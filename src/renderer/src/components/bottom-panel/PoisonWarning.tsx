import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  startCh: number
  endCh: number
  onClose: () => void
}

export default function PoisonWarning({ startCh, endCh, onClose }: Props) {
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    btnRef.current?.focus()
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
      <div role="alertdialog" aria-modal="true" aria-labelledby="poison-title" className="bg-[var(--surface-elevated)] border-2 border-[var(--danger-border)] w-[500px] rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex flex-col items-center py-10 px-8 text-center">
          <div className="w-20 h-20 rounded-full bg-[var(--danger-surface)] border-2 border-[var(--danger-border)] flex items-center justify-center mb-6 animate-pulse">
            <AlertTriangle size={40} className="text-[var(--danger-primary)]" />
          </div>
          <h2 id="poison-title" className="text-xl font-bold text-[var(--danger-primary)] mb-3">毒点熔断预警！</h2>
          <p className="text-[var(--text-primary)] text-sm leading-relaxed max-w-sm">
            第 <span className="text-[var(--danger-primary)] font-bold">{startCh}</span> 章到第{' '}
            <span className="text-[var(--danger-primary)] font-bold">{endCh}</span>{' '}
            章连续 5 个节点情绪值均 ≤ 0，读者可能正在流失！
          </p>
          <p className="text-[var(--text-muted)] text-xs mt-3">
            建议安排爽点/金手指/主角反转来挽救剧情节奏。
          </p>
        </div>
        <div className="h-14 border-t border-[var(--border-primary)] bg-[var(--bg-primary)] flex items-center justify-center">
          <button
            ref={btnRef}
            onClick={onClose}
            className="px-6 py-2 text-xs bg-[var(--danger-primary)] hover:brightness-105 text-[var(--text-inverse)] rounded-lg font-bold transition"
          >
            我知道了，马上调整
          </button>
        </div>
      </div>
    </div>
  )
}
