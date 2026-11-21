import type { SVGProps } from 'react'

export type IconName =
  | 'home'
  | 'users'
  | 'film'
  | 'person'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'plus'
  | 'heart'
  | 'bookmark'
  | 'clock'
  | 'gear'
  | 'info'
  | 'share'
  | 'map'
  | 'search'
  | 'bell'
  | 'trash'
  | 'check'
  | 'close'
  | 'edit'
  | 'image'
  | 'drag'
  | 'download'
  | 'upload'
  | 'lock'

interface Props extends SVGProps<SVGSVGElement> {
  name: IconName
  size?: number
  filled?: boolean
}

const paths: Record<IconName, JSX.Element> = {
  home: (
    <>
      <path d="M3.2 10.6 12 3.4l8.8 7.2" />
      <path d="M5.6 9.4V19.8a1 1 0 0 0 1 1h10.8a1 1 0 0 0 1-1V9.4" />
    </>
  ),
  users: (
    <>
      <circle cx="9.2" cy="8" r="3.2" />
      <path d="M3.4 19.8c0-3.2 2.6-5.4 5.8-5.4s5.8 2.2 5.8 5.4" />
      <path d="M16.2 5.3a3.2 3.2 0 0 1 0 6" />
      <path d="M17.6 14.9c1.9.7 3.1 2.4 3.1 4.9" />
    </>
  ),
  film: (
    <>
      <rect x="3" y="4.6" width="18" height="14.8" rx="3" />
      <path d="M8 4.6v14.8M16 4.6v14.8" />
      <path d="M3 9.4h5M3 14.6h5M16 9.4h5M16 14.6h5" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8.2" r="3.6" />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
    </>
  ),
  'chevron-left': <path d="M14.5 5.5 8 12l6.5 6.5" />,
  'chevron-right': <path d="M9.5 5.5 16 12l-6.5 6.5" />,
  'chevron-down': <path d="M5.5 9.5 12 16l6.5-6.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  heart: (
    <path d="M12 20.2s-7.4-4.5-7.4-9.6A4.2 4.2 0 0 1 12 7.8a4.2 4.2 0 0 1 7.4 2.8c0 5.1-7.4 9.6-7.4 9.6Z" />
  ),
  bookmark: (
    <path d="M6.6 4.8h10.8a1 1 0 0 1 1 1v14.4L12 15.9l-6.4 4.3V5.8a1 1 0 0 1 1-1Z" />
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 7.4V12l3.2 2" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.5 14.6a1.5 1.5 0 0 0 .3 1.6l.1.1a1.8 1.8 0 1 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-1.6-.3 1.5 1.5 0 0 0-.9 1.4v.2a1.8 1.8 0 1 1-3.6 0v-.1a1.5 1.5 0 0 0-1-1.4 1.5 1.5 0 0 0-1.6.3l-.1.1a1.8 1.8 0 1 1-2.6-2.6l.1-.1a1.5 1.5 0 0 0 .3-1.6 1.5 1.5 0 0 0-1.4-.9H4a1.8 1.8 0 1 1 0-3.6h.1a1.5 1.5 0 0 0 1.4-1 1.5 1.5 0 0 0-.3-1.6l-.1-.1a1.8 1.8 0 1 1 2.6-2.6l.1.1a1.5 1.5 0 0 0 1.6.3h.1a1.5 1.5 0 0 0 .9-1.4V4a1.8 1.8 0 1 1 3.6 0v.1a1.5 1.5 0 0 0 .9 1.4 1.5 1.5 0 0 0 1.6-.3l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1a1.5 1.5 0 0 0-.3 1.6v.1a1.5 1.5 0 0 0 1.4.9h.2a1.8 1.8 0 1 1 0 3.6h-.1a1.5 1.5 0 0 0-1.4.9Z" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 11v5.4" />
      <circle cx="12" cy="7.9" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  share: (
    <>
      <path d="M12 15.5V4.2" />
      <path d="m8.4 7.8 3.6-3.6 3.6 3.6" />
      <path d="M5.6 12.4v6.2a1.2 1.2 0 0 0 1.2 1.2h10.4a1.2 1.2 0 0 0 1.2-1.2v-6.2" />
    </>
  ),
  map: (
    <>
      <path d="M12 21s6.4-6 6.4-10.4A6.4 6.4 0 0 0 5.6 10.6C5.6 15 12 21 12 21Z" />
      <circle cx="12" cy="10.4" r="2.2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.4" />
      <path d="m16 16 4 4" />
    </>
  ),
  bell: (
    <>
      <path d="M6.4 10.2a5.6 5.6 0 0 1 11.2 0c0 4 1.4 5.4 1.4 5.4H5s1.4-1.4 1.4-5.4Z" />
      <path d="M10.2 19a2 2 0 0 0 3.6 0" />
    </>
  ),
  trash: (
    <>
      <path d="M4.6 7.2h14.8" />
      <path d="M9.4 7.2V5.4a1 1 0 0 1 1-1h3.2a1 1 0 0 1 1 1v1.8" />
      <path d="M6.6 7.2 7.5 19a1 1 0 0 0 1 .9h7a1 1 0 0 0 1-.9l.9-11.8" />
    </>
  ),
  check: <path d="m5 12.6 4.6 4.4L19 6.8" />,
  close: <path d="M6.4 6.4l11.2 11.2M17.6 6.4 6.4 17.6" />,
  edit: (
    <>
      <path d="M4.8 19.2h4l10-10a2.2 2.2 0 0 0-3.1-3.1l-10 10v3.1Z" />
      <path d="m13.9 7.4 3.1 3.1" />
    </>
  ),
  image: (
    <>
      <rect x="3.4" y="4.8" width="17.2" height="14.4" rx="3" />
      <circle cx="8.8" cy="9.8" r="1.5" />
      <path d="m4.6 17 4.8-4.6 3.2 3 2.6-2.4 4 4" />
    </>
  ),
  drag: <path d="M8 8.5h8M8 12h8M8 15.5h8" />,
  download: (
    <>
      <path d="M12 4v11" />
      <path d="m7.8 11.4 4.2 4.2 4.2-4.2" />
      <path d="M4.8 19.4h14.4" />
    </>
  ),
  upload: (
    <>
      <path d="M12 20V9" />
      <path d="m7.8 12.6 4.2-4.2 4.2 4.2" />
      <path d="M4.8 4.6h14.4" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.4" width="14" height="9.4" rx="2.6" />
      <path d="M8.4 10.4V7.8a3.6 3.6 0 0 1 7.2 0v2.6" />
    </>
  ),
}

export function Icon({ name, size = 24, filled, ...rest }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  )
}
