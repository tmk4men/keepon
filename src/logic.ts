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
  bmiNote: string | null // BMIに合わせた注意メッセージ
  timeEase: number // めやす時間の倍率（1=通常、<1=復帰中で緩め）
}

const MODE_ORDER: Record<DailyMode, number> = {
  comeback: 0,
  light: 1,
  normal: 2,
}

// 2つのモードのうち、よりやさしい方を返す
function gentler(a: DailyMode, b: DailyMode): DailyMode {
  return MODE_ORDER[a] <= MODE_ORDER[b] ? a : b
}

// 復帰ランプ：直近の大きな空白（4日以上）から段階的に元のペースへ戻す。
// 大空白が明けた後、活動日数が増えるにつれ comeback → light → 通常 へ。
function recoveryRamp(state: AppState, today: string): DailyMode | null {
  const timeline = buildTimeline(state, today)
  let gapRun = 0
  let bigGapLen = 0
  let activeAfter = 0
  let sawBigGap = false
  for (const day of timeline) {
    if (day.status === 'future' || day.status === 'pending') break
    if (day.status === 'missed') {
      gapRun++
      continue
    }
    // active な日
    if (gapRun >= 4) {
      bigGapLen = gapRun
      activeAfter = 0
      sawBigGap = true
    }
    if (sawBigGap) activeAfter++
    gapRun = 0
  }
  if (!sawBigGap) return null
  // 空白が長いほどランプも長く（3〜6日）
  const rampLength = Math.min(6, Math.max(3, Math.ceil(bigGapLen / 2)))
  if (activeAfter >= rampLength) return null // ランプ終了＝通常へ
  return activeAfter <= Math.floor(rampLength / 2) ? 'comeback' : 'light'
}

// 年齢に応じて実効的な運動量を1段やさしくする（メニュー内容が年代別に変わる）
function adjustCapacityForAge(cap: Capacity, age: number): Capacity {
  const order: Capacity[] = ['low', 'mid', 'high']
  let i = order.indexOf(cap)
  if (age >= 60) i = Math.max(0, i - 1)
  else if (age >= 45 && cap === 'high') i = 1
  return order[i]
}

// ---- BMI ----

export type BmiCategory = 'low' | 'normal' | 'high' | 'veryHigh'

export type BmiInfo = {
  value: number // 小数1桁
  category: BmiCategory
  label: string // 穏やかな表現
}

// 身長(cm)・体重(kg)からBMIを算出。値が不正なら null。
export function bmiInfo(height: number, weight: number): BmiInfo | null {
  if (!Number.isFinite(height) || !Number.isFinite(weight)) return null
  if (height <= 0 || weight <= 0) return null
  const m = height / 100
  const raw = weight / (m * m)
  if (!Number.isFinite(raw)) return null
  const value = Math.round(raw * 10) / 10
  let category: BmiCategory
  let label: string
  if (raw < 18.5) {
    category = 'low'
    label = '低め'
  } else if (raw < 25) {
    category = 'normal'
    label = '標準の範囲'
  } else if (raw < 30) {
    category = 'high'
    label = 'やや高め'
  } else {
    category = 'veryHigh'
    label = '高め'
  }
  return { value, category, label }
}

// BMIが高めのときは、関節への負担を減らすため実効運動量を1段やさしくする
function adjustCapacityForBmi(cap: Capacity, bmi: BmiInfo | null): Capacity {
  if (!bmi || (bmi.category !== 'high' && bmi.category !== 'veryHigh')) {
    return cap
  }
  const order: Capacity[] = ['low', 'mid', 'high']
  return order[Math.max(0, order.indexOf(cap) - 1)]
}

// BMIが「関節にやさしい低負荷メニュー」を出すべき状態か
function needsJointCare(bmi: BmiInfo | null): boolean {
  return !!bmi && (bmi.category === 'high' || bmi.category === 'veryHigh')
}

function bmiNote(bmi: BmiInfo | null, goal: AppState['profile']): string | null {
  if (!bmi) return null
  const isBulk = goal?.goal === 'bulk'
  if (bmi.category === 'veryHigh') {
    return 'ジャンプや走り込みはひざ・腰の負担になりやすい時期。今は低負荷メニュー中心で、痛みが出たら最低ラインへ。'
  }
  if (bmi.category === 'high') {
    return 'ひざ・腰にやさしい低負荷メニューを中心にしています。無理なく、続けることを優先で。'
  }
  if (bmi.category === 'low') {
    return isBulk
      ? '体重は軽めです。トレーニング後の食事・たんぱく質をしっかりとると、体づくりが進みやすくなります。'
      : '体重は軽めです。減量より、今の体を保ちながら筋力をつけることを優先しても大丈夫。'
  }
  return null
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

// 今日のプランを組み立てる（端末内の通常ロジック）
export function buildDailyPlan(state: AppState, today: string): DailyPlan {
  const profile = state.profile!
  const dayIndex = Math.max(0, daysBetween(state.createdAt, today))

  const lastActive = lastActiveDate(state, today)
  // 一度も動いていない場合は「登録日からの経過」を空白とみなす
  const gapDays = lastActive
    ? daysBetween(lastActive, today)
    : daysBetween(state.createdAt, today)

  let gapMode: DailyMode
  if (gapDays <= 1) gapMode = 'normal'
  else if (gapDays <= 3) gapMode = 'light'
  else gapMode = 'comeback'

  // 空白由来のモードと、復帰ランプのモードの「やさしい方」を採用
  const ramp = recoveryRamp(state, today)
  const mode: DailyMode = ramp ? gentler(gapMode, ramp) : gapMode

  const minimum = pickMinimumMenu(dayIndex)
  const bmi = bmiInfo(profile.height, profile.weight)
  const effCapacity = adjustCapacityForBmi(
    adjustCapacityForAge(profile.capacity, profile.age),
    bmi,
  )

  let menuOptions: Menu[]
  if (mode === 'normal') {
    menuOptions = pickNormalMenus(
      profile.goal,
      effCapacity,
      profile.gender,
      profile.frequency,
      dayIndex,
      needsJointCare(bmi),
    )
  } else if (mode === 'light') {
    menuOptions = pickLightMenus(profile.goal, dayIndex)
  } else {
    // 復帰モードは「今日やること」も軽い候補に寄せる
    menuOptions = pickMinimumMenus(dayIndex)
  }

  // 復帰中はめやす時間も緩める
  const timeEase = mode === 'normal' ? 1 : mode === 'light' ? 0.7 : 0.6

  return {
    mode,
    menuOptions,
    minimum,
    gapDays,
    comebackNote: buildNote(mode, gapDays),
    ageNote: ageNote(profile.age),
    bmiNote: bmiNote(bmi, profile),
    timeEase,
  }
}

function buildNote(mode: DailyMode, gapDays: number): string | null {
  if (mode === 'normal') return null
  if (gapDays >= 7) {
    return '間が空いた＝終わり、じゃない。今日できる一番小さいことから、もう一度。'
  }
  if (gapDays >= 4) {
    return 'ひさしぶり。ここで戻れたら、それが一番すごいこと。最低ラインでも100点。'
  }
  if (gapDays >= 2) {
    return '数日空いても大丈夫。今日は軽めにして、リズムだけ取り戻そう。'
  }
  // 空白は無いが light/comeback ＝ 復帰ランプの途中
  return 'まだ復帰の途中。今日は控えめでOK。数日かけて、元のペースに戻していこう。'
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
      text: '今日の一歩が、\n戻る力の最初の記録になる。',
    }
  }
  if (resilience >= 70) {
    return {
      level: 'high',
      label: 'とても戻りやすい',
      text:
        currentGap > 0
          ? '少し空いてるけど、あなたは戻れる人。\n今日それを証明しよう。'
          : 'いいリズム。もし止まっても、\nここまでの自分が戻してくれる。',
    }
  }
  if (resilience >= 45) {
    return {
      level: 'mid',
      label: '戻れる力がある',
      text: '完璧じゃなくていい。\n戻ってきた回数が、あなたの強さ。',
    }
  }
  return {
    level: 'low',
    label: '今は戻る練習中',
    text: '止まるのは失敗じゃない。\n今日、最低ラインだけでも戻ってみよう。',
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

// ---- コーチコメント（スコアカードの吹き出し） ----

export type CoachLine = { text: string; excited: boolean; icon: number }

// レベルごとのコメント候補。excited は「！」を使った力強い感激コメント。
const COACH_LINES: Record<
  RecoveryLevel,
  { text: string; excited: boolean }[]
> = {
  new: [
    { text: '今日の一歩が、\n戻る力の最初の記録になる。', excited: false },
    { text: 'はじめましてっ！\nここから一緒に積んでいこう！', excited: true },
  ],
  low: [
    {
      text: '止まるのは失敗じゃない。\n今日、最低ラインだけでも戻ってみよう。',
      excited: false,
    },
    {
      text: '大丈夫、ここからだよ。\n小さく動けたら、それで合格！',
      excited: true,
    },
  ],
  mid: [
    {
      text: '完璧じゃなくていい。\n戻ってきた回数が、あなたの強さ。',
      excited: false,
    },
    { text: 'いい感じ！\nそのリズム、キープしていこう！', excited: true },
  ],
  high: [
    {
      text: 'いいリズム。もし止まっても、\nここまでの自分が戻してくれる。',
      excited: false,
    },
    { text: 'すごいっ！\nこの戻る力は、もう本物だよ！', excited: true },
    {
      text: '完璧すぎる！\nあなたはもう、止まっても怖くない人！',
      excited: true,
    },
  ],
}

// 文字列から安定した擬似乱数の種を作る（同じ日なら毎レンダー同じ結果）
function seedFrom(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

// その日のコーチコメントとアイコンを選ぶ（日付固定なので画面再描画でブレない）
export function coachLine(level: RecoveryLevel, today: string): CoachLine {
  const pool = COACH_LINES[level]
  const seed = seedFrom(today)
  const pick = pool[seed % pool.length]
  return { text: pick.text, excited: pick.excited, icon: (seed % 4) + 1 }
}

// ---- 直近1週間の活動量（分） ----

export type DayMinutes = { date: string; dow: number; minutes: number }

// 今日を含む直近7日分の活動時間（分）を、古い順で返す。
export function weeklyMinutes(state: AppState, today: string): DayMinutes[] {
  const out: DayMinutes[] = []
  for (let i = 6; i >= 0; i--) {
    const date = addDays(today, -i)
    const rec = recordOn(state.records, date)
    out.push({
      date,
      dow: parseDate(date).getDay(),
      minutes: rec?.minutes ?? 0,
    })
  }
  return out
}
