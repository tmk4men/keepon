import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.tsuzukin.keepon',
  appName: 'ツヅキン',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
}

export default config
