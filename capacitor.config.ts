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
    // 始终从线上加载：网站一更新，App 下次打开就是新版，不用重新下载安装包
    url: 'https://yacc2026.pages.dev',
    cleartext: false,
  },
}

export default config
