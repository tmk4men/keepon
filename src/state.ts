// アプリの状態・型・永続化（localStorage）

export type Goal = 'diet' | 'bulk'
export type Gender = 'male' | 'female' | 'other'
export type Capacity = 'low' | 'mid' | 'high'

export type Profile = {
  goal: Goal
  gender: Gender
  height: number // cm
  weight: number // kg
  age: number
  capacity: Capacity // 疲れていてもできそうな量
  frequency: number // 週あたりの目標回数
}

// full = 通常メニュー達成 / minimum = 最低ラインだけ達成 / rest = 計画的なお休み
// none は記録に保存しない（記録が無い過去日を「未達成」とみなす）
export type DayStatus = 'full' | 'minimum' | 'rest'

export type DayRecord = {
  date: string // YYYY-MM-DD
  status: DayStatus
}

export type AppState = {
  version: number
  profile: Profile | null
  records: DayRecord[] // date昇順を保つ
  createdAt: string // YYYY-MM-DD
}

const STORAGE_KEY = 'keepon.state.v1'
export const STATE_VERSION = 1

// ---- 日付ユーティリティ（端末ローカル日付ベース） ----

export function todayStr(): string {
  return toDateStr(new Date())
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s: string, n: number): string {
  const d = parseDate(s)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

// a から b までの日数（b - a）。同日なら 0。
export function daysBetween(a: string, b: string): number {
  const ms = parseDate(b).getTime() - parseDate(a).getTime()
  return Math.round(ms / 86400000)
}

export function formatJp(s: string): string {
  const d = parseDate(s)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// ---- 永続化 ----

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      if (parsed && typeof parsed === 'object') {
        return {
          version: STATE_VERSION,
          profile: parsed.profile ?? null,
          records: Array.isArray(parsed.records) ? parsed.records : [],
          createdAt: parsed.createdAt ?? todayStr(),
        }
      }
    }
  } catch {
    // 壊れていたら初期化
  }
  return { version: STATE_VERSION, profile: null, records: [], createdAt: todayStr() }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 保存失敗は無視（プライベートモード等）
  }
}

// 指定日の記録を取得
export function recordOn(records: DayRecord[], date: string): DayRecord | undefined {
  return records.find((r) => r.date === date)
}

// 指定日の記録を追加/更新（同日があれば上書き）
export function setRecord(
  records: DayRecord[],
  date: string,
  status: DayStatus,
): DayRecord[] {
  const next = records.filter((r) => r.date !== date)
  next.push({ date, status })
  next.sort((a, b) => (a.date < b.date ? -1 : 1))
  return next
}

// 指定日の記録を削除（取り消し）
export function clearRecord(records: DayRecord[], date: string): DayRecord[] {
  return records.filter((r) => r.date !== date)
}
