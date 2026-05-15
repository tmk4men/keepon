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

  if (!state.profile) {
    return (
      <Onboarding
        onComplete={(profile: Profile) =>
          setState((s) => ({ ...s, profile, createdAt: todayStr() }))
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
          onSave={(profile) => setState((s) => ({ ...s, profile }))}
          onReplaceState={(next) => setState(next)}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
