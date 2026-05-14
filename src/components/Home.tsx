import { useState } from 'react'
import {
  daysBetween,
  recordOn,
  type AppState,
  type DayStatus,
} from '../state'
import { buildDailyPlan, computeMetrics, type DailyMode } from '../logic'
import { IconCheck, IconLeaf, IconSpark } from './icons'

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
  const [editing, setEditing] = useState(false)
  const plan = buildDailyPlan(state, today)
  const metrics = computeMetrics(state, today)
  const todayRec = recordOn(state.records, today)
  const timerRunning = state.timer !== null

  const start = (kind: 'full' | 'minimum', menuTitle: string) => {
    onStart(kind, menuTitle)
    setEditing(false)
  }

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

      {todayRec && !editing && !timerRunning ? (
        <>
          <DoneCard
            status={todayRec.status}
            priorGap={priorGap}
            onEdit={() => setEditing(true)}
          />
          <button className="text-undo" onClick={onUnlog}>
            今日のきろくを取り消す
          </button>
        </>
      ) : timerRunning ? (
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
          {editing && (
            <p className="edit-note">
              選び直すと今日のきろくが上書きされます。
              <button className="link-btn" onClick={() => setEditing(false)}>
                やめる
              </button>
            </p>
          )}

          {/* メインのメニュー */}
          <div className={`card menu-card mode-${plan.mode} reveal`}>
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
              <button
                className="btn-start"
                onClick={() => start('full', plan.menu.title)}
              >
                開始
              </button>
            </div>
          </div>

          {/* 最低ライン */}
          <div className="card menu-card min-line reveal reveal-2">
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
              <button
                className="btn-start min"
                onClick={() => start('minimum', plan.minimum.title)}
              >
                開始
              </button>
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

function DoneCard({
  status,
  priorGap,
  onEdit,
}: {
  status: DayStatus
  priorGap: number
  onEdit: () => void
}) {
  const cameBack = priorGap >= 4 && (status === 'full' || status === 'minimum')

  let ringClass = 'level-full'
  let title = '今日も継続成功'
  let msg = 'しっかり動けた一日。この積み重ねが、戻る力になる。'
  let Icon = IconCheck

  if (status === 'minimum') {
    ringClass = 'level-min'
    title = 'ゼロを作らなかった'
    msg = '最低ラインでも、立派な継続成功。今日のあなたは止まらなかった。'
  } else if (status === 'rest') {
    ringClass = 'level-rest'
    title = '計画的なお休み'
    msg = '休むのも続けるうち。明日はまた軽くからで大丈夫。'
    Icon = IconLeaf
  }

  if (cameBack) {
    ringClass = 'level-comeback'
    title = 'おかえり。戻ってこれた'
    msg = `${priorGap}日空いても、ここに戻ってきた。いちばん難しいことを、今日やった。`
    Icon = IconSpark
  }

  return (
    <div className="card done-card reveal">
      <div className={`done-ring ${ringClass}`}>
        <Icon size={28} />
      </div>
      <div className="done-title">{title}</div>
      <p className="done-msg">{msg}</p>
      <button className="btn btn-ghost btn-small" onClick={onEdit}>
        きろくを変更
      </button>
    </div>
  )
}
