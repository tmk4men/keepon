import { useState } from 'react'
import {
  formatJp,
  parseDate,
  recordOn,
  toDateStr,
  type AppState,
  type DayStatus,
} from '../state'
import { IconArrowBack } from './icons'

type CellStatus = DayStatus | 'missed' | 'pending' | 'future' | 'before'

const STATUS_LABEL: Record<DayStatus, string> = {
  full: '通常メニュー達成',
  minimum: '最低ライン達成',
  rest: '計画的なお休み',
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

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

  // 月内集計
  let full = 0
  let minimum = 0
  let rest = 0
  const cells: { day: number; date: string; status: CellStatus }[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const date = toDateStr(new Date(view.y, view.m, d))
    const rec = recordOn(state.records, date)
    let status: CellStatus
    if (date > today) status = 'future'
    else if (date < state.createdAt) status = 'before'
    else if (rec) {
      status = rec.status
      if (rec.status === 'full') full++
      else if (rec.status === 'minimum') minimum++
      else rest++
    } else if (date === today) status = 'pending'
    else status = 'missed'
    cells.push({ day: d, date, status })
  }

  const recent = [...state.records]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 14)

  return (
    <div className="screen">
      <h2 className="screen-title">きろく</h2>
      <p className="screen-sub">
        連続日数は数えません。「動けた日」を、見返すために。
      </p>

      <div className="card">
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
          {cells.map((c) => (
            <span
              key={c.date}
              className={`cal-cell ${c.status}${
                c.date === today ? ' is-today' : ''
              }`}
            >
              {c.day}
            </span>
          ))}
        </div>

        <div className="legend">
          <span>
            <i className="lg-full" />
            通常
          </span>
          <span>
            <i className="lg-min" />
            最低ライン
          </span>
          <span>
            <i className="lg-rest" />
            お休み
          </span>
          <span>
            <i className="lg-missed" />
            未記録
          </span>
        </div>
      </div>

      <div className="month-stats">
        <Stat n={full} label="通常" tone="full" />
        <Stat n={minimum} label="最低ライン" tone="min" />
        <Stat n={rest} label="お休み" tone="rest" />
      </div>

      <h3 className="section-title">さいきんの記録</h3>
      {recent.length === 0 ? (
        <div className="card">
          <p className="center-msg">
            まだ記録はありません。
            <br />
            今日の「今日」タブから、最初の一歩を残しましょう。
          </p>
        </div>
      ) : (
        <div className="card">
          <ul className="record-list">
            {recent.map((r) => (
              <li key={r.date}>
                <span className={`dot dot-${r.status}`} />
                <span className="r-date">{formatJp(r.date)}</span>
                <span className="r-label">{STATUS_LABEL[r.status]}</span>
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
  tone: 'full' | 'min' | 'rest'
}) {
  return (
    <div className={`mstat mstat-${tone}`}>
      <div className="mstat-n">{n}</div>
      <div className="mstat-l">{label}</div>
    </div>
  )
}
