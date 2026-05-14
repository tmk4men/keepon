// メニューカタログ。AIは使わず通常ロジックで提示する（企画書「AI緊急出動型」）。
// 通常メニューは 目的(goal) × 運動量(capacity) × 性別(gender) ごとに用意する。
// capacity=強度、gender=傾向（female:下半身/お尻/体幹 male:上半身/筋力 other:全身バランス）

import type { Capacity, Gender, Goal } from './state'

export type MenuLevel = 'normal' | 'light' | 'minimum'

export type Menu = {
  id: string
  title: string
  detail: string
  minutes: number
  level: MenuLevel
}

type GenderPools = Record<Gender, Menu[]>

const n = (
  id: string,
  title: string,
  detail: string,
  minutes: number,
): Menu => ({ id, title, detail, minutes, level: 'normal' })

// 通常メニュー：目的 × 運動量 × 性別
const NORMAL: Record<Goal, Record<Capacity, GenderPools>> = {
  diet: {
    low: {
      female: [
        n('d-low-f1', 'ヒップリフト＆もも内側 8分', 'ヒップリフト15回・内ももしめ15回を2周。お尻と脚をやさしく。', 8),
        n('d-low-f2', '下半身ゆるサーキット 10分', 'スロースクワット10回・もも上げ30秒・ストレッチを2周。', 10),
        n('d-low-f3', '早歩き＆お尻歩き 10分', '早歩き7分＋床でお尻歩き前後。下半身に血を巡らせる。', 10),
      ],
      male: [
        n('d-low-m1', '早歩き＆腕立て 10分', '早歩き7分＋ひざつき腕立て10回×2。上半身も軽く刺激。', 10),
        n('d-low-m2', '体幹＋プッシュ 8分', 'プランク20秒・腕立て8回・もも上げ30秒を2周。', 8),
        n('d-low-m3', 'スロースクワット＆ジョグ 10分', 'スロースクワット10回×2＋その場ジョグ3分。', 10),
      ],
      other: [
        n('d-low-o1', '早歩き 10分', 'いつもより少し速く。息が軽く弾むくらいでOK。', 10),
        n('d-low-o2', 'ラジオ体操＋足踏み 8分', 'ラジオ体操1曲＋その場足踏み2分。全身をゆるく起こす。', 8),
        n('d-low-o3', 'ストレッチ＋体幹キープ 10分', '全身を伸ばしてからプランク20秒×2。じんわり効かせる。', 10),
      ],
    },
    mid: {
      female: [
        n('d-mid-f1', '下半身燃焼サーキット 18分', 'スクワット・ヒップリフト・ランジを各40秒＋休憩。4周。', 18),
        n('d-mid-f2', '有酸素＋お腹引き締め 16分', '早歩き10分＋プランク・レッグレイズ各2セット。', 16),
        n('d-mid-f3', '美脚ステップ運動 15分', '段差の上り下りをリズムよく。お尻と脚を意識して。', 15),
      ],
      male: [
        n('d-mid-m1', 'HIIT＋腕立て 16分', '20秒全力／40秒休憩を6本＋腕立て10回×2。', 16),
        n('d-mid-m2', 'バーピー寄りサーキット 18分', 'バーピー・スクワット・腕立てを各40秒。4周。', 18),
        n('d-mid-m3', 'ジョグ＋自重プッシュ 18分', 'ジョグ12分＋腕立て・ディップス各2セット。', 18),
      ],
      other: [
        n('d-mid-o1', '早歩き＆軽いジョグ 15分', '3分歩く→2分軽く走る、を3セット。会話できるペースで。', 15),
        n('d-mid-o2', '全身サーキット 18分', 'スクワット・腕立て・もも上げを各40秒＋休憩20秒。4周。', 18),
        n('d-mid-o3', '自重HIIT 12分＋ウォーク', '20秒全力／40秒休憩を8本。そのあと軽く歩いて整える。', 18),
      ],
    },
    high: {
      female: [
        n('d-high-f1', '下半身集中バーン 25分', 'スクワット・ランジ・ヒップスラストを高回数で5周。', 25),
        n('d-high-f2', '有酸素30分＋体幹', 'ジョグ／バイク25分＋プランク系5分。脂肪燃焼を狙う。', 30),
        n('d-high-f3', '美脚ヒップ強化サーキット 25分', '片脚スクワット・ブルガリアンスクワット中心に5周。', 25),
      ],
      male: [
        n('d-high-m1', 'HIIT 15分＋有酸素 15分', 'HIIT（20秒全力／40秒休憩）のあと、ジョグかバイクで15分。', 30),
        n('d-high-m2', '階段／坂ダッシュ 20分', '上りは速く、下りはゆっくり歩いて回復。10〜15本が目安。', 20),
        n('d-high-m3', 'バーピー中心フルボディ 30分', 'バーピー・ジャンプスクワット・マウンテンクライマー。', 30),
      ],
      other: [
        n('d-high-o1', 'ランニング 25分', '会話できるくらいのペースで。距離より「動いた時間」を優先。', 25),
        n('d-high-o2', '全身サーキット 25分', 'スクワット・腕立て・バーピー・もも上げを各45秒。5周。', 25),
        n('d-high-o3', '自重フルボディ 30分', 'バーピー・スクワット・腕立て・体幹をバランスよく。', 30),
      ],
    },
  },
  bulk: {
    low: {
      female: [
        n('b-low-f1', 'ヒップリフト＋内転筋 10分', 'ヒップリフト15回・内ももしめ15回を2〜3周。', 10),
        n('b-low-f2', '体幹＋お尻 8分', 'プランク20秒・ヒップリフト15回・バードドッグを2周。', 8),
        n('b-low-f3', '軽ダンベル下半身 10分', 'ペットボトルを持ってスクワット・ランジ各12回×2。', 10),
      ],
      male: [
        n('b-low-m1', 'ひざつき腕立て＆ディップス 8分', 'ひざつき腕立て10回・イスでディップス8回を2周。', 8),
        n('b-low-m2', '軽め上半身プッシュ 10分', '腕立て・肩トレ（ペットボトル）を各10回×2。フォーム優先。', 10),
        n('b-low-m3', 'ペットボトル アームトレ 10分', 'カール・サイドレイズ・トライセプスを各12回×2。', 10),
      ],
      other: [
        n('b-low-o1', '自重スクワット 12回×2', '太ももが床と平行になるまで。膝とつま先は同じ向きに。', 8),
        n('b-low-o2', 'プランク＋バードドッグ 8分', 'プランク20秒・バードドッグ左右10回を2〜3周。体幹の土台作り。', 8),
        n('b-low-o3', '軽ダンベル全身 10分', 'ダンベルでスクワット・プレス・ローイングを各10回×2。', 10),
      ],
    },
    mid: {
      female: [
        n('b-mid-f1', '下半身デイ 18分', 'スクワット・ランジ・ヒップスラストを各12回×3セット。', 18),
        n('b-mid-f2', 'お尻・裏ももデイ 18分', 'ヒップスラスト・ルーマニアンDL・キックバック中心。', 18),
        n('b-mid-f3', '体幹＋下半身サーキット 15分', 'スクワット・プランク・ヒップリフトを各45秒。4周。', 15),
      ],
      male: [
        n('b-mid-m1', '上半身プッシュ 15分', '腕立て・ディップス・肩トレを各10〜12回×3セット。', 15),
        n('b-mid-m2', '背中・引く種目 18分', '斜め懸垂・ローイング・タオルプルを限界手前×3セット。', 18),
        n('b-mid-m3', 'ダンベル上半身 20分', 'プレス・ローイング・カールを各10回×3セット。', 20),
      ],
      other: [
        n('b-mid-o1', '全身自重サーキット 15分', 'プランク・スクワット・腕立てを各45秒。3〜4周。', 15),
        n('b-mid-o2', 'ダンベル全身 20分', 'ダンベルでスクワット・プレス・ローイングを各10回×3。', 20),
        n('b-mid-o3', '体幹＋自重 15分', 'プランク系・スクワット・腕立てをバランスよく3周。', 15),
      ],
    },
    high: {
      female: [
        n('b-high-f1', '脚・お尻の日 25分', 'ヒップスラスト中心にスクワット・ランジを高重量で3〜4セット。', 25),
        n('b-high-f2', '下半身ウェイト＋体幹 25分', 'スクワット・ルーマニアンDL・腹筋を追い込む。', 25),
        n('b-high-f3', 'グルート集中 30分', 'ヒップスラスト・キックバック・アブダクションを徹底的に。', 30),
      ],
      male: [
        n('b-high-m1', '上半身ウェイト 25分', 'ベンチ系・ショルダープレス・ローイングを高めの重量で3〜4セット。', 25),
        n('b-high-m2', 'プル系デイ 25分', '懸垂・ローイング・ラットプル。背中を意識して3〜4セット。', 25),
        n('b-high-m3', '胸・腕デイ 25分', 'ベンチ・ディップス・カール・エクステンションで追い込む。', 25),
      ],
      other: [
        n('b-high-o1', '全身コンパウンド 30分', 'スクワット・デッドリフト系・プレスを大きく動かす。各3〜4セット。', 30),
        n('b-high-o2', '自重高負荷サーキット 30分', '片足スクワット・ディップス・懸垂・バーピーを休憩短めで回す。', 30),
        n('b-high-o3', '脚の日 25分', 'スクワット中心にランジ・レッグカール。限界手前まで追い込む。', 25),
      ],
    },
  },
}

// 軽量化メニュー：数日空いたとき用（通常の半分くらいの負荷・性別共通）
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

// 最低ライン：目的・性別に関係なく「ゼロを作らない」ための超小タスク
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
  gender: Gender,
  dayIndex: number,
): Menu[] {
  return rotatePair(NORMAL[goal][capacity][gender], dayIndex)
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
