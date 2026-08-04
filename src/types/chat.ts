export type BadgeKind = 'twitch' | '7tv'

export type TwitchBadgeSet =
  | 'broadcaster'
  | 'moderator'
  | 'vip'
  | 'founder'
  | 'subscriber'
  | 'premium'
  | 'staff'
  | 'partner'
  | 'bits'
  | 'turbo'

export type BadgeRef =
  | { kind: 'twitch'; set: string; version: string }
  | { kind: '7tv'; id: string; url: string; tooltip?: string }

export type SevenTvPaintStop = {
  at: number
  color: string
}

export type SevenTvPaint = {
  id: string
  name: string
  color?: number | null
  function?: string | null
  stops?: SevenTvPaintStop[]
  repeat?: boolean
  angle?: number
  shape?: string | null
  imageUrl?: string | null
  shadows?: Array<{ x_offset: number; y_offset: number; radius: number; color: number }>
  /** Raw CSS background if provided by API */
  css?: string | null
  animated?: boolean
}

export type ReplyTo = {
  username: string
  messageSnippet: string
}

export type MessageAnimation = 'none' | 'fade' | 'slide'

export type ChatMessage = {
  id: string
  username: string
  displayName?: string
  message: string
  color?: string
  paint?: SevenTvPaint | null
  badges: BadgeRef[]
  showTimestamp: boolean
  timestamp?: string | null
  replyTo?: ReplyTo | null
  animation?: MessageAnimation
}

export type ChatTheme = 'twitch-dark' | 'twitch-light' | 'transparent'

export type ViewMode = 'chat' | 'popup'

export type PopupBackgroundStyle = 'solid' | 'frosted'

export type PopupStyle = {
  backgroundStyle: PopupBackgroundStyle
  /** 0–1 fill opacity for the bubble */
  backgroundOpacity: number
  borderWidth: number
  borderRadius: number
  /** When true, border uses the username color */
  matchBorderToUsername: boolean
  borderColor: string
  showBadges: boolean
  fontSize: number
  maxWidth: number
  paddingX: number
  paddingY: number
}

export type ChatProject = {
  version: 1
  name: string
  channelLogin?: string
  theme: ChatTheme
  viewMode: ViewMode
  popupStyle: PopupStyle
  messages: ChatMessage[]
  previewScale: number
  animationEnabled: boolean
}

export type AppSettings = {
  twitchClientId: string
  twitchAccessToken: string
  defaultChannel: string
  exportTransparent: boolean
}

export type EmoteAsset = {
  id: string
  name: string
  url: string
  url2x?: string
  url3x?: string
  animated: boolean
  provider: '7tv' | 'twitch' | 'bttv' | 'ffz'
  zeroWidth?: boolean
}

export type MessagePart =
  | { type: 'text'; value: string }
  | { type: 'emote'; emote: EmoteAsset }
  | { type: 'emoji'; value: string }
  | { type: 'link'; url: string }
  | { type: 'mention'; value: string }
