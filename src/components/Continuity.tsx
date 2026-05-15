import { useEffect, useRef, useState } from 'react'
import {
  coachLine,
  computeMetrics,
  weeklyMinutes,
  type CoachLine,
  type DayMinutes,
} from '../logic'
import type { AppState } from '../state'
import { IconSpark } from './icons'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

export default function Continuity({
  state,
  today,
}: {
  state: AppState
  today: string
}) {
  const m = computeMetrics(state, today)
  const week = weeklyMinutes(state, today)

  if (!m.hasData) {
    return (
      <div className="screen">
        <h2 className="screen-title">継続力</h2>
        <div className="card">
          <p className="center-msg">
            まだ記録がありません。
            <br />
            一度でも動けたら、ここに「戻る力」が育っていきます。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <h2 className="screen-title">継続力</h2>

      <div className={`card resilience-card outlook-${m.outlook.level}`}>
        <ResilienceRing score={m.resilience} level={m.outlook.level} />
        <div className="resilience-label">スコア</div>
        <div className="resilience-outlook">{m.outlook.label}</div>
        <CoachBubble line={coachLine(m.outlook.level, today)} />
      </div>

      <div className="card hero-stat reveal">
        <div className="hero-stat-ico">
          <IconSpark size={24} />
        </div>
        <div className="hero-stat-body">
          <div className="hero-stat-n">
            {m.comebackCount}
            <span className="unit">回</span>
          </div>
          <div className="hero-stat-l">空白から戻ってこれた回数</div>
        </div>
      </div>

      <h3 className="section-title">直近1週間の活動量</h3>
      <div className="card week-min-card reveal">
        <WeeklyMinutesChart data={week} />
      </div>

      <h3 className="section-title">戻る力の中身</h3>
      <div className="card metrics-card reveal-2">
        <Metric
          name="復帰率"
          desc="空白に入ったあと、戻ってこれた割合"
          value={`${Math.round(m.comebackRate * 100)}`}
          unit="%"
        />
        <Metric
          name="戻る速度"
          desc="空白から戻るまでにかかった平均日数"
          value={m.avgComebackDays > 0 ? m.avgComebackDays.toFixed(1) : 'ー'}
          unit={m.avgComebackDays > 0 ? '日' : ''}
        />
        <Metric
          name="挫折の回数"
          desc="数日空いてしまったことがある回数（戻ればOK）"
          value={`${m.setbackCount}`}
          unit="回"
        />
      </div>

      <h3 className="section-title">これまでの積み重ね</h3>
      <div className="card metrics-card reveal-3">
        <Metric name="動けた日" value={`${m.totalActive}`} unit="日" />
        <Metric
          name="最長だった空白"
          desc="これだけ空いても、ここまで戻ってこれた"
          value={`${m.longestGap}`}
          unit="日"
        />
        <Metric name="いまの空白" value={`${m.currentGap}`} unit="日" />
      </div>
    </div>
  )
}

function CoachBubble({ line }: { line: CoachLine }) {
  return (
    <div className="coach">
      <img className="coach-ico" src={`./coach${line.icon}.png`} alt="" />
      <div className={`coach-bubble${line.excited ? ' excited' : ''}`}>
        {line.text}
      </div>
    </div>
  )
}

function WeeklyMinutesChart({ data }: { data: DayMinutes[] }) {
  const max = Math.max(10, ...data.map((d) => d.minutes))
  const lastIdx = data.length - 1
  return (
    <div className="week-min-chart">
      {data.map((d, i) => (
        <div className="week-min-col" key={d.date}>
          <div className="week-min-val">{d.minutes > 0 ? d.minutes : ''}</div>
          <div className="week-min-track">
            <div
              className={`week-min-bar${d.minutes > 0 ? ' on' : ''}`}
              style={{
                height: `${(d.minutes / max) * 100}%`,
                animationDelay: `${i * 0.055}s`,
              }}
            />
          </div>
          <div
            className={`week-min-dow${i === lastIdx ? ' today' : ''}`}
          >
            {WEEKDAYS[d.dow]}
          </div>
        </div>
      ))}
    </div>
  )
}

function ResilienceRing({
  score,
  level,
}: {
  score: number
  level: string
}) {
  // ゲージと数字を 0 → score までアニメーションさせる
  const [shown, setShown] = useState(0)
  const rafRef = useRef(0)

  useEffect(() => {
    const start = performance.now()
    const dur = 1000
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(Math.round(score * eased))
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [score])

  const r = 54
  const c = 2 * Math.PI * r
  const offset = c * (1 - shown / 100)
  return (
    <div className="ring-wrap">
      <svg width="148" height="148" viewBox="0 0 148 148">
        <circle
          cx="74"
          cy="74"
          r={r}
          className="ring-track"
          strokeWidth="12"
          fill="none"
        />
        <circle
          cx="74"
          cy="74"
          r={r}
          className={`ring-fill ring-${level}`}
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 74 74)"
        />
      </svg>
      <div className="ring-center">
        <div className="ring-score">{shown}</div>
        <div className="ring-max">/ 100</div>
      </div>
    </div>
  )
}

function Metric({
  name,
  desc,
  value,
  unit,
}: {
  name: string
  desc?: string
  value: string
  unit: string
}) {
  return (
    <div className="metric-row">
      <div>
        <div className="metric-name">{name}</div>
        {desc && <div className="metric-desc">{desc}</div>}
      </div>
      <div className="metric-value">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
    </div>
  )
}
