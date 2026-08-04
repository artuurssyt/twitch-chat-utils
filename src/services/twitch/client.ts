import type { TwitchBadgeSet } from '@/types/chat'
import { fetchJson } from '@/lib/net'

const HELIX = 'https://api.twitch.tv/helix'
const BADGES_GLOBAL = 'https://badges.twitch.tv/v1/badges/global/display'

export type TwitchCredentials = {
  clientId: string
  accessToken: string
}

export type TwitchUser = {
  id: string
  login: string
  display_name: string
}

type BadgeVersion = { image_url_1x: string; image_url_2x: string; image_url_4x: string; title?: string }
type BadgeSet = { versions: Record<string, BadgeVersion> }

let globalBadgeCache: Record<string, BadgeSet> | null = null
let badgeLoadPromise: Promise<Record<string, BadgeSet>> | null = null

export const TWITCH_BADGE_LABELS: Record<TwitchBadgeSet, string> = {
  broadcaster: 'Broadcaster',
  moderator: 'Moderator',
  vip: 'VIP',
  founder: 'Founder',
  subscriber: 'Subscriber',
  premium: 'Prime',
  staff: 'Staff',
  partner: 'Verified',
  bits: 'Bits',
  turbo: 'Turbo',
}

export const MANUAL_BADGE_PRESETS: Array<{ set: TwitchBadgeSet; version: string; label: string }> = [
  { set: 'broadcaster', version: '1', label: 'Broadcaster' },
  { set: 'moderator', version: '1', label: 'Mod' },
  { set: 'vip', version: '1', label: 'VIP' },
  { set: 'founder', version: '0', label: 'Founder' },
  { set: 'subscriber', version: '0', label: 'Sub' },
  { set: 'premium', version: '1', label: 'Prime' },
  { set: 'staff', version: '1', label: 'Staff' },
  { set: 'partner', version: '1', label: 'Verified' },
]

/** Well-known badge set IDs used by static CDN (fallback when catalog fetch fails). */
const BADGE_SET_IDS: Partial<Record<TwitchBadgeSet, string>> = {
  broadcaster: '5527c58c-fb7d-422d-b71b-f309dcb85cc1',
  moderator: '3267646d-33f0-4b17-b3df-f923a41db1d0',
  vip: 'b817aba4-fad8-49e2-b88a-7cc744296210',
  founder: '511b78a9-ab37-472f-9563-f6a9033d487d',
  subscriber: '5d9f2208-5dd8-11e7-ad86-0ee6b9db9bd3',
  premium: 'a276651d-5753-4171-8c75-b8a1f2f4c8e5',
  partner: 'd12a2e27-16f6-41d0-ab77-b78025bbd7c0',
  staff: 'd97c37bd-a6f5-4c38-8f57-4e4bef88af34',
  turbo: 'd9761efc-e712-4ff1-9c61-ac0aaaf972bd',
  bits: '73b75930-7f86-40ad-8f68-8679f9e6d39e',
}

function hasCreds(creds?: TwitchCredentials | null): creds is TwitchCredentials {
  return Boolean(creds?.clientId && creds?.accessToken)
}

async function helixGet<T>(path: string, creds: TwitchCredentials): Promise<T | null> {
  try {
    const res = await fetch(`${HELIX}${path}`, {
      headers: {
        'Client-ID': creds.clientId,
        Authorization: `Bearer ${creds.accessToken}`,
      },
    })
    if (!res.ok) {
      console.warn('Helix error', path, res.status)
      return null
    }
    return (await res.json()) as T
  } catch (err) {
    console.warn('Helix request failed', err)
    return null
  }
}

export async function fetchTwitchUserByLogin(
  login: string,
  creds?: TwitchCredentials | null,
): Promise<TwitchUser | null> {
  if (!hasCreds(creds) || !login.trim()) return null
  const data = await helixGet<{ data: TwitchUser[] }>(
    `/users?login=${encodeURIComponent(login.trim().toLowerCase())}`,
    creds,
  )
  return data?.data?.[0] ?? null
}

export async function fetchUserChatColor(
  userId: string,
  creds?: TwitchCredentials | null,
): Promise<string | null> {
  if (!hasCreds(creds) || !userId) return null
  const data = await helixGet<{ data: Array<{ color: string }> }>(`/chat/color?user_id=${userId}`, creds)
  const color = data?.data?.[0]?.color
  return color || null
}

function badgeCdn(set: string, version: string): string {
  const id = BADGE_SET_IDS[set as TwitchBadgeSet]
  if (id) return `https://static-cdn.jtvnw.net/badges/v1/${id}/${version}/2`
  // Unknown / event badge sets use the set id string on the CDN
  return `https://static-cdn.jtvnw.net/badges/v1/${set}/${version}/2`
}

function fallbackBadgeCatalog(): Record<string, BadgeSet> {
  const catalog: Record<string, BadgeSet> = {}
  for (const [set, id] of Object.entries(BADGE_SET_IDS)) {
    if (!id) continue
    catalog[set] = {
      versions: {
        '0': {
          image_url_1x: `https://static-cdn.jtvnw.net/badges/v1/${id}/0/1`,
          image_url_2x: `https://static-cdn.jtvnw.net/badges/v1/${id}/0/2`,
          image_url_4x: `https://static-cdn.jtvnw.net/badges/v1/${id}/0/3`,
        },
        '1': {
          image_url_1x: `https://static-cdn.jtvnw.net/badges/v1/${id}/1/1`,
          image_url_2x: `https://static-cdn.jtvnw.net/badges/v1/${id}/1/2`,
          image_url_4x: `https://static-cdn.jtvnw.net/badges/v1/${id}/1/3`,
        },
      },
    }
  }
  return catalog
}

export async function fetchGlobalBadges(): Promise<Record<string, BadgeSet>> {
  if (globalBadgeCache) return globalBadgeCache
  if (badgeLoadPromise) return badgeLoadPromise

  badgeLoadPromise = (async () => {
    const json = await fetchJson<{ badge_sets: Record<string, BadgeSet> }>(BADGES_GLOBAL)
    if (json?.badge_sets) {
      globalBadgeCache = json.badge_sets
      return globalBadgeCache
    }
    console.warn('Using fallback Twitch badge URLs')
    globalBadgeCache = fallbackBadgeCatalog()
    return globalBadgeCache
  })()

  try {
    return await badgeLoadPromise
  } finally {
    badgeLoadPromise = null
  }
}

export async function resolveBadgeUrl(set: string, version: string): Promise<string> {
  const badges = await fetchGlobalBadges()
  const ver =
    badges[set]?.versions?.[version] ??
    badges[set]?.versions?.['1'] ??
    badges[set]?.versions?.['0']
  return ver?.image_url_2x || ver?.image_url_1x || badgeCdn(set, version)
}

export async function fetchGlobalTwitchEmotes(
  creds?: TwitchCredentials | null,
): Promise<Array<{ id: string; name: string }>> {
  if (!hasCreds(creds)) return []
  const data = await helixGet<{ data: Array<{ id: string; name: string }> }>('/chat/emotes/global', creds)
  return data?.data ?? []
}

export function twitchEmoteUrl(id: string, scale: '1.0' | '2.0' | '3.0' = '2.0'): string {
  return `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/${scale}`
}
