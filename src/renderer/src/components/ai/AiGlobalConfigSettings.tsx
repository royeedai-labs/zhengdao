import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  RefreshCw,
  Save,
  Server,
  Terminal
} from 'lucide-react'
import { useToastStore } from '@/stores/toast-store'
import { useAuthStore } from '@/stores/auth-store'
import { getAiProviderUiMeta } from '@/utils/ai/provider-ui'
import { buildAiGlobalConfigStatusRequest } from '@/utils/ai/global-config-status'
import { hasProEntitlement } from '@/utils/auth-display'
import type { AiOfficialProfile } from '@/utils/ai/types'

type GlobalAiConfig = {
  ai_provider: string
  ai_api_endpoint: string
  ai_model: string
  ai_official_profile_id: string
  has_secret: number
}

type GlobalAiConfigDraft = GlobalAiConfig & {
  ai_api_key: string
  clear_api_key: boolean
}

type AiProviderStatus = {
  provider: string
  available: boolean
  needsSetup: boolean
  message: string
}

const AI_PROVIDERS = [
  ['zhengdao_official', '官方 AI'],
  ['openai', 'OpenAI 兼容'],
  ['gemini', 'Gemini API Key'],
  ['gemini_cli', 'Gemini CLI'],
  ['ollama', 'Ollama 本地'],
  ['custom', '自定义兼容']
] as const

function createEmptyDraft(): GlobalAiConfigDraft {
  return {
    ai_provider: 'zhengdao_official',
    ai_api_endpoint: '',
    ai_model: '',
    ai_official_profile_id: '',
    has_secret: 0,
    ai_api_key: '',
    clear_api_key: false
  }
}

function toDraft(config: GlobalAiConfig | null | undefined): GlobalAiConfigDraft {
  return {
    ...createEmptyDraft(),
    ...(config || {}),
    ai_api_key: '',
    clear_api_key: false
  }
}

export default function AiGlobalConfigSettings() {
  const user = useAuthStore((s) => s.user)
  const loadUser = useAuthStore((s) => s.loadUser)
  const [officialProfiles, setOfficialProfiles] = useState<AiOfficialProfile[]>([])
  const [draft, setDraft] = useState<GlobalAiConfigDraft>(createEmptyDraft)
  const [loading, setLoading] = useState(false)
  const [providerStatus, setProviderStatus] = useState<AiProviderStatus | null>(null)
  const [providerStatusLoading, setProviderStatusLoading] = useState(false)
  const hasPro = hasProEntitlement(user)
  const isOfficialProvider = draft.ai_provider === 'zhengdao_official'
  const providerMeta = useMemo(() => getAiProviderUiMeta(draft.ai_provider), [draft.ai_provider])

  const selectedOfficialProfile = useMemo(
    () =>
      officialProfiles.find((profile) => profile.id === draft.ai_official_profile_id) ||
      officialProfiles.find((profile) => profile.default) ||
      officialProfiles[0] ||
      null,
    [draft.ai_official_profile_id, officialProfiles]
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [configRow, profileRows] = await Promise.all([
        window.api.aiGetGlobalConfig() as Promise<GlobalAiConfig>,
        hasPro ? window.api.aiGetOfficialProfiles() as Promise<AiOfficialProfile[]> : Promise.resolve([])
      ])
      setDraft(toDraft(configRow))
      setOfficialProfiles(profileRows)
      setProviderStatus(null)
    } catch (error) {
      setOfficialProfiles([])
      useToastStore.getState().addToast(
        'error',
        error instanceof Error ? error.message : '读取 AI 全局配置失败'
      )
    } finally {
      setLoading(false)
    }
  }, [hasPro])

  useEffect(() => {
    void loadUser()
  }, [loadUser])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const refreshProviderStatus = useCallback(
    async (probe = false) => {
      if (isOfficialProvider || !providerMeta.supportsStatusCheck) return
      setProviderStatusLoading(true)
      try {
        const request = buildAiGlobalConfigStatusRequest(
          {
            provider: draft.ai_provider,
            api_endpoint: draft.ai_api_endpoint,
            model: draft.ai_model,
            api_key: draft.ai_api_key
          },
          probe
        )
        const status = (await window.api.aiGetProviderStatus(request.provider, request.options)) as AiProviderStatus
        setProviderStatus(status)
      } finally {
        setProviderStatusLoading(false)
      }
    },
    [draft.ai_api_endpoint, draft.ai_api_key, draft.ai_model, draft.ai_provider, isOfficialProvider, providerMeta.supportsStatusCheck]
  )

  useEffect(() => {
    if (isOfficialProvider || !providerMeta.supportsStatusCheck) return
    let cancelled = false
    const statusDraft = {
      provider: draft.ai_provider,
      api_endpoint: draft.ai_api_endpoint,
      model: draft.ai_model,
      api_key: draft.ai_api_key
    }

    const loadProviderStatus = async () => {
      setProviderStatusLoading(true)
      try {
        const request = buildAiGlobalConfigStatusRequest(statusDraft, false)
        const status = (await window.api.aiGetProviderStatus(request.provider, request.options)) as AiProviderStatus
        if (!cancelled) setProviderStatus(status)
      } finally {
        if (!cancelled) setProviderStatusLoading(false)
      }
    }

    void loadProviderStatus()
    return () => {
      cancelled = true
    }
  }, [draft.ai_api_endpoint, draft.ai_api_key, draft.ai_model, draft.ai_provider, isOfficialProvider, providerMeta.supportsStatusCheck])

  const saveConfig = async () => {
    if (isOfficialProvider && !hasPro) {
      await window.api.authOpenUpgradePage()
      return
    }

    const saved = (await window.api.aiSaveGlobalConfig({
      ai_provider: draft.ai_provider,
      ai_api_endpoint: draft.ai_api_endpoint,
      ai_model: draft.ai_model,
      ai_api_key: draft.ai_api_key,
      ai_official_profile_id: selectedOfficialProfile?.id || draft.ai_official_profile_id,
      clear_api_key: draft.clear_api_key
    })) as GlobalAiConfig
    setDraft(toDraft(saved))
    setProviderStatus(null)
    useToastStore.getState().addToast('success', 'AI 全局配置已保存')
  }

  const startGeminiCliLogin = async () => {
    setProviderStatusLoading(true)
    try {
      const result = (await window.api.aiSetupGeminiCli()) as { ok: boolean; error?: string }
      setProviderStatus({
        provider: 'gemini_cli',
        available: Boolean(result.ok),
        needsSetup: true,
        message: result.ok
          ? '已打开 Gemini CLI 终端。请在终端和浏览器中完成 Google 登录，然后回来点“检测”。'
          : result.error || 'Gemini CLI 登录启动失败'
      })
    } finally {
      setProviderStatusLoading(false)
    }
  }

  const displayedProviderStatus = !isOfficialProvider && providerMeta.supportsStatusCheck ? providerStatus : null
  const apiKeyPlaceholder = draft.has_secret
    ? '已保存密钥；留空则继续使用'
    : providerMeta.apiKeyPlaceholder

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
              <Cloud size={16} className="text-[var(--accent-primary)]" />
              AI 全局配置
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
              所有作品、章节、书架助手和 AI 工具都使用这一套配置；作品内只保留上下文档案和能力卡。
            </p>
          </div>
          <button type="button" onClick={() => void refresh()} className="secondary-btn">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            刷新
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Provider">
            <select
              value={draft.ai_provider}
              onChange={(event) => {
                setProviderStatus(null)
                setDraft((current) => ({
                  ...current,
                  ai_provider: event.target.value,
                  ai_api_key: '',
                  clear_api_key: false
                }))
              }}
              className="field"
            >
              {AI_PROVIDERS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
          <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
            当前选择会立即影响所有 AI 调用；不再按作品单独选择模型。
          </div>
        </div>

        {isOfficialProvider ? (
          <div className="mt-4">
            {!user ? (
              <Notice>登录证道后可读取后台启用的官方 AI 配置。</Notice>
            ) : !hasPro ? (
              <div className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-surface)] p-3 text-sm text-[var(--text-primary)]">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--warning-primary)]" />
                  <div className="min-w-0">
                    <div className="font-semibold">官方 AI 需要 Pro 权益</div>
                    <div className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                      当前 Free 状态可以把 Provider 切换到 API Key、Gemini CLI 或 Ollama。
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => void window.api.authOpenUpgradePage()} className="primary-btn">
                        升级 Pro
                      </button>
                      <button type="button" onClick={() => void loadUser()} className="secondary-btn">
                        刷新权益
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : officialProfiles.length === 0 ? (
              <Notice>当前没有后台启用的官方 AI 配置。</Notice>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {officialProfiles.map((profile) => {
                  const selected = selectedOfficialProfile?.id === profile.id
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => setDraft((current) => ({ ...current, ai_official_profile_id: profile.id }))}
                      className={`rounded-lg border p-3 text-left transition ${
                        selected
                          ? 'border-[var(--accent-border)] bg-[var(--accent-surface)]'
                          : 'border-[var(--border-primary)] bg-[var(--bg-secondary)] hover:border-[var(--border-secondary)]'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                          <Server size={15} />
                          <span className="truncate">{profile.name}</span>
                        </span>
                        {selected ? <CheckCircle2 size={15} className="text-[var(--success-primary)]" /> : null}
                      </span>
                      <span className="mt-2 block text-[11px] text-[var(--text-muted)]">
                        {profile.category} · {profile.modelHint}
                        {profile.default ? ' · 默认' : ''}
                      </span>
                      {profile.description ? (
                        <span className="mt-2 block text-xs leading-5 text-[var(--text-secondary)]">
                          {profile.description}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              {providerMeta.showEndpointField ? (
                <Field label="Base URL / Endpoint">
                  <input
                    value={draft.ai_api_endpoint}
                    onChange={(event) => setDraft((current) => ({ ...current, ai_api_endpoint: event.target.value }))}
                    className="field"
                    placeholder={providerMeta.endpointPlaceholder}
                  />
                </Field>
              ) : (
                <div className="hidden md:block" />
              )}
              <Field label="模型">
                <input
                  value={draft.ai_model}
                  onChange={(event) => setDraft((current) => ({ ...current, ai_model: event.target.value }))}
                  className="field"
                  placeholder={providerMeta.modelPlaceholder}
                />
              </Field>
              {providerMeta.showApiKeyField ? (
                <Field label={providerMeta.apiKeyLabel}>
                  <input
                    type="password"
                    value={draft.ai_api_key}
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      ai_api_key: event.target.value,
                      clear_api_key: false
                    }))}
                    className="field"
                    placeholder={apiKeyPlaceholder}
                  />
                </Field>
              ) : (
                <div className="rounded-lg border border-[var(--success-border)] bg-[var(--success-surface)] px-3 py-2 text-xs text-[var(--text-primary)] md:col-span-2">
                  当前 Provider 通过本机授权或运行时状态工作，不需要保存 API Key。
                </div>
              )}
              {providerMeta.showApiKeyField && draft.has_secret ? (
                <label className="mt-5 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={draft.clear_api_key}
                    onChange={(event) => setDraft((current) => ({ ...current, clear_api_key: event.target.checked }))}
                  />
                  保存时清除已保存密钥
                </label>
              ) : null}
            </div>

            {providerMeta.supportsStatusCheck ? (
              <div className="space-y-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3">
                <div className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                  {displayedProviderStatus && displayedProviderStatus.available && !displayedProviderStatus.needsSetup ? (
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--success-primary)]" />
                  ) : (
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--warning-primary)]" />
                  )}
                  <span>{displayedProviderStatus?.message || '点击“检测”验证当前全局模型配置。'}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void refreshProviderStatus(true)}
                    disabled={providerStatusLoading}
                    className="secondary-btn"
                  >
                    <RefreshCw size={13} className={providerStatusLoading ? 'animate-spin' : ''} /> 检测
                  </button>
                  {providerMeta.supportsAuthLaunch ? (
                    <button
                      type="button"
                      onClick={() => void startGeminiCliLogin()}
                      disabled={providerStatusLoading}
                      className="primary-btn"
                    >
                      <Terminal size={14} /> 启动登录
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button type="button" onClick={() => void saveConfig()} className="primary-btn">
            <Save size={14} /> 保存全局配置
          </button>
        </div>
      </div>
    </div>
  )
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-surface)] p-3 text-sm text-[var(--text-primary)]">
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--warning-primary)]" />
        <span>{children}</span>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase text-[var(--text-muted)]">{label}</span>
      {children}
    </label>
  )
}
