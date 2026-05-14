import { useEffect, useMemo, useState } from 'react'
import {
  clearRecord,
  loadState,
  saveState,
  setRecord,
  todayStr,
  type AppState,
  type DayStatus,
  type Profile,
} from './state'
import Onboarding from './components/Onboarding'
import Home from './components/Home'
import Records from './components/Records'
import Continuity from './components/Continuity'
import { TabBar, type TabKey } from './components/TabBar'

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

  const log = (status: DayStatus) =>
    setState((s) => ({ ...s, records: setRecord(s.records, today, status) }))
  const unlog = () =>
    setState((s) => ({ ...s, records: clearRecord(s.records, today) }))

  return (
    <div className="app">
      <header className="app-header">
        <h1>KeepOn</h1>
        <div className="tagline">止まっても、戻れる。</div>
      </header>

      {tab === 'today' && (
        <Home state={state} today={today} onLog={log} onUnlog={unlog} />
      )}
      {tab === 'records' && <Records state={state} today={today} />}
      {tab === 'continuity' && <Continuity state={state} today={today} />}

      <TabBar tab={tab} onChange={setTab} />
    </div>
  )
}
