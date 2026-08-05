// Windows で `npx cap sync ios` を実行すると、Capacitor CLI が
// ios/App/CapApp-SPM/Package.swift のパスを「..\..\..\node_modules\@capacitor\...」と
// 円記号（バックスラッシュ）で書き出す。Swift では \. や \@ は不正なエスケープなので、
// Mac でビルドすると manifest の解析で落ちる。
// このスクリプトはそのパスをスラッシュに直すだけ。macOS で実行しても無害。

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const target = join(root, 'ios', 'App', 'CapApp-SPM', 'Package.swift')

let source
try {
  source = readFileSync(target, 'utf8')
} catch {
  console.log('Package.swift が無いのでスキップしました:', target)
  process.exit(0)
}

// path: "..." の中だけを対象にする（他の文字列は触らない）
const fixed = source.replace(/path:\s*"([^"]*)"/g, (whole, p) =>
  whole.replace(p, p.replace(/\\/g, '/')),
)

if (fixed === source) {
  console.log('Package.swift のパスは正常です')
} else {
  writeFileSync(target, fixed, 'utf8')
  console.log('Package.swift のパス区切りを / に直しました')
}
