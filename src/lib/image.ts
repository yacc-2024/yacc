/**
 * 把用户选的图片裁成正方形并压缩成 data URL。
 * 头像直接存进数据库，所以必须压得够小。
 */
export function fileToAvatar(file: File, size = 256): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('请选一张图片'))
  }
  if (file.size > 8 * 1024 * 1024) {
    return Promise.reject(new Error('图片超过 8MB 了，换一张小一点的'))
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('浏览器不支持图片处理')

        // 等比铺满，居中裁切
        const scale = Math.max(size / img.width, size / img.height)
        const w = img.width * scale
        const h = img.height * scale
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)

        const data = canvas.toDataURL('image/jpeg', 0.85)
        if (data.length > 180_000) {
          reject(new Error('这张图压缩后还是太大，换一张试试'))
          return
        }
        resolve(data)
      } catch (err) {
        reject(err instanceof Error ? err : new Error('处理图片失败'))
      } finally {
        URL.revokeObjectURL(url)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('这张图读不出来，可能是格式不支持'))
    }

    img.src = url
  })
}
