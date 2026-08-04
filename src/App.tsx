import { useEffect } from 'react'
import { ActionBar, PopupStylePanel } from '@/features/editor/ActionBar'
import { MessageEditor } from '@/features/editor/MessageEditor'
import { MessageList } from '@/features/editor/MessageList'
import { SettingsModal } from '@/features/editor/SettingsModal'
import { TwitchChatPreview } from '@/features/preview/TwitchChatPreview'
import { PopupPreview } from '@/features/preview/PopupPreview'
import { useChatStore } from '@/store/chatStore'
import { fetchGlobalEmotes, fetchChannelEmotes, ensureCosmeticsCatalog } from '@/services/seventv/client'
import { fetchGlobalBadges, fetchGlobalTwitchEmotes, twitchEmoteUrl } from '@/services/twitch/client'
import {
  exportPng,
  loadProjectFromDisk,
  saveProjectToDisk,
} from '@/features/export/exportUtils'
import type { EmoteAsset } from '@/types/chat'

function useKeyboardShortcuts() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)

      const mod = e.ctrlKey || e.metaKey
      const store = useChatStore.getState()

      if (mod && e.key.toLowerCase() === 'enter') {
        e.preventDefault()
        store.addMessage()
        return
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        store.duplicateSelected()
        return
      }
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        store.undo()
        return
      }
      if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault()
        store.redo()
        return
      }
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveProjectToDisk()
        return
      }
      if (mod && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        void exportPng(true)
        return
      }
      if (mod && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        void loadProjectFromDisk()
        return
      }
      if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault()
        store.moveSelected(-1)
        return
      }
      if (e.altKey && e.key === 'ArrowDown') {
        e.preventDefault()
        store.moveSelected(1)
        return
      }
      if (!typing && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault()
        store.deleteSelected()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

function useBootstrapEmotes() {
  const channelLogin = useChatStore((s) => s.project.channelLogin)
  const settings = useChatStore((s) => s.settings)
  const setEmoteMap = useChatStore((s) => s.setEmoteMap)
  const mergeEmotes = useChatStore((s) => s.mergeEmotes)
  const setAssetLoad = useChatStore((s) => s.setAssetLoad)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setAssetLoad({ status: 'loading', label: 'Starting…', progress: 5, emoteCount: 0 })
      try {
        setAssetLoad({ label: 'Loading 7TV paints & badges…', progress: 15 })
        await ensureCosmeticsCatalog()
        if (cancelled) return

        setAssetLoad({ label: 'Loading Twitch badges…', progress: 40 })
        await fetchGlobalBadges()
        if (cancelled) return

        setAssetLoad({ label: 'Loading global 7TV emotes…', progress: 55 })
        const global = await fetchGlobalEmotes()
        if (cancelled) return
        setEmoteMap(global)
        setAssetLoad({
          label: `Loaded ${global.size} global emotes…`,
          progress: 70,
          emoteCount: global.size,
        })

        const creds =
          settings.twitchClientId && settings.twitchAccessToken
            ? { clientId: settings.twitchClientId, accessToken: settings.twitchAccessToken }
            : null
        if (creds) {
          setAssetLoad({ label: 'Loading Twitch emotes…', progress: 80 })
          const twitchEmotes = await fetchGlobalTwitchEmotes(creds)
          if (!cancelled && twitchEmotes.length) {
            const map = new Map<string, EmoteAsset>()
            for (const e of twitchEmotes) {
              map.set(e.name, {
                id: e.id,
                name: e.name,
                url: twitchEmoteUrl(e.id, '1.0'),
                url2x: twitchEmoteUrl(e.id, '2.0'),
                url3x: twitchEmoteUrl(e.id, '3.0'),
                animated: false,
                provider: 'twitch',
              })
            }
            mergeEmotes(map)
          }
        }
        if (cancelled) return

        const channel = channelLogin?.trim()
        if (channel) {
          setAssetLoad({
            label: `Loading #${channel} emotes…`,
            progress: 90,
            emoteCount: useChatStore.getState().emoteMap.size,
          })
          const map = await fetchChannelEmotes(channel)
          if (cancelled) return
          if (map.size) mergeEmotes(map)
        }

        if (cancelled) return
        const count = useChatStore.getState().emoteMap.size
        setAssetLoad({
          status: 'done',
          label: `${count} emotes ready`,
          progress: 100,
          emoteCount: count,
        })
      } catch (err) {
        console.warn(err)
        if (!cancelled) {
          setAssetLoad({
            status: 'error',
            label: 'Failed to load some assets',
            progress: 100,
          })
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [
    channelLogin,
    settings.twitchClientId,
    settings.twitchAccessToken,
    setEmoteMap,
    mergeEmotes,
    setAssetLoad,
  ])
}

export default function App() {
  const initFromStorage = useChatStore((s) => s.initFromStorage)
  const theme = useChatStore((s) => s.project.theme)
  const viewMode = useChatStore((s) => s.project.viewMode)
  const projectName = useChatStore((s) => s.project.name)
  const setProjectName = useChatStore((s) => s.setProjectName)
  const assetLoad = useChatStore((s) => s.assetLoad)

  useEffect(() => {
    initFromStorage()
  }, [initFromStorage])

  useKeyboardShortcuts()
  useBootstrapEmotes()

  // Clear the "ready" label after a few seconds so the header stays clean.
  useEffect(() => {
    if (assetLoad.status !== 'done') return
    const t = setTimeout(() => {
      useChatStore.getState().setAssetLoad({ status: 'idle', label: '', progress: 0 })
    }, 3500)
    return () => clearTimeout(t)
  }, [assetLoad.status, assetLoad.emoteCount])

  const isPopup = viewMode === 'popup'
  const showLoadBar = assetLoad.status === 'loading' || assetLoad.status === 'error'
  const showLoadDone = assetLoad.status === 'done'

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex flex-col border-b border-zinc-800">
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="text-sm font-semibold tracking-tight text-violet-300">Twitch Chat Overlay</div>
          <input
            className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-2 py-1 text-sm text-zinc-200 outline-none hover:border-zinc-700 focus:border-violet-600"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            title="Project name"
          />
          {(showLoadBar || showLoadDone) && (
            <div
              className={`hidden max-w-[280px] truncate text-[11px] sm:block ${
                assetLoad.status === 'error'
                  ? 'text-red-400'
                  : assetLoad.status === 'loading'
                    ? 'text-amber-300'
                    : 'text-zinc-500'
              }`}
              title={assetLoad.label}
            >
              {assetLoad.status === 'loading' && (
                <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
              )}
              {assetLoad.label}
            </div>
          )}
          <div className="hidden text-[11px] text-zinc-500 lg:block">
            {isPopup
              ? 'Clip Popup · Ctrl+E download transparent PNG'
              : 'Ctrl+Enter add · Ctrl+S save · Ctrl+E PNG'}
          </div>
        </div>
        {showLoadBar && (
          <div className="h-1 w-full bg-zinc-900">
            <div
              className={`h-full transition-all duration-300 ${
                assetLoad.status === 'error' ? 'bg-red-500' : 'bg-violet-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(4, assetLoad.progress))}%` }}
            />
          </div>
        )}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
        <aside className="flex min-h-0 flex-col border-r border-zinc-800 bg-zinc-950">
          <ActionBar />
          <div className="min-h-0 flex-1 overflow-hidden">
            <div
              className={`grid h-full ${
                isPopup ? 'grid-rows-[minmax(220px,1fr)_minmax(140px,32%)]' : 'grid-rows-[1fr_minmax(180px,40%)]'
              }`}
            >
              <div className="min-h-0 overflow-hidden">
                <MessageEditor />
              </div>
              <MessageList />
            </div>
          </div>
        </aside>

        <main
          className={`relative flex min-h-[320px] min-w-0 flex-col overflow-hidden ${
            isPopup || theme === 'transparent' ? 'preview-checker' : 'bg-[#0e0e10]'
          }`}
        >
          {isPopup && <PopupStylePanel />}
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div className="absolute inset-3 overflow-hidden rounded-lg border border-zinc-800/80 shadow-2xl">
              {isPopup ? <PopupPreview /> : <TwitchChatPreview />}
            </div>
          </div>
        </main>
      </div>

      <SettingsModal />
    </div>
  )
}
