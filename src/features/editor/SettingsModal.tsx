import { useChatStore } from '@/store/chatStore'

export function SettingsModal() {
  const open = useChatStore((s) => s.settingsOpen)
  const setSettingsOpen = useChatStore((s) => s.setSettingsOpen)
  const settings = useChatStore((s) => s.settings)
  const setSettings = useChatStore((s) => s.setSettings)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">Settings</h2>
          <button
            type="button"
            className="rounded px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            onClick={() => setSettingsOpen(false)}
          >
            ✕
          </button>
        </div>

        <p className="mb-4 text-sm text-zinc-400">
          Optional Twitch Helix credentials unlock real username colors and richer badge/emote data.
          Create an app at{' '}
          <a
            className="text-violet-400 underline"
            href="https://dev.twitch.tv/console"
            target="_blank"
            rel="noreferrer"
          >
            Twitch Developer Console
          </a>
          , then generate an App Access Token.
        </p>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            Twitch Client ID
            <input
              className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              value={settings.twitchClientId}
              onChange={(e) => setSettings({ twitchClientId: e.target.value.trim() })}
              placeholder="Client ID"
              autoComplete="off"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            Twitch App Access Token
            <input
              className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              value={settings.twitchAccessToken}
              onChange={(e) => setSettings({ twitchAccessToken: e.target.value.trim() })}
              placeholder="Access Token"
              type="password"
              autoComplete="off"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            Default channel
            <input
              className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              value={settings.defaultChannel}
              onChange={(e) => setSettings({ defaultChannel: e.target.value.trim() })}
              placeholder="channel_login"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={settings.exportTransparent}
              onChange={(e) => setSettings({ exportTransparent: e.target.checked })}
            />
            Prefer transparent exports
          </label>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
            onClick={() => setSettingsOpen(false)}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
