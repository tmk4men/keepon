// メニューカタログ。AIは使わず通常ロジックで提示する（企画書「AI緊急出動型」）。

import type { Capacity, Goal } from './state'

export type MenuLevel = 'normal' | 'light' | 'minimum'

export type Menu = {
  id: string
  title: string
  detail: string
  minutes: number
  level: MenuLevel
}

// 通常メニュー：目的ごとのプール（minutes昇順で並べておく）
const NORMAL: Record<Goal, Menu[]> = {
  diet: [
    {
      id: 'd-walk-jog',
      title: '早歩き＆軽いジョグ 15分',
      detail: '3分歩く→2分軽く走る、を3セット。息が弾むくらいでOK。',
      minutes: 15,
      level: 'normal',
    },
    {
      id: 'd-circuit',
      title: '全身サーキット 20分',
      detail: 'スクワット・腕立て・もも上げを各40秒＋休憩20秒。4周。',
      minutes: 20,
      level: 'normal',
    },
    {
      id: 'd-run',
      title: 'ランニング 20分',
      detail: '会話できるくらいのペースで。距離より「動いた時間」を優先。',
      minutes: 20,
      level: 'normal',
    },
    {
      id: 'd-hiit',
      title: 'HIIT＋有酸素 25分',
      detail: 'HIIT 10分（20秒全力／40秒休憩）＋ウォーキング15分。',
      minutes: 25,
      level: 'normal',
    },
  ],
  bulk: [
    {
      id: 'b-push',
      title: '上半身プッシュ 15分',
      detail: '腕立て・ディップス・肩トレを各10〜12回×3セット。',
      minutes: 15,
      level: 'normal',
    },
    {
      id: 'b-legs',
      title: '下半身デイ 20分',
      detail: 'スクワット・ランジ・カーフレイズを各12回×3セット。',
      minutes: 20,
      level: 'normal',
    },
    {
      id: 'b-pull',
      title: '背中・引く種目 20分',
      detail: '懸垂（or 斜め懸垂）・ローイングを限界手前×3セット。',
      minutes: 20,
      level: 'normal',
    },
    {
      id: 'b-compound',
      title: '全身コンパウンド 25分',
      detail: 'スクワット→プッシュ→プルを大きく動かす。各3セット。',
      minutes: 25,
      level: 'normal',
    },
  ],
}

// 軽量化メニュー：数日空いたとき用（通常の半分くらいの負荷）
const LIGHT: Record<Goal, Menu[]> = {
  diet: [
    {
      id: 'd-light-walk',
      title: '散歩 10分',
      detail: '外に出て10分歩くだけ。スマホ見ながらでもOK。',
      minutes: 10,
      level: 'light',
    },
    {
      id: 'd-light-home',
      title: 'おうち軽トレ 8分',
      detail: 'スクワット10回・もも上げ30秒を2周。汗ばむ手前で終了。',
      minutes: 8,
      level: 'light',
    },
  ],
  bulk: [
    {
      id: 'b-light-body',
      title: '自重ライトトレ 10分',
      detail: '腕立て・スクワットを各10回×2セット。フォーム優先。',
      minutes: 10,
      level: 'light',
    },
    {
      id: 'b-light-core',
      title: '体幹リセット 8分',
      detail: 'プランク30秒・バードドッグ左右10回を2周。',
      minutes: 8,
      level: 'light',
    },
  ],
}

// 最低ライン：目的に関係なく「ゼロを作らない」ための超小タスク
export const MINIMUM_MENUS: Menu[] = [
  {
    id: 'm-squat',
    title: 'スクワット 5回',
    detail: 'これだけで「今日も継続成功」。回数は増やしてもOK。',
    minutes: 1,
    level: 'minimum',
  },
  {
    id: 'm-stretch',
    title: 'ストレッチ 3分',
    detail: '肩・もも・背中を気持ちよく伸ばす。深呼吸しながら。',
    minutes: 3,
    level: 'minimum',
  },
  {
    id: 'm-pushup',
    title: '腕立て 3回',
    detail: 'ひざつきでもOK。「やった」という事実だけ残す。',
    minutes: 1,
    level: 'minimum',
  },
  {
    id: 'm-calf',
    title: 'かかと上げ 20回',
    detail: '歯みがき中でもできる。立ったままつま先立ちを繰り返す。',
    minutes: 1,
    level: 'minimum',
  },
  {
    id: 'm-walk1',
    title: '1分だけ歩く',
    detail: '玄関を出て1分。戻ってきていい。動き出せたら勝ち。',
    minutes: 1,
    level: 'minimum',
  },
]

// 余力に応じて通常プールから候補を絞る
function capacityPool(pool: Menu[], capacity: Capacity): Menu[] {
  if (capacity === 'low') return pool.slice(0, 2) // 短い方
  if (capacity === 'high') return pool.slice(-2) // 長い方
  return pool // mid は全部
}

// 日付インデックスで決定的にローテーション（同じ日は同じメニュー）
function rotate<T>(pool: T[], dayIndex: number): T {
  if (pool.length === 0) throw new Error('empty pool')
  return pool[((dayIndex % pool.length) + pool.length) % pool.length]
}

export function pickNormalMenu(
  goal: Goal,
  capacity: Capacity,
  dayIndex: number,
): Menu {
  return rotate(capacityPool(NORMAL[goal], capacity), dayIndex)
}

export function pickLightMenu(goal: Goal, dayIndex: number): Menu {
  return rotate(LIGHT[goal], dayIndex)
}

export function pickMinimumMenu(dayIndex: number): Menu {
  return rotate(MINIMUM_MENUS, dayIndex)
}
