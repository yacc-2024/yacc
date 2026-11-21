import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:5173'
const OUT = '/tmp/shots'

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  colorScheme: 'light',
  locale: 'zh-CN',
  isMobile: true,
  hasTouch: true,
})
const page = await ctx.newPage()


// React 受控 input 必须走原生 setter，否则 onChange 不触发
async function setBlur(value) {
  await page.evaluate((v) => {
    const el = document.querySelector('input[type=range]')
    if (!el) return
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    ).set
    setter.call(el, String(v))
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
  await page.waitForTimeout(350)
}

async function shot(name, opts = {}) {
  await page.screenshot({ path: `${OUT}/${name}.png`, ...opts })
  console.log('shot', name)
}

await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.getByText('反对校园霸凌，人人有责').first().waitFor()
await page.waitForTimeout(520)
await shot('01-home-top')

// 滚动让内容钻到导航栏下面，检查毛玻璃
await page.mouse.wheel(0, 260)
await page.waitForTimeout(500)
await shot('02-home-scrolled')

await page.goto(BASE + '/works', { waitUntil: 'networkidle' })
await page.waitForTimeout(520)
await shot('03-works')

await page.goto(BASE + '/about', { waitUntil: 'networkidle' })
await page.waitForTimeout(520)
await shot('04-about')

await page.goto(BASE + '/members', { waitUntil: 'networkidle' })
await page.waitForTimeout(520)
await shot('05-members-gate')

await page.goto(BASE + '/me', { waitUntil: 'networkidle' })
await page.waitForTimeout(520)
await shot('06-me')

// 深色
await page.emulateMedia({ colorScheme: 'dark' })
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(520)
await shot('07-home-dark')
await page.emulateMedia({ colorScheme: 'light' })

// 管理员：激活 -> 看设置里的模糊度
await page.goto(BASE + '/login?mode=admin', { waitUntil: 'networkidle' })
await page.getByLabel('激活码').fill('YACC-ADMIN-2026')
await page.getByLabel('昵称').fill('导演')
await page.getByLabel('密码', { exact: true }).fill('abc123')
await page.getByLabel('确认密码', { exact: true }).fill('abc123')
await page.getByRole('button', { name: '激活管理端' }).click()
await page.getByText('反对校园霸凌，人人有责').first().waitFor()
console.log('admin activated')

await page.goto(BASE + '/me/settings', { waitUntil: 'networkidle' })
await page.waitForTimeout(520)
await shot('08-settings')

// 模糊度 0 与 40 的对照（滚到能看见内容的位置）
await setBlur(0)
await page.evaluate(() => window.scrollTo(0, 240))
await page.waitForTimeout(520)
await shot('09-nav-blur-0')

await setBlur(40)
await page.waitForTimeout(520)
await shot('10-nav-blur-40')

const blur = await page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue('--glass-blur'),
)
const navFilter = await page.evaluate(() => {
  const nav = document.querySelector('.nav')
  if (!nav) return null
  const cs = getComputedStyle(nav)
  return { backdrop: cs.backdropFilter, bg: cs.backgroundColor, cls: nav.className }
})
console.log('--glass-blur =', blur)
console.log('nav =', JSON.stringify(navFilter))

// 管理端页面
await page.goto(BASE + '/admin', { waitUntil: 'networkidle' })
await page.waitForTimeout(520)
await shot('11-admin')

await page.goto(BASE + '/works', { waitUntil: 'networkidle' })
await page.waitForTimeout(520)
await shot('12-works-after')

await page.goto(BASE + '/me', { waitUntil: 'networkidle' })
await page.waitForTimeout(520)
await shot('13-me-after')

await page.goto(BASE + '/me/settings', { waitUntil: 'networkidle' })
await page.waitForTimeout(520)
await shot('14-settings-after')

await browser.close()
console.log('done')
