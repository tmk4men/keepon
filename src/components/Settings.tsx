import { useState } from 'react'
import type { Capacity, Gender, Goal, Profile } from '../state'
import { IconClose } from './icons'

const GOALS: { key: Goal; label: string; sub: string }[] = [
  { key: 'diet', label: 'ダイエット', sub: '体を軽く・引き締める' },
  { key: 'bulk', label: '増量・筋肥大', sub: '体を大きく・力をつける' },
]

const GENDERS: { key: Gender; label: string }[] = [
  { key: 'female', label: '女性' },
  { key: 'male', label: '男性' },
  { key: 'other', label: 'その他' },
]

const CAPACITY: { key: Capacity; label: string; sub: string }[] = [
  { key: 'low', label: 'まずは軽く', sub: '1回 10分くらいまで' },
  { key: 'mid', label: 'ほどほどに', sub: '1回 15〜20分くらい' },
  { key: 'high', label: 'しっかり動く', sub: '1回 20分以上でも平気' },
]

const FREQ = [2, 3, 4, 5]

export default function Settings({
  profile,
  onSave,
  onClose,
}: {
  profile: Profile
  onSave: (p: Profile) => void
  onClose: () => void
}) {
  const [goal, setGoal] = useState<Goal>(profile.goal)
  const [gender, setGender] = useState<Gender>(profile.gender)
  const [age, setAge] = useState(String(profile.age))
  const [height, setHeight] = useState(String(profile.height))
  const [weight, setWeight] = useState(String(profile.weight))
  const [capacity, setCapacity] = useState<Capacity>(profile.capacity)
  const [frequency, setFrequency] = useState<number>(profile.frequency)

  const valid = age !== '' && height !== '' && weight !== ''

  const save = () => {
    onSave({
      goal,
      gender,
      capacity,
      frequency,
      age: clampNum(age, 10, 100, profile.age),
      height: clampNum(height, 120, 230, profile.height),
      weight: clampNum(weight, 30, 200, profile.weight),
    })
    onClose()
  }

  return (
    <div className="settings-overlay">
      <header className="settings-head">
        <h2>設定</h2>
        <button className="settings-close" onClick={onClose} aria-label="閉じる">
          <IconClose size={20} />
        </button>
      </header>

      <div className="settings-body">
        <p className="settings-lead">
          初回に入力した内容は、ここでいつでも変えられます。
        </p>

        <section className="settings-section">
          <h3 className="settings-q">目的</h3>
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
        </section>

        <section className="settings-section">
          <h3 className="settings-q">あなたのこと</h3>
          <div className="field">
            <label>性別</label>
            <div className="choice-grid three">
              {GENDERS.map((g) => (
                <button
                  key={g.key}
                  className={`choice mini ${
                    gender === g.key ? 'selected' : ''
                  }`}
                  onClick={() => setGender(g.key)}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <div className="field-row">
            <NumField label="年齢" unit="歳" value={age} onChange={setAge} />
            <NumField
              label="身長"
              unit="cm"
              value={height}
              onChange={setHeight}
            />
            <NumField
              label="体重"
              unit="kg"
              value={weight}
              onChange={setWeight}
            />
          </div>
        </section>

        <section className="settings-section">
          <h3 className="settings-q">ふだんの運動量</h3>
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
        </section>

        <section className="settings-section">
          <h3 className="settings-q">目標頻度</h3>
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
        </section>

        <button
          className="btn btn-primary settings-save"
          disabled={!valid}
          onClick={save}
        >
          保存して閉じる
        </button>
        <button className="settings-cancel" onClick={onClose}>
          変更せずに閉じる
        </button>
      </div>
    </div>
  )
}

function NumField({
  label,
  unit,
  value,
  onChange,
}: {
  label: string
  unit: string
  value: string
  onChange: (v: string) => void
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

function clampNum(s: string, min: number, max: number, fallback: number): number {
  const n = Number(s)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}
