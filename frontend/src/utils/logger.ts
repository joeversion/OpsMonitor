import type { App } from 'vue'
import authUtils from './auth'

type LogEntry = { level: 'warn' | 'error'; message: string }

export function installFrontendLogging(app: App): void {
  const originalWarn = console.warn.bind(console)
  const originalError = console.error.bind(console)
  const queue: LogEntry[] = []
  let sending = false

  function describe(value: unknown): string {
    if (value instanceof Error) return value.stack || value.message
    if (typeof value === 'string') return value
    try { return JSON.stringify(value) ?? String(value) } catch { return '[Unserializable value]' }
  }

  function record(level: LogEntry['level'], values: unknown[]): void {
    try {
      if (!authUtils.getToken()) return
      const message = `${location.pathname}: ${values.map(describe).join(' ')}`.slice(0, 2000)
      if (queue.length >= 20) queue.shift()
      queue.push({ level, message })
    } catch {
      return
    }
  }

  async function flush(): Promise<void> {
    if (sending || queue.length === 0) return
    let token: string | null
    try { token = authUtils.getToken() } catch { queue.length = 0; return }
    if (!token) { queue.length = 0; return }
    sending = true
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 5000)
    try {
      await fetch('/api/logs/frontend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ entries: queue.splice(0, 5) }),
        keepalive: true,
        signal: controller.signal
      })
    } catch {
      return
    } finally {
      window.clearTimeout(timeout)
      sending = false
    }
  }

  console.warn = (...values: unknown[]) => { originalWarn(...values); record('warn', values) }
  console.error = (...values: unknown[]) => { originalError(...values); record('error', values) }
  const previousErrorHandler = app.config.errorHandler
  app.config.errorHandler = (error, instance, info) => {
    record('error', [info, error])
    if (previousErrorHandler) previousErrorHandler(error, instance, info)
    else originalError(error)
  }
  window.addEventListener('error', event => {
    if (event instanceof ErrorEvent) record('error', [event.error || event.message])
    else if (event.target instanceof HTMLElement) record('error', ['Resource load failed', event.target.tagName])
  }, true)
  window.addEventListener('unhandledrejection', event => record('error', ['Unhandled rejection', event.reason]))
  window.setInterval(() => { void flush() }, 5000)
  window.addEventListener('pagehide', () => { void flush() })
}