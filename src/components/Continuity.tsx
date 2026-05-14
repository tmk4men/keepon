import { computeMetrics } from '../logic'
import type { AppState } from '../state'
import { IconSpark } from './icons'

export default function Continuity({
  state,
  today,
}: {
  state: AppState
  today: string
}) {
  const m = computeMetrics(state, today)

  if (!m.hasData) {
    return (
      <div className="screen">
        <h2 className="screen-title">継続力</h2>
        <p className="screen-sub">
          がんばった量ではなく、「戻る力」を見える化します。
        </p>
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
      <p className="screen-sub">
        がんばった量ではなく、「戻る力」を見える化します。
      </p>

      <div className={`card resilience-card outlook-${m.outlook.level}`}>
        <ResilienceRing score={m.resilience} level={m.outlook.level} />
        <div className="resilience-label">崩壊耐性スコア</div>
        <div className="resilience-outlook">{m.outlook.label}</div>
        <p className="resilience-text">{m.outlook.text}</p>
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
      <p className="hint center">
        止まった回数じゃなく、戻った回数を数える。これがこのアプリの「達成感」。
      </p>

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
        <Metric
          name="動けた日"
          desc={`通常 ${m.fullCount}日 ／ 最低ライン ${m.minimumCount}日`}
          value={`${m.totalActive}`}
          unit="日"
        />
        <Metric
          name="計画的なお休み"
          desc="サボりではなく、選んで休んだ日"
          value={`${m.restCount}`}
          unit="日"
        />
        <Metric
          name="いまの空白"
          desc={
            m.currentGap > 0
              ? 'ここで戻れば、復帰率はまた上がる'
              : '空白なし。止まっていません'
          }
          value={`${m.currentGap}`}
          unit="日"
        />
      </div>

      <p className="foot-note">
        スコアが低くても問題ありません。
        <br />
        「また止まった」ところから戻るたびに、この数字は育ちます。
      </p>
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
  const r = 54
  const c = 2 * Math.PI * r
  const offset = c * (1 - score / 100)
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
        <div className="ring-score">{score}</div>
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
  desc: string
  value: string
  unit: string
}) {
  return (
    <div className="metric-row">
      <div>
        <div className="metric-name">{name}</div>
        <div className="metric-desc">{desc}</div>
      </div>
      <div className="metric-value">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
    </div>
  )
}
