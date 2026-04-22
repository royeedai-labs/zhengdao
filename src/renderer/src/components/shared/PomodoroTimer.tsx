import { useEffect, useRef, useState } from 'react'
import { Timer } from 'lucide-react'

const LS_WORK = 'write_pomodoro_work_sec'
const LS_BREAK = 'write_pomodoro_break_sec'

function loadSettings() {
  let work = 25 * 60
  let breakSec = 5 * 60
  try {
    const w = localStorage.getItem(LS_WORK)
    const b = localStorage.getItem(LS_BREAK)
    if (w) {
      const n = Number(w)
      if (Number.isFinite(n) && n >= 60 && n <= 7200) work = n
    }
    if (b) {
      const n = Number(b)
      if (Number.isFinite(n) && n >= 60 && n <= 3600) breakSec = n
    }
  } catch {
    void 0
  }
  return { work, breakSec }
}

function formatMmSs(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function PomodoroTimer() {
  const phaseRef = useRef<'idle' | 'work' | 'break'>('idle')
  const remainingRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [display, setDisplay] = useState({ phase: 'idle' as 'idle' | 'work' | 'break', remaining: 0 })

  const clearTick = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  function armInterval() {
    clearTick()
    intervalRef.current = setInterval(() => {
      if (remainingRef.current <= 1) {
        clearTick()
        const phase = phaseRef.current
        if (phase === 'work') {
          void window.api.notify('番茄钟', '专注时间结束，休息一会儿吧')
          const { breakSec } = loadSettings()
          phaseRef.current = 'break'
          remainingRef.current = breakSec
          setDisplay({ phase: 'break', remaining: breakSec })
          armInterval()
          return
        }
        if (phase === 'break') {
          void window.api.notify('番茄钟', '休息结束，继续写作')
          phaseRef.current = 'idle'
          remainingRef.current = 0
          setDisplay({ phase: 'idle', remaining: 0 })
        }
        return
      }
      remainingRef.current -= 1
      setDisplay({ phase: phaseRef.current, remaining: remainingRef.current })
    }, 1000)
  }

  const toggle = () => {
    if (phaseRef.current === 'idle') {
      const { work } = loadSettings()
      phaseRef.current = 'work'
      remainingRef.current = work
      setDisplay({ phase: 'work', remaining: work })
      armInterval()
      return
    }
    clearTick()
    phaseRef.current = 'idle'
    remainingRef.current = 0
    setDisplay({ phase: 'idle', remaining: 0 })
  }

  useEffect(() => () => clearTick(), [])

  const preset = loadSettings()
  const label =
    display.phase === 'idle'
      ? formatMmSs(preset.work)
      : formatMmSs(display.remaining)

  return (
    <button
      type="button"
      onClick={toggle}
      title={
        display.phase === 'idle'
          ? `开始番茄钟 (${Math.round(preset.work / 60)} 分钟)，时长可在 localStorage 键 ${LS_WORK} / ${LS_BREAK}（秒）配置`
          : display.phase === 'work'
            ? '点击停止'
            : '点击停止休息'
      }
      className="flex items-center gap-1 px-2 py-0.5 rounded border border-[var(--border-primary)] bg-[var(--bg-tertiary)]/80 text-[10px] font-mono text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-border)] transition"
    >
      <Timer size={12} className="shrink-0 text-rose-400/90" />
      <span>{display.phase === 'work' ? '' : display.phase === 'break' ? '休 ' : ''}</span>
      <span>{label}</span>
    </button>
  )
}
