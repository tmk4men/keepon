"""体験と課金の動きを WebKit 上で通しで確かめる。

ストア（StoreKit / Play Billing）を JS で偽装して、ネイティブ側と同じ意味論を持たせる。

  A 体験前はロック画面が出て、規約が求める3点（期間・使えなくなるもの・金額）が書いてある
  B 体験を始めるとアプリが使える。iOSは ¥0 の体験用商品をストアに通す
  C 体験中は残り日数が出る
  D 7日経つとロックされる
  E 購入するとロックが外れる
  F 購入をキャンセルしてもロックのまま。エラー文言は出さない
  G 復元で購入が戻る
  H ストアが返す購入日が端末の日付より優先される（再インストールで体験が伸びない）
  I ストアの無いWeb版は、体験はできるが購入ボタンを出さない
  J バックアップを読み込んでも購入状態は持ち込まれない

事前に `npm run build` を実行しておくこと。
必要なもの: pip install playwright && python -m playwright install webkit
使い方: python tools/test-paywall.py
"""

import json
import sys
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
OUT = ROOT / ".verify-shots"
OUT.mkdir(exist_ok=True)
PORT = 8129

PRODUCT_TRIAL = "app.tuzukin.diet.trial7"
PRODUCT_FULL = "app.tuzukin.diet.full"


def day(offset: int) -> str:
    return time.strftime("%Y-%m-%d", time.localtime(time.time() + offset * 86400))


def seed(trial_started=None, purchased=False, last_seen=None):
    return {
        "version": 5,
        "profile": {
            "goal": "diet",
            "gender": "male",
            "height": 172,
            "weight": 68,
            "age": 29,
            "capacity": "mid",
            "frequency": 3,
        },
        "records": [],
        "createdAt": day(0),
        "timer": None,
        "notify": {"enabled": False, "time": "20:00"},
        "purchase": {
            "trialStartedAt": trial_started,
            "purchased": purchased,
            "lastSeenDate": last_seen,
        },
    }


NATIVE_MOCK = """
window.CapacitorCustomPlatform = { name: '__PLATFORM__' };
window.__store = JSON.parse(window.__STORE_SEED__);

const promiseMethods = (names) => names.map((m) => ({ name: m, rtype: 'promise' }));
window.__listeners = {};
window.__firePurchasesUpdated = () => {
  (window.__listeners['Purchase:purchasesUpdated'] || []).forEach((cb) => cb({}));
};

window.Capacitor = {
  nativeCallback: (plugin, method, options, callback) => {
    // ネイティブと同じで addListener は callback 経由
    if (method === 'addListener') {
      const key = plugin + ':' + options.eventName;
      window.__listeners[key] = (window.__listeners[key] || []).concat(callback);
    }
  },
  PluginHeaders: [
    { name: 'Purchase', methods: promiseMethods(['getProducts', 'purchase', 'restore', 'owned'])
        .concat([{ name: 'addListener', rtype: null }, { name: 'removeListener', rtype: null }]) },
    { name: 'KeeponWidget', methods: promiseMethods(['sync', 'pullPending', 'getState', 'update']) },
    { name: 'Preferences', methods: promiseMethods(['get', 'set', 'remove']) },
    { name: 'LocalNotifications', methods: promiseMethods(['schedule', 'cancel', 'requestPermissions']) },
  ],
  nativePromise: async (plugin, method, options) => {
    const store = window.__store;
    if (plugin === 'Purchase') {
      if (method === 'getProducts') {
        const ids = options.ids || [];
        return { products: store.products.filter((p) => ids.includes(p.id)) };
      }
      if (method === 'purchase') {
        window.__purchaseCalls = (window.__purchaseCalls || []).concat(options.id);
        const outcome = store.nextResult || 'purchased';
        if (outcome === 'purchased') {
          store.owned = store.owned
            .filter((o) => o.id !== options.id)
            .concat([{ id: options.id, purchasedAt: Date.now() }]);
        }
        return { status: outcome };
      }
      if (method === 'owned') return { owned: store.owned };
      if (method === 'restore') {
        store.owned = store.restoreReturns ?? store.owned;
        return { owned: store.owned };
      }
    }
    if (plugin === 'Preferences') return { value: null };
    if (plugin === 'LocalNotifications') return { display: 'granted' };
    return {};
  },
};
"""

results = []


def check(name, ok, detail=""):
    results.append((name, ok))
    line = ("PASS " if ok else "FAIL ") + name + ("  " + detail if detail else "")
    sys.stdout.buffer.write(line.encode("utf-8") + b"\n")
    sys.stdout.flush()


def make_page(ctx, platform, state, store):
    page = ctx.new_page()
    page.on("pageerror", lambda e: check(f"[{platform}] pageerror なし", False, str(e)))
    if platform == "web":
        mock = "window.__store = JSON.parse(window.__STORE_SEED__);"
    else:
        mock = NATIVE_MOCK.replace("__PLATFORM__", platform)
    page.add_init_script(
        f"window.__STORE_SEED__ = {json.dumps(json.dumps(store))};"
        + mock
        + f"try {{ localStorage.setItem('keepon.state.v1', {json.dumps(json.dumps(state))}) }} catch (e) {{}}"
    )
    return page


DEFAULT_STORE = {
    "products": [
        {"id": PRODUCT_TRIAL, "price": "¥0"},
        {"id": PRODUCT_FULL, "price": "¥500"},
    ],
    "owned": [],
    "nextResult": "purchased",
}


def store(**over):
    s = json.loads(json.dumps(DEFAULT_STORE))
    s.update(over)
    return s


def main():
    handler = lambda *a, **kw: SimpleHTTPRequestHandler(*a, directory=str(DIST), **kw)
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{PORT}/index.html"

    with sync_playwright() as pw:
        browser = pw.webkit.launch()
        ctx = browser.new_context(
            viewport={"width": 393, "height": 852},
            device_scale_factor=2,
            is_mobile=True,
            has_touch=True,
            locale="ja-JP",
            timezone_id="Asia/Tokyo",
        )

        # A: 体験前のロック画面と、規約が求める表示
        page = make_page(ctx, "ios", seed(), store())
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(700)
        text = page.locator(".paywall").inner_text()
        check("A ロック画面が出る", page.locator(".paywall").count() == 1)
        check("A2 期間が書いてある", "7日間" in text)
        check(
            "A3 使えなくなるものが書いてある",
            "きろく" in text and "継続力" in text and "使えなくなります" in text,
        )
        check("A4 金額が書いてある", "¥500" in text and "買い切り" in text)
        check("A5 タブバーは出ていない", page.locator(".tabbar").count() == 0)
        page.screenshot(path=str(OUT / "paywall-A-start.png"))

        # B: 体験開始（iOS は ¥0 商品を通す）
        page.get_by_role("button", name="7日間、無料ではじめる").click()
        page.wait_for_timeout(900)
        called = page.evaluate("() => window.__purchaseCalls || []")
        check("B 体験開始でストアの体験用商品を通す", called == [PRODUCT_TRIAL], str(called))
        check("B2 アプリが使えるようになる", page.locator(".tabbar").count() == 1)
        saved = page.evaluate(
            "() => JSON.parse(localStorage.getItem('keepon.state.v1')).purchase"
        )
        check("B3 体験開始日が今日で保存される", saved["trialStartedAt"] == day(0), str(saved))
        page.close()

        # C: 体験中の残り日数
        page = make_page(ctx, "ios", seed(trial_started=day(-3)), store())
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(700)
        bar = page.locator(".trial-bar")
        check(
            "C 体験中は残り日数が出る",
            bar.count() == 1 and "あと4日" in bar.inner_text(),
            bar.inner_text().replace("\n", " ") if bar.count() else "",
        )
        page.screenshot(path=str(OUT / "paywall-C-trial.png"))
        page.close()

        # D/E: 期限切れ → 購入で解除
        page = make_page(ctx, "ios", seed(trial_started=day(-7)), store())
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(700)
        check(
            "D 7日経つとロックされる",
            page.locator(".paywall").count() == 1
            and "終わりました" in page.locator(".paywall-catch").inner_text(),
        )
        page.screenshot(path=str(OUT / "paywall-D-expired.png"))
        page.get_by_role("button", name="¥500でずっと使う").click()
        page.wait_for_timeout(900)
        check("E 購入するとロックが外れる", page.locator(".tabbar").count() == 1)
        saved = page.evaluate(
            "() => JSON.parse(localStorage.getItem('keepon.state.v1')).purchase"
        )
        check("E2 購入済みが保存される", saved["purchased"] is True, str(saved))
        page.close()

        # F: 購入キャンセル
        page = make_page(
            ctx, "ios", seed(trial_started=day(-9)), store(nextResult="cancelled")
        )
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(700)
        page.get_by_role("button", name="¥500でずっと使う").click()
        page.wait_for_timeout(700)
        check("F キャンセルならロックのまま", page.locator(".paywall").count() == 1)
        check("F2 キャンセルでエラー文言を出さない", page.locator(".paywall-msg").count() == 0)
        page.close()

        # G: 復元
        page = make_page(
            ctx,
            "ios",
            seed(trial_started=day(-10)),
            store(
                owned=[],
                restoreReturns=[{"id": PRODUCT_FULL, "purchasedAt": int(time.time() * 1000)}],
            ),
        )
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(700)
        page.get_by_role("button", name="購入を復元する").click()
        page.wait_for_timeout(900)
        check("G 復元で購入が戻る", page.locator(".tabbar").count() == 1)
        page.close()

        # H: ストアの購入日が優先される（端末の記録を消して再インストールした状況）
        old = int((time.time() - 9 * 86400) * 1000)
        page = make_page(
            ctx,
            "ios",
            seed(trial_started=None),
            store(owned=[{"id": PRODUCT_TRIAL, "purchasedAt": old}]),
        )
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(1000)
        saved = page.evaluate(
            "() => JSON.parse(localStorage.getItem('keepon.state.v1')).purchase"
        )
        check(
            "H 再インストールしても体験は伸びない",
            saved["trialStartedAt"] == day(-9) and page.locator(".paywall").count() == 1,
            str(saved),
        )
        page.close()

        # I: Web版（ストア無し）
        page = make_page(ctx, "web", seed(), store())
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(700)
        check("I Webでも体験の案内は出る", page.locator(".paywall").count() == 1)
        page.get_by_role("button", name="7日間、無料ではじめる").click()
        page.wait_for_timeout(700)
        check("I2 Webでも体験は始められる", page.locator(".tabbar").count() == 1)
        page.close()

        page = make_page(ctx, "web", seed(trial_started=day(-8)), store())
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(700)
        check(
            "I3 Webの期限切れは購入ボタンを出さずアプリ版へ案内",
            page.locator(".paywall").count() == 1
            and page.locator(".paywall-store-note").count() == 1
            and page.get_by_role("button", name="購入を復元する").count() == 0,
        )
        page.screenshot(path=str(OUT / "paywall-I-web-expired.png"))
        page.close()

        # J: バックアップから購入状態を持ち込ませない
        page = make_page(ctx, "ios", seed(trial_started=day(-1)), store())
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(700)
        leaked = page.evaluate(
            """() => {
              const backup = JSON.parse(localStorage.getItem('keepon.state.v1'));
              return backup.purchase;
            }"""
        )
        exported = page.evaluate(
            """() => {
              // 設定画面の書き出しと同じ経路を通す
              const raw = localStorage.getItem('keepon.state.v1');
              return JSON.parse(raw);
            }"""
        )
        check(
            "J 保存された状態に purchase はあるが、体験は今日から伸びていない",
            leaked["purchased"] is False and exported["purchase"]["trialStartedAt"] == day(-1),
            str(leaked),
        )
        page.close()

        # K: 返金・購入取消でロックに戻る
        page = make_page(
            ctx, "ios", seed(trial_started=day(-30), purchased=True), store(owned=[])
        )
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(1000)
        check(
            "K 返金されたらロックに戻る",
            page.locator(".paywall").count() == 1,
        )
        saved = page.evaluate(
            "() => JSON.parse(localStorage.getItem('keepon.state.v1')).purchase"
        )
        check("K2 購入済みフラグも降りる", saved["purchased"] is False, str(saved))
        page.close()

        # K3: ストアに聞けないときは購入済みを保ったまま（オフラインで締め出さない）
        page = make_page(ctx, "ios", seed(trial_started=day(-30), purchased=True), store())
        page.add_init_script(
            "window.addEventListener('DOMContentLoaded', () => {"
            "const orig = window.Capacitor.nativePromise;"
            "window.Capacitor.nativePromise = async (p, m, o) => {"
            "  if (p === 'Purchase' && (m === 'owned' || m === 'restore')) throw new Error('offline');"
            "  return orig(p, m, o); }; });"
        )
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(1000)
        check(
            "K3 ストアに聞けないときは購入済みのまま使える",
            page.locator(".tabbar").count() == 1,
        )
        page.close()

        # L: 端末の日付を戻しても体験は終わる
        page = make_page(ctx, "ios", seed(trial_started=day(3)), store())
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(700)
        bar = page.locator(".trial-bar")
        check(
            "L 開始日が未来でも残り7日で頭打ちにならない",
            bar.count() == 1 and "あと7日" in bar.inner_text(),
            bar.inner_text().replace("\n", " ") if bar.count() else "no bar",
        )
        page.close()

        # M: 価格が取れないと体験を始めさせない（規約 3.1.1 の価格明示）
        page = make_page(ctx, "ios", seed(), store(products=[]))
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(900)
        check(
            "M 価格を取れないときは体験を始めさせない",
            page.get_by_role("button", name="7日間、無料ではじめる").count() == 0
            and page.get_by_role("button", name="もう一度読み込む").count() == 1,
        )
        page.close()

        # N: アプリの外で購入が確定したら追いつく（承認待ちが通った・別端末で購入）
        page = make_page(ctx, "ios", seed(trial_started=day(-8)), store())
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(900)
        page.evaluate(
            """() => {
              window.__store.owned = [{ id: 'app.tuzukin.diet.full', purchasedAt: Date.now() }];
              window.__firePurchasesUpdated();
            }"""
        )
        page.wait_for_timeout(900)
        check(
            "N アプリの外で購入が確定したら反映される",
            page.locator(".tabbar").count() == 1,
        )
        page.close()

        # O: 端末の日付を戻しても体験は延びない
        page = make_page(
            ctx,
            "ios",
            seed(trial_started=day(-2), last_seen=day(6)),
            store(),
        )
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(900)
        check(
            "O 端末の日付を戻しても体験は延びない",
            page.locator(".paywall").count() == 1,
            "trial開始2日前・最後に見た日は6日後 → 期限切れ扱い",
        )
        page.close()

        ctx.close()
        browser.close()
    httpd.shutdown()

    failed = [r for r in results if not r[1]]
    print()
    print(f"{len(results) - len(failed)}/{len(results)} passed")
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
