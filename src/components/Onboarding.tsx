import { useState } from 'react'
import type { Capacity, Gender, Goal, Profile } from '../state'
import { IconArrowBack, IconLeaf } from './icons'

const GOALS: { key: Goal; label: string; sub: string }[] = [
  { key: 'diet', label: 'ダイエット', sub: '体を軽く・引き締める' },
  { key: 'bulk', label: '増量・筋肥大', sub: '体を大きく・力をつける' },
]

const CAPACITY: { key: Capacity; label: string; sub: string }[] = [
  {
    key: 'low',
    label: 'まずは軽く',
    sub: '1回 10分くらいまで。運動はしばらくお休み中',
  },
  {
    key: 'mid',
    label: 'ほどほどに',
    sub: '1回 15〜20分くらい。ときどき体を動かす',
  },
  {
    key: 'high',
    label: 'しっかり動く',
    sub: '1回 20分以上でも平気。運動には慣れている',
  },
]

const FREQ = [2, 3, 4, 5]

const GENDERS: { key: Gender; label: string }[] = [
  { key: 'female', label: '女性' },
  { key: 'male', label: '男性' },
  { key: 'other', label: 'その他' },
]

const TOTAL_STEPS = 5

export default function Onboarding({
  onComplete,
}: {
  onComplete: (p: Profile) => void
}) {
  const [step, setStep] = useState(0)
  const [goal, setGoal] = useState<Goal | null>(null)
  const [gender, setGender] = useState<Gender | null>(null)
  const [age, setAge] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [capacity, setCapacity] = useState<Capacity | null>(null)
  const [frequency, setFrequency] = useState<number | null>(null)

  const back = () => setStep((s) => Math.max(0, s - 1))
  const next = () => setStep((s) => s + 1)

  const finish = () => {
    onComplete({
      goal: goal!,
      gender: gender!,
      age: clampNum(age, 10, 100, 30),
      height: clampNum(height, 120, 230, 165),
      weight: clampNum(weight, 30, 200, 60),
      capacity: capacity!,
      frequency: frequency!,
    })
  }

  // ステップ0：コンセプト紹介
  if (step === 0) {
    return (
      <div className="ob ob-welcome">
        <div className="ob-logo">
          <IconLeaf size={30} />
        </div>
        <h1>KeepOn</h1>
        <p className="ob-welcome-catch">
          止まらなくていい。
          <br />
          戻れればいい。
        </p>
        <p className="lead">
          完璧に続けるためのアプリじゃありません。
          <br />
          数日サボっても、ちゃんと戻ってこれる。
          <br />
          そのための小さな仕組みです。
        </p>
        <div className="ob-welcome-points">
          <div>
            <b>「ゼロ」を作らない</b>
            <span>1分だけでも「継続成功」</span>
          </div>
          <div>
            <b>止まったら軽くする</b>
            <span>空いた分だけメニューを下げる</span>
          </div>
          <div>
            <b>連続記録じゃなく「戻る力」</b>
            <span>戻ってこれた回数を、ちゃんと数える</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={next}>
          はじめる
        </button>
      </div>
    )
  }

  return (
    <div className="ob">
      <div className="ob-top">
        <button className="ob-back" onClick={back} aria-label="戻る">
          <IconArrowBack />
        </button>
        <div className="ob-progress">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <span key={i} className={i < step ? 'on' : ''} />
          ))}
        </div>
      </div>

      {step === 1 && (
        <Step
          num={1}
          q="どっちを目指したい？"
          canNext={goal !== null}
          onNext={next}
        >
          <div className="choice-grid">
            {GOALS.map((g) => (
              <button
                key={g.key}
                className={`choice ${goal === g.key ? 'selected' : ''}`}
                onClick={() => setGoal(g.key)}
              >
                {g.label}
                <span className="c-sub">{g.sub}</span>
              </button>
            ))}
          </div>
          <p className="hint">あとから変えられます。今の気分でOK。</p>
        </Step>
      )}

      {step === 2 && (
        <Step
          num={2}
          q="あなたのことを教えて"
          canNext={
            gender !== null && age !== '' && height !== '' && weight !== ''
          }
          onNext={next}
        >
          <div className="field">
            <label>性別</label>
            <div className="choice-grid three">
              {GENDERS.map((g) => (
                <button
                  key={g.key}
                  className={`choice mini ${gender === g.key ? 'selected' : ''}`}
                  onClick={() => setGender(g.key)}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <div className="field-row">
            <NumField label="年齢" value={age} onChange={setAge} unit="歳" />
            <NumField
              label="身長"
              value={height}
              onChange={setHeight}
              unit="cm"
            />
            <NumField
              label="体重"
              value={weight}
              onChange={setWeight}
              unit="kg"
            />
          </div>
          <p className="hint">
            メニューの強さの目安にするだけ。だいたいでOKです。
          </p>
        </Step>
      )}

      {step === 3 && (
        <Step
          num={3}
          q="ふだん、どれくらい運動できそう？"
          canNext={capacity !== null}
          onNext={next}
        >
          <p className="ob-q-note">
            毎日のメニューの強さの基準にします。背伸びせず、今の自分で選んでOK。
          </p>
          <div className="choice-grid">
            {CAPACITY.map((c) => (
              <button
                key={c.key}
                className={`choice ${capacity === c.key ? 'selected' : ''}`}
                onClick={() => setCapacity(c.key)}
              >
                {c.label}
                <span className="c-sub">{c.sub}</span>
              </button>
            ))}
          </div>
          <p className="hint">
            きつかったら、あとから下げられます。低めスタートが続けるコツ。
          </p>
        </Step>
      )}

      {step === 4 && (
        <Step
          num={4}
          q="週に何回くらいやりたい？"
          canNext={frequency !== null}
          onNext={next}
        >
          <div className="choice-grid four-row">
            {FREQ.map((f) => (
              <button
                key={f}
                className={`choice freq ${frequency === f ? 'selected' : ''}`}
                onClick={() => setFrequency(f)}
              >
                週{f}回
              </button>
            ))}
          </div>
          <p className="hint">
            守れなくても責めません。「戻れたか」だけ見ています。
          </p>
        </Step>
      )}

      {step === 5 && (
        <Step num={5} q="準備ができました" canNext onNext={finish} nextLabel="はじめる" isLast>
          <div className="ob-summary">
            <SummaryRow label="目的" value={GOALS.find((g) => g.key === goal)?.label ?? ''} />
            <SummaryRow
              label="からだ"
              value={`${GENDERS.find((g) => g.key === gender)?.label} / ${age}歳 / ${height}cm / ${weight}kg`}
            />
            <SummaryRow
              label="無理ない量"
              value={CAPACITY.find((c) => c.key === capacity)?.label ?? ''}
            />
            <SummaryRow label="目標頻度" value={`週${frequency}回`} />
          </div>
          <p className="hint">
            この設定で、今日のメニューと最低ラインを用意します。
          </p>
        </Step>
      )}
    </div>
  )
}

function Step({
  num,
  q,
  children,
  canNext,
  onNext,
  nextLabel = '次へ',
  isLast = false,
}: {
  num: number
  q: string
  children: React.ReactNode
  canNext: boolean
  onNext: () => void
  nextLabel?: string
  isLast?: boolean
}) {
  return (
    <div className="ob-step">
      <div className="ob-step-num">STEP {num} / {TOTAL_STEPS}</div>
      <h2 className="ob-q">{q}</h2>
      {children}
      <button
        className={`btn ${isLast ? 'btn-primary' : 'btn-primary'}`}
        disabled={!canNext}
        onClick={onNext}
        style={{ marginTop: 24 }}
      >
        {nextLabel}
      </button>
    </div>
  )
}

function NumField({
  label,
  value,
  onChange,
  unit,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  unit: string
}) {
  return (
    <div className="field">
      <label>
        {label} <span className="unit-tag">{unit}</span>
      </label>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="—"
      />
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-row">
      <span className="s-label">{label}</span>
      <span className="s-value">{value}</span>
    </div>
  )
}

function clampNum(s: string, min: number, max: number, fallback: number): number {
  const n = Number(s)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}
