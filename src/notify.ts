// 通知まわりのヘルパー
// ・ネイティブ（Capacitor）：LocalNotifications で日次繰り返しを予約。アプリを閉じていてもOSが配信
// ・Web：Notification API + Service Worker。アプリ起動中は setTimeout、起動時にキャッチアップ

import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

const CATCHUP_KEY = 'keepon.notify.lastSent' // 'YYYY-MM-DD' Web版のキャッチアップ用
const NATIVE_NOTIF_ID = 4321 // 日次通知の固定ID

export function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

export function isNotifySupported(): boolean {
  if (isNative()) return true
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator
  )
}

export function currentPermission(): NotificationPermission {
  if (isNative()) return 'default' // ネイティブは別経路（requestPermission で確認）
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied'
  }
  return Notification.permission
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (isNative()) {
    const res = await LocalNotifications.requestPermissions()
    if (res.display === 'granted') return 'granted'
    if (res.display === 'denied') return 'denied'
    return 'default'
  }
  if (!isNotifySupported()) return 'denied'
  if (Notification.permission !== 'default') return Notification.permission
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

// 'HH:MM' を {hour, minute} に
export function parseHM(hm: string): { hour: number; minute: number } {
  const m = /^(\d{2}):(\d{2})$/.exec(hm)
  if (!m) return { hour: 20, minute: 0 }
  return {
    hour: Math.min(23, Math.max(0, Number(m[1]))),
    minute: Math.min(59, Math.max(0, Number(m[2]))),
  }
}

// Web版：次に「HH:MM」が来る時刻（epoch ms）を返す
export function nextFireAt(hm: string, now: Date = new Date()): number {
  const { hour, minute } = parseHM(hm)
  const target = new Date(now)
  target.setHours(hour, minute, 0, 0)
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1)
  }
  return target.getTime()
}

function notSentToday(today: string): boolean {
  try {
    return localStorage.getItem(CATCHUP_KEY) !== today
  } catch {
    return true
  }
}

function markSent(today: string): void {
  try {
    localStorage.setItem(CATCHUP_KEY, today)
  } catch {
    // ignore
  }
}

// 即時通知（テストやキャッチアップ用）
export async function showNotification(
  title: string,
  body: string,
): Promise<void> {
  if (isNative()) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 1_000_000),
            title,
            body,
            schedule: { at: new Date(Date.now() + 1000) },
            smallIcon: 'ic_stat_icon_config_sample',
          },
        ],
      })
    } catch {
      // 失敗は握りつぶし
    }
    return
  }
  if (currentPermission() !== 'granted') return
  try {
    const reg = await navigator.serviceWorker.ready
    await reg.showNotification(title, {
      body,
      icon: './icon.webp',
      badge: './icon.webp',
      tag: 'keepon-daily',
      renotify: true,
    } as NotificationOptions)
  } catch {
    try {
      new Notification(title, { body, icon: './icon.webp' })
    } catch {
      // ignore
    }
  }
}

// 日次の繰り返し通知を予約（ネイティブ専用）。既存予約は置きかえ。
export async function scheduleDailyNative(
  hm: string,
  title: string,
  body: string,
): Promise<void> {
  if (!isNative()) return
  try {
    await LocalNotifications.cancel({
      notifications: [{ id: NATIVE_NOTIF_ID }],
    })
  } catch {
    // ignore
  }
  const { hour, minute } = parseHM(hm)
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: NATIVE_NOTIF_ID,
          title,
          body,
          schedule: {
            on: { hour, minute },
            allowWhileIdle: true,
          },
          smallIcon: 'ic_stat_icon_config_sample',
        },
      ],
    })
  } catch {
    // ignore
  }
}

// 日次の繰り返しを取り消し
export async function cancelDailyNative(): Promise<void> {
  if (!isNative()) return
  try {
    await LocalNotifications.cancel({
      notifications: [{ id: NATIVE_NOTIF_ID }],
    })
  } catch {
    // ignore
  }
}

// 「今日の通知をまだ出していなければ出す」(Web版のキャッチアップ)
export async function fireDailyIfDue(today: string): Promise<boolean> {
  if (isNative()) return false // ネイティブは OS スケジューラに任せる
  if (!notSentToday(today)) return false
  await showNotification(
    'ツヅキンの時間',
    '今日もちょっとだけ動こう。短くてもOK。',
  )
  markSent(today)
  return true
}

// 文言バリエーション。空白が長いほど「戻ろう」を強めに。
export function reminderCopy(currentGap: number): { title: string; body: string } {
  if (currentGap >= 7) {
    return {
      title: 'おかえりを待ってるよ',
      body: '止まっても戻れる。今日は1分でも、軽くでもOK。',
    }
  }
  if (currentGap >= 3) {
    return {
      title: 'そろそろ、戻ってこよう',
      body: '完璧じゃなくていい。1つだけ動けば十分。',
    }
  }
  return {
    title: 'ツヅキンの時間',
    body: '今日もちょっとだけ動こう。短くてもOK。',
  }
}
