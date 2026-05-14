import { useEffect, useState } from 'react'
import { parseDate, recordOn, toDateStr, type AppState } from '../state'
import { IconArrowBack, StampDone, StampMin } from './icons'

type CellStatus =
  | 'full'
  | 'minimum'
  | 'both'
  | 'missed'
  | 'pending'
  | 'future'
  | 'before'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function formatShort(s: string): string {
  const d = parseDate(s)
  return `${d.getMonth() + 1}/${d.getDate()}（${WEEKDAYS[d.getDay()]}）`
}

export default function Records({
  state,
  today,
}: {
  state: AppState
  today: string
}) {
  const todayDate = parseDate(today)
  const createdDate = parseDate(state.createdAt)
  const [view, setView] = useState({
    y: todayDate.getFullYear(),
    m: todayDate.getMonth(),
  })
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (!selected) return
    document
      .getElementById(`log-${selected}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [selected])

  const monthStart = new Date(view.y, view.m, 1)
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const leadBlanks = monthStart.getDay()

  const canPrev =
    new Date(view.y, view.m, 1) >
    new Date(createdDate.getFullYear(), createdDate.getMonth(), 1)
  const canNext =
    new Date(view.y, view.m, 1) <
    new Date(todayDate.getFullYear(), todayDate.getMonth(), 1)

  const shiftMonth = (d: number) => {
    setView((v) => {
      const nd = new Date(v.y, v.m + d, 1)
      return { y: nd.getFullYear(), m: nd.getMonth() }
    })
  }

  // 月内集計＋セル
  let full = 0
  let minimum = 0
  const cells: { day: number; date: string; status: CellStatus }[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const date = toDateStr(new Date(view.y, view.m, d))
    const rec = recordOn(state.records, date)
    let status: CellStatus
    if (date > today) status = 'future'
    else if (date < state.createdAt) status = 'before'
    else if (rec && (rec.full || rec.minimum)) {
      if (rec.full) full++
      if (rec.minimum) minimum++
      status = rec.full && rec.minimum ? 'both' : rec.full ? 'full' : 'minimum'
    } else if (date === today) status = 'pending'
    else status = 'missed'
    cells.push({ day: d, date, status })
  }

  // この月の記録一覧（新しい日付が上）
  const monthLog = state.records
    .filter((r) => {
      const d = parseDate(r.date)
      return (
        d.getFullYear() === view.y &&
        d.getMonth() === view.m &&
        (r.full || r.minimum)
      )
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  return (
    <div className="screen">
      <h2 className="screen-title">きろく</h2>
      <p className="screen-sub">動けた日に、スタンプがたまっていきます。</p>

      <div className="card stamp-card-sheet">
        <div className="cal-head">
          <button
            className="cal-nav"
            disabled={!canPrev}
            onClick={() => shiftMonth(-1)}
            aria-label="前の月"
          >
            <IconArrowBack size={16} />
          </button>
          <div className="cal-month">
            {view.y}年 {view.m + 1}月
          </div>
          <button
            className="cal-nav next"
            disabled={!canNext}
            onClick={() => shiftMonth(1)}
            aria-label="次の月"
          >
            <IconArrowBack size={16} />
          </button>
        </div>

        <div className="cal-weekdays">
          {WEEKDAYS.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className="cal-grid">
          {Array.from({ length: leadBlanks }).map((_, i) => (
            <span key={`b${i}`} className="cal-cell blank" />
          ))}
          {cells.map((c) => {
            const hasRec =
              c.status === 'full' ||
              c.status === 'minimum' ||
              c.status === 'both'
            const cls = `cal-cell ${c.status}${
              c.date === today ? ' is-today' : ''
            }${c.date === selected ? ' selected' : ''}`
            const inner = (
              <>
                <span className="cal-day">{c.day}</span>
                {(c.status === 'full' || c.status === 'both') && (
                  <StampDone size={34} className="stamp stamp-full" />
                )}
                {c.status === 'minimum' && (
                  <StampMin size={34} className="stamp stamp-min" />
                )}
                {c.status === 'both' && (
                  <StampMin size={18} className="stamp-extra stamp-min" />
                )}
              </>
            )
            return hasRec ? (
              <button
                key={c.date}
                className={cls}
                onClick={() =>
                  setSelected((cur) => (cur === c.date ? null : c.date))
                }
              >
                {inner}
              </button>
            ) : (
              <div key={c.date} className={cls}>
                {inner}
              </div>
            )
          })}
        </div>

        <div className="legend">
          <span>
            <StampDone size={22} className="lg-stamp stamp-full" />
            メニュー完了
          </span>
          <span>
            <StampMin size={22} className="lg-stamp stamp-min" />
            最低ライン
          </span>
          <span>
            <i className="lg-empty" />
            まだ
          </span>
        </div>
      </div>

      <div className="month-stats">
        <Stat n={full} label="メニュー" tone="full" />
        <Stat n={minimum} label="最低ライン" tone="min" />
        <Stat n={full + minimum} label="スタンプ合計" tone="total" />
      </div>

      {monthLog.length === 0 ? (
        <div className="card month-log-card">
          <p className="center-msg">この月のきろくは、まだありません。</p>
        </div>
      ) : (
        <div className="card month-log-card">
          <ul className="month-log">
            {monthLog.map((r) => (
              <li
                key={r.date}
                id={`log-${r.date}`}
                className={r.date === selected ? 'highlighted' : ''}
              >
                <span className="month-log-date">{formatShort(r.date)}</span>
                <div className="month-log-items">
                  {r.full && (
                    <div className="month-log-item">
                      <StampDone size={20} className="stamp-full" />
                      <span>{r.fullMenu ?? 'メニューを実施'}</span>
                    </div>
                  )}
                  {r.minimum && (
                    <div className="month-log-item">
                      <StampMin size={20} className="stamp-min" />
                      <span>{r.minimumMenu ?? '最低ラインを実施'}</span>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Stat({
  n,
  label,
  tone,
}: {
  n: number
  label: string
  tone: 'full' | 'min' | 'total'
}) {
  return (
    <div className={`mstat mstat-${tone}`}>
      <div className="mstat-n">{n}</div>
      <div className="mstat-l">{label}</div>
    </div>
  )
}
