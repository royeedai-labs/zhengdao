import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  Terminal,
  Trash2
} from 'lucide-react'
import { useToastStore } from '@/stores/toast-store'
import { getAiAccountProviderUiMeta } from '@/utils/ai/account-provider'
import { buildAiGlobalAccountStatusRequest } from '@/utils/ai/global-account-status'

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
  const [accounts, setAccounts] = useState<AiAccount[]>([])
  const [accountDraft, setAccountDraft] = useState(createEmptyAccountDraft)
  const [accountProviderStatus, setAccountProviderStatus] = useState<AiProviderStatus | null>(null)
  const [accountProviderStatusLoading, setAccountProviderStatusLoading] = useState(false)
  const accountProviderMeta = useMemo(
    () => getAiAccountProviderUiMeta(accountDraft.provider),
    [accountDraft.provider]
  )

  const refresh = async () => {
    const accountRows = (await window.api.aiGetAccounts()) as AiAccount[]
    setAccounts(accountRows)
  }

  useEffect(() => {
    void refresh()
  }, [])

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
    if (!accountProviderMeta.supportsStatusCheck) return
    let cancelled = false

    const loadProviderStatus = async () => {
      setAccountProviderStatusLoading(true)
      try {
        const request = buildAiGlobalAccountStatusRequest(accountDraft, false)
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
  }, [accountDraft.provider, accountProviderMeta.supportsStatusCheck])

  const saveAccount = async () => {
    await window.api.aiSaveAccount(accountDraft)
    setAccountDraft(createEmptyAccountDraft())
    setAccountProviderStatus(null)
    useToastStore.getState().addToast('success', '全局 AI 账号已保存')
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
    if (!window.confirm(`确定删除全局账号“${account.name}”吗？`)) return
    await window.api.aiDeleteAccount(account.id)
    if (accountDraft.id === account.id) {
      setAccountDraft(createEmptyAccountDraft())
    }
    useToastStore.getState().addToast('success', '全局 AI 账号已删除')
    await refresh()
  }

  const displayedAccountProviderStatus =
    accountProviderMeta.supportsStatusCheck ? accountProviderStatus : null

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--text-muted)]">
        AI 账号是系统级资源，所有作品共用默认账号；作品配置只保存写作规则，不重复保存 key。
      </p>
      <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
          <KeyRound size={16} className="text-[var(--accent-primary)]" /> 新增 / 更新全局账号
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
            <Field label="Endpoint">
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
            设为默认账号
          </label>
        </div>
        {accountProviderMeta.supportsStatusCheck && (
          <div className="mt-3 space-y-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3">
            <div className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
              {displayedAccountProviderStatus && displayedAccountProviderStatus.available && !displayedAccountProviderStatus.needsSetup ? (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--success-primary)]" />
              ) : (
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--warning-primary)]" />
              )}
              <span>{displayedAccountProviderStatus?.message || '检测 Gemini CLI 状态后可启动终端式 Google 登录。'}</span>
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
          <div className="rounded-lg border border-[var(--border-primary)] p-4 text-sm text-[var(--text-muted)]">暂无全局账号</div>
        ) : (
          accounts.map((account) => (
            <div key={account.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-sm">
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
                <button type="button" onClick={() => void refresh()} className="secondary-btn">
                  <RefreshCw size={13} /> 刷新
                </button>
              </div>
            </div>
          ))
        )}
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
