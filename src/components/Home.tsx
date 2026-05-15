import { daysBetween, recordOn, type AppState, type MenuKind } from '../state'
import { buildDailyPlan, weeklyProgress, type WeeklyPace } from '../logic'
import { IconCheck, IconSpark, StampDone } from './icons'
import { MenuSwiper } from './MenuSwiper'
import type { DailyMode } from '../logic'

const MODE_TAG: Record<DailyMode, string | null> = {
  normal: null,
  light: '少し軽めに',
  comeback: 'ゆっくり戻る日',
}

export default function Home({
  state,
  today,
  onStart,
}: {
  state: AppState
  today: string
  onStart: (kind: MenuKind, menuTitle: string) => void
}) {
  const plan = buildDailyPlan(state, today)
  const pace = weeklyProgress(state, today)
  const todayRec = recordOn(state.records, today)
  const timerRunning = state.timer !== null

  const fullDone = todayRec?.full === true
  const minDone = todayRec?.minimum === true

  const priorActive = state.records
    .filter((r) => r.date < today && (r.full || r.minimum))
    .map((r) => r.date)
    .sort()
    .pop()
  const priorGap = priorActive
    ? daysBetween(priorActive, today)
    : daysBetween(state.createdAt, today)

  return (
    <div className="screen">
      <WeeklyPaceBar pace={pace} />

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
          {(fullDone || minDone) && (
            <DoneBanner full={fullDone} minimum={minDone} priorGap={priorGap} />
          )}

          {/* メインのメニュー（2候補をスワイプで選ぶ） */}
          <div
            className={`card menu-card mode-${plan.mode}${
              fullDone ? ' is-done' : ''
            } reveal`}
          >
            {fullDone && (
              <StampDone size={58} className="card-stamp stamp-full" />
            )}
            <MenuSwiper
              menuOptions={plan.menuOptions}
              modeTag={MODE_TAG[plan.mode]}
              modeClass={plan.mode}
              comebackNote={plan.comebackNote}
              done={fullDone}
              timeEase={plan.timeEase}
              onStart={onStart}
            />
          </div>

          {plan.bmiNote && <p className="age-note reveal">{plan.bmiNote}</p>}
          {plan.ageNote && <p className="age-note reveal">{plan.ageNote}</p>}

          {/* 最低ライン */}
          <div
            className={`card menu-card min-line${
              minDone ? ' is-done' : ''
            } reveal reveal-2`}
          >
            {minDone && (
              <StampDone size={58} className="card-stamp stamp-min" />
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
            メニューと最低ラインは、両方やってもOK。
          </p>
        </>
      )}
    </div>
  )
}

function WeeklyPaceBar({ pace }: { pace: WeeklyPace }) {
  const dots = Math.max(pace.target, pace.done)
  return (
    <div className={`week-pace${pace.met ? ' met' : ''}`}>
      <div className="week-pace-head">
        <span className="week-pace-label">今週のペース</span>
        <span className="week-pace-count">
          {pace.done}
          <span className="week-pace-sep"> / </span>
          {pace.target}
          <span className="unit">回</span>
        </span>
      </div>
      <div className="week-pace-dots">
        {Array.from({ length: dots }).map((_, i) => (
          <span
            key={i}
            className={`week-dot${i < pace.done ? ' on' : ''}${
              i >= pace.target ? ' bonus' : ''
            }`}
          />
        ))}
      </div>
      <p className="week-pace-msg">
        {pace.met
          ? '今週の目標、クリア。ここからは全部おまけ。'
          : '焦らなくて大丈夫。1日でも動けたら、それがペース。'}
      </p>
    </div>
  )
}

function DoneBanner({
  full,
  minimum,
  priorGap,
}: {
  full: boolean
  minimum: boolean
  priorGap: number
}) {
  const cameBack = priorGap >= 4

  let ringClass = full ? 'level-full' : 'level-min'
  let title = '今日は記録ずみ'
  let sub: string
  let Icon = IconCheck

  if (full && minimum) {
    sub = 'メニューと最低ライン、両方やった。すごい。'
  } else if (full) {
    sub = 'メニュー完了。お疲れさま！'
  } else {
    sub = '最低ライン達成。ゼロを作らなかった。'
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
    </div>
  )
}
