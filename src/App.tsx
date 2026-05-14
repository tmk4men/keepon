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
import { TimerBar, FinishedBar } from './components/TimerBar'
import { IconLeaf } from './components/icons'

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState())
  const [tab, setTab] = useState<TabKey>('today')
  const [finished, setFinished] = useState<'full' | 'minimum' | null>(null)
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

  const startTimer = (kind: 'full' | 'minimum', menuTitle: string) => {
    setFinished(null)
    setState((s) => ({
      ...s,
      timer: { kind, menuTitle, startedAt: Date.now() },
    }))
  }
  const finishTimer = () => {
    if (!state.timer) return
    const kind = state.timer.kind
    setState((s) =>
      s.timer
        ? {
            ...s,
            records: setRecord(s.records, today, s.timer.kind),
            timer: null,
          }
        : s,
    )
    setFinished(kind)
  }
  const cancelTimer = () => setState((s) => ({ ...s, timer: null }))
  const backHome = () => {
    setFinished(null)
    setTab('today')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className={`app${state.timer || finished ? ' has-timer' : ''}`}>
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

      {state.timer ? (
        <TimerBar
          timer={state.timer}
          onFinish={finishTimer}
          onCancel={cancelTimer}
        />
      ) : finished ? (
        <FinishedBar kind={finished} onHome={backHome} />
      ) : null}
      <TabBar tab={tab} onChange={setTab} />
    </div>
  )
}
