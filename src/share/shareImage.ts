import { toBlob } from 'html-to-image'

export async function shareImage(node: HTMLElement, filename: string): Promise<void> {
  const blob = await toBlob(node, { pixelRatio: 2, backgroundColor: '#f2f2f7' })
  if (!blob) return
  const file = new File([blob], filename, { type: 'image/png' })
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: filename })
    return
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
