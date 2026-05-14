// 軽量なインラインSVGアイコン（絵文字に頼らず統一感を出す）

type P = { size?: number; className?: string }

const base = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className,
})

export function IconToday({ size = 22, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 3v3M5 7l2 2M19 7l-2 2M4 13a8 8 0 0 1 16 0" />
      <path d="M12 13l3-2" />
      <path d="M3 13h2M19 13h2M3 18h18" />
    </svg>
  )
}

export function IconRecords({ size = 22, className }: P) {
  return (
    <svg {...base(size, className)}>
      <rect x="4" y="4" width="16" height="17" rx="2.5" />
      <path d="M4 9h16M9 3v3M15 3v3" />
      <path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" />
    </svg>
  )
}

export function IconContinuity({ size = 22, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 17c3 0 3-8 6-8s3 6 6 6 3-4 4-4" />
      <path d="M4 21h16" />
      <circle cx="10" cy="9" r="0.6" fill="currentColor" />
    </svg>
  )
}

export function IconCheck({ size = 22, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M5 13l4 4L19 7" />
    </svg>
  )
}

export function IconSpark({ size = 22, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="M6.5 6.5l2 2M17.5 6.5l-2 2M6.5 17.5l2-2M17.5 17.5l-2-2" />
    </svg>
  )
}

export function IconLeaf({ size = 22, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M11 20A7 7 0 0 1 4 13c0-5 5-9 16-9 0 11-4 16-9 16Z" />
      <path d="M11 20c0-5 2-9 6-12" />
    </svg>
  )
}

export function IconArrowBack({ size = 18, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}

// ハンコ風スタンプ：メニュー完了（チェックの判子）
export function StampDone({ size = 30, className }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      className={className}
    >
      <g transform="rotate(-11 20 20)">
        <circle cx="20" cy="20" r="15.4" strokeWidth="2" />
        <circle
          cx="20"
          cy="20"
          r="11.8"
          strokeWidth="1"
          strokeDasharray="1.4 2.3"
        />
        <path
          d="M13.6 20.6l4.4 4.4 8.4-9"
          strokeWidth="2.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}

// ハンコ風スタンプ：最低ライン達成（点の判子）
export function StampMin({ size = 30, className }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      className={className}
    >
      <g transform="rotate(-11 20 20)">
        <circle
          cx="20"
          cy="20"
          r="13.4"
          strokeWidth="1.7"
          strokeDasharray="2.6 2.6"
        />
        <circle cx="20" cy="20" r="3.6" fill="currentColor" stroke="none" />
      </g>
    </svg>
  )
}
