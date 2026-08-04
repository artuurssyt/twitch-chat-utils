import type { EmoteAsset, MessagePart } from '@/types/chat'

const URL_RE = /^(https?:\/\/[^\s]+)$/i
const MENTION_RE = /^@[A-Za-z0-9_]{1,25}$/
// Basic emoji / ZWJ sequences — keep simple for Twitch-like inline rendering
const EMOJI_RE =
  /^(?:\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*)+$/u

/**
 * Parse chat text like Twitch: emotes only replace whole whitespace-separated
 * tokens (so "you" never becomes emote "yo" + "u").
 */
export function parseMessage(raw: string, emoteMap: Map<string, EmoteAsset>): MessagePart[] {
  if (!raw) return [{ type: 'text', value: '' }]

  const tokens = raw.split(/(\s+)/)
  const parts: MessagePart[] = []

  for (const token of tokens) {
    if (!token) continue
    if (/^\s+$/.test(token)) {
      parts.push({ type: 'text', value: token })
      continue
    }

    // Exact whole-word emote match only (Twitch / 7TV behavior)
    const emote = emoteMap.get(token)
    if (emote) {
      parts.push({ type: 'emote', emote })
      continue
    }

    if (URL_RE.test(token)) {
      parts.push({ type: 'link', url: token })
      continue
    }

    if (MENTION_RE.test(token)) {
      parts.push({ type: 'mention', value: token })
      continue
    }

    if (EMOJI_RE.test(token)) {
      parts.push({ type: 'emoji', value: token })
      continue
    }

    // Only split Unicode emoji out of mixed text — never substring-match emotes
    parts.push(...splitEmojiFromText(token))
  }

  return mergeAdjacentText(parts)
}

function splitEmojiFromText(token: string): MessagePart[] {
  const parts: MessagePart[] = []
  let buffer = ''
  const chars = [...token]

  for (const ch of chars) {
    if (EMOJI_RE.test(ch)) {
      if (buffer) {
        parts.push({ type: 'text', value: buffer })
        buffer = ''
      }
      parts.push({ type: 'emoji', value: ch })
    } else {
      buffer += ch
    }
  }
  if (buffer) parts.push({ type: 'text', value: buffer })
  return parts
}

function mergeAdjacentText(parts: MessagePart[]): MessagePart[] {
  const out: MessagePart[] = []
  for (const part of parts) {
    const last = out[out.length - 1]
    if (part.type === 'text' && last?.type === 'text') {
      last.value += part.value
    } else {
      out.push(part)
    }
  }
  return out
}

export function filterEmotesByPrefix(emoteMap: Map<string, EmoteAsset>, prefix: string, limit = 12): EmoteAsset[] {
  if (!prefix) return []
  const lower = prefix.toLowerCase()
  const results: EmoteAsset[] = []
  for (const [name, emote] of emoteMap) {
    if (name.toLowerCase().startsWith(lower)) {
      results.push(emote)
      if (results.length >= limit) break
    }
  }
  return results
}
