import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cloud,
  KeyRound,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  Server,
  Terminal,
  Trash2
} from 'lucide-react'
import { useToastStore } from '@/stores/toast-store'
import { getAiAccountProviderUiMeta } from '@/utils/ai/account-provider'
import { buildAiGlobalAccountStatusRequest } from '@/utils/ai/global-account-status'
import type { AiOfficialProfile } from '@/utils/ai/types'

type AiAccount = {
  id: number
  name: string
  provider: string
  api_endpoint: string
  model: string
  has_secret: number
  is_default: number
  status: string
}

type AiProviderStatus = {
  provider: string
  available: boolean
  needsSetup: boolean
  message: string
}

const ACCOUNT_PROVIDERS = [
  ['openai', 'OpenAI 兼容'],
  ['gemini', 'Gemini API Key'],
  ['gemini_cli', 'Gemini CLI'],
  ['ollama', 'Ollama 本地'],
  ['custom', '自定义兼容']
] as const

const OFFICIAL_PROFILE_KEY = 'ai_official_profile_id'
const THIRD_PARTY_ENABLED_KEY = 'ai_third_party_enabled'

function createEmptyAccountDraft() {
  return {
    id: null as number | null,
    name: 'AI 账号',
    provider: 'openai',
    api_endpoint: '',
    model: '',
    api_key: '',
    is_default: true
  }
}

export default function AiGlobalAccountsSettings() {
  const [officialProfiles, setOfficialProfiles] = useState<AiOfficialProfile[]>([])
  const [officialProfileId, setOfficialProfileId] = useState('')
  const [officialLoading, setOfficialLoading] = useState(false)
  const [thirdPartyExpanded, setThirdPartyExpanded] = useState(false)
  const [thirdPartyEnabled, setThirdPartyEnabled] = useState(false)
  const [accounts, setAccounts] = useState<AiAccount[]>([])
  const [accountDraft, setAccountDraft] = useState(createEmptyAccountDraft)
  const [accountProviderStatus, setAccountProviderStatus] = useState<AiProviderStatus | null>(null)
  const [accountProviderStatusLoading, setAccountProviderStatusLoading] = useState(false)
  const accountProviderMeta = useMemo(
    () => getAiAccountProviderUiMeta(accountDraft.provider),
    [accountDraft.provider]
  )

  const selectedOfficialProfile = useMemo(
    () =>
      officialProfiles.find((profile) => profile.id === officialProfileId) ||
      officialProfiles.find((profile) => profile.default) ||
      officialProfiles[0] ||
      null,
    [officialProfileId, officialProfiles]
  )

  const refresh = async () => {
    setOfficialLoading(true)
    try {
      const [accountRows, profileRows, selectedProfileId, thirdPartyFlag] = await Promise.all([
        window.api.aiGetAccounts() as Promise<AiAccount[]>,
        window.api.aiGetOfficialProfiles() as Promise<AiOfficialProfile[]>,
        window.api.getAppState(OFFICIAL_PROFILE_KEY),
        window.api.getAppState(THIRD_PARTY_ENABLED_KEY)
      ])
      setAccounts(accountRows)
      setOfficialProfiles(profileRows)
      setOfficialProfileId(String(selectedProfileId || ''))
      setThirdPartyEnabled(thirdPartyFlag === '1')
      setThirdPartyExpanded(thirdPartyFlag === '1')
    } catch (error) {
      setOfficialProfiles([])
      useToastStore.getState().addToast(
        'error',
        error instanceof Error ? error.message : '读取官方 AI 配置失败'
      )
    } finally {
      setOfficialLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const selectOfficialProfile = async (profileId: string) => {
    await window.api.setAppState(OFFICIAL_PROFILE_KEY, profileId)
    await window.api.setAppState(THIRD_PARTY_ENABLED_KEY, '0')
    setOfficialProfileId(profileId)
    setThirdPartyEnabled(false)
    useToastStore.getState().addToast('success', '默认 AI 已切换为官方配置')
  }

  const setThirdPartyMode = async (enabled: boolean) => {
    await window.api.setAppState(THIRD_PARTY_ENABLED_KEY, enabled ? '1' : '0')
    setThirdPartyEnabled(enabled)
    if (enabled) setThirdPartyExpanded(true)
    useToastStore.getState().addToast('success', enabled ? '已启用第三方模型配置' : '已切回官方 AI')
  }

  const refreshAccountProviderStatus = async (probe = false) => {
    setAccountProviderStatusLoading(true)
    try {
      const request = buildAiGlobalAccountStatusRequest(accountDraft, probe)
      const status = (await window.api.aiGetProviderStatus(request.provider, request.options)) as AiProviderStatus
      setAccountProviderStatus(status)
    } finally {
      setAccountProviderStatusLoading(false)
    }
  }

  useEffect(() => {
    if (!accountProviderMeta.supportsStatusCheck || !thirdPartyExpanded) return
    let cancelled = false
    const accountStatusDraft = accountDraft

    const loadProviderStatus = async () => {
      setAccountProviderStatusLoading(true)
      try {
        const request = buildAiGlobalAccountStatusRequest(accountStatusDraft, false)
        const status = (await window.api.aiGetProviderStatus(request.provider, request.options)) as AiProviderStatus
        if (!cancelled) setAccountProviderStatus(status)
      } finally {
        if (!cancelled) setAccountProviderStatusLoading(false)
      }
    }

    void loadProviderStatus()
    return () => {
      cancelled = true
    }
  }, [accountDraft, accountProviderMeta.supportsStatusCheck, thirdPartyExpanded])

  const saveAccount = async () => {
    await window.api.aiSaveAccount(accountDraft)
    setAccountDraft(createEmptyAccountDraft())
    setAccountProviderStatus(null)
    useToastStore.getState().addToast('success', '第三方 AI 账号已保存')
    await refresh()
  }

  const editAccount = (account: AiAccount) => {
    setAccountProviderStatus(null)
    setAccountDraft({
      id: account.id,
      name: account.name,
      provider: account.provider,
      api_endpoint: account.api_endpoint || '',
      model: account.model || '',
      api_key: '',
      is_default: Boolean(account.is_default)
    })
    setThirdPartyExpanded(true)
  }

  const startGeminiCliLogin = async () => {
    setAccountProviderStatusLoading(true)
    try {
      const result = (await window.api.aiSetupGeminiCli()) as { ok: boolean; error?: string }
      if (!result.ok) {
        setAccountProviderStatus({
          provider: 'gemini_cli',
          available: false,
          needsSetup: true,
          message: result.error || 'Gemini CLI 登录启动失败'
        })
        return
      }
      setAccountProviderStatus({
        provider: 'gemini_cli',
        available: true,
        needsSetup: true,
        message: '已打开 Gemini CLI 终端。请在终端和浏览器中完成 Google 登录，然后回来点“检测”。'
      })
    } finally {
      setAccountProviderStatusLoading(false)
    }
  }

  const deleteAccount = async (account: AiAccount) => {
    if (!window.confirm(`确定删除第三方账号“${account.name}”吗？`)) return
    await window.api.aiDeleteAccount(account.id)
    if (accountDraft.id === account.id) {
      setAccountDraft(createEmptyAccountDraft())
    }
    useToastStore.getState().addToast('success', '第三方 AI 账号已删除')
    await refresh()
  }

  const displayedAccountProviderStatus =
    accountProviderMeta.supportsStatusCheck ? accountProviderStatus : null

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
              <Cloud size={16} className="text-[var(--accent-primary)]" />
              官方 AI
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
              官方 AI 由后台配置模型、供应商和额度策略；本机只保存所选官方配置项。
            </p>
          </div>
          <button type="button" onClick={() => void refresh()} className="secondary-btn">
            <RefreshCw size={13} className={officialLoading ? 'animate-spin' : ''} />
            刷新
          </button>
        </div>

        {officialProfiles.length === 0 ? (
          <div className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-surface)] p-3 text-sm text-[var(--text-primary)]">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--warning-primary)]" />
              <span>登录证道账号后可读取后台启用的官方 AI 配置。</span>
            </div>
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {officialProfiles.map((profile) => {
              const selected = selectedOfficialProfile?.id === profile.id && !thirdPartyEnabled
              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => void selectOfficialProfile(profile.id)}
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

      <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)]">
        <button
          type="button"
          onClick={() => setThirdPartyExpanded((current) => !current)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
            <KeyRound size={16} className="text-[var(--text-muted)]" />
            高级 / 自定义第三方模型
            {thirdPartyEnabled ? (
              <span className="rounded border border-[var(--warning-border)] px-1.5 py-0.5 text-[10px] text-[var(--warning-primary)]">
                已启用
              </span>
            ) : null}
          </span>
          {thirdPartyExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {thirdPartyExpanded ? (
          <div className="space-y-4 border-t border-[var(--border-primary)] p-4">
            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={thirdPartyEnabled}
                onChange={(event) => void setThirdPartyMode(event.target.checked)}
              />
              使用第三方模型覆盖官方 AI
            </label>

            <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                <KeyRound size={16} className="text-[var(--accent-primary)]" /> 新增 / 更新第三方账号
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="账号名">
                  <input value={accountDraft.name} onChange={(event) => setAccountDraft((current) => ({ ...current, name: event.target.value }))} className="field" />
                </Field>
                <Field label="Provider">
                  <select
                    value={accountDraft.provider}
                    onChange={(event) => {
                      setAccountProviderStatus(null)
                      setAccountDraft((current) => ({ ...current, provider: event.target.value }))
                    }}
                    className="field"
                  >
                    {ACCOUNT_PROVIDERS.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </Field>
                {accountProviderMeta.showEndpointField ? (
                  <Field label="Base URL / Endpoint">
                    <input
                      value={accountDraft.api_endpoint}
                      onChange={(event) => setAccountDraft((current) => ({ ...current, api_endpoint: event.target.value }))}
                      className="field"
                      placeholder={accountProviderMeta.endpointPlaceholder}
                    />
                  </Field>
                ) : (
                  <div className="hidden md:block" />
                )}
                <Field label="模型">
                  <input
                    value={accountDraft.model}
                    onChange={(event) => setAccountDraft((current) => ({ ...current, model: event.target.value }))}
                    className="field"
                    placeholder={accountProviderMeta.modelPlaceholder}
                  />
                </Field>
                {accountProviderMeta.showApiKeyField ? (
                  <Field label={accountProviderMeta.apiKeyLabel}>
                    <input
                      type="password"
                      value={accountDraft.api_key}
                      onChange={(event) => setAccountDraft((current) => ({ ...current, api_key: event.target.value }))}
                      className="field"
                      placeholder={accountProviderMeta.apiKeyPlaceholder}
                    />
                  </Field>
                ) : (
                  <div className="rounded-lg border border-[var(--success-border)] bg-[var(--success-surface)] px-3 py-2 text-xs text-[var(--text-primary)] md:col-span-2">
                    当前 provider 通过本机授权或运行时状态工作，不需要保存 API Key。
                  </div>
                )}
                <label className="mt-5 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <input type="checkbox" checked={accountDraft.is_default} onChange={(event) => setAccountDraft((current) => ({ ...current, is_default: event.target.checked }))} />
                  设为默认第三方账号
                </label>
              </div>
              {accountProviderMeta.supportsStatusCheck && (
                <div className="mt-3 space-y-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3">
                  <div className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                    {displayedAccountProviderStatus && displayedAccountProviderStatus.available && !displayedAccountProviderStatus.needsSetup ? (
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--success-primary)]" />
                    ) : (
                      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--warning-primary)]" />
                    )}
                    <span>{displayedAccountProviderStatus?.message || '点击“检测”验证第三方模型连通性。'}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void refreshAccountProviderStatus(true)}
                      disabled={accountProviderStatusLoading}
                      className="secondary-btn"
                    >
                      <RefreshCw size={13} className={accountProviderStatusLoading ? 'animate-spin' : ''} /> 检测
                    </button>
                    {accountProviderMeta.supportsAuthLaunch && (
                      <button
                        type="button"
                        onClick={() => void startGeminiCliLogin()}
                        disabled={accountProviderStatusLoading}
                        className="primary-btn"
                      >
                        <Terminal size={14} /> 启动登录
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div className="mt-3 flex justify-end gap-2">
                {accountDraft.id != null && (
                  <button type="button" onClick={() => setAccountDraft(createEmptyAccountDraft())} className="secondary-btn">
                    <RotateCcw size={14} /> 新建账号
                  </button>
                )}
                <button type="button" onClick={() => void saveAccount()} className="primary-btn">
                  <Save size={14} /> {accountDraft.id != null ? '更新账号' : '保存账号'}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {accounts.length === 0 ? (
                <div className="rounded-lg border border-[var(--border-primary)] p-4 text-sm text-[var(--text-muted)]">暂无第三方账号</div>
              ) : (
                accounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                        {account.name}
                        {account.is_default ? <span className="rounded border border-[var(--success-border)] px-1.5 py-0.5 text-[10px] text-[var(--success-primary)]">默认</span> : null}
                        {account.has_secret ? <span className="rounded border border-[var(--info-border)] px-1.5 py-0.5 text-[10px] text-[var(--info-primary)]">已保存密钥</span> : null}
                      </div>
                      <div className="truncate text-[11px] text-[var(--text-muted)]">
                        {account.provider} / {account.model || '默认模型'} / {account.api_endpoint || '默认端点'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => editAccount(account)} className="secondary-btn">
                        <Pencil size={13} /> 编辑
                      </button>
                      <button type="button" onClick={() => void deleteAccount(account)} className="secondary-btn text-[var(--danger-primary)] hover:text-[var(--danger-primary)]">
                        <Trash2 size={13} /> 删除
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
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
