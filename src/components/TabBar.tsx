import { IconContinuity, IconRecords, IconToday } from './icons'

export type TabKey = 'today' | 'records' | 'continuity'

const TABS: { key: TabKey; label: string; Icon: typeof IconToday }[] = [
  { key: 'today', label: '今日', Icon: IconToday },
  { key: 'records', label: 'きろく', Icon: IconRecords },
  { key: 'continuity', label: '継続力', Icon: IconContinuity },
]

export function TabBar({
  tab,
  onChange,
}: {
  tab: TabKey
  onChange: (t: TabKey) => void
}) {
  return (
    <nav className="tabbar">
      {TABS.map(({ key, label, Icon }) => (
        <button
          key={key}
          className={tab === key ? 'active' : ''}
          onClick={() => onChange(key)}
          aria-label={label}
        >
          <Icon size={21} className="tab-ico" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
