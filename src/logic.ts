// 復帰支援のコアロジック。連続記録ではなく「止まっても戻れるか」を扱う。

import {
  addDays,
  daysBetween,
  parseDate,
  recordOn,
  type AppState,
  type Capacity,
} from './state'
import {
  pickLightMenus,
  pickMinimumMenu,
  pickMinimumMenus,
  pickNormalMenus,
  type Menu,
} from './menus'

export type DailyMode = 'normal' | 'light' | 'comeback'

export type DailyPlan = {
  mode: DailyMode
  menuOptions: Menu[] // 今日のメニュー候補（2つ・スワイプで選ぶ）
  minimum: Menu // 最低ライン（ゼロを作らないための保険）
  gapDays: number // 最後に動いた日からの日数
  comebackNote: string | null // 復帰モード時の心理復帰メッセージ
  ageNote: string | null // 年代に合わせた注意メッセージ
}

// 年齢に応じて実効的な運動量を1段やさしくする（メニュー内容が年代別に変わる）
function adjustCapacityForAge(cap: Capacity, age: number): Capacity {
  const order: Capacity[] = ['low', 'mid', 'high']
  let i = order.indexOf(cap)
  if (age >= 60) i = Math.max(0, i - 1)
  else if (age >= 45 && cap === 'high') i = 1
  return order[i]
}

function ageNote(age: number): string | null {
  if (age >= 60) {
    return '準備運動を長めに。痛みや強い疲れを感じたら、無理せず最低ラインに切り替えてOK。'
  }
  if (age >= 45) {
    return '関節を痛めないよう、はじめに軽い準備運動を。きつければ回数を減らして大丈夫。'
  }
  return null
}

// 最後に「動いた日」（メニュー or 最低ラインを実施）を探す。無ければ null。
function lastActiveDate(state: AppState, today: string): string | null {
  let best: string | null = null
  for (const r of state.records) {
    if (r.date <= today && (r.full || r.minimum)) {
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
  const effCapacity = adjustCapacityForAge(profile.capacity, profile.age)

  let menuOptions: Menu[]
  if (mode === 'normal') {
    menuOptions = pickNormalMenus(
      profile.goal,
      effCapacity,
      profile.gender,
      dayIndex,
    )
  } else if (mode === 'light') {
    menuOptions = pickLightMenus(profile.goal, dayIndex)
  } else {
    // 復帰モードは「今日やること」も軽い候補に寄せる
    menuOptions = pickMinimumMenus(dayIndex)
  }

  return {
    mode,
    menuOptions,
    minimum,
    gapDays,
    comebackNote: comebackNote(mode, gapDays),
    ageNote: ageNote(profile.age),
  }
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

// ---- 記録タイムライン（指標算出の共通土台） ----

export type TimelineStatus = 'active' | 'missed' | 'pending' | 'future'
export type TimelineDay = { date: string; status: TimelineStatus }

export function buildTimeline(state: AppState, today: string): TimelineDay[] {
  const days: TimelineDay[] = []
  let cursor = state.createdAt
  // 念のため上限（5年）
  for (let i = 0; i < 365 * 5; i++) {
    let status: TimelineStatus
    const rec = recordOn(state.records, cursor)
    if (cursor > today) status = 'future'
    else if (rec && (rec.full || rec.minimum)) status = 'active'
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
  totalActive: number // 何かしら動けた日数
  fullCount: number // メニューを実施した回数
  minimumCount: number // 最低ラインを実施した回数
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
  let totalActive = 0
  for (const r of state.records) {
    if (r.date > today) continue
    if (r.full) fullCount++
    if (r.minimum) minimumCount++
    if (r.full || r.minimum) totalActive++
  }

  // 空白（missed の連続）を走査。最初に動いた日より前は対象外。
  let seenActive = false
  let gap = 0
  const recoveredGaps: number[] = []
  let longestGap = 0

  for (const day of timeline) {
    const s = day.status
    if (s === 'future') break
    if (s === 'pending') break // 今日まだ未実施：直前までの空白は進行中
    if (!seenActive) {
      if (s === 'active') seenActive = true
      continue
    }
    if (s === 'missed') {
      gap++
      continue
    }
    // s === 'active'：空白を閉じる＝復帰
    if (gap > 0) {
      recoveredGaps.push(gap)
      if (gap > longestGap) longestGap = gap
    }
    gap = 0
  }
  const currentGap = gap
  if (currentGap > longestGap) longestGap = currentGap

  const comebackCount = recoveredGaps.length
  const setbackCount = comebackCount + (currentGap > 0 ? 1 : 0)
  const comebackRate = setbackCount > 0 ? comebackCount / setbackCount : 1
  const avgComebackDays =
    comebackCount > 0
      ? recoveredGaps.reduce((a, b) => a + b, 0) / comebackCount
      : 0

  const hasData = totalActive > 0

  // ---- 崩壊耐性スコア（0..100） ----
  const rateScore = comebackRate
  const speedScore =
    comebackCount === 0 ? 1 : clamp01(1 - (avgComebackDays - 1) / 6)
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

// ---- 今週のペース（目標頻度との進捗） ----

export type WeeklyPace = {
  done: number // 今週、動けた日数
  target: number // 目標頻度（週あたり）
  met: boolean
}

export function weeklyProgress(state: AppState, today: string): WeeklyPace {
  const dow = parseDate(today).getDay() // 0=日曜
  const weekStart = addDays(today, -dow)
  let done = 0
  for (const r of state.records) {
    if (r.date >= weekStart && r.date <= today && (r.full || r.minimum)) {
      done++
    }
  }
  const target = state.profile?.frequency ?? 3
  return { done, target, met: done >= target }
}
