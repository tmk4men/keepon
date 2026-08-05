// 体験の開始画面と、体験が終わったあとのロック画面。
// App Store の規約（3.1.1）に合わせて、体験を始める前に
// 「期間」「終わると何が使えなくなるか」「そのあといくら払うか」を必ず出す。

import { TRIAL_DAYS } from '../entitlement'
import { IconSpark } from './icons'

type Props = {
  mode: 'start' | 'expired'
  price: string
  busy: boolean
  message: string | null
  canBuy: boolean // ストアが使える端末か（Webは使えない）
  priceKnown: boolean // ストアから価格を取れているか
  onRetryStore: () => void
  onStartTrial: () => void
  onBuy: () => void
  onRestore: () => void
  onExport: () => void
}

const LOCKED_ITEMS = [
  '今日のメニューと最低ライン',
  'タイマーと記録',
  'きろく（カレンダー・月次集計）',
  '継続力（スコア・復帰率・活動量）',
  'リマインド通知とウィジェット',
]

export default function Paywall({
  mode,
  price,
  busy,
  message,
  canBuy,
  priceKnown,
  onRetryStore,
  onStartTrial,
  onBuy,
  onRestore,
  onExport,
}: Props) {
  const start = mode === 'start'
  // 価格が分からないまま体験を始めさせない（あとでいくら払うかを必ず先に出す）
  const blocked = canBuy && !priceKnown

  return (
    <div className="paywall">
      <div className="paywall-inner">
        <img className="paywall-logo" src="./icon-192.png" alt="" />
        <h1>ツヅキン</h1>

        {start ? (
          <p className="paywall-catch">
            まず{TRIAL_DAYS}日間、
            <br />
            ぜんぶ無料でためせます。
          </p>
        ) : (
          <p className="paywall-catch">
            {TRIAL_DAYS}日間の体験が
            <br />
            終わりました。
          </p>
        )}

        <div className="paywall-box">
          <div className="paywall-box-head">
            <IconSpark size={17} />
            <b>{start ? `${TRIAL_DAYS}日間の無料体験について` : '続けるには'}</b>
          </div>
          {start ? (
            <ul className="paywall-list">
              <li>
                体験は<b>{TRIAL_DAYS}日間</b>。この間はすべての機能を使えます。
              </li>
              <li>
                {TRIAL_DAYS}日を過ぎると、次のものが使えなくなります。
                <span>{LOCKED_ITEMS.join(' ／ ')}</span>
              </li>
              <li>
                そのあとも使うには <b>{price}（買い切り）</b>。
                月額はありません。一度払えばずっと使えます。
              </li>
              <li>記録は端末に残ります。購入すればそのまま続きから使えます。</li>
            </ul>
          ) : (
            <ul className="paywall-list">
              <li>
                <b>{price}（買い切り）</b>で、すべての機能がまた使えるようになります。
                月額はありません。
              </li>
              <li>
                これまでの記録はこの端末に残っています。購入すれば、そのまま
                続きから使えます。
              </li>
              <li>
                一度購入すれば、同じアカウントで入れ直しても使えます
                （「購入を復元する」から）。
              </li>
            </ul>
          )}
        </div>

        {message && <p className="paywall-msg">{message}</p>}

        {blocked && (
          <p className="paywall-msg">
            ストアの価格を確認できませんでした。通信を確かめて、もう一度お試しください。
          </p>
        )}

        {blocked ? (
          <button className="btn btn-primary paywall-cta" onClick={onRetryStore}>
            もう一度読み込む
          </button>
        ) : start ? (
          <button
            className="btn btn-primary paywall-cta"
            onClick={onStartTrial}
            disabled={busy}
          >
            {busy ? '準備しています…' : `${TRIAL_DAYS}日間、無料ではじめる`}
          </button>
        ) : canBuy ? (
          <button
            className="btn btn-primary paywall-cta"
            onClick={onBuy}
            disabled={busy}
          >
            {busy ? '処理しています…' : `${price}でずっと使う`}
          </button>
        ) : (
          <p className="paywall-store-note">
            この続きはアプリ版でご利用いただけます。
            <br />
            App Store / Google Play で「ツヅキン」を探してください。
          </p>
        )}

        {canBuy && (
          <button className="paywall-restore" onClick={onRestore} disabled={busy}>
            購入を復元する
          </button>
        )}

        {!start && (
          // 買わない人でも自分の記録は持ち出せるようにしておく
          <button className="paywall-restore" onClick={onExport}>
            これまでの記録を書き出す
          </button>
        )}
      </div>
    </div>
  )
}
