import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.yacc.crew',
  appName: 'yacc',
  webDir: 'dist',
  android: {
    // 安卓壳里页面是本地文件，接口走线上
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
}

export default config
