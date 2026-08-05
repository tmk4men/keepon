import { useRef, useState } from 'react'
import {
  downloadBackup,
  parseBackup,
  type AppState,
  type Capacity,
  type Gender,
  type Goal,
  type NotifySettings,
  type Profile,
} from '../state'
import { bmiInfo } from '../logic'
import {
  currentPermission,
  isNative,
  isNotifySupported,
  requestPermission,
  showNotification,
} from '../notify'
import { IconClose } from './icons'
import { trialLabel, type Access } from '../entitlement'

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
  notify,
  access,
  price,
  storeBusy,
  canBuy,
  onBuy,
  onRestore,
  onSave,
  onNotifyChange,
  onReplaceState,
  onClose,
}: {
  profile: Profile
  notify: NotifySettings
  access: Access
  price: string
  storeBusy: boolean
  canBuy: boolean
  onBuy: () => void
  onRestore: () => void
  onSave: (p: Profile) => void
  onNotifyChange: (n: NotifySettings) => void
  onReplaceState: (s: AppState) => void
  onClose: () => void
}) {
  const [goal, setGoal] = useState<Goal>(profile.goal)
  const [gender, setGender] = useState<Gender>(profile.gender)
  const [age, setAge] = useState(String(profile.age))
  const [height, setHeight] = useState(String(profile.height))
  const [weight, setWeight] = useState(String(profile.weight))
  const [capacity, setCapacity] = useState<Capacity>(profile.capacity)
  const [frequency, setFrequency] = useState<number>(profile.frequency)
  const fileRef = useRef<HTMLInputElement>(null)
  const [dataMsg, setDataMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  )
  const [perm, setPerm] = useState<NotificationPermission>(() =>
    currentPermission(),
  )
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null)
  const supported = isNotifySupported()

  const valid = age !== '' && height !== '' && weight !== ''
  const bmi = bmiInfo(Number(height), Number(weight))

  const handleExport = () => {
    setDataMsg(
      downloadBackup()
        ? { ok: true, text: 'バックアップを書き出しました。' }
        : { ok: false, text: '書き出しに失敗しました。' },
    )
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const next = parseBackup(String(reader.result))
      if (!next) {
        setDataMsg({
          ok: false,
          text: 'このファイルはツヅキンのバックアップとして読み込めませんでした。',
        })
        return
      }
      if (
        !window.confirm(
          '今の記録を、読み込んだバックアップで置きかえます。よろしいですか？',
        )
      ) {
        return
      }
      onReplaceState(next)
      onClose()
    }
    reader.onerror = () =>
      setDataMsg({ ok: false, text: 'ファイルを読み込めませんでした。' })
    reader.readAsText(file)
  }

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
          <div className={`bmi-row${bmi ? ` bmi-${bmi.category}` : ''}`}>
            <span className="bmi-label">BMI</span>
            {bmi ? (
              <span className="bmi-value">
                {bmi.value.toFixed(1)}
                <span className="bmi-cat">{bmi.label}</span>
              </span>
            ) : (
              <span className="bmi-value bmi-empty">身長・体重を入力</span>
            )}
          </div>
          <p className="bmi-hint">
            今日のメニューは、このBMIも考慮して選ばれます
            （高めのときは、ひざ・腰にやさしい低負荷メニュー中心）。
          </p>
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

        <section className="settings-section">
          <h3 className="settings-q">通知</h3>
          {!supported ? (
            <p className="settings-note">
              このブラウザは通知に対応していません。
            </p>
          ) : (
            <>
              <div className="notify-row">
                <label className="notify-toggle">
                  <input
                    type="checkbox"
                    checked={notify.enabled}
                    onChange={async (e) => {
                      const next = e.target.checked
                      if (next && currentPermission() !== 'granted') {
                        const p = await requestPermission()
                        setPerm(p)
                        if (p !== 'granted') {
                          setNotifyMsg(
                            '通知の許可が下りませんでした。ブラウザの設定で許可してください。',
                          )
                          return
                        }
                      }
                      setNotifyMsg(null)
                      onNotifyChange({ ...notify, enabled: next })
                    }}
                  />
                  <span>毎日リマインドする</span>
                </label>
              </div>
              <div className="notify-row">
                <label className="notify-time-label" htmlFor="notify-time">
                  通知時刻
                </label>
                <input
                  id="notify-time"
                  className="notify-time"
                  type="time"
                  value={notify.time}
                  onChange={(e) =>
                    onNotifyChange({ ...notify, time: e.target.value })
                  }
                  disabled={!notify.enabled}
                />
              </div>
              <div className="notify-actions">
                <button
                  type="button"
                  className="data-btn"
                  onClick={async () => {
                    if (currentPermission() !== 'granted') {
                      const p = await requestPermission()
                      setPerm(p)
                      if (p !== 'granted') {
                        setNotifyMsg('通知が許可されていません。')
                        return
                      }
                    }
                    await showNotification(
                      'ツヅキン（テスト通知）',
                      'この見え方で毎日届きます。',
                    )
                    setNotifyMsg('テスト通知を送りました。')
                  }}
                >
                  テスト通知を送る
                </button>
              </div>
              <p className="settings-note">
                {isNative()
                  ? '指定した時刻に毎日通知が届きます。届かないときは端末の通知設定でツヅキンが「許可」になっているかご確認ください。'
                  : 'ブラウザ版では、アプリを開いている間に予約されます。完全に閉じている間は届かないことがあります。'}
              </p>
              {!isNative() && perm === 'denied' && (
                <p className="data-msg err">
                  ブラウザの通知がブロックされています。サイトの設定から許可してください。
                </p>
              )}
              {notifyMsg && <p className="data-msg ok">{notifyMsg}</p>}
            </>
          )}
        </section>

        <section className="settings-section">
          <h3 className="settings-q">運動するときの注意</h3>
          <ul className="caution-list">
            <li>痛みや強い不調を感じたら、すぐに中止してください。</li>
            <li>
              持病・通院中の方、妊娠中の方は、医師に相談のうえ無理のない範囲で。
            </li>
            <li>
              メニューは一般的な目安です。体調に合わせて回数や強度を調整してOK。
            </li>
            <li>運動の前後に、水分補給と軽い準備運動・整理運動を。</li>
          </ul>
          <p className="settings-note">
            このアプリは医療・治療を目的としたものではありません。
          </p>
        </section>

        <section className="settings-section">
          <h3 className="settings-q">ご利用の状態</h3>
          {access.kind === 'purchased' ? (
            <p className="settings-note">
              フルアクセスを購入済みです。期限はありません。
            </p>
          ) : (
            <>
              <p className="settings-note">
                {access.kind === 'trial'
                  ? `無料体験を利用中です（${trialLabel(access.daysLeft)}）。体験が終わると、記録もメニューも使えなくなります。`
                  : '無料体験は終了しています。'}
                {canBuy
                  ? `そのまま使い続けるには ${price}（買い切り）です。月額はありません。`
                  : 'アプリ版でご購入いただけます。'}
              </p>
              {canBuy && (
                <div className="data-actions">
                  <button className="data-btn" onClick={onBuy} disabled={storeBusy}>
                    {price}でずっと使う
                  </button>
                  <button
                    className="data-btn"
                    onClick={onRestore}
                    disabled={storeBusy}
                  >
                    購入を復元する
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <section className="settings-section">
          <h3 className="settings-q">データのバックアップ</h3>
          <p className="settings-note">
            記録は、この端末の中だけに保存されています。機種変更やブラウザの
            履歴削除に備えて、ときどき書き出しておくと安心です。
          </p>
          <div className="data-actions">
            <button className="data-btn" onClick={handleExport}>
              バックアップを書き出す
            </button>
            <button
              className="data-btn"
              onClick={() => fileRef.current?.click()}
            >
              バックアップを読み込む
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="data-file"
            onChange={handleImport}
          />
          {dataMsg && (
            <p className={`data-msg ${dataMsg.ok ? 'ok' : 'err'}`}>
              {dataMsg.text}
            </p>
          )}
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
