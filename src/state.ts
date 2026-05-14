// アプリの状態・型・永続化（localStorage）

export type Goal = 'diet' | 'bulk'
export type Gender = 'male' | 'female' | 'other'
export type Capacity = 'low' | 'mid' | 'high'
export type MenuKind = 'full' | 'minimum'

export type Profile = {
  goal: Goal
  gender: Gender
  height: number // cm
  weight: number // kg
  age: number
  capacity: Capacity // 疲れていてもできそうな量
  frequency: number // 週あたりの目標回数
}

// 1日の記録。メニューと最低ラインは独立して達成できる。
export type DayRecord = {
  date: string // YYYY-MM-DD
  full: boolean // 今日のメニューを実施した
  minimum: boolean // 最低ラインを実施した
}

// 進行中のカウントアップタイマー（終了すると kind が記録される）
export type RunningTimer = {
  kind: MenuKind
  menuTitle: string
  startedAt: number // epoch ms
}

export type AppState = {
  version: number
  profile: Profile | null
  records: DayRecord[] // date昇順を保つ
  createdAt: string // YYYY-MM-DD
  timer: RunningTimer | null
}

const STORAGE_KEY = 'keepon.state.v1'
export const STATE_VERSION = 2

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

// ---- 記録の正規化（旧フォーマット {date,status} からの移行を含む） ----

function normalizeRecords(raw: unknown): DayRecord[] {
  if (!Array.isArray(raw)) return []
  const merged = new Map<string, DayRecord>()
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const rec = r as Record<string, unknown>
    if (typeof rec.date !== 'string') continue

    let full = false
    let minimum = false
    if (typeof rec.full === 'boolean' || typeof rec.minimum === 'boolean') {
      full = rec.full === true
      minimum = rec.minimum === true
    } else if (rec.status === 'full') {
      full = true
    } else if (rec.status === 'minimum') {
      minimum = true
    }
    // status === 'rest' や不正データは破棄
    if (!full && !minimum) continue

    const existing = merged.get(rec.date)
    if (existing) {
      existing.full = existing.full || full
      existing.minimum = existing.minimum || minimum
    } else {
      merged.set(rec.date, { date: rec.date, full, minimum })
    }
  }
  return [...merged.values()].sort((a, b) => (a.date < b.date ? -1 : 1))
}

// ---- 永続化 ----

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>
      if (parsed && typeof parsed === 'object') {
        return {
          version: STATE_VERSION,
          profile: parsed.profile ?? null,
          records: normalizeRecords(parsed.records),
          createdAt: parsed.createdAt ?? todayStr(),
          timer: parsed.timer ?? null,
        }
      }
    }
  } catch {
    // 壊れていたら初期化
  }
  return {
    version: STATE_VERSION,
    profile: null,
    records: [],
    createdAt: todayStr(),
    timer: null,
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 保存失敗は無視（プライベートモード等）
  }
}

// 指定日の記録を取得
export function recordOn(
  records: DayRecord[],
  date: string,
): DayRecord | undefined {
  return records.find((r) => r.date === date)
}

// 記録があり、かつ何かしら実施済みか
export function isActiveRecord(r: DayRecord | undefined): boolean {
  return !!r && (r.full || r.minimum)
}

// 指定日の指定種別を「実施済み」にする（もう片方の状態は維持）
export function markDone(
  records: DayRecord[],
  date: string,
  kind: MenuKind,
): DayRecord[] {
  const existing = recordOn(records, date)
  const next = records.filter((r) => r.date !== date)
  next.push({
    date,
    full: kind === 'full' ? true : (existing?.full ?? false),
    minimum: kind === 'minimum' ? true : (existing?.minimum ?? false),
  })
  next.sort((a, b) => (a.date < b.date ? -1 : 1))
  return next
}
