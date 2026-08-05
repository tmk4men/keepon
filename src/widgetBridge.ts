// JS ↔ ホーム画面ウィジェットのブリッジ
// ・Android: Preferencesプラグイン経由で SharedPreferences "CapacitorStorage" を共有し、
//   自作の KeeponWidget プラグインで再描画をトリガーする
// ・iOS: 拡張はアプリの UserDefaults を直接読めないので、読み書きごと
//   自作の KeeponWidget プラグイン（App Group）に任せる
// ・Web ではノーオプ

import { Capacitor, registerPlugin } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

interface KeeponWidgetPlugin {
  update(): Promise<void>
  // iOS のみ実装
  sync(state: WidgetSyncState): Promise<void>
  pullPending(): Promise<{ records: WidgetPendingRecord[] }>
  getState(): Promise<{ state: WidgetSyncState | null }>
}

const KeeponWidget = registerPlugin<KeeponWidgetPlugin>('KeeponWidget')

const KEY_STATE = 'keepon_widget_state'
const KEY_PENDING = 'keepon_widget_pending'

export type WidgetSyncState = {
  date: string // YYYY-MM-DD 当日の日付。日付が変わったらネイティブ側で完了/タイマー状態をリセットする
  todayMenu: string | null
  fullDone: boolean
  timerRunning: boolean
  timerStartedAt: number
  locked: boolean // 体験切れ。ウィジェットからの操作も止める
  // この日まで使える（YYYY-MM-DD）。購入済みなら空文字。
  // アプリを開かないまま期限を過ぎた場合に、ウィジェット側だけで止められるようにする。
  accessUntil: string
}

export type WidgetPendingRecord = {
  date: string
  kind: 'full' | 'minimum'
  menuTitle: string
  minutes: number
}

function platform(): 'android' | 'ios' | 'web' {
  if (!Capacitor.isNativePlatform()) return 'web'
  const name = Capacitor.getPlatform()
  return name === 'android' || name === 'ios' ? name : 'web'
}

function isPendingRecord(r: unknown): r is WidgetPendingRecord {
  if (!r || typeof r !== 'object') return false
  const rec = r as Record<string, unknown>
  return (
    typeof rec.date === 'string' &&
    (rec.kind === 'full' || rec.kind === 'minimum') &&
    typeof rec.menuTitle === 'string' &&
    typeof rec.minutes === 'number'
  )
}

export async function syncWidgetState(state: WidgetSyncState): Promise<void> {
  const target = platform()
  if (target === 'web') return
  try {
    if (target === 'ios') {
      await KeeponWidget.sync(state)
      return
    }
    await Preferences.set({ key: KEY_STATE, value: JSON.stringify(state) })
    // 即時で再描画させる（ウィジェットのデフォルトは30分間隔のため）
    await KeeponWidget.update().catch(() => undefined)
  } catch {
    // 失敗は握りつぶし（ウィジェットが入っていない端末・古いOSなど）
  }
}

// ウィジェット側で「開始」されたタイマーを拾うために、現在の共有状態を読む
export async function readWidgetState(): Promise<WidgetSyncState | null> {
  const target = platform()
  if (target === 'web') return null
  try {
    let raw: unknown = null
    if (target === 'ios') {
      const res = await KeeponWidget.getState()
      raw = res?.state ?? null
    } else {
      const { value } = await Preferences.get({ key: KEY_STATE })
      raw = value ? JSON.parse(value) : null
    }
    if (!raw || typeof raw !== 'object') return null
    const s = raw as Record<string, unknown>
    if (typeof s.date !== 'string' || !s.date) return null
    return {
      date: s.date,
      todayMenu: typeof s.todayMenu === 'string' && s.todayMenu ? s.todayMenu : null,
      fullDone: s.fullDone === true,
      timerRunning: s.timerRunning === true,
      timerStartedAt: typeof s.timerStartedAt === 'number' ? s.timerStartedAt : 0,
      locked: s.locked === true,
      accessUntil: typeof s.accessUntil === 'string' ? s.accessUntil : '',
    }
  } catch {
    return null
  }
}

export async function pullPendingRecords(): Promise<WidgetPendingRecord[]> {
  const target = platform()
  if (target === 'web') return []
  try {
    if (target === 'ios') {
      const res = await KeeponWidget.pullPending()
      const records = res?.records
      if (!Array.isArray(records)) return []
      return records.filter(isPendingRecord)
    }
    const { value } = await Preferences.get({ key: KEY_PENDING })
    if (!value) return []
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    // 読み出したら消す（次回起動時の二重適用を防ぐ）
    await Preferences.remove({ key: KEY_PENDING })
    return parsed.filter(isPendingRecord)
  } catch {
    return []
  }
}
