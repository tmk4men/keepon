// 利用資格（トライアル / 購入済み / ロック）の判定。
// 端末の日付だけで決まる純粋な計算にして、テストできるようにしてある。

import { addDays, daysBetween, toDateStr } from './state'

export const TRIAL_DAYS = 7

// 課金商品のID（App Store / Google Play で同じものを使う）
export const PRODUCT_TRIAL = 'app.tuzukin.diet.trial7'
export const PRODUCT_FULL = 'app.tuzukin.diet.full'
export const FULL_PRICE_FALLBACK = '¥500'

export type PurchaseState = {
  trialStartedAt: string | null // YYYY-MM-DD。体験を始めた日
  purchased: boolean // フルアクセスを購入済み
  // これまでに見た最後の日付。端末の日付を戻して体験を延ばすのを防ぐ。
  lastSeenDate: string | null
}

export const DEFAULT_PURCHASE: PurchaseState = {
  trialStartedAt: null,
  purchased: false,
  lastSeenDate: null,
}

// 判定に使う「今日」。端末の日付が戻されていたら、これまでに見た最後の日を使う。
function effectiveToday(p: PurchaseState, today: string): string {
  return p.lastSeenDate && p.lastSeenDate > today ? p.lastSeenDate : today
}

// 日付が進んだら記録する（進んだときだけ。戻ったときは無視）
export function touchSeenDate(p: PurchaseState, today: string): PurchaseState {
  if (p.lastSeenDate && p.lastSeenDate >= today) return p
  return { ...p, lastSeenDate: today }
}

export type Access =
  | { kind: 'purchased' }
  | { kind: 'trial'; daysLeft: number }
  | { kind: 'locked'; reason: 'not-started' | 'expired' }

export function accessOn(p: PurchaseState, today: string): Access {
  if (p.purchased) return { kind: 'purchased' }
  if (!p.trialStartedAt) return { kind: 'locked', reason: 'not-started' }

  const now = effectiveToday(p, today)
  // 開始日が未来（保存を書き換えられた）なら今日として扱う。
  // そうしないと毎日「残り7日」になって体験が終わらない。
  const start = p.trialStartedAt > now ? now : p.trialStartedAt
  const left = TRIAL_DAYS - daysBetween(start, now)
  if (left > 0) return { kind: 'trial', daysLeft: left }
  return { kind: 'locked', reason: 'expired' }
}

// 体験が切れる日（この日まで使える）。ウィジェットに渡して、
// アプリを開かないまま期限を過ぎた場合もウィジェット側で止められるようにする。
export function accessUntil(p: PurchaseState, today: string): string {
  const now = effectiveToday(p, today)
  if (!p.trialStartedAt) return now
  const start = p.trialStartedAt > now ? now : p.trialStartedAt
  return addDays(start, TRIAL_DAYS - 1)
}

// 画面を使えるか
export function canUseApp(access: Access): boolean {
  return access.kind !== 'locked'
}

// 残り日数の見せ方。あと1日を「今日まで」と言い換える。
export function trialLabel(daysLeft: number): string {
  if (daysLeft <= 1) return '体験は今日まで'
  return `体験はあと${daysLeft}日`
}

// ストアへの問い合わせ結果を手元の状態に反映する。
// ok は「ストアに聞けたかどうか」。聞けなかった（オフライン等）ときは手元を保つ。
// 聞けたときは purchased をストアの答えで置きかえる。
// これをしないと、返金・購入取消のあとも使えたままになる。
export function mergeStoreState(
  current: PurchaseState,
  result: { ok: boolean; items: { id: string; purchasedAt: number }[] },
): PurchaseState {
  if (!result.ok) return current

  const next: PurchaseState = { ...current }
  next.purchased = result.items.some((o) => o.id === PRODUCT_FULL)

  // 体験の開始日は、ストアが購入日を返せるならそちらを正とする
  // （App Store は ¥0 の体験用商品の購入日を返せるので、再インストールしても
  //  体験期間がリセットされない。Google Play は ¥0 商品を作れないため端末内のみ）。
  const trial = result.items.find(
    (o) => o.id === PRODUCT_TRIAL && o.purchasedAt > 0,
  )
  if (trial) {
    const fromStore = toDateStr(new Date(trial.purchasedAt))
    // 端末側に古い開始日があるなら、早いほうを採用する（体験を伸ばさせない）
    next.trialStartedAt =
      next.trialStartedAt && next.trialStartedAt < fromStore
        ? next.trialStartedAt
        : fromStore
  }
  return next
}

export function normalizePurchase(raw: unknown): PurchaseState {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PURCHASE }
  const r = raw as Record<string, unknown>
  const asDate = (v: unknown): string | null =>
    typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
  return {
    trialStartedAt: asDate(r.trialStartedAt),
    purchased: r.purchased === true,
    lastSeenDate: asDate(r.lastSeenDate),
  }
}
