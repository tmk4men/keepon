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
import { TabBar, type TabKey } from './components/TabBar'
import { TimerBar } from './components/TimerBar'
import { IconLeaf } from './components/icons'

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState())
  const [tab, setTab] = useState<TabKey>('today')
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
    const kind = state.timer.kind
    setState((s) =>
      s.timer
        ? { ...s, records: markDone(s.records, today, kind), timer: null }
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
    </div>
  )
}
