/** 把用户选的图片压成 data URL，供论坛发帖用 */
export function fileToDataUrl(file: File, maxSide = 1080, quality = 0.82): Promise<string> {
  if (!file.type.startsWith('image/')) return Promise.reject(new Error('请选图片'))
  if (file.size > 10 * 1024 * 1024) return Promise.reject(new Error('图片超过 10MB'))

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('浏览器不支持图片处理')
        ctx.drawImage(img, 0, 0, w, h)

        let data = canvas.toDataURL('image/jpeg', quality)
        // 太大就降画质重来
        let q = quality
        while (data.length > 190_000 && q > 0.4) {
          q -= 0.12
          data = canvas.toDataURL('image/jpeg', q)
        }
        if (data.length > 200_000) throw new Error('这张图太大了，换一张')
        resolve(data)
      } catch (err) {
        reject(err instanceof Error ? err : new Error('处理图片失败'))
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('这张图读不出来'))
    }
    img.src = url
  })
}
