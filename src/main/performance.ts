export function measureMainTask<T>(label: string, task: () => T): T {
  const enabled = process.env.ZHENGDAO_PERF_LOG === '1' || process.env.NODE_ENV === 'development'
  if (!enabled) return task()
  const started = performance.now()
  try {
    return task()
  } finally {
    const elapsed = performance.now() - started
    console.debug(`[perf] ${label} ${elapsed.toFixed(1)}ms`)
  }
}
