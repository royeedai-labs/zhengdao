export async function measureRendererTask<T>(label: string, task: () => Promise<T>): Promise<T> {
  const enabled =
    import.meta.env.DEV ||
    (() => {
      try {
        return localStorage.getItem('zhengdao_perf_log') === '1'
      } catch {
        return false
      }
    })()
  if (!enabled) return task()
  const started = performance.now()
  try {
    return await task()
  } finally {
    const elapsed = performance.now() - started
    console.debug(`[perf] ${label} ${elapsed.toFixed(1)}ms`)
  }
}
