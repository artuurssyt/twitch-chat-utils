import { useChatStore } from '@/store/chatStore'
import {
  copyPngToClipboard,
  exportPng,
  loadProjectFromDisk,
  newProject,
  savePngViaDialog,
  saveProjectToDisk,
} from '@/features/export/exportUtils'
import type { PopupBackgroundStyle, ViewMode } from '@/types/chat'

export function ActionBar() {
  const addMessage = useChatStore((s) => s.addMessage)
  const duplicateSelected = useChatStore((s) => s.duplicateSelected)
  const deleteSelected = useChatStore((s) => s.deleteSelected)
  const moveSelected = useChatStore((s) => s.moveSelected)
  const setSettingsOpen = useChatStore((s) => s.setSettingsOpen)
  const previewScale = useChatStore((s) => s.project.previewScale)
  const setPreviewScale = useChatStore((s) => s.setPreviewScale)
  const animationEnabled = useChatStore((s) => s.project.animationEnabled)
  const setAnimationEnabled = useChatStore((s) => s.setAnimationEnabled)
  const theme = useChatStore((s) => s.project.theme)
  const setTheme = useChatStore((s) => s.setTheme)
  const viewMode = useChatStore((s) => s.project.viewMode)
  const setViewMode = useChatStore((s) => s.setViewMode)
  const channelLogin = useChatStore((s) => s.project.channelLogin)
  const setChannelLogin = useChatStore((s) => s.setChannelLogin)
  const undo = useChatStore((s) => s.undo)
  const redo = useChatStore((s) => s.redo)

  const isPopup = viewMode === 'popup'

  const btn =
    'rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-40'
  const primary =
    'rounded-md bg-violet-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-violet-500'

  return (
    <div className="flex flex-col gap-2 border-b border-zinc-800 p-3">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-900 p-1">
        <button
          type="button"
          className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
            viewMode === 'chat' ? 'bg-emerald-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-100'
          }`}
          onClick={() => setViewMode('chat' as ViewMode)}
        >
          Chat Log
        </button>
        <button
          type="button"
          className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
            viewMode === 'popup' ? 'bg-emerald-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-100'
          }`}
          onClick={() => setViewMode('popup' as ViewMode)}
        >
          Clip Popup
        </button>
      </div>

      {isPopup && (
        <div className="rounded-md border border-emerald-700/50 bg-emerald-950/40 px-2.5 py-1.5 text-[11px] text-emerald-200">
          Clip Popup mode — edit username/message below. Preview is the rounded bubble on the right.
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={primary} onClick={() => addMessage()}>
          Add Message
        </button>
        <button type="button" className={btn} onClick={duplicateSelected}>
          Duplicate
        </button>
        <button type="button" className={btn} onClick={deleteSelected}>
          Delete
        </button>
        {!isPopup && (
          <>
            <button type="button" className={btn} onClick={() => moveSelected(-1)}>
              Move Up
            </button>
            <button type="button" className={btn} onClick={() => moveSelected(1)}>
              Move Down
            </button>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {!isPopup && (
          <button type="button" className={btn} onClick={() => void exportPng(false)}>
            Export PNG
          </button>
        )}
        <button
          type="button"
          className={btn}
          onClick={() => void savePngViaDialog(true).catch(() => exportPng(true))}
        >
          {isPopup ? 'Download Popup PNG' : 'Export Transparent PNG'}
        </button>
        <button type="button" className={btn} onClick={() => void copyPngToClipboard(true)}>
          Copy PNG
        </button>
        <button type="button" className={`${btn} cursor-not-allowed opacity-50`} disabled title="Coming soon">
          Export Video
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={btn} onClick={() => newProject()}>
          New
        </button>
        <button type="button" className={btn} onClick={() => void saveProjectToDisk()}>
          Save
        </button>
        <button type="button" className={btn} onClick={() => void loadProjectFromDisk()}>
          Load
        </button>
        <button type="button" className={btn} onClick={undo}>
          Undo
        </button>
        <button type="button" className={btn} onClick={redo}>
          Redo
        </button>
        <button type="button" className={btn} onClick={() => setSettingsOpen(true)}>
          Settings
        </button>
      </div>

      {!isPopup && (
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[11px] text-zinc-400">
            Channel (7TV set)
            <input
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100"
              value={channelLogin ?? ''}
              onChange={(e) => setChannelLogin(e.target.value)}
              placeholder="channel_login"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-zinc-400">
            Theme
            <select
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100"
              value={theme}
              onChange={(e) => setTheme(e.target.value as typeof theme)}
            >
              <option value="twitch-dark">Twitch Dark</option>
              <option value="twitch-light">Twitch Light</option>
              <option value="transparent">Transparent</option>
            </select>
          </label>
        </div>
      )}

      <div className="flex items-center gap-3">
        <label className="flex flex-1 flex-col gap-1 text-[11px] text-zinc-400">
          Preview scale ({previewScale.toFixed(2)}x)
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={previewScale}
            onChange={(e) => setPreviewScale(Number(e.target.value))}
          />
        </label>
        {!isPopup && (
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={animationEnabled}
              onChange={(e) => setAnimationEnabled(e.target.checked)}
            />
            Animate
          </label>
        )}
      </div>
    </div>
  )
}

/** Compact popup style panel — shown above the preview in Clip Popup mode */
export function PopupStylePanel() {
  const popupStyle = useChatStore((s) => s.project.popupStyle)
  const setPopupStyle = useChatStore((s) => s.setPopupStyle)

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-800 bg-zinc-950/90 px-3 py-2 text-xs text-zinc-300">
      <span className="font-semibold text-emerald-400">Popup style</span>
      <label className="flex items-center gap-1.5">
        Background
        <select
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
          value={popupStyle.backgroundStyle}
          onChange={(e) =>
            setPopupStyle({ backgroundStyle: e.target.value as PopupBackgroundStyle })
          }
        >
          <option value="solid">Semi-transparent</option>
          <option value="frosted">Blurry + transparent</option>
        </select>
      </label>
      <label className="flex items-center gap-1.5">
        Opacity
        <input
          type="range"
          className="w-20"
          min={0.15}
          max={0.95}
          step={0.01}
          value={popupStyle.backgroundOpacity}
          onChange={(e) => setPopupStyle({ backgroundOpacity: Number(e.target.value) })}
        />
        <span className="w-8 text-zinc-500">{Math.round(popupStyle.backgroundOpacity * 100)}%</span>
      </label>
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={popupStyle.matchBorderToUsername}
          onChange={(e) => setPopupStyle({ matchBorderToUsername: e.target.checked })}
        />
        Border = name color
      </label>
      {!popupStyle.matchBorderToUsername && (
        <input
          type="color"
          value={popupStyle.borderColor}
          onChange={(e) => setPopupStyle({ borderColor: e.target.value })}
          className="h-6 w-8 cursor-pointer rounded border border-zinc-700 bg-transparent"
          title="Border color"
        />
      )}
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={popupStyle.showBadges}
          onChange={(e) => setPopupStyle({ showBadges: e.target.checked })}
        />
        Badges
      </label>
      <label className="flex items-center gap-1.5">
        Size
        <input
          type="number"
          min={12}
          max={40}
          value={popupStyle.fontSize}
          onChange={(e) => setPopupStyle({ fontSize: Number(e.target.value) || 18 })}
          className="w-14 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
        />
      </label>
      <label className="flex items-center gap-1.5">
        Radius
        <input
          type="number"
          min={0}
          max={40}
          value={popupStyle.borderRadius}
          onChange={(e) => setPopupStyle({ borderRadius: Number(e.target.value) || 0 })}
          className="w-14 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
        />
      </label>
    </div>
  )
}
