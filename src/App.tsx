import { useEffect, useMemo, useState } from 'react'
import {
  clearRecord,
  loadState,
  saveState,
  setRecord,
  todayStr,
  type AppState,
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

  const unlog = () =>
    setState((s) => ({ ...s, records: clearRecord(s.records, today) }))

  const startTimer = (kind: 'full' | 'minimum', menuTitle: string) =>
    setState((s) => ({
      ...s,
      timer: { kind, menuTitle, startedAt: Date.now() },
    }))
  const finishTimer = () =>
    setState((s) =>
      s.timer
        ? {
            ...s,
            records: setRecord(s.records, today, s.timer.kind),
            timer: null,
          }
        : s,
    )
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
        <Home
          state={state}
          today={today}
          onUnlog={unlog}
          onStart={startTimer}
        />
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
