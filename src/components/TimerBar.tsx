import { useEffect, useState } from 'react'
import type { RunningTimer } from '../state'
import { IconCheck } from './icons'

export function TimerBar({
  timer,
  onFinish,
  onCancel,
}: {
  timer: RunningTimer
  onFinish: () => void
  onCancel: () => void
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const elapsed = Math.max(0, Math.floor((now - timer.startedAt) / 1000))
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  return (
    <div className={`timer-bar timer-${timer.kind}`}>
      <button
        className="timer-cancel"
        onClick={onCancel}
        aria-label="中止する"
      >
        中止
      </button>

      <div className="timer-main">
        <div className="timer-status">
          <span className="timer-pulse" />
          {timer.kind === 'minimum' ? '最低ライン' : 'メニュー'}を実施中
        </div>
        <div className="timer-clock">
          {mm}
          <span className="timer-colon">:</span>
          {ss}
        </div>
        <div className="timer-menu">{timer.menuTitle}</div>
      </div>

      <button className="timer-finish" onClick={onFinish}>
        <IconCheck size={19} />
        終了して記録
      </button>
    </div>
  )
}
