import type { EmoteAsset, SevenTvPaint, SevenTvPaintStop } from '@/types/chat'

const API = 'https://7tv.io/v3'
const CDN = 'https://cdn.7tv.app'
const GQL = `${API}/gql`

export type SevenTvUserPayload = {
  id: string
  username: string
  display_name: string
  avatar_url?: string
  style?: {
    color?: number
    paint_id?: string | null
    badge_id?: string | null
  }
  paint?: SevenTvPaintRaw | null
  badge?: SevenTvBadgeRaw | null
  emote_set?: SevenTvEmoteSetRaw | null
  emote_sets?: SevenTvEmoteSetRaw[]
  connections?: Array<{
    id: string
    platform: string
    username: string
    display_name: string
    emote_set_id?: string
    emote_set?: SevenTvEmoteSetRaw | null
  }>
}

type SevenTvBadgeRaw = {
  id: string
  name: string
  tooltip?: string
  host?: { url: string; files?: Array<{ name: string; format: string }> }
}

type SevenTvPaintRaw = {
  id: string
  name: string
  color?: number | null
  function?: string | null
  angle?: number
  shape?: string | null
  image_url?: string | null
  repeat?: boolean
  stops?: Array<{ at: number; color: number }>
  shadows?: Array<{ x_offset: number; y_offset: number; radius: number; color: number }>
}

type SevenTvEmoteSetRaw = {
  id: string
  name: string
  emotes?: Array<{
    id: string
    name: string
    data?: {
      id: string
      name: string
      animated?: boolean
      host?: {
        url: string
        files?: Array<{ name: string; format: string; width: number; height: number }>
      }
    }
  }>
}

type TwitchConnectionPayload = {
  id: string
  platform?: string
  username?: string
  display_name?: string
  emote_set?: SevenTvEmoteSetRaw | null
  user?: { id: string }
}

export type TwitchPublicProfile = {
  id: string
  login: string
  displayName?: string
  chatColor?: string | null
  badges: Array<{ setID: string; version: string; title?: string }>
  isPartner?: boolean
  isStaff?: boolean
}

const userCache = new Map<string, SevenTvUserPayload | null>()
const paintCache = new Map<string, SevenTvPaint>()
const badgeCache = new Map<string, { id: string; url: string; tooltip?: string }>()
let globalEmotesCache: Map<string, EmoteAsset> | null = null
let cosmeticsLoaded = false

/** 7TV encodes colors as signed int RRGGBBAA (not ARGB). */
function intToRgba(color: number): string {
  const u = color >>> 0
  const r = (u >>> 24) & 0xff
  const g = (u >>> 16) & 0xff
  const b = (u >>> 8) & 0xff
  const a = u & 0xff
  if (a === 255) return `rgb(${r}, ${g}, ${b})`
  return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`
}

function intToHex(color: number): string {
  const u = color >>> 0
  const r = ((u >>> 24) & 0xff).toString(16).padStart(2, '0')
  const g = ((u >>> 16) & 0xff).toString(16).padStart(2, '0')
  const b = ((u >>> 8) & 0xff).toString(16).padStart(2, '0')
  return `#${r}${g}${b}`
}

export function paintFromRaw(raw: SevenTvPaintRaw): SevenTvPaint {
  const stops: SevenTvPaintStop[] | undefined = raw.stops?.map((s) => ({
    at: s.at,
    color: intToRgba(s.color),
  }))

  const imageUrl = raw.image_url?.trim() ? raw.image_url : null

  return {
    id: raw.id,
    name: raw.name,
    color: raw.color,
    function: raw.function,
    angle: raw.angle,
    shape: raw.shape,
    imageUrl,
    repeat: raw.repeat,
    stops,
    shadows: raw.shadows,
    animated: Boolean(imageUrl?.includes('.webp') || raw.function === 'URL' || raw.function === 'IMAGE'),
  }
}

export type PaintCss = {
  backgroundImage?: string
  backgroundSize?: string
  backgroundPosition?: string
  textShadow?: string
  color?: string
  isPainted: boolean
}

/** Build CSS matching the 7TV extension nametag paint renderer. */
export function buildPaintCss(paint: SevenTvPaint): PaintCss {
  if (paint.imageUrl) {
    return {
      backgroundImage: `url(${paint.imageUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      textShadow: shadowCss(paint),
      color: paint.color != null ? intToHex(paint.color) : undefined,
      isPainted: true,
    }
  }

  const stops = paint.stops ?? []
  if (stops.length >= 2) {
    // Keep hard band edges (duplicate at positions) like the 7TV paint tool
    const gradientStops = stops.map((s) => `${s.color} ${(s.at * 100).toFixed(2)}%`).join(', ')
    const angle = paint.angle ?? 90
    const fn = (paint.function || 'LINEAR_GRADIENT').toUpperCase()
    const repeating = paint.repeat ? 'repeating-' : ''
    let backgroundImage: string
    if (fn.includes('RADIAL')) {
      const shape = paint.shape === 'circle' ? 'circle' : 'ellipse'
      backgroundImage = `${repeating}radial-gradient(${shape}, ${gradientStops})`
    } else {
      backgroundImage = `${repeating}linear-gradient(${angle}deg, ${gradientStops})`
    }
    return {
      backgroundImage,
      backgroundSize: paint.repeat ? '100% 100%' : undefined,
      backgroundPosition: 'center',
      textShadow: shadowCss(paint),
      color: paint.color != null ? intToHex(paint.color) : undefined,
      isPainted: true,
    }
  }

  if (paint.color != null) {
    const hex = intToHex(paint.color)
    return {
      color: hex,
      textShadow: shadowCss(paint),
      isPainted: false,
    }
  }

  return { isPainted: false }
}

function shadowCss(paint: SevenTvPaint): string | undefined {
  if (!paint.shadows?.length) return undefined
  // 7TV stores offsets/radius in em-like units
  return paint.shadows
    .map((sh) => {
      const x = `${sh.x_offset}em`
      const y = `${sh.y_offset}em`
      const r = `${Math.max(sh.radius, 0.05)}em`
      return `${x} ${y} ${r} ${intToRgba(sh.color)}`
    })
    .join(', ')
}

/** @deprecated use buildPaintCss — kept for any older imports */
export function buildPaintBackground(paint: SevenTvPaint): { background: string; filter?: string; color?: string } {
  const css = buildPaintCss(paint)
  return {
    background: css.backgroundImage || css.color || 'currentColor',
    color: css.color,
  }
}

function emoteFromRaw(
  id: string,
  name: string,
  host?: { url: string; files?: Array<{ name: string; format: string }> },
  animated?: boolean,
): EmoteAsset {
  const base = host?.url?.startsWith('//') ? `https:${host.url}` : host?.url || `${CDN}/emote/${id}`
  const files = host?.files ?? []
  const preferWebp = files.filter((f) => f.format === 'WEBP')
  const pick = (size: string) => {
    const match = preferWebp.find((f) => f.name.startsWith(size)) ?? files.find((f) => f.name.startsWith(size))
    if (match) return `${base}/${match.name}`
    return `${base}/${size}x.webp`
  }
  return {
    id,
    name,
    url: pick('1'),
    url2x: pick('2'),
    url3x: pick('3'),
    animated: Boolean(animated),
    provider: '7tv',
  }
}

function collectEmotesFromSet(set: SevenTvEmoteSetRaw | null | undefined, map: Map<string, EmoteAsset>) {
  if (!set?.emotes) return
  for (const e of set.emotes) {
    const data = e.data
    const id = data?.id ?? e.id
    const name = e.name || data?.name
    if (!id || !name) continue
    map.set(name, emoteFromRaw(id, name, data?.host, data?.animated))
  }
}

function badgeFromRaw(raw: SevenTvBadgeRaw): { id: string; url: string; tooltip?: string } {
  const host = raw.host
  const base = host?.url?.startsWith('//') ? `https:${host.url}` : host?.url
  const file =
    host?.files?.find((f) => f.name.startsWith('2x')) ??
    host?.files?.find((f) => f.name.startsWith('1x')) ??
    host?.files?.[0]
  const url = base && file ? `${base}/${file.name}` : `${CDN}/badge/${raw.id}/2x.webp`
  return { id: raw.id, url, tooltip: raw.tooltip || raw.name }
}

export async function ensureCosmeticsCatalog(): Promise<void> {
  if (cosmeticsLoaded) return
  try {
    const res = await fetch(GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{
          cosmetics {
            paints {
              id name function color angle shape image_url repeat
              stops { at color }
              shadows { x_offset y_offset radius color }
            }
            badges {
              id name tooltip
              host { url files { name format } }
            }
          }
        }`,
      }),
    })
    if (!res.ok) throw new Error(`cosmetics gql ${res.status}`)
    const json = (await res.json()) as {
      data?: {
        cosmetics?: {
          paints?: SevenTvPaintRaw[]
          badges?: SevenTvBadgeRaw[]
        }
      }
    }
    for (const p of json.data?.cosmetics?.paints ?? []) {
      paintCache.set(p.id, paintFromRaw(p))
    }
    for (const b of json.data?.cosmetics?.badges ?? []) {
      badgeCache.set(b.id, badgeFromRaw(b))
    }
    cosmeticsLoaded = true
  } catch (err) {
    console.warn('Failed to load 7TV cosmetics catalog', err)
  }
}

export async function fetchGlobalEmotes(): Promise<Map<string, EmoteAsset>> {
  if (globalEmotesCache) return new Map(globalEmotesCache)
  try {
    const res = await fetch(`${API}/emote-sets/global`)
    if (!res.ok) throw new Error(`7TV global emotes ${res.status}`)
    const data = (await res.json()) as SevenTvEmoteSetRaw
    const map = new Map<string, EmoteAsset>()
    collectEmotesFromSet(data, map)
    globalEmotesCache = map
    return new Map(map)
  } catch (err) {
    console.warn('Failed to load 7TV global emotes', err)
    return new Map()
  }
}

export async function resolveTwitchProfile(login: string): Promise<TwitchPublicProfile | null> {
  try {
    const res = await fetch(`https://api.ivr.fi/v2/twitch/user?login=${encodeURIComponent(login)}`)
    if (!res.ok) return null
    const data = (await res.json()) as
      | Array<{
          id: string
          login: string
          displayName?: string
          chatColor?: string | null
          badges?: Array<{ setID: string; version: string; title?: string }>
          roles?: { isPartner?: boolean; isStaff?: boolean | null }
        }>
      | {
          id: string
          login: string
          displayName?: string
          chatColor?: string | null
          badges?: Array<{ setID: string; version: string; title?: string }>
          roles?: { isPartner?: boolean; isStaff?: boolean | null }
        }
    const row = Array.isArray(data) ? data[0] : data
    if (!row?.id) return null
    return {
      id: row.id,
      login: row.login,
      displayName: row.displayName,
      chatColor: row.chatColor || null,
      badges: row.badges ?? [],
      isPartner: Boolean(row.roles?.isPartner),
      isStaff: Boolean(row.roles?.isStaff),
    }
  } catch {
    return null
  }
}

async function hydrateUser(userId: string, channelEmoteSet?: SevenTvEmoteSetRaw | null): Promise<SevenTvUserPayload | null> {
  const fullRes = await fetch(`${API}/users/${userId}`)
  if (!fullRes.ok) return null
  const full = (await fullRes.json()) as SevenTvUserPayload

  // Attach active channel emote set from the Twitch connection response when present
  if (channelEmoteSet) {
    const twitchConn = full.connections?.find((c) => c.platform === 'TWITCH')
    if (twitchConn && !twitchConn.emote_set) {
      twitchConn.emote_set = channelEmoteSet
    }
    if (!full.emote_set) full.emote_set = channelEmoteSet
  }

  // Resolve paint/badge from style ids via cosmetics catalog
  await ensureCosmeticsCatalog()
  return full
}

export async function fetchUserByTwitchId(twitchId: string): Promise<SevenTvUserPayload | null> {
  try {
    const res = await fetch(`${API}/users/twitch/${twitchId}`)
    if (!res.ok) return null
    const conn = (await res.json()) as TwitchConnectionPayload & SevenTvUserPayload
    // Endpoint returns a connection object with nested `.user`
    if (conn.user?.id) {
      return hydrateUser(conn.user.id, conn.emote_set)
    }
    // Or a full user already
    if (conn.id && conn.username) {
      return hydrateUser(conn.id, conn.emote_set)
    }
    return null
  } catch {
    return null
  }
}

export async function fetchUserByTwitchLogin(login: string): Promise<SevenTvUserPayload | null> {
  const key = login.trim().toLowerCase()
  if (!key) return null
  if (userCache.has(key)) return userCache.get(key) ?? null

  try {
    const profile = await resolveTwitchProfile(key)
    if (profile?.id) {
      const byTwitch = await fetchUserByTwitchId(profile.id)
      if (byTwitch) {
        userCache.set(key, byTwitch)
        return byTwitch
      }
    }

    userCache.set(key, null)
    return null
  } catch (err) {
    console.warn('7TV user lookup failed', err)
    userCache.set(key, null)
    return null
  }
}

export function extractUserCosmetics(user: SevenTvUserPayload): {
  paint: SevenTvPaint | null
  badge: { id: string; url: string; tooltip?: string } | null
  color?: string
  emotes: Map<string, EmoteAsset>
} {
  const emotes = new Map<string, EmoteAsset>()
  collectEmotesFromSet(user.emote_set, emotes)
  for (const set of user.emote_sets ?? []) collectEmotesFromSet(set, emotes)
  for (const conn of user.connections ?? []) collectEmotesFromSet(conn.emote_set, emotes)

  let paint: SevenTvPaint | null = null
  if (user.style?.paint_id && paintCache.has(user.style.paint_id)) {
    paint = paintCache.get(user.style.paint_id)!
  } else if (user.paint) {
    paint = paintFromRaw(user.paint)
    paintCache.set(paint.id, paint)
  }

  let badge: { id: string; url: string; tooltip?: string } | null = null
  if (user.style?.badge_id) {
    if (badgeCache.has(user.style.badge_id)) {
      badge = badgeCache.get(user.style.badge_id)!
    } else {
      // Catalog miss — still render from CDN (Twitch+7TV always host here)
      const id = user.style.badge_id
      badge = {
        id,
        url: `${CDN}/badge/${id}/2x.webp`,
        tooltip: '7TV',
      }
    }
  } else if (user.badge) {
    badge = badgeFromRaw(user.badge)
  }

  const color = user.style?.color != null ? intToHex(user.style.color) : undefined

  return { paint, badge, color, emotes }
}

export async function fetchChannelEmotes(channelLogin: string): Promise<Map<string, EmoteAsset>> {
  const user = await fetchUserByTwitchLogin(channelLogin)
  if (!user) return new Map()
  const { emotes } = extractUserCosmetics(user)
  const twitch = user.connections?.find((c) => c.platform === 'TWITCH')
  if (twitch?.emote_set) collectEmotesFromSet(twitch.emote_set, emotes)
  return emotes
}

export function getCachedPaint(id: string): SevenTvPaint | undefined {
  return paintCache.get(id)
}

export function clearSevenTvCaches() {
  userCache.clear()
  paintCache.clear()
  badgeCache.clear()
  globalEmotesCache = null
  cosmeticsLoaded = false
}
