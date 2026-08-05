// ストア（App Store / Google Play）とのやりとり。
// ネイティブ側の自作プラグイン Purchase を呼ぶだけの薄い層。
// Web ではストアが無いので「買えない」を返す。

import { Capacitor, registerPlugin } from '@capacitor/core'
import { PRODUCT_FULL, PRODUCT_TRIAL } from './entitlement'

export type StoreProduct = {
  id: string
  price: string // 表示用のローカライズ済み価格（例: ¥500）
}

export type PurchaseResult = 'purchased' | 'cancelled' | 'pending' | 'failed'

// 所有している商品。purchasedAt は epoch ミリ秒（分からなければ0）。
export type OwnedItem = { id: string; purchasedAt: number }

interface PurchasePlugin {
  getProducts(options: { ids: string[] }): Promise<{ products: StoreProduct[] }>
  purchase(options: { id: string }): Promise<{ status: PurchaseResult }>
  restore(): Promise<{ owned: OwnedItem[] }>
  owned(): Promise<{ owned: OwnedItem[] }>
  addListener(
    event: 'purchasesUpdated',
    handler: () => void,
  ): Promise<{ remove: () => Promise<void> }>
}

const Purchase = registerPlugin<PurchasePlugin>('Purchase')

export function hasStore(): boolean {
  return Capacitor.isNativePlatform()
}

// 体験の開始をストア経由でやる必要があるか。
// App Store は「¥0 の非消耗型を体験用に用意する」ことを規約で求めている（3.1.1）。
// Google Play は ¥0 のアプリ内商品を作れないので、Android と Web は端末内で始める。
export function trialNeedsStore(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'
}

export async function loadProducts(): Promise<{
  ok: boolean
  products: StoreProduct[]
}> {
  if (!hasStore()) return { ok: false, products: [] }
  try {
    const res = await Purchase.getProducts({ ids: [PRODUCT_TRIAL, PRODUCT_FULL] })
    const products = Array.isArray(res?.products) ? res.products : []
    // 1件も返らないのは取得失敗とみなす（審査前で商品未登録のときもここ）
    return { ok: products.length > 0, products }
  } catch {
    return { ok: false, products: [] }
  }
}

function toOwned(raw: unknown): OwnedItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((o) => {
      if (typeof o === 'string') return { id: o, purchasedAt: 0 }
      if (o && typeof o === 'object') {
        const r = o as Record<string, unknown>
        if (typeof r.id === 'string') {
          return {
            id: r.id,
            purchasedAt: typeof r.purchasedAt === 'number' ? r.purchasedAt : 0,
          }
        }
      }
      return null
    })
    .filter((o): o is OwnedItem => o !== null)
}

// ストアに聞けたかどうかを区別して返す。
// 「持っていない」と「聞けなかった」を混同すると、オフライン時に
// 購入済みの人をロックしてしまう。
export type OwnedResult = { ok: boolean; items: OwnedItem[] }

// 所有している商品。復元やアプリ起動時の照合に使う。
export async function ownedProducts(): Promise<OwnedResult> {
  if (!hasStore()) return { ok: false, items: [] }
  try {
    const res = await Purchase.owned()
    return { ok: true, items: toOwned(res?.owned) }
  } catch {
    return { ok: false, items: [] }
  }
}

export async function restorePurchases(): Promise<OwnedResult> {
  if (!hasStore()) return { ok: false, items: [] }
  try {
    const res = await Purchase.restore()
    return { ok: true, items: toOwned(res?.owned) }
  } catch {
    return { ok: false, items: [] }
  }
}

// 購入がアプリの外で確定したとき（承認待ちが通った・別端末で買った）に呼ばれる
export async function onPurchasesUpdated(
  handler: () => void,
): Promise<() => void> {
  if (!hasStore()) return () => undefined
  try {
    const listener = await Purchase.addListener('purchasesUpdated', handler)
    return () => listener.remove()
  } catch {
    return () => undefined
  }
}

export async function buy(id: string): Promise<PurchaseResult> {
  if (!hasStore()) return 'failed'
  try {
    const res = await Purchase.purchase({ id })
    return res?.status ?? 'failed'
  } catch {
    return 'failed'
  }
}
