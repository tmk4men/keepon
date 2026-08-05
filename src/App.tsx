import { useEffect, useState } from 'react'
import {
  downloadBackup,
  loadState,
  markDone,
  saveState,
  todayStr,
  type AppState,
  type MenuKind,
  type Profile,
} from './state'
import Onboarding from './components/Onboarding'
import Home from './components/Home'
import Records from './components/Records'
import Continuity from './components/Continuity'
import Settings from './components/Settings'
import { TabBar, type TabKey } from './components/TabBar'
import { TimerBar } from './components/TimerBar'
import { IconMenu } from './components/icons'
import {
  cancelDailyNative,
  currentPermission,
  fireDailyIfDue,
  isNative,
  nextFireAt,
  reminderCopy,
  scheduleDailyNative,
  showNotification,
} from './notify'
import { buildDailyPlan, computeMetrics } from './logic'
import {
  pullPendingRecords,
  readWidgetState,
  syncWidgetState,
} from './widgetBridge'
import Paywall from './components/Paywall'
import {
  accessOn,
  accessUntil,
  FULL_PRICE_FALLBACK,
  mergeStoreState,
  PRODUCT_FULL,
  PRODUCT_TRIAL,
  touchSeenDate,
  trialLabel,
} from './entitlement'
import {
  buy,
  hasStore,
  loadProducts,
  onPurchasesUpdated,
  ownedProducts,
  restorePurchases,
  trialNeedsStore,
} from './purchase'

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState())
  const [tab, setTab] = useState<TabKey>('today')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [today, setToday] = useState<string>(() => todayStr())
  // ウィジェットからの取り込みが済むまで、ウィジェットへの書き戻しを保留する
  const [widgetSynced, setWidgetSynced] = useState(false)
  const [storeBusy, setStoreBusy] = useState(false)
  const [storeMsg, setStoreMsg] = useState<string | null>(null)
  const [fullPrice, setFullPrice] = useState(FULL_PRICE_FALLBACK)
  // ストアから価格を取れたか。取れないまま体験を始めさせない（規約 3.1.1 の価格明示）
  const [priceKnown, setPriceKnown] = useState(!hasStore())
  const [storeSync, setStoreSync] = useState<(() => void) | null>(null)

  const access = accessOn(state.purchase, today)

  // 真夜中を跨いだら today を更新する（アプリ起動時／日付変更時／可視化復帰時）
  useEffect(() => {
    const tick = () => {
      const now = todayStr()
      setToday((prev) => (prev === now ? prev : now))
    }
    tick()
    const interval = window.setInterval(tick, 60 * 1000)
    const onVis = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  useEffect(() => {
    saveState(state)
  }, [state])

  // 日付が進んだことを覚えておく（端末の日付を戻して体験を延ばすのを防ぐ）
  useEffect(() => {
    setState((s) => {
      const next = touchSeenDate(s.purchase, today)
      return next === s.purchase ? s : { ...s, purchase: next }
    })
  }, [today])

  // ウィジェットの状態をアプリに取り込む。
  // ・「完了」でたまった記録を反映する
  // ・ウィジェットで開始されたタイマーを引き継ぐ（引き継がないとアプリ起動で消える）
  // 起動時だけでなく復帰時にも見る（バックグラウンドのままウィジェットを押されるため）
  useEffect(() => {
    if (!isNative()) {
      setWidgetSynced(true)
      return
    }
    const drain = async () => {
      const pending = await pullPendingRecords()
      if (pending.length > 0) {
        setState((s) => {
          let nextRecords = s.records
          for (const p of pending) {
            nextRecords = markDone(nextRecords, p.date, p.kind, p.menuTitle, p.minutes)
          }
          return { ...s, records: nextRecords }
        })
      }
      const w = await readWidgetState()
      if (w && w.timerRunning && w.timerStartedAt > 0 && w.date === todayStr()) {
        setState((s) =>
          s.timer
            ? s
            : {
                ...s,
                timer: {
                  kind: 'full',
                  menuTitle: w.todayMenu ?? '今日のメニュー',
                  startedAt: w.timerStartedAt,
                },
              },
        )
      }
    }
    // 取り込みが終わるまでウィジェットへの書き戻しを止める（先に上書きしないため）
    drain().finally(() => setWidgetSynced(true))
    const onVis = () => {
      if (document.visibilityState === 'visible') drain()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // 状態が変わるたびにウィジェットへ反映
  useEffect(() => {
    if (!state.profile) return
    if (!isNative()) return
    if (!widgetSynced) return
    const plan = buildDailyPlan(state, today)
    const todayRec = state.records.find((r) => r.date === today)
    const fullDone = todayRec?.full === true
    const locked = access.kind === 'locked'
    syncWidgetState({
      date: today,
      // 体験切れのときはウィジェットからも運動を始められないようにする
      todayMenu: locked
        ? 'アプリを開いて、続きの手続きをしてください'
        : (plan.menuOptions[0]?.title ?? null),
      fullDone,
      timerRunning: !locked && !!state.timer,
      timerStartedAt: state.timer?.startedAt ?? 0,
      locked,
      // 購入済みなら期限なし。体験中は最終日を渡して、アプリを開かないまま
      // 期限を過ぎたときもウィジェット側で止められるようにする。
      accessUntil:
        access.kind === 'purchased' ? '' : accessUntil(state.purchase, today),
    })
  }, [state, today, widgetSynced, access.kind])

  // ストアの状態をアプリに合わせる。価格の表示と、購入済みかどうかの照合。
  // 復帰時と、アプリの外で購入が確定したときにも見る
  // （承認待ちが通った・別端末で買った・返金された、に追いつくため）
  useEffect(() => {
    if (!hasStore()) return
    let alive = true
    const sync = async () => {
      const { ok, products } = await loadProducts()
      if (alive) {
        const full = products.find((p) => p.id === PRODUCT_FULL)
        if (full?.price) setFullPrice(full.price)
        setPriceKnown(ok && !!full?.price)
      }
      const owned = await ownedProducts()
      if (!alive) return
      setState((s) => ({ ...s, purchase: mergeStoreState(s.purchase, owned) }))
    }
    sync()
    setStoreSync(() => sync)

    const onVis = () => {
      if (document.visibilityState === 'visible') sync()
    }
    document.addEventListener('visibilitychange', onVis)
    let removeListener: (() => void) | null = null
    onPurchasesUpdated(() => sync()).then((remove) => {
      if (alive) removeListener = remove
      else remove()
    })
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVis)
      removeListener?.()
    }
  }, [])

  useEffect(() => {
    const lock = tab === 'today' || tab === 'records'
    document.body.classList.toggle('no-scroll', lock)
    return () => document.body.classList.remove('no-scroll')
  }, [tab])

  // 通知のスケジュール
  // ・ネイティブ：LocalNotifications で日次繰り返しを OS に登録（閉じてても届く）
  // ・Web：アプリ起動中の setTimeout ＋ 起動時キャッチアップ
  useEffect(() => {
    if (isNative()) {
      if (state.notify.enabled) {
        const metrics = computeMetrics(state, today)
        const copy = reminderCopy(metrics.currentGap)
        scheduleDailyNative(state.notify.time, copy.title, copy.body)
      } else {
        cancelDailyNative()
      }
      return
    }

    if (!state.notify.enabled) return
    if (currentPermission() !== 'granted') return

    // 起動直後のキャッチアップ：今日まだ動いておらず、予定時刻を過ぎていれば出す
    const todayRecord = state.records.find((r) => r.date === today)
    const doneToday = !!todayRecord && (todayRecord.full || todayRecord.minimum)
    if (!doneToday) {
      const fire = nextFireAt(state.notify.time)
      const todayFire = fire - 24 * 60 * 60 * 1000
      if (Date.now() >= todayFire) {
        fireDailyIfDue(today)
      }
    }

    let timerId: number | undefined
    const schedule = () => {
      const at = nextFireAt(state.notify.time)
      const delay = at - Date.now()
      timerId = window.setTimeout(async () => {
        const metrics = computeMetrics(state, today)
        const copy = reminderCopy(metrics.currentGap)
        await showNotification(copy.title, copy.body)
        schedule()
      }, Math.max(1000, delay))
    }
    schedule()
    return () => {
      if (timerId !== undefined) window.clearTimeout(timerId)
    }
  }, [state.notify.enabled, state.notify.time, state.records, today])

  const beginTrialLocally = () =>
    setState((s) => ({
      ...s,
      purchase: {
        ...s.purchase,
        trialStartedAt: s.purchase.trialStartedAt ?? todayStr(),
      },
    }))

  // 体験をはじめる。iOSだけ ¥0 の体験用商品を通す（App Store の規約 3.1.1）
  const startTrial = async () => {
    setStoreMsg(null)
    if (!trialNeedsStore()) {
      beginTrialLocally()
      return
    }
    setStoreBusy(true)
    const res = await buy(PRODUCT_TRIAL)
    setStoreBusy(false)
    if (res === 'purchased') {
      beginTrialLocally()
      return
    }
    if (res === 'cancelled') return
    setStoreMsg(
      '体験を始められませんでした。通信を確かめて、もう一度お試しください。',
    )
  }

  const buyFull = async () => {
    setStoreMsg(null)
    setStoreBusy(true)
    const res = await buy(PRODUCT_FULL)
    setStoreBusy(false)
    if (res === 'purchased') {
      setState((s) => ({ ...s, purchase: { ...s.purchase, purchased: true } }))
      return
    }
    if (res === 'cancelled') return
    if (res === 'pending') {
      setStoreMsg('購入の承認待ちです。完了すると自動で使えるようになります。')
      return
    }
    setStoreMsg('購入できませんでした。通信を確かめて、もう一度お試しください。')
  }

  const restore = async () => {
    setStoreMsg(null)
    setStoreBusy(true)
    const owned = await restorePurchases()
    setStoreBusy(false)
    if (!owned.ok) {
      setStoreMsg('ストアに接続できませんでした。通信を確かめてください。')
      return
    }
    setState((s) => ({ ...s, purchase: mergeStoreState(s.purchase, owned) }))
    setStoreMsg(
      owned.items.some((o) => o.id === PRODUCT_FULL)
        ? '購入を復元しました。'
        : 'この Apple ID / Google アカウントでの購入は見つかりませんでした。',
    )
  }

  if (!state.profile) {
    return (
      <Onboarding
        onComplete={(profile: Profile) =>
          setState((s) => ({
            ...s,
            profile,
            createdAt: todayStr(),
          }))
        }
      />
    )
  }

  // 体験前・体験切れは、ここから先に進ませない
  if (access.kind === 'locked') {
    return (
      <Paywall
        mode={access.reason === 'not-started' ? 'start' : 'expired'}
        price={fullPrice}
        busy={storeBusy}
        message={storeMsg}
        canBuy={hasStore()}
        priceKnown={priceKnown}
        onRetryStore={() => storeSync?.()}
        onStartTrial={startTrial}
        onBuy={buyFull}
        onRestore={restore}
        onExport={() => {
          if (!downloadBackup()) setStoreMsg('書き出しに失敗しました。')
        }}
      />
    )
  }

  const startTimer = (kind: MenuKind, menuTitle: string) =>
    setState((s) => ({
      ...s,
      timer: { kind, menuTitle, startedAt: Date.now() },
    }))

  const finishTimer = () => {
    if (!state.timer) return
    const { kind, menuTitle, startedAt } = state.timer
    const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000))
    navigator.vibrate?.([12, 30, 18]) // 記録できた合図（対応端末のみ）
    setState((s) =>
      s.timer
        ? {
            ...s,
            records: markDone(s.records, today, kind, menuTitle, minutes),
            timer: null,
          }
        : s,
    )
    setTab('today')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelTimer = () => setState((s) => ({ ...s, timer: null }))

  const changeTab = (t: TabKey) => {
    setTab(t)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className={`app${state.timer ? ' has-timer' : ''}`}>
      <header className="app-header">
        <div className="brand">
          <img className="brand-mark" src="./icon.webp" alt="" />
          <span className="brand-name">ツヅキン</span>
        </div>
        <div className="tagline">止まっても戻れるボディメイク</div>
        <button
          className="header-menu"
          onClick={() => setSettingsOpen(true)}
          aria-label="設定"
        >
          <IconMenu size={20} />
        </button>
      </header>

      {access.kind === 'trial' && (
        <div className="trial-bar">
          <span>{trialLabel(access.daysLeft)}</span>
          {hasStore() && (
            <button onClick={buyFull} disabled={storeBusy}>
              {fullPrice}でずっと使う
            </button>
          )}
        </div>
      )}

      {tab === 'today' && (
        <Home state={state} today={today} onStart={startTimer} />
      )}
      {tab === 'records' && <Records state={state} today={today} />}
      {tab === 'continuity' && <Continuity state={state} today={today} />}

      {state.timer && (
        <TimerBar
          timer={state.timer}
          onFinish={finishTimer}
          onCancel={cancelTimer}
        />
      )}
      <TabBar tab={tab} onChange={changeTab} />

      {settingsOpen && (
        <Settings
          profile={state.profile}
          notify={state.notify}
          access={access}
          price={fullPrice}
          storeBusy={storeBusy}
          canBuy={hasStore()}
          onBuy={buyFull}
          onRestore={restore}
          onSave={(profile) => setState((s) => ({ ...s, profile }))}
          onNotifyChange={(notify) => setState((s) => ({ ...s, notify }))}
          onReplaceState={(next) => setState(next)}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
