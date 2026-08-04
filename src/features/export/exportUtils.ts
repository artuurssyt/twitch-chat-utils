import { toPng } from 'html-to-image'
import { useChatStore } from '@/store/chatStore'
import { createDefaultProject } from '@/lib/utils'
import type { ChatProject } from '@/types/chat'

function getExportRootId(): string {
  const mode = useChatStore.getState().project.viewMode
  return mode === 'popup' ? 'popup-preview-root' : 'chat-preview-root'
}

async function exportNodeAsPng(transparent: boolean) {
  const store = useChatStore.getState()
  const node = document.getElementById(getExportRootId())
  if (!node) throw new Error('Preview not found')

  const project = store.project
  const isPopup = project.viewMode === 'popup'
  const prevTheme = project.theme
  const wantTransparent = transparent || isPopup

  store.setExportCapturing(true)
  if (wantTransparent && !isPopup) {
    store.setTheme('transparent')
  }

  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))))

  try {
    const dataUrl = await toPng(node, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: wantTransparent ? undefined : '#18181b',
      style: wantTransparent
        ? {
            background: 'transparent',
            backgroundColor: 'transparent',
          }
        : undefined,
      filter: (el) => {
        if (el instanceof HTMLElement && el.classList.contains('preview-checker-overlay')) {
          return false
        }
        return true
      },
    })
    return dataUrl
  } finally {
    useChatStore.getState().setExportCapturing(false)
    if (wantTransparent && !isPopup && prevTheme !== 'transparent') {
      useChatStore.getState().setTheme(prevTheme)
    }
  }
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',')
  const mime = /data:(.*?);/.exec(header)?.[1] ?? 'image/png'
  const binary = atob(data)
  const arr = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

export async function exportPng(transparent: boolean) {
  const dataUrl = await exportNodeAsPng(transparent)
  const project = useChatStore.getState().project
  const name = project.name.replace(/[^\w\-]+/g, '_') || 'chat'
  const suffix =
    project.viewMode === 'popup'
      ? `-popup${project.popupStyle.backgroundStyle === 'frosted' ? '-frosted' : ''}-transparent`
      : transparent
        ? '-transparent'
        : ''
  downloadDataUrl(dataUrl, `${name}${suffix}.png`)
  return dataUrl
}

export async function copyPngToClipboard(transparent = true) {
  const dataUrl = await exportNodeAsPng(transparent)
  const blob = dataUrlToBlob(dataUrl)
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}

export async function saveProjectToDisk() {
  const project = useChatStore.getState().project
  const json = JSON.stringify(project, null, 2)

  if (window.ipcRenderer) {
    const result = (await window.ipcRenderer.invoke('project:save', json, useChatStore.getState().projectPath)) as
      | { ok: true; path: string }
      | { ok: false; canceled?: boolean; error?: string }
    if (result.ok) {
      useChatStore.setState({ projectPath: result.path })
      return result.path
    }
    if (result.canceled) return null
    throw new Error(result.error || 'Save failed')
  }

  downloadDataUrl(`data:application/json;charset=utf-8,${encodeURIComponent(json)}`, `${project.name || 'chat'}.json`)
  return null
}

export async function loadProjectFromDisk() {
  if (window.ipcRenderer) {
    const result = (await window.ipcRenderer.invoke('project:load')) as
      | { ok: true; path: string; content: string }
      | { ok: false; canceled?: boolean; error?: string }
    if (!result.ok) {
      if (result.canceled) return null
      throw new Error(result.error || 'Load failed')
    }
    const project = JSON.parse(result.content) as ChatProject
    if (project.version !== 1 || !Array.isArray(project.messages)) {
      throw new Error('Invalid project file')
    }
    useChatStore.getState().loadProject(project, result.path)
    return project
  }

  return new Promise<ChatProject | null>((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      try {
        const text = await file.text()
        const project = JSON.parse(text) as ChatProject
        useChatStore.getState().loadProject(project, file.name)
        resolve(project)
      } catch (e) {
        reject(e)
      }
    }
    input.click()
  })
}

export function newProject() {
  useChatStore.getState().loadProject(createDefaultProject(), null)
}

export async function savePngViaDialog(transparent: boolean) {
  const dataUrl = await exportNodeAsPng(transparent)
  if (!window.ipcRenderer) {
    await exportPng(transparent)
    return
  }
  const project = useChatStore.getState().project
  const base64 = dataUrl.split(',')[1]
  const name = project.name.replace(/[^\w\-]+/g, '_') || 'chat'
  const suffix =
    project.viewMode === 'popup'
      ? `-popup${project.popupStyle.backgroundStyle === 'frosted' ? '-frosted' : ''}-transparent`
      : transparent
        ? '-transparent'
        : ''
  await window.ipcRenderer.invoke('export:png', base64, `${name}${suffix}.png`)
}
