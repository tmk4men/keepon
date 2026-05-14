// メニューカタログ。AIは使わず通常ロジックで提示する（企画書「AI緊急出動型」）。
// 通常メニューは 目的(goal) × 運動量(capacity) ごとに用意する。

import type { Capacity, Goal } from './state'

export type MenuLevel = 'normal' | 'light' | 'minimum'

export type Menu = {
  id: string
  title: string
  detail: string
  minutes: number
  level: MenuLevel
}

// 通常メニュー：目的 × 運動量 ごとのプール
const NORMAL: Record<Goal, Record<Capacity, Menu[]>> = {
  diet: {
    low: [
      {
        id: 'd-l-walk',
        title: '早歩き 10分',
        detail: 'いつもより少し速く。息が軽く弾むくらいでOK。',
        minutes: 10,
        level: 'normal',
      },
      {
        id: 'd-l-radio',
        title: 'ラジオ体操＋足踏み 8分',
        detail: 'ラジオ体操を1曲＋その場足踏み2分。全身をゆるく起こす。',
        minutes: 8,
        level: 'normal',
      },
      {
        id: 'd-l-squat',
        title: 'スロースクワット 10回×2',
        detail: '4秒かけて下ろし、2秒で上げる。反動を使わずゆっくり。',
        minutes: 8,
        level: 'normal',
      },
      {
        id: 'd-l-knee',
        title: 'もも上げ＆腕振り 1分×3',
        detail: 'その場でもも上げ。腕も大きく振って心拍を上げる。',
        minutes: 8,
        level: 'normal',
      },
      {
        id: 'd-l-stretch',
        title: 'ストレッチ＋体幹キープ 10分',
        detail: '全身を伸ばしてからプランク20秒×2。じんわり効かせる。',
        minutes: 10,
        level: 'normal',
      },
    ],
    mid: [
      {
        id: 'd-m-jog',
        title: '早歩き＆軽いジョグ 15分',
        detail: '3分歩く→2分軽く走る、を3セット。会話できるペースで。',
        minutes: 15,
        level: 'normal',
      },
      {
        id: 'd-m-circuit',
        title: '全身サーキット 18分',
        detail: 'スクワット・腕立て・もも上げを各40秒＋休憩20秒。4周。',
        minutes: 18,
        level: 'normal',
      },
      {
        id: 'd-m-step',
        title: 'ステップ運動 15分',
        detail: '階段や段差を上り下り。一定リズムで脂肪燃焼。',
        minutes: 15,
        level: 'normal',
      },
      {
        id: 'd-m-hiit',
        title: '自重HIIT 12分＋ウォーク',
        detail: '20秒全力／40秒休憩を8本。そのあと軽く歩いてクールダウン。',
        minutes: 18,
        level: 'normal',
      },
      {
        id: 'd-m-rope',
        title: 'なわとび 10分＋ストレッチ',
        detail: 'なわとび（エアでも可）を1分×6＋休憩。最後にストレッチ。',
        minutes: 16,
        level: 'normal',
      },
    ],
    high: [
      {
        id: 'd-h-run',
        title: 'ランニング 25分',
        detail: '会話できるくらいのペースで。距離より「動いた時間」を優先。',
        minutes: 25,
        level: 'normal',
      },
      {
        id: 'd-h-hiit',
        title: 'HIIT 15分＋有酸素 15分',
        detail: 'HIIT（20秒全力／40秒休憩）のあと、ジョグかバイクで15分。',
        minutes: 30,
        level: 'normal',
      },
      {
        id: 'd-h-circuit',
        title: '全身サーキット 25分',
        detail: 'スクワット・腕立て・バーピー・もも上げを各45秒。5周。',
        minutes: 25,
        level: 'normal',
      },
      {
        id: 'd-h-dash',
        title: '階段／坂ダッシュ 20分',
        detail: '上りは速く、下りはゆっくり歩いて回復。10〜15本が目安。',
        minutes: 20,
        level: 'normal',
      },
      {
        id: 'd-h-fullbody',
        title: '自重フルボディ 30分',
        detail: 'バーピー・ジャンプスクワット・マウンテンクライマー中心。',
        minutes: 30,
        level: 'normal',
      },
    ],
  },
  bulk: {
    low: [
      {
        id: 'b-l-pushup',
        title: 'ひざつき腕立て 10回×2',
        detail: '胸を床に近づける。下ろす動きをゆっくり丁寧に。',
        minutes: 8,
        level: 'normal',
      },
      {
        id: 'b-l-squat',
        title: '自重スクワット 12回×2',
        detail: '太ももが床と平行になるまで。膝とつま先は同じ向きに。',
        minutes: 8,
        level: 'normal',
      },
      {
        id: 'b-l-core',
        title: 'プランク＋バードドッグ 8分',
        detail: 'プランク20秒・バードドッグ左右10回を2〜3周。体幹の土台作り。',
        minutes: 8,
        level: 'normal',
      },
      {
        id: 'b-l-hip',
        title: 'ヒップリフト 15回×2',
        detail: '仰向けでお尻を持ち上げ、上で1秒キープ。お尻と裏ももに効かせる。',
        minutes: 8,
        level: 'normal',
      },
      {
        id: 'b-l-arm',
        title: 'ペットボトル アームトレ 10分',
        detail: '水入りペットボトルでカール・サイドレイズを各12回×2。',
        minutes: 10,
        level: 'normal',
      },
    ],
    mid: [
      {
        id: 'b-m-push',
        title: '上半身プッシュ 15分',
        detail: '腕立て・ディップス・肩トレを各10〜12回×3セット。',
        minutes: 15,
        level: 'normal',
      },
      {
        id: 'b-m-legs',
        title: '下半身デイ 18分',
        detail: 'スクワット・ランジ・カーフレイズを各12回×3セット。',
        minutes: 18,
        level: 'normal',
      },
      {
        id: 'b-m-pull',
        title: '背中・引く種目 18分',
        detail: '斜め懸垂・ローイング・タオルプルを限界手前×3セット。',
        minutes: 18,
        level: 'normal',
      },
      {
        id: 'b-m-core',
        title: '体幹＋自重サーキット 15分',
        detail: 'プランク・スクワット・腕立てを各45秒。3〜4周。',
        minutes: 15,
        level: 'normal',
      },
      {
        id: 'b-m-dumbbell',
        title: 'ダンベル全身 20分',
        detail: 'ダンベルでスクワット・プレス・ローイングを各10回×3。',
        minutes: 20,
        level: 'normal',
      },
    ],
    high: [
      {
        id: 'b-h-compound',
        title: '全身コンパウンド 30分',
        detail: 'スクワット・デッドリフト系・プレスを大きく動かす。各3〜4セット。',
        minutes: 30,
        level: 'normal',
      },
      {
        id: 'b-h-upper',
        title: '上半身ウェイト 25分',
        detail: 'ベンチ系・ショルダープレス・ローイングを高めの重量で3〜4セット。',
        minutes: 25,
        level: 'normal',
      },
      {
        id: 'b-h-legs',
        title: '脚の日 25分',
        detail: 'スクワット中心にランジ・レッグカール。限界手前まで追い込む。',
        minutes: 25,
        level: 'normal',
      },
      {
        id: 'b-h-pull',
        title: 'プル系デイ 25分',
        detail: '懸垂・ローイング・ラットプル。背中を意識して3〜4セット。',
        minutes: 25,
        level: 'normal',
      },
      {
        id: 'b-h-circuit',
        title: '自重高負荷サーキット 30分',
        detail: '片足スクワット・ディップス・懸垂・バーピーを休憩短めで回す。',
        minutes: 30,
        level: 'normal',
      },
    ],
  },
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
    {
      id: 'd-light-stretch',
      title: 'ストレッチ多め 10分',
      detail: '気持ちいい範囲で全身を伸ばす。体を動かす感覚を取り戻す。',
      minutes: 10,
      level: 'light',
    },
    {
      id: 'd-light-walk2',
      title: '早歩き 12分',
      detail: '少しだけ速く歩く。今日はリズムを戻すのが目的。',
      minutes: 12,
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
    {
      id: 'b-light-dumbbell',
      title: '軽めダンベル 10分',
      detail: '軽い重量でカール・プレスを各12回×2。動きを思い出す。',
      minutes: 10,
      level: 'light',
    },
    {
      id: 'b-light-mobility',
      title: '関節ほぐし＋自重 8分',
      detail: '肩・股関節を回してから、スクワット10回×2。ケガ予防にも。',
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
  {
    id: 'm-plank',
    title: 'プランク 20秒',
    detail: '肘とつま先で体を一直線に。きつければひざをついてOK。',
    minutes: 1,
    level: 'minimum',
  },
  {
    id: 'm-knee',
    title: 'もも上げ 30秒',
    detail: 'その場で太ももを高く。テレビを見ながらでもOK。',
    minutes: 1,
    level: 'minimum',
  },
  {
    id: 'm-shoulder',
    title: '肩回し 20回',
    detail: '前回し10回・後ろ回し10回。デスクワークのリセットにも。',
    minutes: 1,
    level: 'minimum',
  },
  {
    id: 'm-stairs',
    title: '階段を1往復',
    detail: '家やビルの階段を上って下りるだけ。エレベーターを一回我慢。',
    minutes: 2,
    level: 'minimum',
  },
  {
    id: 'm-jump',
    title: 'その場ジャンプ 15回',
    detail: '軽く飛ぶだけ。心拍が少し上がれば十分。',
    minutes: 1,
    level: 'minimum',
  },
  {
    id: 'm-sidebend',
    title: '体側のばし 左右30秒',
    detail: '片手を上げて体を横へ。脇腹がのびる気持ちよさを味わう。',
    minutes: 1,
    level: 'minimum',
  },
  {
    id: 'm-breath',
    title: '深呼吸ストレッチ 2分',
    detail: '大きく吸って背伸び、ゆっくり吐いて脱力。これも立派な一歩。',
    minutes: 2,
    level: 'minimum',
  },
]

// 日付インデックスで決定的にローテーション（同じ日は同じメニュー）
function rotate<T>(pool: T[], dayIndex: number): T {
  if (pool.length === 0) throw new Error('empty pool')
  return pool[((dayIndex % pool.length) + pool.length) % pool.length]
}

// 同じ日に提示する「2つの候補」を決定的に選ぶ（連続する2件）
function rotatePair<T>(pool: T[], dayIndex: number): T[] {
  if (pool.length === 0) throw new Error('empty pool')
  if (pool.length === 1) return [pool[0], pool[0]]
  return [rotate(pool, dayIndex), rotate(pool, dayIndex + 1)]
}

export function pickNormalMenus(
  goal: Goal,
  capacity: Capacity,
  dayIndex: number,
): Menu[] {
  return rotatePair(NORMAL[goal][capacity], dayIndex)
}

export function pickLightMenus(goal: Goal, dayIndex: number): Menu[] {
  return rotatePair(LIGHT[goal], dayIndex)
}

export function pickMinimumMenus(dayIndex: number): Menu[] {
  return rotatePair(MINIMUM_MENUS, dayIndex)
}

export function pickMinimumMenu(dayIndex: number): Menu {
  return rotate(MINIMUM_MENUS, dayIndex)
}
