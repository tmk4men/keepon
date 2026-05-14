import {
  daysBetween,
  recordOn,
  type AppState,
  type DayStatus,
} from '../state'
import { buildDailyPlan, computeMetrics, type DailyMode } from '../logic'
import { IconCheck, IconLeaf, IconSpark, StampDone, StampMin } from './icons'

const MODE_TAG: Record<DailyMode, string | null> = {
  normal: null,
  light: '少し軽めに',
  comeback: 'ゆっくり戻る日',
}

export default function Home({
  state,
  today,
  onUnlog,
  onStart,
}: {
  state: AppState
  today: string
  onUnlog: () => void
  onStart: (kind: 'full' | 'minimum', menuTitle: string) => void
}) {
  const plan = buildDailyPlan(state, today)
  const metrics = computeMetrics(state, today)
  const todayRec = recordOn(state.records, today)
  const timerRunning = state.timer !== null

  const fullDone = todayRec?.status === 'full'
  const minDone = todayRec?.status === 'minimum'

  const priorActive = state.records
    .filter(
      (r) => r.date < today && (r.status === 'full' || r.status === 'minimum'),
    )
    .map((r) => r.date)
    .sort()
    .pop()
  const priorGap = priorActive
    ? daysBetween(priorActive, today)
    : daysBetween(state.createdAt, today)

  return (
    <div className="screen">
      <Outlook metrics={metrics} />

      {timerRunning ? (
        <div className="card running-card reveal">
          <span className="running-dot" />
          <h2 className="running-title">運動中</h2>
          <p className="running-msg">
            下のタイマーで時間を計っています。
            <br />
            終わったら「終了して記録」を押してください。
          </p>
        </div>
      ) : (
        <>
          {todayRec && (
            <DoneBanner
              status={todayRec.status}
              priorGap={priorGap}
              onUnlog={onUnlog}
            />
          )}

          {/* メインのメニュー */}
          <div
            className={`card menu-card mode-${plan.mode}${
              fullDone ? ' is-done' : ''
            } reveal`}
          >
            {fullDone && (
              <StampDone size={58} className="card-stamp stamp-full" />
            )}
            <div className="menu-eyebrow">
              <span>今日のメニュー</span>
              {MODE_TAG[plan.mode] && (
                <span className={`mode-tag ${plan.mode}`}>
                  {MODE_TAG[plan.mode]}
                </span>
              )}
            </div>
            <h2 className="menu-title">{plan.menu.title}</h2>
            <p className="menu-detail">{plan.menu.detail}</p>

            {plan.comebackNote && (
              <div className="comeback-note">
                <IconSpark size={15} className="cn-ico" />
                <span>{plan.comebackNote}</span>
              </div>
            )}

            <div className="menu-foot">
              <span className="menu-minutes">めやす {plan.menu.minutes}分</span>
              {fullDone ? (
                <span className="menu-done-mark">完了</span>
              ) : (
                <button
                  className="btn-start"
                  onClick={() => onStart('full', plan.menu.title)}
                >
                  開始
                </button>
              )}
            </div>
          </div>

          {/* 最低ライン */}
          <div
            className={`card menu-card min-line${
              minDone ? ' is-done' : ''
            } reveal reveal-2`}
          >
            {minDone && (
              <StampMin size={58} className="card-stamp stamp-min" />
            )}
            <div className="menu-eyebrow">
              <span>最低ライン</span>
              <span className="mode-tag min">これだけでも継続成功</span>
            </div>
            <h2 className="menu-title">{plan.minimum.title}</h2>
            <p className="menu-detail">{plan.minimum.detail}</p>
            <div className="menu-foot">
              <span className="menu-minutes">
                めやす {plan.minimum.minutes}分
              </span>
              {minDone ? (
                <span className="menu-done-mark min">完了</span>
              ) : (
                <button
                  className="btn-start min"
                  onClick={() => onStart('minimum', plan.minimum.title)}
                >
                  開始
                </button>
              )}
            </div>
          </div>

          <p className="foot-note reveal reveal-3">
            「開始」を押すと下でタイマーが動き、終了すると自動で記録されます。
          </p>
        </>
      )}
    </div>
  )
}

function Outlook({ metrics }: { metrics: ReturnType<typeof computeMetrics> }) {
  const { outlook } = metrics
  return (
    <div className={`outlook outlook-${outlook.level}`}>
      <div className="outlook-bar" />
      <div className="outlook-body">
        <div className="outlook-head">
          <span className="outlook-tag">復帰可能性</span>
          <span className="outlook-label">{outlook.label}</span>
        </div>
        <p className="outlook-text">{outlook.text}</p>
      </div>
    </div>
  )
}

function DoneBanner({
  status,
  priorGap,
  onUnlog,
}: {
  status: DayStatus
  priorGap: number
  onUnlog: () => void
}) {
  const cameBack = priorGap >= 4 && (status === 'full' || status === 'minimum')

  let ringClass = 'level-full'
  let title = '今日は記録ずみ'
  let sub = 'メニュー完了。おつかれさま。'
  let Icon = IconCheck

  if (status === 'minimum') {
    ringClass = 'level-min'
    sub = '最低ライン達成。ゼロを作らなかった。'
  } else if (status === 'rest') {
    ringClass = 'level-rest'
    sub = '計画的なお休み。これも続けるうち。'
    Icon = IconLeaf
  }

  if (cameBack) {
    ringClass = 'level-comeback'
    title = 'おかえり。戻ってこれた'
    sub = `${priorGap}日空いても、ここに戻ってきた。`
    Icon = IconSpark
  }

  return (
    <div className="done-banner reveal">
      <div className={`done-banner-ring ${ringClass}`}>
        <Icon size={19} />
      </div>
      <div className="done-banner-body">
        <div className="done-banner-title">{title}</div>
        <div className="done-banner-sub">{sub}</div>
      </div>
      <button className="done-banner-undo" onClick={onUnlog}>
        取り消す
      </button>
    </div>
  )
}
