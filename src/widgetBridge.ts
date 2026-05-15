// JS ↔ Android ウィジェットのブリッジ
// ・Preferencesプラグインを通じて、SharedPreferences "CapacitorStorage" を共有
// ・KeeponWidgetプラグイン（自作）で再描画を即時トリガー
// ・Web/iOSではノーオプ

import { Capacitor, registerPlugin } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

interface KeeponWidgetPlugin {
  update(): Promise<void>
}

const KeeponWidget = registerPlugin<KeeponWidgetPlugin>('KeeponWidget')

const KEY_STATE = 'keepon_widget_state'
const KEY_PENDING = 'keepon_widget_pending'

export type WidgetSyncState = {
  date: string // YYYY-MM-DD 当日の日付。日付が変わったらJava側で完了/タイマー状態をリセットする
  todayMenu: string | null
  fullDone: boolean
  timerRunning: boolean
  timerStartedAt: number
}

export type WidgetPendingRecord = {
  date: string
  kind: 'full' | 'minimum'
  menuTitle: string
  minutes: number
}

function isAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

export async function syncWidgetState(state: WidgetSyncState): Promise<void> {
  if (!isAndroid()) return
  try {
    await Preferences.set({ key: KEY_STATE, value: JSON.stringify(state) })
    // 即時で再描画させる（ウィジェットのデフォルトは30分間隔のため）
    await KeeponWidget.update().catch(() => undefined)
  } catch {
    // 失敗は握りつぶし（ウィジェットが入っていない端末・古いOSなど）
  }
}

export async function pullPendingRecords(): Promise<WidgetPendingRecord[]> {
  if (!isAndroid()) return []
  try {
    const { value } = await Preferences.get({ key: KEY_PENDING })
    if (!value) return []
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    // 読み出したら消す（次回起動時の二重適用を防ぐ）
    await Preferences.remove({ key: KEY_PENDING })
    return parsed.filter(
      (r): r is WidgetPendingRecord =>
        r &&
        typeof r.date === 'string' &&
        (r.kind === 'full' || r.kind === 'minimum') &&
        typeof r.menuTitle === 'string' &&
        typeof r.minutes === 'number',
    )
  } catch {
    return []
  }
}
