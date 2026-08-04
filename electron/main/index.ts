import { app, BrowserWindow, shell, ipcMain, dialog, clipboard, nativeImage } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'
import { update } from './update'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

if (process.platform === 'win32' && os.release().startsWith('6.1')) app.disableHardwareAcceleration()
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

async function createWindow() {
  win = new BrowserWindow({
    title: 'Twitch Chat Overlay',
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#09090b',
    icon: path.join(process.env.VITE_PUBLIC!, 'favicon.ico'),
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(indexHtml)
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  update(win)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

ipcMain.handle('project:save', async (_evt, content: string, currentPath: string | null) => {
  try {
    let filePath = currentPath
    if (!filePath) {
      const result = await dialog.showSaveDialog(win!, {
        title: 'Save chat project',
        defaultPath: 'chat-project.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
      if (result.canceled || !result.filePath) return { ok: false, canceled: true }
      filePath = result.filePath
    }
    await fs.writeFile(filePath, content, 'utf-8')
    return { ok: true, path: filePath }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

ipcMain.handle('project:load', async () => {
  try {
    const result = await dialog.showOpenDialog(win!, {
      title: 'Open chat project',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    })
    if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true }
    const filePath = result.filePaths[0]
    const content = await fs.readFile(filePath, 'utf-8')
    return { ok: true, path: filePath, content }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

ipcMain.handle('export:png', async (_evt, base64: string, defaultName: string) => {
  try {
    const result = await dialog.showSaveDialog(win!, {
      title: 'Export PNG',
      defaultPath: defaultName || 'chat.png',
      filters: [{ name: 'PNG', extensions: ['png'] }],
    })
    if (result.canceled || !result.filePath) return { ok: false, canceled: true }
    const buffer = Buffer.from(base64, 'base64')
    await fs.writeFile(result.filePath, buffer)
    return { ok: true, path: result.filePath }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

ipcMain.handle('clipboard:png', async (_evt, base64: string) => {
  try {
    const image = nativeImage.createFromBuffer(Buffer.from(base64, 'base64'))
    clipboard.writeImage(image)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

ipcMain.handle('net:fetch', async (_evt, url: string) => {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    })
    const text = await res.text()
    return { ok: res.ok, status: res.status, body: text }
  } catch (error) {
    return { ok: false, status: 0, error: String(error) }
  }
})
