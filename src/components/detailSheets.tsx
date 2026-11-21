import type { Announcement, CrewEvent } from '../data/schema'
import { useApp } from '../state/AppContext'
import { Sheet } from './ui'
import { Icon } from './Icon'
import { eventStatus, formatDate, formatDateTime, formatTime } from '../lib/format'

export function AnnouncementSheet({
  item,
  onClose,
}: {
  item: Announcement | null
  onClose: () => void
}) {
  return (
    <Sheet open={!!item} title="公告" onClose={onClose}>
      {item ? (
        <div>
          <h3 className="t-title3">{item.title}</h3>
          <p className="t-caption" style={{ marginTop: 4 }}>
            {formatDate(item.date)}
          </p>
          <p className="t-body" style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>
            {item.body}
          </p>
        </div>
      ) : null}
    </Sheet>
  )
}

export function EventSheet({
  item,
  onClose,
}: {
  item: CrewEvent | null
  onClose: () => void
}) {
  const { account } = useApp()
  const status = item ? eventStatus(item) : 'past'
  const statusText =
    status === 'ongoing' ? '进行中' : status === 'upcoming' ? '未开始' : '已结束'

  return (
    <Sheet open={!!item} title="活动" onClose={onClose}>
      {item ? (
        <div>
          <h3 className="t-title3">{item.title}</h3>
          <p className="t-caption" style={{ marginTop: 4 }}>
            {statusText} · {formatDateTime(item.startAt)}
            {item.endAt && formatTime(item.endAt) !== formatTime(item.startAt)
              ? ` – ${formatTime(item.endAt)}`
              : ''}
          </p>

          <div style={{ marginTop: 16 }}>
            <p className="t-caption faint">地点</p>
            <p className="t-body">{item.placePublic || '待定'}</p>

            {account ? (
              item.placePrivate ? (
                <p className="t-body" style={{ marginTop: 4 }}>
                  {item.placePrivate}
                </p>
              ) : null
            ) : (
              <p className="t-caption" style={{ marginTop: 4 }}>
                <Icon name="lock" size={13} /> 具体地址登录后可见
              </p>
            )}
          </div>

          {item.note ? (
            <p className="quote" style={{ marginTop: 16 }}>
              {item.note}
            </p>
          ) : null}

          {account && item.mapQuery ? (
            <a
              className="btn btn--ghost btn--block"
              style={{ marginTop: 20 }}
              href={`https://uri.amap.com/search?keyword=${encodeURIComponent(item.mapQuery)}`}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="map" size={18} />
              打开地图
            </a>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  )
}
