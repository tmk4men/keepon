import { useEffect, useState } from 'react'
import type { RunningTimer } from '../state'
import { IconCheck } from './icons'

// 開始直後の誤連打を防ぐ最小経過秒数
const MIN_SECONDS = 10

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
  const [earlyHit, setEarlyHit] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  // 「まだ早いよ」表示は少し経つと自動で引っ込める
  useEffect(() => {
    if (earlyHit === 0) return
    const id = window.setTimeout(() => setEarlyHit(0), 1100)
    return () => window.clearTimeout(id)
  }, [earlyHit])

  const elapsed = Math.max(0, Math.floor((now - timer.startedAt) / 1000))
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  const canFinish = elapsed >= MIN_SECONDS
  const remain = Math.max(0, MIN_SECONDS - elapsed)

  const handleFinish = () => {
    if (canFinish) {
      onFinish()
    } else {
      setEarlyHit((n) => n + 1)
    }
  }

  return (
    <div className={`timer-bar timer-${timer.kind}`}>
      {earlyHit > 0 && (
        <div className="timer-warn">
          まだ早いよ
          <span>あと{remain}秒</span>
        </div>
      )}

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
          実施中
        </div>
        <div className="timer-clock">
          {mm}
          <span className="timer-colon">:</span>
          {ss}
        </div>
        <div className="timer-menu">{timer.menuTitle}</div>
      </div>

      <button
        key={earlyHit}
        className={`timer-finish${earlyHit > 0 ? ' shake' : ''}`}
        onClick={handleFinish}
      >
        <IconCheck size={19} />
        終了して記録
      </button>
    </div>
  )
}

export function FinishedBar({
  kind,
  onHome,
}: {
  kind: 'full' | 'minimum'
  onHome: () => void
}) {
  return (
    <div className="timer-bar timer-done">
      <div className="timer-main timer-done-main">
        <div className="timer-status">
          <IconCheck size={14} />
          記録しました
        </div>
        <div className="timer-done-label">
          {kind === 'minimum' ? '最低ライン達成' : 'メニュー完了'}・おつかれさま
        </div>
      </div>
      <button className="timer-finish" onClick={onHome}>
        ホームに戻る
      </button>
    </div>
  )
}
