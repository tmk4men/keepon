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
import { IconLeaf, IconMenu } from './components/icons'

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState())
  const [tab, setTab] = useState<TabKey>('today')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const today = useMemo(() => todayStr(), [])

  useEffect(() => {
    saveState(state)
  }, [state])

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
    const { kind, menuTitle } = state.timer
    setState((s) =>
      s.timer
        ? {
            ...s,
            records: markDone(s.records, today, kind, menuTitle),
            timer: null,
          }
        : s,
    )
    setTab('today')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelTimer = () => setState((s) => ({ ...s, timer: null }))

  return (
    <div className={`app${state.timer ? ' has-timer' : ''}`}>
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">
            <IconLeaf size={17} />
          </span>
          <span className="brand-name">KeepOn</span>
        </div>
        <div className="tagline">止まっても、戻れる。</div>
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
      <TabBar tab={tab} onChange={setTab} />

      {settingsOpen && (
        <Settings
          profile={state.profile}
          onSave={(profile) => setState((s) => ({ ...s, profile }))}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
