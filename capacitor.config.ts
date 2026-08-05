import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.tuzukin.diet',
  appName: 'ツヅキン',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  ios: {
    // 起動直後の白フラッシュを防ぐ（アプリ本体の --bg と同じ）
    backgroundColor: '#f4f1ea',
    contentInset: 'never',
  },
}

export default config
