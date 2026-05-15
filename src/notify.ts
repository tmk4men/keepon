// 通知まわりのヘルパー
// Webの制約：アプリ（タブ）が閉じている間は確実な配信ができない。
// 開いている間は setTimeout で次回の時刻ぴったりに通知できる。
// アプリを開き直したときに「予定時刻を過ぎていたら今日の分を出す」キャッチアップも担う。

const CATCHUP_KEY = 'keepon.notify.lastSent' // 'YYYY-MM-DD' 形式で最終発火日を記録

export function isNotifySupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator
  )
}

export function currentPermission(): NotificationPermission {
  if (!isNotifySupported()) return 'denied'
  return Notification.permission
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!isNotifySupported()) return 'denied'
  if (Notification.permission !== 'default') return Notification.permission
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

// 'HH:MM' を分に。失敗時は 1200(=20:00) を返す
export function parseHM(hm: string): number {
  const m = /^(\d{2}):(\d{2})$/.exec(hm)
  if (!m) return 20 * 60
  const h = Math.min(23, Math.max(0, Number(m[1])))
  const min = Math.min(59, Math.max(0, Number(m[2])))
  return h * 60 + min
}

// 次に「HH:MM」が来る時刻（epoch ms）を返す
export function nextFireAt(hm: string, now: Date = new Date()): number {
  const minutes = parseHM(hm)
  const target = new Date(now)
  target.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1)
  }
  return target.getTime()
}

// 今日まだ通知を出していなければ true
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

// SW経由で通知を出す（SWが立ち上がっていれば閉じてもOSに残る）
export async function showNotification(
  title: string,
  body: string,
): Promise<void> {
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
    // フォールバック：直接 Notification を出す
    try {
      new Notification(title, { body, icon: './icon.webp' })
    } catch {
      // それも失敗したら諦める
    }
  }
}

// 「今日の通知をまだ出していなければ出す」
export async function fireDailyIfDue(today: string): Promise<boolean> {
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
