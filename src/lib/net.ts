/** Fetch JSON via Electron main when available (avoids renderer CORS). */
export async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    if (window.ipcRenderer) {
      const result = (await window.ipcRenderer.invoke('net:fetch', url)) as {
        ok: boolean
        status: number
        body?: string
        error?: string
      }
      if (!result.ok || !result.body) return null
      return JSON.parse(result.body) as T
    }
    const res = await fetch(url)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}
