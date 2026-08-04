import type { AppSettings, ChatMessage, ChatProject, PopupStyle } from '@/types/chat'

export const TWITCH_NAMED_COLORS = [
  '#0000FF',
  '#8A2BE2',
  '#5F9EA0',
  '#D2691E',
  '#FF7F50',
  '#1E90FF',
  '#B22222',
  '#DAA520',
  '#008000',
  '#FF69B4',
  '#FF4500',
  '#FF0000',
  '#2E8B57',
  '#00FF7F',
  '#9ACD32',
] as const

export const DEFAULT_POPUP_STYLE: PopupStyle = {
  backgroundStyle: 'solid',
  backgroundOpacity: 0.72,
  borderWidth: 2,
  borderRadius: 14,
  matchBorderToUsername: true,
  borderColor: '#00FF7F',
  showBadges: true,
  fontSize: 18,
  maxWidth: 520,
  paddingX: 18,
  paddingY: 12,
}

export function createId(): string {
  return crypto.randomUUID()
}

export function randomTwitchColor(seed?: string): string {
  if (!seed) {
    return TWITCH_NAMED_COLORS[Math.floor(Math.random() * TWITCH_NAMED_COLORS.length)]
  }
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return TWITCH_NAMED_COLORS[hash % TWITCH_NAMED_COLORS.length]
}

export function formatChatTimestamp(date = new Date()): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function createEmptyMessage(partial?: Partial<ChatMessage>): ChatMessage {
  const username = partial?.username ?? 'viewer'
  return {
    id: createId(),
    username,
    displayName: partial?.displayName ?? username,
    message: '',
    color: partial?.color ?? randomTwitchColor(username),
    paint: null,
    badges: [],
    showTimestamp: false,
    timestamp: formatChatTimestamp(),
    replyTo: null,
    animation: 'fade',
    ...partial,
  }
}

export function createDefaultProject(): ChatProject {
  return {
    version: 1,
    name: 'Untitled Chat',
    channelLogin: '',
    theme: 'twitch-dark',
    viewMode: 'chat',
    popupStyle: { ...DEFAULT_POPUP_STYLE },
    previewScale: 1,
    animationEnabled: false,
    messages: [
      createEmptyMessage({
        username: 'cool_viewer',
        message: 'OMEGALUL HELLO',
        badges: [{ kind: 'twitch', set: 'subscriber', version: '0' }],
        showTimestamp: true,
      }),
      createEmptyMessage({
        username: 'mod_friend',
        message: 'Welcome to the stream 😂🔥',
        color: '#00FF7F',
        badges: [
          { kind: 'twitch', set: 'moderator', version: '1' },
          { kind: 'twitch', set: 'subscriber', version: '0' },
        ],
      }),
    ],
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  twitchClientId: '',
  twitchAccessToken: '',
  defaultChannel: '',
  exportTransparent: true,
}

export function debounce<T extends (...args: never[]) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

/** Merge older saved projects that lack popup fields */
export function normalizeProject(raw: Partial<ChatProject> | null | undefined): ChatProject {
  const base = createDefaultProject()
  if (!raw || typeof raw !== 'object') return base
  return {
    ...base,
    ...raw,
    popupStyle: {
      ...DEFAULT_POPUP_STYLE,
      ...(raw.popupStyle ?? {}),
      showBadges: true,
    },
    viewMode: raw.viewMode === 'popup' ? 'popup' : raw.viewMode === 'chat' ? 'chat' : base.viewMode,
    messages: Array.isArray(raw.messages) ? raw.messages : base.messages,
  }
}
