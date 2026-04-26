import { File, Image } from 'lucide-react'

// Maps content-type patterns to icon paths in /public/file-icons/
function resolveIconSrc(contentType?: string | null): string | null {
  if (!contentType) return null
  if (contentType === 'application/pdf') return '/file-icons/pdf.svg'
  if (contentType.includes('spreadsheet') || contentType.includes('excel') || contentType.includes('csv'))
    return '/file-icons/xls.svg'
  if (contentType.includes('word') || contentType.includes('msword') || contentType.includes('opendocument.text'))
    return '/file-icons/doc.svg'
  if (contentType.includes('powerpoint') || contentType.includes('presentation'))
    return '/file-icons/ppt.svg'
  if (contentType === 'image/jpeg' || contentType === 'image/jpg')
    return '/file-icons/jpg.svg'
  if (contentType === 'image/png')
    return '/file-icons/png.svg'
  return null
}

interface Props {
  contentType?: string | null
  size?: number      // pixel size for the img / lucide icon
  className?: string
}

/**
 * Renders a file-type icon:
 * - Uses branded SVG icons from /public/file-icons/ for known types
 * - Falls back to lucide-react icons for images and generics
 */
export default function FileTypeIcon({ contentType, size = 18, className = '' }: Props) {
  const src = resolveIconSrc(contentType)

  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={`shrink-0 object-contain ${className}`}
        aria-hidden="true"
      />
    )
  }

  const cls = `shrink-0 text-muted-foreground ${className}`
  if (contentType?.startsWith('image/')) return <Image size={size} className={cls} />
  return <File size={size} className={cls} />
}
