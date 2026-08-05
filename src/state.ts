// アプリの状態・型・永続化（localStorage）

import {
  DEFAULT_PURCHASE,
  normalizePurchase,
  type PurchaseState,
} from './entitlement'

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
// fullMenu / minimumMenu には実施したメニュー名を保存する。
export type DayRecord = {
  date: string // YYYY-MM-DD
  full: boolean // 今日のメニューを実施した
  minimum: boolean // 最低ラインを実施した
  fullMenu: string | null // 実施したメニュー名
  minimumMenu: string | null // 実施した最低ラインの内容
  minutes: number // その日に動いた合計時間（分）
}

// 進行中のカウントアップタイマー（終了すると kind が記録される）
export type RunningTimer = {
  kind: MenuKind
  menuTitle: string
  startedAt: number // epoch ms
}

// 通知設定
export type NotifySettings = {
  enabled: boolean
  time: string // 'HH:MM'（24時間表記）
}

export const DEFAULT_NOTIFY: NotifySettings = {
  enabled: false,
  time: '20:00',
}

export type AppState = {
  version: number
  profile: Profile | null
  records: DayRecord[] // date昇順を保つ
  createdAt: string // YYYY-MM-DD
  timer: RunningTimer | null
  notify: NotifySettings
  purchase: PurchaseState // 体験期間と購入状態
}

const STORAGE_KEY = 'keepon.state.v1'
export const STATE_VERSION = 5

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
    let fullMenu: string | null = null
    let minimumMenu: string | null = null
    let minutes = 0
    if (typeof rec.full === 'boolean' || typeof rec.minimum === 'boolean') {
      full = rec.full === true
      minimum = rec.minimum === true
      fullMenu = typeof rec.fullMenu === 'string' ? rec.fullMenu : null
      minimumMenu =
        typeof rec.minimumMenu === 'string' ? rec.minimumMenu : null
      minutes =
        typeof rec.minutes === 'number' && rec.minutes > 0 ? rec.minutes : 0
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
      existing.fullMenu = existing.fullMenu ?? fullMenu
      existing.minimumMenu = existing.minimumMenu ?? minimumMenu
      existing.minutes += minutes
    } else {
      merged.set(rec.date, {
        date: rec.date,
        full,
        minimum,
        fullMenu,
        minimumMenu,
        minutes,
      })
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
          notify: normalizeNotify(parsed.notify),
          purchase: normalizePurchase(parsed.purchase),
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
    notify: { ...DEFAULT_NOTIFY },
    purchase: { ...DEFAULT_PURCHASE },
  }
}

function normalizeNotify(raw: unknown): NotifySettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_NOTIFY }
  const r = raw as Record<string, unknown>
  const enabled = r.enabled === true
  const time =
    typeof r.time === 'string' && /^\d{2}:\d{2}$/.test(r.time)
      ? r.time
      : DEFAULT_NOTIFY.time
  return { enabled, time }
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

// ---- バックアップ（書き出し / 読み込み） ----

function isValidProfile(p: unknown): p is Profile {
  if (!p || typeof p !== 'object') return false
  const o = p as Record<string, unknown>
  return (
    (o.goal === 'diet' || o.goal === 'bulk') &&
    (o.gender === 'male' || o.gender === 'female' || o.gender === 'other') &&
    (o.capacity === 'low' || o.capacity === 'mid' || o.capacity === 'high') &&
    typeof o.height === 'number' &&
    typeof o.weight === 'number' &&
    typeof o.age === 'number' &&
    typeof o.frequency === 'number'
  )
}

// 現在の状態を、バックアップ用のJSON文字列にする。
// 購入・体験の状態はストア側が正なので、バックアップには含めない。
export function exportState(): string {
  const { purchase: _purchase, ...rest } = loadState()
  return JSON.stringify(rest, null, 2)
}

// バックアップを JSON ファイルとしてダウンロードさせる
export function downloadBackup(): boolean {
  try {
    const blob = new Blob([exportState()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tsuzukin-backup-${todayStr()}.json`
    a.click()
    URL.revokeObjectURL(url)
    return true
  } catch {
    return false
  }
}

// バックアップJSONを解釈して状態にする（保存はしない）。
// ツヅキンのバックアップとして読めなければ null。
export function parseBackup(json: string): AppState | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const p = parsed as Partial<AppState>
  // 最低限「記録の配列」か「正しいプロフィール」のどちらかを持つこと
  if (!Array.isArray(p.records) && !isValidProfile(p.profile)) return null
  return {
    version: STATE_VERSION,
    profile: isValidProfile(p.profile) ? p.profile : null,
    records: normalizeRecords(p.records),
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : todayStr(),
    timer: null,
    notify: normalizeNotify(p.notify),
    // バックアップからは体験・購入を持ち込ませない（今の端末の状態を使う）
    purchase: normalizePurchase(loadState().purchase),
  }
}

// 指定日の指定種別を「実施済み」にする（もう片方の状態は維持）
export function markDone(
  records: DayRecord[],
  date: string,
  kind: MenuKind,
  menuTitle: string,
  minutes: number,
): DayRecord[] {
  const existing = recordOn(records, date)
  const next = records.filter((r) => r.date !== date)
  next.push({
    date,
    full: kind === 'full' ? true : (existing?.full ?? false),
    minimum: kind === 'minimum' ? true : (existing?.minimum ?? false),
    fullMenu: kind === 'full' ? menuTitle : (existing?.fullMenu ?? null),
    minimumMenu:
      kind === 'minimum' ? menuTitle : (existing?.minimumMenu ?? null),
    minutes: (existing?.minutes ?? 0) + Math.max(0, minutes),
  })
  next.sort((a, b) => (a.date < b.date ? -1 : 1))
  return next
}
