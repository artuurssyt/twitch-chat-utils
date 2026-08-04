import { create } from 'zustand'
import type {
  AppSettings,
  BadgeRef,
  ChatMessage,
  ChatProject,
  ChatTheme,
  EmoteAsset,
  MessageAnimation,
  PopupStyle,
  ViewMode,
} from '@/types/chat'
import {
  createDefaultProject,
  createEmptyMessage,
  createId,
  DEFAULT_SETTINGS,
  normalizeProject,
} from '@/lib/utils'

const PROJECT_KEY = 'twitch-chat-overlay:project'
const SETTINGS_KEY = 'twitch-chat-overlay:settings'
const MAX_HISTORY = 100

type HistorySnap = {
  messages: ChatMessage[]
  selectedId: string | null
}

type AssetLoadState = {
  status: 'idle' | 'loading' | 'done' | 'error'
  label: string
  progress: number
  emoteCount: number
}

type ChatState = {
  project: ChatProject
  settings: AppSettings
  selectedId: string | null
  emoteMap: Map<string, EmoteAsset>
  settingsOpen: boolean
  exportCapturing: boolean
  assetLoad: AssetLoadState
  past: HistorySnap[]
  future: HistorySnap[]
  projectPath: string | null

  initFromStorage: () => void
  setSettings: (partial: Partial<AppSettings>) => void
  setSettingsOpen: (open: boolean) => void
  setExportCapturing: (capturing: boolean) => void
  setAssetLoad: (partial: Partial<AssetLoadState>) => void
  setTheme: (theme: ChatTheme) => void
  setViewMode: (mode: ViewMode) => void
  setPopupStyle: (partial: Partial<PopupStyle>) => void
  setChannelLogin: (channel: string) => void
  setPreviewScale: (scale: number) => void
  setAnimationEnabled: (enabled: boolean) => void
  setProjectName: (name: string) => void
  setEmoteMap: (map: Map<string, EmoteAsset>) => void
  mergeEmotes: (map: Map<string, EmoteAsset>) => void

  selectMessage: (id: string | null) => void
  addMessage: (partial?: Partial<ChatMessage>) => void
  duplicateSelected: () => void
  deleteSelected: () => void
  moveSelected: (dir: -1 | 1) => void
  reorderMessages: (fromIndex: number, toIndex: number) => void
  updateSelected: (partial: Partial<ChatMessage>) => void
  /** Live edits (typing) — no undo snapshot */
  patchSelected: (partial: Partial<ChatMessage>) => void
  updateMessage: (id: string, partial: Partial<ChatMessage>, opts?: { history?: boolean }) => void
  toggleBadge: (badge: BadgeRef) => void
  setReplyEnabled: (enabled: boolean) => void
  setTimestampEnabled: (enabled: boolean) => void
  setAnimation: (animation: MessageAnimation) => void

  loadProject: (project: ChatProject, path?: string | null) => void
  replaceProject: (project: ChatProject) => void
  getSelected: () => ChatMessage | null
  undo: () => void
  redo: () => void
  persist: () => void
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return { ...fallback, ...JSON.parse(raw) } as T
  } catch {
    return fallback
  }
}

function cloneMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) => ({ ...m, badges: [...m.badges], replyTo: m.replyTo ? { ...m.replyTo } : null, paint: m.paint ? { ...m.paint } : null }))
}

function pushHistory(state: ChatState): Pick<ChatState, 'past' | 'future'> {
  const snap: HistorySnap = {
    messages: cloneMessages(state.project.messages),
    selectedId: state.selectedId,
  }
  const past = [...state.past, snap].slice(-MAX_HISTORY)
  return { past, future: [] }
}

export const useChatStore = create<ChatState>((set, get) => ({
  project: createDefaultProject(),
  settings: DEFAULT_SETTINGS,
  selectedId: null,
  emoteMap: new Map(),
  settingsOpen: false,
  exportCapturing: false,
  assetLoad: {
    status: 'idle',
    label: '',
    progress: 0,
    emoteCount: 0,
  },
  past: [],
  future: [],
  projectPath: null,

  initFromStorage: () => {
    const project = normalizeProject(loadJson<Partial<ChatProject>>(PROJECT_KEY, createDefaultProject()))
    const settings = loadJson<AppSettings>(SETTINGS_KEY, DEFAULT_SETTINGS)
    const selectedId = project.messages[0]?.id ?? null
    set({ project, settings, selectedId })
  },

  persist: () => {
    const { project, settings } = get()
    localStorage.setItem(PROJECT_KEY, JSON.stringify(project))
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  },

  setSettings: (partial) => {
    set((s) => ({ settings: { ...s.settings, ...partial } }))
    get().persist()
  },

  setSettingsOpen: (open) => set({ settingsOpen: open }),

  setExportCapturing: (exportCapturing) => set({ exportCapturing }),

  setAssetLoad: (partial) => {
    set((s) => ({ assetLoad: { ...s.assetLoad, ...partial } }))
  },

  setTheme: (theme) => {
    set((s) => ({ project: { ...s.project, theme } }))
    get().persist()
  },

  setViewMode: (viewMode) => {
    set((s) => ({
      project: normalizeProject({ ...s.project, viewMode }),
    }))
    get().persist()
  },

  setPopupStyle: (partial) => {
    set((s) => {
      const project = normalizeProject(s.project)
      return {
        project: {
          ...project,
          popupStyle: { ...project.popupStyle, ...partial },
        },
      }
    })
    get().persist()
  },

  setChannelLogin: (channelLogin) => {
    set((s) => ({ project: { ...s.project, channelLogin } }))
    get().persist()
  },

  setPreviewScale: (previewScale) => {
    set((s) => ({ project: { ...s.project, previewScale } }))
    get().persist()
  },

  setAnimationEnabled: (animationEnabled) => {
    set((s) => ({ project: { ...s.project, animationEnabled } }))
    get().persist()
  },

  setProjectName: (name) => {
    set((s) => ({ project: { ...s.project, name } }))
    get().persist()
  },

  setEmoteMap: (emoteMap) => set({ emoteMap }),

  mergeEmotes: (map) => {
    set((s) => {
      const next = new Map(s.emoteMap)
      for (const [k, v] of map) next.set(k, v)
      return { emoteMap: next }
    })
  },

  selectMessage: (id) => set({ selectedId: id }),

  addMessage: (partial) => {
    const hist = pushHistory(get())
    const msg = createEmptyMessage(partial)
    set((s) => ({
      ...hist,
      selectedId: msg.id,
      project: { ...s.project, messages: [...s.project.messages, msg] },
    }))
    get().persist()
  },

  duplicateSelected: () => {
    const { selectedId, project } = get()
    const src = project.messages.find((m) => m.id === selectedId)
    if (!src) return
    const hist = pushHistory(get())
    const copy: ChatMessage = {
      ...src,
      id: createId(),
      badges: [...src.badges],
      replyTo: src.replyTo ? { ...src.replyTo } : null,
      paint: src.paint ? { ...src.paint } : null,
    }
    const idx = project.messages.findIndex((m) => m.id === selectedId)
    const messages = [...project.messages]
    messages.splice(idx + 1, 0, copy)
    set((s) => ({
      ...hist,
      selectedId: copy.id,
      project: { ...s.project, messages },
    }))
    get().persist()
  },

  deleteSelected: () => {
    const { selectedId, project } = get()
    if (!selectedId || project.messages.length === 0) return
    const hist = pushHistory(get())
    const idx = project.messages.findIndex((m) => m.id === selectedId)
    const messages = project.messages.filter((m) => m.id !== selectedId)
    const nextSelected = messages[Math.min(idx, messages.length - 1)]?.id ?? null
    set((s) => ({
      ...hist,
      selectedId: nextSelected,
      project: { ...s.project, messages },
    }))
    get().persist()
  },

  moveSelected: (dir) => {
    const { selectedId, project } = get()
    if (!selectedId) return
    const idx = project.messages.findIndex((m) => m.id === selectedId)
    const target = idx + dir
    if (idx < 0 || target < 0 || target >= project.messages.length) return
    const hist = pushHistory(get())
    const messages = [...project.messages]
    const [item] = messages.splice(idx, 1)
    messages.splice(target, 0, item)
    set((s) => ({ ...hist, project: { ...s.project, messages } }))
    get().persist()
  },

  reorderMessages: (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return
    const hist = pushHistory(get())
    set((s) => {
      const messages = [...s.project.messages]
      const [item] = messages.splice(fromIndex, 1)
      messages.splice(toIndex, 0, item)
      return { ...hist, project: { ...s.project, messages } }
    })
    get().persist()
  },

  updateSelected: (partial) => {
    const { selectedId } = get()
    if (!selectedId) return
    get().updateMessage(selectedId, partial, { history: true })
  },

  patchSelected: (partial) => {
    const { selectedId } = get()
    if (!selectedId) return
    get().updateMessage(selectedId, partial, { history: false })
  },

  updateMessage: (id, partial, opts) => {
    const withHistory = opts?.history !== false
    const hist = withHistory ? pushHistory(get()) : {}
    set((s) => ({
      ...hist,
      project: {
        ...s.project,
        messages: s.project.messages.map((m) => (m.id === id ? { ...m, ...partial } : m)),
      },
    }))
    get().persist()
  },

  toggleBadge: (badge) => {
    const selected = get().getSelected()
    if (!selected) return
    const exists = selected.badges.some((b) => {
      if (b.kind !== badge.kind) return false
      if (b.kind === 'twitch' && badge.kind === 'twitch') return b.set === badge.set
      if (b.kind === '7tv' && badge.kind === '7tv') return b.id === badge.id
      return false
    })
    const badges = exists
      ? selected.badges.filter((b) => {
          if (b.kind !== badge.kind) return true
          if (b.kind === 'twitch' && badge.kind === 'twitch') return b.set !== badge.set
          if (b.kind === '7tv' && badge.kind === '7tv') return b.id !== badge.id
          return true
        })
      : [...selected.badges, badge]
    get().updateSelected({ badges })
  },

  setReplyEnabled: (enabled) => {
    const selected = get().getSelected()
    if (!selected) return
    if (!enabled) {
      get().updateSelected({ replyTo: null })
      return
    }
    get().updateSelected({
      replyTo: selected.replyTo ?? { username: 'someone', messageSnippet: 'earlier message' },
    })
  },

  setTimestampEnabled: (enabled) => {
    get().updateSelected({ showTimestamp: enabled })
  },

  setAnimation: (animation) => {
    get().updateSelected({ animation })
  },

  loadProject: (project, path = null) => {
    const normalized = normalizeProject(project)
    set({
      project: normalized,
      selectedId: normalized.messages[0]?.id ?? null,
      projectPath: path,
      past: [],
      future: [],
    })
    get().persist()
  },

  replaceProject: (project) => {
    set((s) => ({ project: normalizeProject({ ...s.project, ...project }) }))
    get().persist()
  },

  getSelected: () => {
    const { selectedId, project } = get()
    return project.messages.find((m) => m.id === selectedId) ?? null
  },

  undo: () => {
    const { past, project, selectedId, future } = get()
    if (!past.length) return
    const prev = past[past.length - 1]
    const current: HistorySnap = {
      messages: cloneMessages(project.messages),
      selectedId,
    }
    set({
      past: past.slice(0, -1),
      future: [current, ...future].slice(0, MAX_HISTORY),
      project: { ...project, messages: prev.messages },
      selectedId: prev.selectedId,
    })
    get().persist()
  },

  redo: () => {
    const { future, project, selectedId, past } = get()
    if (!future.length) return
    const next = future[0]
    const current: HistorySnap = {
      messages: cloneMessages(project.messages),
      selectedId,
    }
    set({
      future: future.slice(1),
      past: [...past, current].slice(-MAX_HISTORY),
      project: { ...project, messages: next.messages },
      selectedId: next.selectedId,
    })
    get().persist()
  },
}))
