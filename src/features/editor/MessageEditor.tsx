import { useEffect, useMemo, useRef, useState } from 'react'
import { useChatStore } from '@/store/chatStore'
import { MANUAL_BADGE_PRESETS } from '@/services/twitch/client'
import { filterEmotesByPrefix } from '@/services/emotes/parseMessage'
import { formatChatTimestamp, randomTwitchColor } from '@/lib/utils'
import {
  ensureCosmeticsCatalog,
  extractUserCosmetics,
  fetchUserByTwitchId,
  fetchUserByTwitchLogin,
  resolveTwitchProfile,
} from '@/services/seventv/client'
import { fetchTwitchUserByLogin, fetchUserChatColor } from '@/services/twitch/client'
import type { BadgeRef } from '@/types/chat'

export function MessageEditor() {
  const selectedId = useChatStore((s) => s.selectedId)
  const messages = useChatStore((s) => s.project.messages)
  const selected = messages.find((m) => m.id === selectedId) ?? null
  const updateSelected = useChatStore((s) => s.updateSelected)
  const patchSelected = useChatStore((s) => s.patchSelected)
  const toggleBadge = useChatStore((s) => s.toggleBadge)
  const setReplyEnabled = useChatStore((s) => s.setReplyEnabled)
  const setTimestampEnabled = useChatStore((s) => s.setTimestampEnabled)
  const setAnimation = useChatStore((s) => s.setAnimation)
  const emoteMap = useChatStore((s) => s.emoteMap)
  const mergeEmotes = useChatStore((s) => s.mergeEmotes)
  const settings = useChatStore((s) => s.settings)

  const [lookupStatus, setLookupStatus] = useState<string>('')
  const [autocomplete, setAutocomplete] = useState<{ start: number; query: string } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const colorOverride = useRef(false)

  // Reset override when selection changes
  useEffect(() => {
    colorOverride.current = false
  }, [selectedId])

  useEffect(() => {
    if (!selected?.username) return
    if (lookupTimer.current) clearTimeout(lookupTimer.current)
    lookupTimer.current = setTimeout(() => {
      void lookupUser(selected.username)
    }, 400)
    return () => {
      if (lookupTimer.current) clearTimeout(lookupTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.username])

  async function lookupUser(username: string) {
    const login = username.trim()
    if (!login) return
    setLookupStatus('Looking up…')
    try {
      await ensureCosmeticsCatalog()
      const creds =
        settings.twitchClientId && settings.twitchAccessToken
          ? { clientId: settings.twitchClientId, accessToken: settings.twitchAccessToken }
          : null

      const publicProfile = await resolveTwitchProfile(login)
      let twitchUser = await fetchTwitchUserByLogin(login, creds)
      let seventv = publicProfile
        ? await fetchUserByTwitchId(publicProfile.id)
        : twitchUser
          ? await fetchUserByTwitchId(twitchUser.id)
          : await fetchUserByTwitchLogin(login)

      if (!seventv && !twitchUser && !publicProfile) {
        setLookupStatus('User not found')
        return
      }

      const cosmetics = seventv ? extractUserCosmetics(seventv) : null
      if (cosmetics?.emotes.size) mergeEmotes(cosmetics.emotes)

      // Priority: 7TV paint → Helix color → IVR chatColor → 7TV style color → random
      let color: string | undefined
      if (twitchUser && creds) {
        color = (await fetchUserChatColor(twitchUser.id, creds)) || undefined
      }
      if (!color && publicProfile?.chatColor) color = publicProfile.chatColor
      if (!color && cosmetics?.color) color = cosmetics.color

      const patch: Parameters<typeof updateSelected>[0] = {
        displayName:
          twitchUser?.display_name ||
          publicProfile?.displayName ||
          seventv?.display_name ||
          login,
      }

      if (cosmetics?.paint) patch.paint = cosmetics.paint
      else patch.paint = null

      if (!colorOverride.current) {
        patch.color = color || randomTwitchColor(login)
      }

      // Rebuild badges: keep manually useful Twitch toggles, add IVR + 7TV auto badges
      const current = useChatStore.getState().getSelected()
      const manualKeep = (current?.badges ?? []).filter((b) => {
        if (b.kind !== 'twitch') return false
        // Keep common chat badges the user toggled (IVR profile rarely has these)
        return ['broadcaster', 'moderator', 'vip', 'founder', 'subscriber', 'premium', 'turbo', 'bits'].includes(
          b.set,
        )
      })

      const autoTwitch: BadgeRef[] = []
      for (const b of publicProfile?.badges ?? []) {
        if (!b.setID) continue
        autoTwitch.push({ kind: 'twitch', set: b.setID, version: b.version || '1' })
      }
      if (publicProfile?.isPartner) {
        autoTwitch.push({ kind: 'twitch', set: 'partner', version: '1' })
      }
      if (publicProfile?.isStaff) {
        autoTwitch.push({ kind: 'twitch', set: 'staff', version: '1' })
      }

      // Dedupe twitch by set
      const twitchBySet = new Map<string, BadgeRef>()
      for (const b of [...manualKeep, ...autoTwitch]) {
        if (b.kind === 'twitch') twitchBySet.set(b.set, b)
      }

      const nextBadges: BadgeRef[] = [...twitchBySet.values()]
      if (cosmetics?.badge) {
        nextBadges.push({
          kind: '7tv',
          id: cosmetics.badge.id,
          url: cosmetics.badge.url,
          tooltip: cosmetics.badge.tooltip,
        })
      }
      patch.badges = nextBadges

      updateSelected(patch)
      const badgeNote = [
        cosmetics?.paint ? `paint:${cosmetics.paint.name}` : null,
        cosmetics?.badge ? '7TV badge' : null,
        nextBadges.filter((b) => b.kind === 'twitch').length
          ? `${nextBadges.filter((b) => b.kind === 'twitch').length} Twitch badge(s)`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
      setLookupStatus(badgeNote || 'Loaded')
    } catch (err) {
      console.warn(err)
      setLookupStatus('Lookup failed')
    }
  }

  const suggestions = useMemo(() => {
    if (!autocomplete) return []
    return filterEmotesByPrefix(emoteMap, autocomplete.query)
  }, [autocomplete, emoteMap])

  if (!selected) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-zinc-500">
        Select or add a message to edit
      </div>
    )
  }

  const msg = selected

  function onMessageChange(value: string) {
    patchSelected({ message: value })
    const el = textareaRef.current
    if (!el) return
    const caret = el.selectionStart
    const before = value.slice(0, caret)
    const match = before.match(/(?:^|\s)([A-Za-z0-9_]+)$/)
    if (match && match[1].length >= 2) {
      setAutocomplete({ start: caret - match[1].length, query: match[1] })
    } else {
      setAutocomplete(null)
    }
  }

  function applySuggestion(name: string) {
    if (!autocomplete) return
    const before = msg.message.slice(0, autocomplete.start)
    const after = msg.message.slice(autocomplete.start + autocomplete.query.length)
    const next = `${before}${name} ${after}`
    updateSelected({ message: next })
    setAutocomplete(null)
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      const pos = before.length + name.length + 1
      el.focus()
      el.setSelectionRange(pos, pos)
    })
  }

  function hasTwitchBadge(set: string) {
    return msg.badges.some((b) => b.kind === 'twitch' && b.set === set)
  }

  return (
    <div className="flex flex-col gap-3 p-4 overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium uppercase tracking-wide text-zinc-400">Username</label>
        <span className="text-[11px] text-zinc-500">{lookupStatus}</span>
      </div>
      <input
        className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500"
        value={msg.username}
        onChange={(e) => {
          colorOverride.current = false
          patchSelected({ username: e.target.value, displayName: e.target.value })
        }}
        placeholder="twitch_username"
      />

      <label className="text-xs font-medium uppercase tracking-wide text-zinc-400">Message</label>
      <div className="relative">
        <textarea
          ref={textareaRef}
          className="min-h-[88px] w-full resize-y rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500"
          value={msg.message}
          onChange={(e) => onMessageChange(e.target.value)}
          placeholder="OMEGALUL HELLO PepeLaugh"
          spellCheck={false}
        />
        {suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-md border border-zinc-700 bg-zinc-900 shadow-xl">
            {suggestions.map((emote) => (
              <button
                key={emote.id}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                onClick={() => applySuggestion(emote.name)}
              >
                <img src={emote.url} alt="" className="h-6 w-6 object-contain" />
                <span>{emote.name}</span>
                <span className="ml-auto text-[10px] uppercase text-zinc-500">{emote.provider}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs font-medium uppercase tracking-wide text-zinc-400">Color</label>
        <input
          type="color"
          value={msg.color?.startsWith('#') ? msg.color : '#efeff1'}
          onChange={(e) => {
            colorOverride.current = true
            updateSelected({ color: e.target.value, paint: null })
          }}
          className="h-8 w-10 cursor-pointer rounded border border-zinc-700 bg-transparent"
        />
        <button
          type="button"
          className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
          onClick={() => {
            colorOverride.current = false
            void lookupUser(msg.username)
          }}
        >
          Refetch cosmetics
        </button>
      </div>

      <label className="text-xs font-medium uppercase tracking-wide text-zinc-400">Badges</label>
      <div className="flex flex-wrap gap-1.5">
        {MANUAL_BADGE_PRESETS.map((preset) => {
          const active = hasTwitchBadge(preset.set)
          return (
            <button
              key={preset.set}
              type="button"
              onClick={() =>
                toggleBadge({ kind: 'twitch', set: preset.set, version: preset.version })
              }
              className={`rounded-md px-2 py-1 text-xs ${
                active
                  ? 'bg-violet-600 text-white'
                  : 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              {preset.label}
            </button>
          )
        })}
        {msg.badges.some((b) => b.kind === '7tv') && (
          <button
            type="button"
            className="rounded-md bg-emerald-700 px-2 py-1 text-xs text-white"
            onClick={() => {
              const b = msg.badges.find((x) => x.kind === '7tv')
              if (b) toggleBadge(b)
            }}
          >
            7TV
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={msg.showTimestamp}
            onChange={(e) => {
              setTimestampEnabled(e.target.checked)
              if (e.target.checked && !msg.timestamp) {
                updateSelected({ timestamp: formatChatTimestamp() })
              }
            }}
          />
          Timestamp
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={Boolean(msg.replyTo)}
            onChange={(e) => setReplyEnabled(e.target.checked)}
          />
          Reply
        </label>
      </div>

      {msg.replyTo && (
        <div className="grid gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 p-2">
          <input
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
            value={msg.replyTo.username}
            placeholder="Reply username"
            onChange={(e) =>
              updateSelected({ replyTo: { ...msg.replyTo!, username: e.target.value } })
            }
          />
          <input
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
            value={msg.replyTo.messageSnippet}
            placeholder="Reply snippet"
            onChange={(e) =>
              updateSelected({
                replyTo: { ...msg.replyTo!, messageSnippet: e.target.value },
              })
            }
          />
        </div>
      )}

      {msg.showTimestamp && (
        <input
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          value={msg.timestamp ?? ''}
          onChange={(e) => updateSelected({ timestamp: e.target.value })}
          placeholder="12:34"
        />
      )}

      <label className="text-xs font-medium uppercase tracking-wide text-zinc-400">
        Line animation
      </label>
      <select
        className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
        value={msg.animation ?? 'fade'}
        onChange={(e) => setAnimation(e.target.value as 'none' | 'fade' | 'slide')}
      >
        <option value="none">None</option>
        <option value="fade">Fade</option>
        <option value="slide">Slide up</option>
      </select>

      <div className="text-[11px] text-zinc-500">
        {messages.length} message{messages.length === 1 ? '' : 's'} in project
      </div>
    </div>
  )
}
