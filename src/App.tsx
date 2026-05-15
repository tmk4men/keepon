import { useEffect, useMemo, useState } from 'react'
import {
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
  currentPermission,
  fireDailyIfDue,
  nextFireAt,
  reminderCopy,
  showNotification,
} from './notify'
import { computeMetrics } from './logic'

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState())
  const [tab, setTab] = useState<TabKey>('today')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const today = useMemo(() => todayStr(), [])

  useEffect(() => {
    saveState(state)
  }, [state])

  useEffect(() => {
    const lock = tab === 'today' || tab === 'records'
    document.body.classList.toggle('no-scroll', lock)
    return () => document.body.classList.remove('no-scroll')
  }, [tab])

  // 通知のスケジュール：アプリが開いている間、指定時刻で発火させる。
  // アプリを開いた瞬間「予定時刻を過ぎていてまだ未実施」ならキャッチアップ通知。
  useEffect(() => {
    if (!state.notify.enabled) return
    if (currentPermission() !== 'granted') return

    // 起動直後のキャッチアップ：今日まだ動いておらず、予定時刻を過ぎていれば出す
    const todayRecord = state.records.find((r) => r.date === today)
    const doneToday = !!todayRecord && (todayRecord.full || todayRecord.minimum)
    if (!doneToday) {
      const fire = nextFireAt(state.notify.time)
      // nextFireAt は「次回」を返すので、今日分を過ぎていれば fire は明日になる。
      // → 今日の予定時刻 = 明日のfire - 24h。それが既に過去ならキャッチアップ対象。
      const todayFire = fire - 24 * 60 * 60 * 1000
      if (Date.now() >= todayFire) {
        fireDailyIfDue(today)
      }
    }

    // 次回の発火を予約
    let timerId: number | undefined
    const schedule = () => {
      const at = nextFireAt(state.notify.time)
      const delay = at - Date.now()
      timerId = window.setTimeout(async () => {
        const metrics = computeMetrics(state, today)
        const copy = reminderCopy(metrics.currentGap)
        await showNotification(copy.title, copy.body)
        // 翌日分を再スケジュール
        schedule()
      }, Math.max(1000, delay))
    }
    schedule()
    return () => {
      if (timerId !== undefined) window.clearTimeout(timerId)
    }
  }, [state.notify.enabled, state.notify.time, state.records, today])

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
          onSave={(profile) => setState((s) => ({ ...s, profile }))}
          onNotifyChange={(notify) => setState((s) => ({ ...s, notify }))}
          onReplaceState={(next) => setState(next)}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
