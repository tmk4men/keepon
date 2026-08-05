"""ウィジェット連携を WebKit 上で実際に動かして確かめる（iOS 経路と Android 経路の両方）。

ネイティブ層を JS で偽装し、Swift 側（KeeponWidgetPlugin / KeeponWidgetShared）と
Java 側（WidgetState / WidgetActionReceiver）と同じ意味論を持たせたうえで、
アプリの取り込み処理を通しで検証する。

  A ウィジェットで開始 → アプリを開くとタイマーを引き継ぐ（消えない）
  B ウィジェットで完了 → アプリを開くと記録が入り、pending が消える
  C 前日の状態は引き継がない（日付が変わったらリセット）
  D アプリ側の状態変化がウィジェットへ書き戻る
  E 復帰を繰り返しても二重取り込みしない

事前に `npm run build` を実行しておくこと（dist/ を見るため）。
必要なもの: pip install playwright && python -m playwright install webkit
使い方: python tools/test-widget-bridge.py
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
PORT = 8124
TODAY = time.strftime("%Y-%m-%d")


def day_ago(n: int) -> str:
    return time.strftime("%Y-%m-%d", time.localtime(time.time() - n * 86400))


YESTERDAY = day_ago(1)

KEY_STATE = "keepon_widget_state"
KEY_PENDING = "keepon_widget_pending"

SEED = {
    "version": 4,
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
    "createdAt": TODAY,
    "timer": None,
    "notify": {"enabled": True, "time": "20:00"},
    # ウィジェットの検証なので、課金のロックは外した状態にしておく
    "purchase": {"trialStartedAt": TODAY, "purchased": True},
}

NATIVE_MOCK = """
window.CapacitorCustomPlatform = { name: '__PLATFORM__' };
window.__widgetStore = {};

const todayStr = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// KeeponWidgetState.read() / WidgetState.read() と同じ日次リセット
const readState = () => {
  const raw = window.__widgetStore['__KEY_STATE__'];
  const s = raw ? JSON.parse(raw) : {};
  const out = {
    date: s.date ?? null,
    todayMenu: s.todayMenu ?? null,
    fullDone: s.fullDone === true,
    timerRunning: s.timerRunning === true,
    timerStartedAt: typeof s.timerStartedAt === 'number' ? s.timerStartedAt : 0,
    locked: s.locked === true,
  };
  if (out.date && out.date !== todayStr()) {
    out.fullDone = false;
    out.timerRunning = false;
    out.timerStartedAt = 0;
  }
  return out;
};

const promiseMethods = (names) => names.map((m) => ({ name: m, rtype: 'promise' }));
window.Capacitor = {
  PluginHeaders: [
    { name: 'KeeponWidget', methods: promiseMethods(['sync', 'pullPending', 'getState', 'update']) },
    { name: 'Preferences', methods: promiseMethods(['get', 'set', 'remove', 'keys', 'clear', 'configure', 'migrate', 'removeOld']) },
    { name: 'LocalNotifications', methods: promiseMethods(['schedule', 'cancel', 'requestPermissions', 'checkPermissions']) },
  ],
  nativePromise: async (plugin, method, options) => {
    if (plugin === 'KeeponWidget') {
      // iOS: 状態の読み書きごとネイティブが持つ
      if (method === 'sync') {
        window.__widgetStore['__KEY_STATE__'] = JSON.stringify({
          date: options.date || todayStr(),
          todayMenu: options.todayMenu ?? null,
          fullDone: options.fullDone === true,
          timerRunning: options.timerRunning === true,
          timerStartedAt: options.timerStartedAt || 0,
          locked: options.locked === true,
        });
        return {};
      }
      if (method === 'getState') {
        const s = readState();
        return { state: {
          date: s.date ?? '',
          todayMenu: s.todayMenu ?? '',
          fullDone: s.fullDone,
          timerRunning: s.timerRunning,
          timerStartedAt: s.timerStartedAt,
          locked: s.locked,
        } };
      }
      if (method === 'pullPending') {
        const raw = window.__widgetStore['__KEY_PENDING__'];
        const list = raw ? JSON.parse(raw) : [];
        if (list.length) delete window.__widgetStore['__KEY_PENDING__'];
        return { records: list };
      }
      if (method === 'update') return {};
    }
    if (plugin === 'Preferences') {
      // Android: SharedPreferences 相当
      if (method === 'get') return { value: window.__widgetStore[options.key] ?? null };
      if (method === 'set') { window.__widgetStore[options.key] = options.value; return {}; }
      if (method === 'remove') { delete window.__widgetStore[options.key]; return {}; }
      return {};
    }
    if (plugin === 'LocalNotifications') {
      if (method === 'requestPermissions' || method === 'checkPermissions') return { display: 'granted' };
      return {};
    }
    return {};
  },
};

// ウィジェットのボタン操作（KeeponWidgetAction / WidgetActionReceiver と同じ）
window.__widgetStart = (agoMs) => {
  const s = readState();
  if (s.locked || s.fullDone || s.timerRunning) return;
  s.date = todayStr();
  s.timerRunning = true;
  s.timerStartedAt = Date.now() - (agoMs || 0);
  window.__widgetStore['__KEY_STATE__'] = JSON.stringify(s);
};
window.__widgetStop = () => {
  const s = readState();
  if (s.locked || !s.timerRunning) return;
  const minutes = Math.max(1, Math.round((Date.now() - s.timerStartedAt) / 60000));
  const raw = window.__widgetStore['__KEY_PENDING__'];
  const list = raw ? JSON.parse(raw) : [];
  list.push({ date: todayStr(), kind: 'full', menuTitle: s.todayMenu || '今日のメニュー', minutes });
  window.__widgetStore['__KEY_PENDING__'] = JSON.stringify(list);
  s.date = todayStr();
  s.timerRunning = false;
  s.timerStartedAt = 0;
  s.fullDone = true;
  window.__widgetStore['__KEY_STATE__'] = JSON.stringify(s);
};
"""

results = []


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    line = ("PASS " if ok else "FAIL ") + name + ("  " + detail if detail else "")
    sys.stdout.buffer.write(line.encode("utf-8") + b"\n")
    sys.stdout.flush()


def make_page(ctx, platform, presets="", state=None):
    page = ctx.new_page()
    page.on("pageerror", lambda e: check(f"[{platform}] pageerror なし", False, str(e)))
    mock = (
        NATIVE_MOCK.replace("__PLATFORM__", platform)
        .replace("__KEY_STATE__", KEY_STATE)
        .replace("__KEY_PENDING__", KEY_PENDING)
    )
    seed = json.dumps(state if state is not None else SEED)
    page.add_init_script(
        mock
        + f"try {{ localStorage.setItem('keepon.state.v1', {json.dumps(seed)}) }} catch (e) {{}}"
        + presets
    )
    return page


def run_platform(ctx, url, platform):
    tag = f"[{platform}]"

    # D: アプリ→ウィジェットの書き戻し
    page = make_page(ctx, platform)
    page.goto(url, wait_until="networkidle")
    page.wait_for_timeout(900)
    state = page.evaluate(f"() => JSON.parse(window.__widgetStore['{KEY_STATE}'] || 'null')")
    check(
        f"{tag} D アプリ起動でウィジェットにメニューが書き戻る",
        bool(state and state["date"] == TODAY and state["todayMenu"]),
        json.dumps(state, ensure_ascii=False),
    )
    page.close()

    # A: ウィジェットで開始 → 引き継ぐ
    started_state = json.dumps(
        {
            "date": TODAY,
            "todayMenu": "スクワット 5回",
            "fullDone": False,
            "timerRunning": True,
            "timerStartedAt": int(time.time() * 1000) - 5 * 60000,
        }
    )
    page = make_page(
        ctx,
        platform,
        f"window.addEventListener('DOMContentLoaded', () => {{ window.__widgetStore['{KEY_STATE}'] = {json.dumps(started_state)}; }});",
    )
    page.goto(url, wait_until="networkidle")
    page.wait_for_timeout(1200)
    bar = page.locator(".timer-bar")
    shown = bar.inner_text().replace("\n", " / ") if bar.count() > 0 else ""
    check(
        f"{tag} A ウィジェットで開始したタイマーをアプリが引き継ぐ",
        bar.count() > 0 and ("05:0" in shown or "05:1" in shown),
        repr(shown),
    )
    after = page.evaluate(f"() => JSON.parse(window.__widgetStore['{KEY_STATE}'])")
    check(
        f"{tag} A2 引き継いだあともウィジェットは実行中のまま",
        after["timerRunning"] is True
        and abs(after["timerStartedAt"] - json.loads(started_state)["timerStartedAt"]) < 2000,
        json.dumps(after, ensure_ascii=False),
    )
    page.screenshot(path=str(OUT / f"bridge-{platform}-A-adopt-timer.png"))
    page.close()

    # B: ウィジェットで完了 → 記録が入る
    running = json.dumps(
        {
            "date": TODAY,
            "todayMenu": "スクワット 5回",
            "fullDone": False,
            "timerRunning": True,
            "timerStartedAt": int(time.time() * 1000) - 12 * 60000,
        }
    )
    page = make_page(
        ctx,
        platform,
        "window.addEventListener('DOMContentLoaded', () => {"
        f"window.__widgetStore['{KEY_STATE}'] = {json.dumps(running)};"
        "window.__widgetStop(); });",
    )
    page.goto(url, wait_until="networkidle")
    page.wait_for_timeout(1200)
    records = page.evaluate("() => JSON.parse(localStorage.getItem('keepon.state.v1')).records")
    pending_left = page.evaluate(f"() => window.__widgetStore['{KEY_PENDING}'] ?? null")
    today_rec = next((r for r in records if r["date"] == TODAY), None)
    check(
        f"{tag} B ウィジェットの完了がアプリの記録になる",
        bool(today_rec and today_rec["full"] and today_rec["minutes"] == 12),
        json.dumps(today_rec, ensure_ascii=False),
    )
    check(f"{tag} B2 取り込んだ pending は消える", pending_left is None, str(pending_left))
    page.get_by_role("button", name="きろく").click()
    page.wait_for_timeout(600)
    page.screenshot(path=str(OUT / f"bridge-{platform}-B-record-from-widget.png"))
    page.close()

    # C: 前日の状態は引き継がない
    stale = json.dumps(
        {
            "date": YESTERDAY,
            "todayMenu": "昨日のメニュー",
            "fullDone": True,
            "timerRunning": True,
            "timerStartedAt": int(time.time() * 1000) - 20 * 3600 * 1000,
        }
    )
    page = make_page(
        ctx,
        platform,
        f"window.addEventListener('DOMContentLoaded', () => {{ window.__widgetStore['{KEY_STATE}'] = {json.dumps(stale)}; }});",
    )
    page.goto(url, wait_until="networkidle")
    page.wait_for_timeout(1200)
    check(f"{tag} C 前日のタイマーは引き継がない", page.locator(".timer-bar").count() == 0)
    state4 = page.evaluate(f"() => JSON.parse(window.__widgetStore['{KEY_STATE}'])")
    check(
        f"{tag} C2 前日の達成済みは今日に持ち越さない",
        state4["date"] == TODAY and state4["fullDone"] is False,
        json.dumps(state4, ensure_ascii=False),
    )
    page.close()

    # E: 復帰を繰り返しても二重取り込みしない
    pending = json.dumps([{"date": TODAY, "kind": "full", "menuTitle": "テスト", "minutes": 7}])
    page = make_page(
        ctx,
        platform,
        f"window.addEventListener('DOMContentLoaded', () => {{ window.__widgetStore['{KEY_PENDING}'] = {json.dumps(pending)}; }});",
    )
    page.goto(url, wait_until="networkidle")
    page.wait_for_timeout(1000)
    for _ in range(3):
        page.evaluate("() => document.dispatchEvent(new Event('visibilitychange'))")
        page.wait_for_timeout(400)
    rec = page.evaluate(
        "() => JSON.parse(localStorage.getItem('keepon.state.v1')).records.find(r => r.date === '%s')"
        % TODAY
    )
    check(
        f"{tag} E 復帰を繰り返しても記録が二重に増えない",
        bool(rec and rec["minutes"] == 7),
        json.dumps(rec, ensure_ascii=False),
    )
    page.close()

    # F: 体験切れのときはウィジェットもロックされる（課金の抜け道を作らない）
    expired = json.loads(json.dumps(SEED))
    expired["purchase"] = {"trialStartedAt": day_ago(9), "purchased": False}
    page = make_page(ctx, platform, state=expired)
    page.goto(url, wait_until="networkidle")
    page.wait_for_timeout(1000)
    state_f = page.evaluate(f"() => JSON.parse(window.__widgetStore['{KEY_STATE}'] || 'null')")
    check(
        f"{tag} F 体験切れならウィジェットに locked を伝える",
        bool(state_f and state_f["locked"] is True and state_f["timerRunning"] is False),
        json.dumps(state_f, ensure_ascii=False),
    )
    # ロック中にウィジェットのボタンが押されても記録は増えない
    page.evaluate("() => window.__widgetStart(0)")
    state_g = page.evaluate(f"() => JSON.parse(window.__widgetStore['{KEY_STATE}'])")
    check(
        f"{tag} F2 ロック中はウィジェットから開始できない",
        state_g["timerRunning"] is False,
        json.dumps(state_g, ensure_ascii=False),
    )
    page.close()


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
        for platform in ("ios", "android"):
            run_platform(ctx, url, platform)
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
