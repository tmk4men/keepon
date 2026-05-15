// ツヅキン：通知用 Service Worker
// 主役は通知の表示とクリック挙動。
// （オフラインキャッシュなどは入れず、まずは通知だけを担当させる）

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// 通知をタップしたとき：開いているタブを前面に、なければ新しく開く
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus()
          return
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow('./')
      }
    })(),
  )
})
