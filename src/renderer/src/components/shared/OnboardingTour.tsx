import { useCallback, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'write_onboarding_completed'

export interface TourStep {
  target: string
  title: string
  description: string
  position: 'top' | 'bottom' | 'left' | 'right' | 'center'
}

export const TOUR_STEPS: TourStep[] = [
  {
    target: 'center',
    title: '选择题材后再开始',
    description:
      '证道会按网文、小说、剧本、学术或公文切换工作流。第一次进入作品，先确认题材、目标读者和本书边界。',
    position: 'center'
  },
  {
    target: '.daily-workbench',
    title: '第一步：今日写什么',
    description:
      '每日工作台把日更目标、备份、伏笔风险、审稿和发布检查放在同一行，先完成今天的写作任务。',
    position: 'bottom'
  },
  {
    target: '.editor-area',
    title: '第二步：写正文',
    description:
      '正文仍在中央编辑器完成。右键可续写、润色、去 AI 味、分析选段；涉及写入的 AI 结果会先进入草稿篮。',
    position: 'left'
  },
  {
    target: '.sidebar-right',
    title: '第三步：检查再确认',
    description:
      'AI 区顶部的作者任务流串起起书、日更、审稿、去 AI 味、发布、自动导演、视觉资产和拆文。草稿必须由作者确认才会写入。',
    position: 'left'
  },
  {
    target: '.bottom-panel-entry',
    title: '第四步：沉淀事实库',
    description:
      '底部区域承载沙盘、统计、AI 记录和设定概览。写完章节后回看人物、事件、伏笔和引用，保持事实库持续更新。',
    position: 'top'
  },
  {
    target: '.topbar-tools',
    title: '按题材补专业工具',
    description:
      '顶部工具按作品需要打开角色、设定、项目统计和题材配置。剧本、学术、公文会出现对应的专用入口。',
    position: 'bottom'
  },
  {
    target: 'center',
    title: '从一次闭环开始',
    description:
      '建议先完成一次“起书方案 → 第一章 → 审稿 → 草稿确认”。这比一次性配置所有功能更接近真实作者工作流。',
    position: 'center'
  }
]

type SpotlightRect = { top: number; left: number; width: number; height: number }

interface OnboardingTourProps {
  signal: number
}

export function isOnboardingDone(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function completeOnboardingStorage(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'true')
  } catch {
    void 0
  }
}

export default function OnboardingTour({ signal }: OnboardingTourProps) {
  const [visible, setVisible] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)
  const [rect, setRect] = useState<SpotlightRect>(() => ({
    top: 0,
    left: 0,
    width: 0,
    height: 0
  }))

  useEffect(() => {
    if (signal <= 0) return
    const id = window.setTimeout(() => {
      setStepIdx(0)
      setVisible(true)
    }, 0)
    return () => window.clearTimeout(id)
  }, [signal])

  const step = TOUR_STEPS[stepIdx]
  const isCenter = step.target === 'center'

  const updateRect = useCallback(() => {
    const s = TOUR_STEPS[stepIdx]
    if (s.target === 'center') {
      const w = Math.min(420, window.innerWidth - 48)
      const h = 240
      setRect({
        top: window.innerHeight / 2 - h / 2,
        left: window.innerWidth / 2 - w / 2,
        width: w,
        height: h
      })
      return
    }
    const el = document.querySelector(s.target)
    if (!el) {
      const w = 320
      const h = 160
      setRect({
        top: window.innerHeight / 2 - h / 2,
        left: window.innerWidth / 2 - w / 2,
        width: w,
        height: h
      })
      return
    }
    const r = el.getBoundingClientRect()
    const pad = 8
    setRect({
      top: Math.max(0, r.top - pad),
      left: Math.max(0, r.left - pad),
      width: Math.min(window.innerWidth, r.width + pad * 2),
      height: Math.min(window.innerHeight, r.height + pad * 2)
    })
  }, [stepIdx])

  useEffect(() => {
    if (!visible) return
    const frameId = window.requestAnimationFrame(updateRect)
    const ro = () => updateRect()
    window.addEventListener('resize', ro)
    window.addEventListener('scroll', ro, true)
    const id = window.setInterval(updateRect, 400)
    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('resize', ro)
      window.removeEventListener('scroll', ro, true)
      window.clearInterval(id)
    }
  }, [visible, stepIdx, updateRect])

  const tooltipStyle = useMemo(() => {
    const pad = 16
    const tw = 280
    const th = 160
    if (step.position === 'center') {
      return {
        top: rect.top + rect.height / 2 - th / 2,
        left: rect.left + rect.width / 2 - tw / 2
      }
    }
    let top = rect.top + rect.height / 2 - th / 2
    let left = rect.left + rect.width + pad
    if (step.position === 'left') {
      left = rect.left - tw - pad
    } else if (step.position === 'top') {
      top = rect.top - th - pad
      left = rect.left + rect.width / 2 - tw / 2
    } else if (step.position === 'bottom') {
      top = rect.top + rect.height + pad
      left = rect.left + rect.width / 2 - tw / 2
    } else if (step.position === 'right') {
      left = rect.left + rect.width + pad
    }
    top = Math.max(pad, Math.min(top, window.innerHeight - th - pad))
    left = Math.max(pad, Math.min(left, window.innerWidth - tw - pad))
    return { top, left }
  }, [rect, step.position])

  const finish = () => {
    completeOnboardingStorage()
    setVisible(false)
  }

  const skip = () => finish()

  const next = () => {
    if (stepIdx >= TOUR_STEPS.length - 1) finish()
    else setStepIdx((i) => i + 1)
  }

  const prev = () => setStepIdx((i) => Math.max(0, i - 1))

  if (!visible) return null

  return (
    <div className="tour-overlay fixed inset-0 z-[9998] pointer-events-auto">
      <div
        className="tour-spotlight absolute rounded-lg pointer-events-none transition-all duration-300 ease-out"
        style={{
          top: rect.top,
          left: rect.left,
          width: Math.max(rect.width, isCenter ? rect.width : 40),
          height: Math.max(rect.height, isCenter ? rect.height : 40),
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.72)'
        }}
      />

      <div
        className="absolute z-[10000] w-[280px] rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4 shadow-2xl pointer-events-auto"
        style={{ top: tooltipStyle.top, left: tooltipStyle.left }}
      >
        <h3 className="text-sm font-bold text-[var(--accent-secondary)] mb-2">{step.title}</h3>
        <p className="text-xs text-[var(--text-primary)] leading-relaxed mb-4">{step.description}</p>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={skip}
            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            跳过
          </button>
          <div className="flex items-center gap-2">
            {stepIdx > 0 && (
              <button
                type="button"
                onClick={prev}
                className="text-xs px-3 py-1.5 rounded border border-[var(--border-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
              >
                上一步
              </button>
            )}
            {stepIdx < TOUR_STEPS.length - 1 && (
              <button
                type="button"
                onClick={next}
                className="text-xs px-3 py-1.5 rounded bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--accent-contrast)]"
              >
                下一步
              </button>
            )}
            {stepIdx === TOUR_STEPS.length - 1 && (
              <button
                type="button"
                onClick={finish}
                className="text-xs px-3 py-1.5 rounded bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-[var(--accent-contrast)]"
              >
                开始创作
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-center gap-1.5 mt-4">
          {TOUR_STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === stepIdx ? 'w-4 bg-[var(--accent-primary)]' : 'w-1.5 bg-[var(--border-secondary)]'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
