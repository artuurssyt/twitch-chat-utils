import { useEffect, useMemo, useState } from 'react'
import type { BadgeRef, ChatMessage, EmoteAsset, PopupStyle, SevenTvPaint } from '@/types/chat'
import { parseMessage } from '@/services/emotes/parseMessage'
import { buildPaintCss, getCachedPaint } from '@/services/seventv/client'
import { resolveBadgeUrl } from '@/services/twitch/client'
import { useChatStore } from '@/store/chatStore'
import './popup.css'

type Props = {
  exportMode?: boolean
}

function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace('#', '')
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw.padEnd(6, '0').slice(0, 6)
  const n = Number.parseInt(full, 16)
  if (Number.isNaN(n)) return `rgba(0,0,0,${alpha})`
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function Username({
  name,
  color,
  paint,
}: {
  name: string
  color?: string
  paint?: SevenTvPaint | null
}) {
  const resolved = paint?.id ? getCachedPaint(paint.id) ?? paint : paint
  const style = useMemo(() => {
    if (!resolved) return { color: color || '#00FF7F' } as React.CSSProperties
    const css = buildPaintCss(resolved)
    if (css.isPainted && css.backgroundImage) {
      return {
        backgroundImage: css.backgroundImage,
        backgroundSize: css.backgroundSize,
        backgroundPosition: css.backgroundPosition ?? 'center',
        textShadow: css.textShadow,
      } as React.CSSProperties
    }
    return {
      color: css.color || color || '#00FF7F',
      WebkitTextFillColor: css.color || color || '#00FF7F',
      textShadow: css.textShadow,
    } as React.CSSProperties
  }, [resolved, color])

  const painted = Boolean(
    resolved && (resolved.stops?.length || resolved.imageUrl || resolved.function),
  )

  return (
    <span
      className={`popup-username${painted ? ' popup-username--paint' : ''}`}
      style={painted ? style : { color: color || '#00FF7F' }}
    >
      {name}
    </span>
  )
}

function BadgeImage({ badge }: { badge: BadgeRef }) {
  const [src, setSrc] = useState<string | null>(badge.kind === '7tv' ? badge.url : null)

  useEffect(() => {
    let cancelled = false
    if (badge.kind === '7tv') {
      setSrc(badge.url)
      return
    }
    resolveBadgeUrl(badge.set, badge.version).then((url) => {
      if (!cancelled) setSrc(url)
    })
    return () => {
      cancelled = true
    }
  }, [badge])

  if (!src) return null
  return (
    <img
      className="popup-badge"
      src={src}
      alt=""
      draggable={false}
      onError={() => setSrc(null)}
    />
  )
}

function PopupBubble({
  message,
  emoteMap,
  style,
  exportMode,
}: {
  message: ChatMessage
  emoteMap: Map<string, EmoteAsset>
  style: PopupStyle
  exportMode?: boolean
}) {
  const parts = useMemo(() => parseMessage(message.message, emoteMap), [message.message, emoteMap])
  const display = message.displayName || message.username
  const userColor = message.color || '#00FF7F'
  const borderColor = style.matchBorderToUsername ? userColor : style.borderColor

  const bg =
    style.backgroundStyle === 'frosted'
      ? hexToRgba('#101014', Math.min(0.85, style.backgroundOpacity * 0.85))
      : hexToRgba('#0a0a0c', style.backgroundOpacity)

  return (
    <div
      className={[
        'popup-bubble',
        style.backgroundStyle === 'frosted' ? 'popup-bubble--frosted' : 'popup-bubble--solid',
        exportMode && style.backgroundStyle === 'frosted' ? 'popup-bubble--export' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        backgroundColor: bg,
        borderColor,
        borderWidth: style.borderWidth,
        borderRadius: style.borderRadius,
        fontSize: style.fontSize,
        maxWidth: style.maxWidth,
        padding: `${style.paddingY}px ${style.paddingX}px`,
      }}
    >
      {style.showBadges &&
        message.badges.map((b, i) => <BadgeImage key={`${b.kind}-${i}`} badge={b} />)}
      <Username name={display} color={userColor} paint={message.paint} />
      <span className="popup-colon">:</span>
      <span className="popup-message">
        {parts.map((part, i) => {
          switch (part.type) {
            case 'emote':
              return (
                <img
                  key={i}
                  className="popup-emote"
                  src={part.emote.url2x || part.emote.url}
                  alt={part.emote.name}
                  title={part.emote.name}
                  draggable={false}
                />
              )
            case 'emoji':
              return (
                <span key={i} className="popup-emoji">
                  {part.value}
                </span>
              )
            case 'link':
              return (
                <a key={i} className="popup-link" href={part.url}>
                  {part.url}
                </a>
              )
            case 'mention':
              return (
                <span key={i} className="popup-mention">
                  {part.value}
                </span>
              )
            default:
              return <span key={i}>{part.value}</span>
          }
        })}
      </span>
    </div>
  )
}

export function PopupPreview({ exportMode = false }: Props) {
  const selectedId = useChatStore((s) => s.selectedId)
  const messages = useChatStore((s) => s.project.messages)
  const popupStyle = useChatStore((s) => s.project.popupStyle)
  const previewScale = useChatStore((s) => s.project.previewScale)
  const emoteMap = useChatStore((s) => s.emoteMap)
  const capturing = useChatStore((s) => s.exportCapturing)

  const message = messages.find((m) => m.id === selectedId) ?? messages[0] ?? null
  const scale = exportMode || capturing ? 1 : previewScale
  const forExport = exportMode || capturing

  return (
    <div
      id={exportMode ? 'popup-export-root' : 'popup-preview-root'}
      className="popup-stage"
      style={{
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: 'center center',
      }}
    >
      {message ? (
        <PopupBubble
          message={message}
          emoteMap={emoteMap}
          style={popupStyle}
          exportMode={forExport}
        />
      ) : (
        <div className="text-sm text-zinc-500">Select a message to preview the popup</div>
      )}
    </div>
  )
}
