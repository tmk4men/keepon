# ツヅキン — 止まっても戻れるボディメイク

「トレーニングをやめない」ための復帰支援アプリ。
完璧に続けるのではなく、**止まっても戻れる**状態を作ることに特化しています。

## コンセプト

- **「ゼロ」を作らない** — 1分のストレッチでも「継続成功」として扱う
- **止まったら軽くする** — 数日空くと、メニューが自動で軽量化／復帰モードに切り替わる
- **連続記録ではなく「戻る力」** — 復帰率・戻る速度・崩壊耐性を可視化する

## 実装済み（MVP）

| 画面 | 内容 |
|------|------|
| 初回入力 | 目的（ダイエット/増量）・からだ・無理ない量・目標頻度 |
| 今日 | 今週のペース／メニュー2候補をスワイプ選択／最低ライン。空白日数でモード自動切替、タイマーで計測＆自動記録 |
| きろく | 紙のスタンプカード風カレンダー＋月次集計。日付タップで実施内容をポップアップ |
| 継続力 | 崩壊耐性スコア・復帰率・戻る速度・戻ってこれた回数 |

データは端末の localStorage に保存。サーバー不要で動作します。

## 復帰ロジック

最後に動いた日からの空白日数で「今日のモード」が決まります。すべて端末内の通常ロジックで処理し、外部サービスには依存しません。

- 0〜1日: 通常モード
- 2〜3日: 軽めモード
- 4日〜: 復帰モード（最低ライン中心＋心理復帰メッセージ）

メニューは 目的 × 運動量 × 性別 × 年齢 × 目標頻度 で出し分けます。

## 開発

```bash
npm install
npm run dev      # 開発サーバー
npm run build    # 本番ビルド
npm run preview  # ビルド結果の確認
```

技術構成: Vite + React + TypeScript + Capacitor（Android / iOS）

## 課金（7日間の無料体験 → 買い切り）

アプリ全体が有料です。最初の7日間だけ無料で全機能を試せて、そのあとは買い切りで解除します。
サブスクリプションはありません。

| 商品ID | 種別 | 価格 | 用途 |
|--------|------|------|------|
| `app.tuzukin.diet.trial7` | 非消耗型 | ¥0（ティア0） | 7日間の無料体験の開始記録。**iOSのみ** |
| `app.tuzukin.diet.full` | 非消耗型 | ¥500 | フルアクセス（期限なし） |

`trial7` は App Store の規約 3.1.1 が求める形です。サブスク以外のアプリで期間限定の体験を
提供する場合、価格ティア0の非消耗型を「7日間トライアル」という名前で用意し、**体験を始める前に
「期間」「終わると何が使えなくなるか」「そのあといくら払うか」を明示する**ことが条件になっています。
ロック画面はその3点を必ず出しています。Google Play は ¥0 のアプリ内商品を作れないため、
Android では体験期間を端末内だけで管理します（`trial7` は登録しません）。

**審査メモに書く内容**（App Review へ）:

> 有料販売は `app.tuzukin.diet.full`（非消耗型・買い切り）のみです。
> `app.tuzukin.diet.trial7` は価格ティア0で、無料体験の開始日を記録するためだけに使用します。
> 課金は発生せず、継続請求もありません。ガイドライン 3.1.1 の「非サブスクリプションアプリの
> 無料体験」に沿った実装です。体験の期間・終了後に使えなくなる機能・その後の価格は、
> 体験開始ボタンの前に画面上で明示しています。

判定は `src/entitlement.ts`（純粋関数）に寄せてあります。ストアとのやりとりは `src/purchase.ts`
とネイティブの自作プラグイン `Purchase`（iOS: StoreKit 2 / Android: Play Billing）です。

### ストアへの登録

App Store Connect 側は `store/asc.tuzukin.json` を使って `appstore-connect` スキルの CLI で流します。
先に ASC でアプリレコードを作り、`asc apps` で出た appId とプライバシーポリシーのURLを書き入れてください。

```bash
asc apps                                  # appId を確認
asc-setup store/asc.tuzukin.json          # ドライラン（何も送らない）
asc-setup store/asc.tuzukin.json --yes    # 課金商品と掲載文を反映
```

Google Play 側は `app.tuzukin.diet.full` を1つ、アプリ内アイテム（1回限り）として ¥500 で作ります。
`trial7` は登録しません。

### 防げていないこと

端末内だけで判定しているので、次は防げません。完全に塞ぐにはサーバーとアカウントが要ります。

- **Android の再インストール**で体験がリセットされる（Play が ¥0 商品を扱えず、購入日を照会できないため）。
  iOS は `trial7` の購入日をストアから取るのでリセットされない
- **Web版の localStorage を直接書き換える**と解除できる
- 購入済みかどうかは、ストアに問い合わせできたときは必ずストアの答えで上書きする
  （返金・購入取消でロックに戻る）。オフラインのときだけ手元の状態を保つ

## iOS ビルド（Mac で行う）

Xcode が要るので、この工程だけは Mac で行います。Apple Developer アカウントでサインイン済みの Xcode が前提です。

```bash
npm install
npm run build
npm run sync:ios     # cap sync ios ＋ Package.swift のパス修正
npx cap open ios     # Xcode が開く
```

`npx cap sync ios` を Windows で実行すると `ios/App/CapApp-SPM/Package.swift` のパスが
円記号区切りで書き出され、Mac のビルドが manifest の解析で落ちます。
`npm run sync:ios` はそれを直すところまでやります（Mac で実行しても無害）。

Xcode を開いたあと、最初の1回だけ次を確認します。

1. 左の一覧のいちばん上「App」（青いアイコン）をクリック
2. 中央上の TARGETS で **App** を選び、**Signing & Capabilities** タブを開く
3. Team に自分の Apple Developer チームを選ぶ（Automatically manage signing はオンのまま）
4. 同じ画面に **App Groups** があり、`group.app.tuzukin.diet` にチェックが入っていることを確認する
5. TARGETS を **KeeponWidgetExtension** に切り替えて、3と4を同じように設定する

`group.app.tuzukin.diet` はアプリ本体とウィジェットがデータを受け渡すための箱です。両方に同じものが入っていないとウィジェットが「アプリを開いて今日のメニューを表示」のままになります。

あとは実機を繋いで、左上の再生ボタン（▶）で起動します。

### iOS 側の構成

| 場所 | 中身 |
|------|------|
| `ios/App/App` | アプリ本体。`KeeponWidgetPlugin.swift` が JS ↔ ウィジェットの橋渡し |
| `ios/App/Shared` | アプリとウィジェットで共有する状態（App Group の UserDefaults） |
| `ios/App/KeeponWidget` | ホーム画面ウィジェット（WidgetKit） |

ウィジェット内のボタンで直接開始・完了できるのは iOS 17 以降です。iOS 16 以下ではボタンの代わりに案内が出て、タップするとアプリが開きます。

アイコンとスプラッシュは `python tools/gen-icons.py` で `public/icon.png` から作り直せます
（iOS の AppIcon 全サイズ、スプラッシュ、Web/PWA 用の 180・192・512・maskable）。

`npm run build` のあと、次の2つでネイティブ経路を通しで確認できます（ストアとウィジェットを偽装して WebKit で実行）。

```bash
python tools/test-widget-bridge.py   # 開始の引き継ぎ・完了の取り込み・日付リセット・体験切れのロック
python tools/test-paywall.py         # 体験の開始と期限・購入・復元・返金・価格取得の失敗
```

**注意**: `npx cap add ios` を再実行すると `ios/` が作り直され、ウィジェットのターゲット設定（`project.pbxproj` に手で足した部分）が消えます。通常は `npx cap sync ios` だけを使ってください。
