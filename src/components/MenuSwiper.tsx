import { useRef, useState } from 'react'
import type { Menu } from '../menus'
import type { MenuKind } from '../state'
import { IconSpark } from './icons'

// 今日のメニュー候補（2つ）を左右スワイプで切り替えて選ぶカード内コンテンツ
export function MenuSwiper({
  menuOptions,
  modeTag,
  modeClass,
  comebackNote,
  done,
  timeEase,
  onStart,
}: {
  menuOptions: Menu[]
  modeTag: string | null
  modeClass: string
  comebackNote: string | null
  done: boolean
  timeEase: number
  onStart: (kind: MenuKind, menuTitle: string) => void
}) {
  const [index, setIndex] = useState(0)
  const [drag, setDrag] = useState(0)
  const startX = useRef(0)
  const startY = useRef(0)
  const dragging = useRef(false)

  const count = menuOptions.length
  const clampedIndex = Math.min(index, count - 1)

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    dragging.current = true
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current) return
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current
    if (Math.abs(dx) < Math.abs(dy)) return // 縦スクロール優先
    // 端では引っぱり抵抗をかける
    let eff = dx
    if ((clampedIndex === 0 && dx > 0) || (clampedIndex === count - 1 && dx < 0)) {
      eff = dx / 3.2
    }
    setDrag(eff)
  }
  const onTouchEnd = () => {
    dragging.current = false
    const threshold = 46
    if (drag < -threshold && clampedIndex < count - 1) {
      setIndex(clampedIndex + 1)
    } else if (drag > threshold && clampedIndex > 0) {
      setIndex(clampedIndex - 1)
    }
    setDrag(0)
  }

  const trackStyle: React.CSSProperties = {
    transform: `translateX(calc(${-clampedIndex * 100}% + ${drag}px))`,
    transition: dragging.current ? 'none' : 'transform 0.32s cubic-bezier(0.22,0.61,0.36,1)',
  }

  return (
    <div className="menu-swipe">
      <div
        className="menu-track"
        style={trackStyle}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {menuOptions.map((m, i) => (
          <div className="menu-slide" key={i}>
            <div className="menu-eyebrow">
              <span>今日のメニュー</span>
              {modeTag && (
                <span className={`mode-tag ${modeClass}`}>{modeTag}</span>
              )}
              <span className="menu-eyebrow-count">
                {i + 1} / {count}
              </span>
            </div>
            <h2 className="menu-title">{m.title}</h2>
            <p className="menu-detail">{m.detail}</p>

            {comebackNote && (
              <div className="comeback-note">
                <IconSpark size={15} className="cn-ico" />
                <span>{comebackNote}</span>
              </div>
            )}

            <div className="menu-foot">
              <span className="menu-minutes">
                めやす {Math.max(1, Math.round(m.minutes * timeEase))}分
                {timeEase < 1 && (
                  <span className="menu-ease">ゆっくりでOK</span>
                )}
              </span>
              {done ? (
                <span className="menu-done-mark">完了</span>
              ) : (
                <button
                  className="btn-start"
                  onClick={() => onStart('full', m.title)}
                >
                  開始
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="menu-swipe-foot">
        <span className="menu-swipe-hint">← スワイプで選ぶ →</span>
        <div className="menu-dots">
          {menuOptions.map((_, i) => (
            <button
              key={i}
              className={`menu-dot${i === clampedIndex ? ' active' : ''}`}
              onClick={() => setIndex(i)}
              aria-label={`メニュー${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
