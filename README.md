# Twitch Chat Overlay

Desktop app for crafting realistic Twitch chat overlays for YouTube videos and shorts.

## Features (MVP)

- Two-panel editor: message list + live Twitch-dark preview
- **Clip Popup mode** — rounded highlighted chat bubble for shorts/clips (like stream highlight callouts)
  - Semi-transparent or frosted (blurry + transparent) bubble fill
  - Border matches username color by default
  - Download PNG with fully transparent outside the bubble
- Badges (Twitch + 7TV), username paints/gradients, emoji, replies, timestamps
- Auto 7TV cosmetics lookup when typing a username
- Emote autocomplete from loaded 7TV (global + channel + personal) sets
- Optional Twitch Helix credentials for real chat colors
- PNG / transparent PNG export, copy to clipboard
- Project save/load (JSON), autosave draft to localStorage
- Undo/redo, drag-reorder, keyboard shortcuts

## Run

```bash
npm install
npm run dev
```

## Twitch colors & API

Username colors work **without** Twitch credentials via the public IVR lookup (same colors as chat).

Optional Helix credentials (Settings) unlock Helix user lookup and global Twitch emotes:

1. Create an app at [Twitch Developer Console](https://dev.twitch.tv/console)
2. Generate an **App Access Token** (client credentials flow)
3. Paste Client ID + Access Token in **Settings**

Color priority: **7TV paint → Helix color → IVR chat color → color picker → random Twitch palette**.

## Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+Enter | Add message |
| Ctrl+D | Duplicate |
| Delete | Delete selected (when not typing) |
| Alt+↑ / Alt+↓ | Move message |
| Ctrl+Z / Ctrl+Y | Undo / Redo |
| Ctrl+S | Save project |
| Ctrl+O | Load project |
| Ctrl+E | Export transparent PNG |

## Export notes

- Use **Transparent** theme or **Export Transparent PNG** for overlays in editors (Premiere, CapCut, etc.)
- Video / OBS browser source export is stubbed for a later release

## Stack

Electron + Vite + React + TypeScript + TailwindCSS + Zustand
