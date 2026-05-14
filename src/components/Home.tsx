import { useState } from 'react'
import {
  daysBetween,
  recordOn,
  type AppState,
  type DayStatus,
} from '../state'
import { buildDailyPlan, computeMetrics, type DailyMode } from '../logic'
import { IconCheck, IconLeaf, IconSpark } from './icons'

const MODE_LABEL: Record<DailyMode, string> = {
  normal: '通常モード',
  light: '軽めモード',
  comeback: '復帰モード',
}

export default function Home({
  state,
  today,
  onLog,
  onUnlog,
}: {
  state: AppState
  today: string
  onLog: (s: DayStatus) => void
  onUnlog: () => void
}) {
  const [editing, setEditing] = useState(false)
  const plan = buildDailyPlan(state, today)
  const metrics = computeMetrics(state, today)
  const todayRec = recordOn(state.records, today)

  // 今日より前の「最後に動いた日」からの空白（戻ってきた演出の判定用）
  const priorActive = state.records
    .filter((r) => r.date < today && (r.status === 'full' || r.status === 'minimum'))
    .map((r) => r.date)
    .sort()
    .pop()
  const priorGap = priorActive
    ? daysBetween(priorActive, today)
    : daysBetween(state.createdAt, today)

  const log = (s: DayStatus) => {
    onLog(s)
    setEditing(false)
  }

  return (
    <div className="screen">
      <Outlook metrics={metrics} />

      {todayRec && !editing ? (
        <DoneCard
          status={todayRec.status}
          priorGap={priorGap}
          onEdit={() => setEditing(true)}
        />
      ) : (
        <>
          {todayRec && editing && (
            <p className="edit-note">
              きろくを選び直すと上書きされます。
              <button className="link-btn" onClick={() => setEditing(false)}>
                やめる
              </button>
            </p>
          )}

          <div className={`card menu-card mode-${plan.mode} reveal`}>
            <span className={`menu-mode ${plan.mode}`}>
              {MODE_LABEL[plan.mode]}
            </span>
            <div className="card-label">今日やること</div>
            <h2 className="menu-title">{plan.menu.title}</h2>
            <p className="menu-detail">{plan.menu.detail}</p>
            <div className="menu-minutes">めやす {plan.menu.minutes} 分</div>

            {plan.comebackNote && (
              <div className="comeback-note">
                <IconSpark size={16} className="cn-ico" />
                <span>{plan.comebackNote}</span>
              </div>
            )}
          </div>

          <div className="card min-line reveal reveal-2">
            <div className="card-label">最低ライン — これだけでも「継続成功」</div>
            <h3 className="menu-title">{plan.minimum.title}</h3>
            <p className="menu-detail">{plan.minimum.detail}</p>
          </div>

          <div className="actions reveal reveal-3">
            <button className="btn btn-primary" onClick={() => log('full')}>
              <IconCheck size={18} />
              {plan.mode === 'comeback'
                ? '今日のメニュー、やった'
                : '通常メニュー、できた'}
            </button>
            <button className="btn btn-min" onClick={() => log('minimum')}>
              <IconCheck size={18} />
              最低ラインだけ、やった
            </button>
            <button className="btn btn-ghost" onClick={() => log('rest')}>
              今日は計画的に休む
            </button>
          </div>

          <p className="foot-note">
            「できなかった」を記録する必要はありません。
            <br />
            動けた分だけ、ここに残していきましょう。
          </p>
        </>
      )}

      {todayRec && !editing && (
        <button className="btn btn-ghost reset-undo" onClick={onUnlog}>
          今日のきろくを取り消す
        </button>
      )}
    </div>
  )
}

function Outlook({ metrics }: { metrics: ReturnType<typeof computeMetrics> }) {
  const { outlook } = metrics
  return (
    <div className={`outlook outlook-${outlook.level}`}>
      <div className="outlook-head">
        <span className="outlook-tag">復帰可能性</span>
        <span className="outlook-label">{outlook.label}</span>
      </div>
      <p className="outlook-text">{outlook.text}</p>
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
  let msg = 'しっかり動けた一日。この積み重ねが、戻る力の土台になります。'
  let Icon = IconCheck

  if (status === 'minimum') {
    ringClass = 'level-min'
    title = 'ゼロを作らなかった'
    msg =
      '最低ラインでも、立派な「継続成功」。今日のあなたは、止まらなかった。'
  } else if (status === 'rest') {
    ringClass = 'level-rest'
    title = '計画的なお休み'
    msg = '休むのも続けるうち。明日また、軽くからで大丈夫です。'
    Icon = IconLeaf
  }

  if (cameBack) {
    ringClass = 'level-comeback'
    title = 'おかえり。戻ってこれた'
    msg = `${priorGap}日空いても、あなたはここに戻ってきた。これがいちばん難しくて、いちばんすごいこと。`
    Icon = IconSpark
  }

  return (
    <div className="card done-card reveal">
      <div className={`done-ring ${ringClass}`}>
        <Icon size={30} />
      </div>
      <div className="done-title">{title}</div>
      <p className="done-msg">{msg}</p>
      <button className="btn btn-ghost btn-small" onClick={onEdit}>
        きろくを変更
      </button>
    </div>
  )
}
