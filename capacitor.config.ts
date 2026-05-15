import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.tuzukin.diet',
  appName: 'ツヅキン',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
}

export default config
