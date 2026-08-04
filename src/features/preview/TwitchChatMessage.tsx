import { useEffect, useMemo, useState } from 'react'
import type { BadgeRef, ChatMessage, EmoteAsset, SevenTvPaint } from '@/types/chat'
import { parseMessage } from '@/services/emotes/parseMessage'
import { buildPaintCss, getCachedPaint } from '@/services/seventv/client'
import { resolveBadgeUrl } from '@/services/twitch/client'

type Props = {
  message: ChatMessage
  emoteMap: Map<string, EmoteAsset>
  animate?: boolean
}

function UsernamePaint({ name, paint, color }: { name: string; paint?: SevenTvPaint | null; color?: string }) {
  const resolved = paint?.id ? getCachedPaint(paint.id) ?? paint : paint
  const style = useMemo(() => {
    if (!resolved) return { color: color || '#efeff1' } as React.CSSProperties
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
      color: css.color || color || '#efeff1',
      WebkitTextFillColor: css.color || color || '#efeff1',
      textShadow: css.textShadow,
    } as React.CSSProperties
  }, [resolved, color])

  const painted = Boolean(
    resolved && (resolved.stops?.length || resolved.imageUrl || resolved.function),
  )

  return (
    <span
      className={`twitch-username${painted ? ' twitch-username--paint' : ''}`}
      style={painted ? style : { color: color || '#efeff1' }}
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
      className="twitch-badge"
      src={src}
      alt=""
      draggable={false}
      onError={() => setSrc(null)}
    />
  )
}

export function TwitchChatMessage({ message, emoteMap, animate }: Props) {
  const parts = useMemo(() => parseMessage(message.message, emoteMap), [message.message, emoteMap])
  const display = message.displayName || message.username
  const animClass =
    animate && message.animation && message.animation !== 'none'
      ? ` twitch-line--${message.animation}`
      : ''

  return (
    <div className={`twitch-line${animClass}`} data-message-id={message.id}>
      {message.replyTo && (
        <div className="twitch-reply">
          <svg className="twitch-reply__icon" viewBox="0 0 16 16" aria-hidden>
            <path
              fill="currentColor"
              d="M4.5 3.5v3h7.3L9.4 4.1l.7-.7L14 7.3 10.1 11l-.7-.7 2.4-2.3H3.5v-4h1z"
            />
          </svg>
          <span className="twitch-reply__user">{message.replyTo.username}</span>
          <span className="twitch-reply__snippet">{message.replyTo.messageSnippet}</span>
        </div>
      )}
      <div className="twitch-line__body">
        {message.showTimestamp && message.timestamp && (
          <span className="twitch-timestamp">{message.timestamp}</span>
        )}
        <span className="twitch-badges">
          {message.badges.map((b, i) => (
            <BadgeImage key={`${b.kind}-${i}`} badge={b} />
          ))}
        </span>
        <UsernamePaint name={display} paint={message.paint} color={message.color} />
        <span className="twitch-colon">:</span>
        <span className="twitch-message">
          {parts.map((part, i) => {
            switch (part.type) {
              case 'emote':
                return (
                  <img
                    key={i}
                    className="twitch-emote"
                    src={part.emote.url2x || part.emote.url}
                    alt={part.emote.name}
                    title={part.emote.name}
                    draggable={false}
                  />
                )
              case 'emoji':
                return (
                  <span key={i} className="twitch-emoji">
                    {part.value}
                  </span>
                )
              case 'link':
                return (
                  <a key={i} className="twitch-link" href={part.url} target="_blank" rel="noreferrer">
                    {part.url}
                  </a>
                )
              case 'mention':
                return (
                  <span key={i} className="twitch-mention">
                    {part.value}
                  </span>
                )
              default:
                return <span key={i}>{part.value}</span>
            }
          })}
        </span>
      </div>
    </div>
  )
}
