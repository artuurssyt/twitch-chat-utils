import { useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useChatStore } from '@/store/chatStore'
import { TwitchChatMessage } from './TwitchChatMessage'
import './twitch-chat.css'

type Props = {
  exportMode?: boolean
  exportTransparent?: boolean
}

export function TwitchChatPreview({ exportMode = false, exportTransparent = false }: Props) {
  const project = useChatStore((s) => s.project)
  const emoteMap = useChatStore((s) => s.emoteMap)
  const parentRef = useRef<HTMLDivElement>(null)

  const themeClass = useMemo(() => {
    if (exportTransparent || project.theme === 'transparent') return 'twitch-chat--transparent'
    if (project.theme === 'twitch-light') return 'twitch-chat--light'
    return ''
  }, [project.theme, exportTransparent])

  const useVirtual = !exportMode && project.messages.length > 80

  const virtualizer = useVirtualizer({
    count: project.messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 12,
  })

  const scale = exportMode ? 1 : project.previewScale

  return (
    <div
      id={exportMode ? 'chat-export-root' : 'chat-preview-root'}
      className={`twitch-chat ${themeClass}`}
      style={{
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: 'bottom left',
        width: scale !== 1 ? `${100 / scale}%` : '100%',
        height: scale !== 1 ? `${100 / scale}%` : '100%',
      }}
    >
      {useVirtual ? (
        <div ref={parentRef} className="twitch-chat__scroll twitch-chat__scroll--virtual">
          <div
            style={{
              height: virtualizer.getTotalSize(),
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((item) => {
              const message = project.messages[item.index]
              return (
                <div
                  key={message.id}
                  data-index={item.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${item.start}px)`,
                  }}
                >
                  <TwitchChatMessage
                    message={message}
                    emoteMap={emoteMap}
                    animate={project.animationEnabled}
                  />
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div ref={parentRef} className="twitch-chat__scroll">
          {project.messages.map((message) => (
            <TwitchChatMessage
              key={message.id}
              message={message}
              emoteMap={emoteMap}
              animate={!exportMode && project.animationEnabled}
            />
          ))}
        </div>
      )}
    </div>
  )
}
