// 復帰支援のコアロジック。連続記録ではなく「止まっても戻れるか」を扱う。

import {
  addDays,
  daysBetween,
  recordOn,
  type AppState,
  type DayStatus,
} from './state'
import {
  pickLightMenu,
  pickMinimumMenu,
  pickNormalMenu,
  type Menu,
} from './menus'

export type DailyMode = 'normal' | 'light' | 'comeback'

export type DailyPlan = {
  mode: DailyMode
  menu: Menu // 今日やること（空白日数に応じて負荷が変わる）
  minimum: Menu // 最低ライン（ゼロを作らないための保険）
  gapDays: number // 最後に動いた日からの日数
  comebackNote: string | null // 復帰モード時の心理復帰メッセージ
}

const ACTIVE: DayStatus[] = ['full', 'minimum']

function isActive(s: DayStatus | undefined): boolean {
  return s === 'full' || s === 'minimum'
}

// 最後に「動いた日」（full/minimum）を探す。無ければ null。
function lastActiveDate(state: AppState, today: string): string | null {
  let best: string | null = null
  for (const r of state.records) {
    if (r.date <= today && isActive(r.status)) {
      if (best === null || r.date > best) best = r.date
    }
  }
  return best
}

// 今日のプランを組み立てる（AIではなく通常ロジック）
export function buildDailyPlan(state: AppState, today: string): DailyPlan {
  const profile = state.profile!
  const dayIndex = Math.max(0, daysBetween(state.createdAt, today))

  const lastActive = lastActiveDate(state, today)
  // 一度も動いていない場合は「登録日からの経過」を空白とみなす
  const gapDays = lastActive
    ? daysBetween(lastActive, today)
    : daysBetween(state.createdAt, today)

  let mode: DailyMode
  if (gapDays <= 1) mode = 'normal'
  else if (gapDays <= 3) mode = 'light'
  else mode = 'comeback'

  const minimum = pickMinimumMenu(dayIndex)

  let menu: Menu
  if (mode === 'normal') {
    menu = pickNormalMenu(profile.goal, profile.capacity, dayIndex)
  } else if (mode === 'light') {
    menu = pickLightMenu(profile.goal, dayIndex)
  } else {
    // 復帰モードは「今日やること」も最低ラインに寄せる
    menu = minimum
  }

  return { mode, menu, minimum, gapDays, comebackNote: comebackNote(mode, gapDays) }
}

function comebackNote(mode: DailyMode, gapDays: number): string | null {
  if (mode === 'normal') return null
  if (mode === 'light') {
    return '数日空いても大丈夫。今日は軽めにして、リズムだけ取り戻そう。'
  }
  if (gapDays <= 6) {
    return 'ひさしぶり。ここで戻れたら、それが一番すごいこと。最低ラインでも100点。'
  }
  return '間が空いた＝終わり、じゃない。今日できる一番小さいことから、もう一度。'
}

// ---- 記録タイムライン（カレンダー表示・指標算出の共通土台） ----

export type TimelineStatus =
  | 'full'
  | 'minimum'
  | 'rest'
  | 'missed' // 過去日で記録なし＝未達成
  | 'pending' // 今日でまだ未記録
  | 'future'

export type TimelineDay = { date: string; status: TimelineStatus }

export function buildTimeline(
  state: AppState,
  today: string,
  fromDate?: string,
): TimelineDay[] {
  const start = fromDate ?? state.createdAt
  const days: TimelineDay[] = []
  let cursor = start
  // 念のため上限（5年）
  for (let i = 0; i < 365 * 5; i++) {
    let status: TimelineStatus
    const rec = recordOn(state.records, cursor)
    if (cursor > today) status = 'future'
    else if (rec) status = rec.status
    else if (cursor === today) status = 'pending'
    else status = 'missed'
    days.push({ date: cursor, status })
    if (cursor >= today) break
    cursor = addDays(cursor, 1)
  }
  return days
}

// ---- 継続評価の指標（復帰率・戻る速度・崩壊耐性） ----

export type RecoveryLevel = 'high' | 'mid' | 'low' | 'new'

export type Metrics = {
  hasData: boolean
  daysElapsed: number
  totalActive: number
  fullCount: number
  minimumCount: number
  restCount: number
  comebackCount: number // 空白から戻ってこれた回数（ごほうび指標）
  setbackCount: number // 挫折（空白）が発生した回数
  comebackRate: number // 0..1
  avgComebackDays: number // 戻るのにかかった平均日数（0 = 実績なし）
  longestGap: number
  currentGap: number // 今まさに続いている空白日数
  resilience: number // 0..100 崩壊耐性スコア
  outlook: { level: RecoveryLevel; label: string; text: string }
}

export function computeMetrics(state: AppState, today: string): Metrics {
  const daysElapsed = Math.max(0, daysBetween(state.createdAt, today))
  const timeline = buildTimeline(state, today)

  let fullCount = 0
  let minimumCount = 0
  let restCount = 0

  // 空白（missed の連続）を走査。最初に動いた日より前は対象外。
  let seenActive = false
  let gap = 0
  const recoveredGaps: number[] = []
  let longestGap = 0
  let currentGap = 0

  for (const day of timeline) {
    const s = day.status
    if (s === 'future') break
    if (s === 'full') fullCount++
    if (s === 'minimum') minimumCount++
    if (s === 'rest') restCount++

    if (!seenActive) {
      if (s === 'full' || s === 'minimum') seenActive = true
      continue
    }

    if (s === 'missed') {
      gap++
      continue
    }
    // rest は中立（空白を割らない・閉じない）
    if (s === 'rest') continue
    if (s === 'pending') {
      // 今日まだ未記録：直前までの空白は「進行中」
      break
    }
    // ここに来るのは full / minimum＝空白を閉じる＝復帰
    if (gap > 0) {
      recoveredGaps.push(gap)
      if (gap > longestGap) longestGap = gap
    }
    gap = 0
  }
  // ループ後に残った gap は進行中の空白
  currentGap = gap
  if (currentGap > longestGap) longestGap = currentGap

  const totalActive = fullCount + minimumCount
  const comebackCount = recoveredGaps.length
  const setbackCount = comebackCount + (currentGap > 0 ? 1 : 0)
  const comebackRate = setbackCount > 0 ? comebackCount / setbackCount : 1
  const avgComebackDays =
    comebackCount > 0
      ? recoveredGaps.reduce((a, b) => a + b, 0) / comebackCount
      : 0

  const hasData = totalActive > 0 || restCount > 0

  // ---- 崩壊耐性スコア（0..100） ----
  // 4要素の合成：復帰率・戻る速度・自分の目標頻度の達成度・直近の空白
  const rateScore = comebackRate // 0..1

  const speedScore =
    comebackCount === 0
      ? 1 // 戻る必要がなかった＝good
      : clamp01(1 - (avgComebackDays - 1) / 6)

  const targetPerDay = (state.profile?.frequency ?? 3) / 7
  const activeRatio = daysElapsed > 0 ? totalActive / daysElapsed : 0
  const consistencyScore =
    targetPerDay > 0 ? clamp01(activeRatio / targetPerDay) : 0

  const recencyScore = clamp01(1 - currentGap / 7)

  const resilience = hasData
    ? Math.round(
        rateScore * 30 +
          speedScore * 25 +
          consistencyScore * 25 +
          recencyScore * 20,
      )
    : 0

  return {
    hasData,
    daysElapsed,
    totalActive,
    fullCount,
    minimumCount,
    restCount,
    comebackCount,
    setbackCount,
    comebackRate,
    avgComebackDays,
    longestGap,
    currentGap,
    resilience,
    outlook: buildOutlook(hasData, resilience, currentGap),
  }
}

function buildOutlook(
  hasData: boolean,
  resilience: number,
  currentGap: number,
): Metrics['outlook'] {
  if (!hasData) {
    return {
      level: 'new',
      label: 'これから作っていく',
      text: '今日の一歩が、戻る力の最初の記録になる。',
    }
  }
  if (resilience >= 70) {
    return {
      level: 'high',
      label: 'とても戻りやすい',
      text:
        currentGap > 0
          ? '少し空いてるけど、あなたは戻れる人。今日それを証明しよう。'
          : 'いいリズム。もし止まっても、ここまでの自分が戻してくれる。',
    }
  }
  if (resilience >= 45) {
    return {
      level: 'mid',
      label: '戻れる力がある',
      text: '完璧じゃなくていい。戻ってきた回数が、あなたの強さ。',
    }
  }
  return {
    level: 'low',
    label: '今は戻る練習中',
    text: '止まるのは失敗じゃない。今日、最低ラインだけでも戻ってみよう。',
  }
}

function clamp01(n: number): number {
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

export { ACTIVE }
