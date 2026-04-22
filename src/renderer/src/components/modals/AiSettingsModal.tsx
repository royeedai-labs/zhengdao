import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  KeyRound,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Terminal,
  Trash2,
  X
} from 'lucide-react'
import { useBookStore } from '@/stores/book-store'
import { useToastStore } from '@/stores/toast-store'
import { useUIStore } from '@/stores/ui-store'
import type { AiSkillOverride, AiSkillTemplate, AiWorkProfile } from '@/utils/ai/assistant-workflow'
import { getAiAccountProviderUiMeta } from '@/utils/ai/account-provider'

type Tab = 'profile' | 'skills' | 'accounts'

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

type SkillDraft = Partial<AiSkillTemplate & AiSkillOverride>

const EMPTY_PROFILE: AiWorkProfile = {
  id: 0,
  book_id: 0,
  default_account_id: null,
  style_guide: '',
  genre_rules: '',
  content_boundaries: '',
  asset_rules: '',
  rhythm_rules: '',
  context_policy: 'smart_minimal',
  created_at: '',
  updated_at: ''
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

function createSkillDraft(
  selectedSkill: AiSkillTemplate,
  selectedOverride: AiSkillOverride | null,
  useOverride: boolean
): SkillDraft {
  const source = useOverride && selectedOverride ? selectedOverride : selectedSkill
  return {
    name: source.name || selectedSkill.name,
    description: source.description || selectedSkill.description,
    system_prompt: source.system_prompt || selectedSkill.system_prompt,
    user_prompt_template: source.user_prompt_template || selectedSkill.user_prompt_template,
    context_policy: source.context_policy || selectedSkill.context_policy,
    output_contract: source.output_contract || selectedSkill.output_contract,
    enabled_surfaces: source.enabled_surfaces || selectedSkill.enabled_surfaces
  }
}

export default function AiSettingsModal() {
  const closeModal = useUIStore((s) => s.closeModal)
  const bookId = useBookStore((s) => s.currentBookId)!
  const [tab, setTab] = useState<Tab>('profile')
  const [accounts, setAccounts] = useState<AiAccount[]>([])
  const [skills, setSkills] = useState<AiSkillTemplate[]>([])
  const [overrides, setOverrides] = useState<AiSkillOverride[]>([])
  const [profile, setProfile] = useState<AiWorkProfile>(EMPTY_PROFILE)
  const [selectedSkillKey, setSelectedSkillKey] = useState('continue_writing')
  const [useOverride, setUseOverride] = useState(false)
  const [accountDraft, setAccountDraft] = useState(createEmptyAccountDraft)
  const [accountProviderStatus, setAccountProviderStatus] = useState<AiProviderStatus | null>(null)
  const [accountProviderStatusLoading, setAccountProviderStatusLoading] = useState(false)

  const selectedSkill = useMemo(
    () => skills.find((skill) => skill.key === selectedSkillKey) || skills[0],
    [skills, selectedSkillKey]
  )
  const selectedOverride = useMemo(
    () => overrides.find((override) => override.skill_key === selectedSkillKey) || null,
    [overrides, selectedSkillKey]
  )
  const accountProviderMeta = useMemo(
    () => getAiAccountProviderUiMeta(accountDraft.provider),
    [accountDraft.provider]
  )

  const loadModalState = useCallback(async () => {
    const [accountRows, skillRows, profileRow, overrideRows] = await Promise.all([
      window.api.aiGetAccounts(),
      window.api.aiGetSkillTemplates(),
      window.api.aiGetWorkProfile(bookId),
      window.api.aiGetSkillOverrides(bookId)
    ])
    return {
      accounts: accountRows as AiAccount[],
      skills: skillRows as AiSkillTemplate[],
      profile: (profileRow as AiWorkProfile) || EMPTY_PROFILE,
      overrides: overrideRows as AiSkillOverride[]
    }
  }, [bookId])

  const refresh = async () => {
    const next = await loadModalState()
    setAccounts(next.accounts)
    setSkills(next.skills)
    setProfile(next.profile)
    setOverrides(next.overrides)
    setUseOverride(Boolean(next.overrides.find((override) => override.skill_key === selectedSkillKey)))
  }

  useEffect(() => {
    let cancelled = false

    const loadInitialState = async () => {
      const next = await loadModalState()
      if (cancelled) return
      setAccounts(next.accounts)
      setSkills(next.skills)
      setProfile(next.profile)
      setOverrides(next.overrides)
      setUseOverride(Boolean(next.overrides.find((override) => override.skill_key === selectedSkillKey)))
    }

    void loadInitialState()
    return () => {
      cancelled = true
    }
  }, [loadModalState, selectedSkillKey])

  const refreshAccountProviderStatus = async (probe = false) => {
    setAccountProviderStatusLoading(true)
    try {
      const status = (await window.api.aiGetProviderStatus(accountDraft.provider, { probe })) as AiProviderStatus
      setAccountProviderStatus(status)
    } finally {
      setAccountProviderStatusLoading(false)
    }
  }

  useEffect(() => {
    if (tab !== 'accounts' || !accountProviderMeta.supportsStatusCheck) return
    let cancelled = false

    const loadProviderStatus = async () => {
      setAccountProviderStatusLoading(true)
      try {
        const status = (await window.api.aiGetProviderStatus(accountDraft.provider, { probe: false })) as AiProviderStatus
        if (!cancelled) setAccountProviderStatus(status)
      } finally {
        if (!cancelled) setAccountProviderStatusLoading(false)
      }
    }

    void loadProviderStatus()
    return () => {
      cancelled = true
    }
  }, [tab, accountDraft.provider, accountProviderMeta.supportsStatusCheck])

  const saveProfile = async () => {
    await window.api.aiSaveWorkProfile(bookId, profile)
    useToastStore.getState().addToast('success', '作品 AI 档案已保存')
    await refresh()
  }

  const saveSkill = async (skillDraft: SkillDraft) => {
    if (!selectedSkill) return
    if (useOverride) {
      await window.api.aiUpsertSkillOverride(bookId, selectedSkill.key, skillDraft)
      useToastStore.getState().addToast('success', '本作品能力覆盖已保存')
    } else {
      await window.api.aiUpdateSkillTemplate(selectedSkill.key, skillDraft)
      useToastStore.getState().addToast('success', '全局能力模板已保存')
    }
    await refresh()
  }

  const resetSkillOverride = async () => {
    if (!selectedSkill) return
    await window.api.aiDeleteSkillOverride(bookId, selectedSkill.key)
    setUseOverride(false)
    useToastStore.getState().addToast('success', '已恢复继承全局能力')
    await refresh()
  }

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

  const selectSkill = (skillKey: string) => {
    setSelectedSkillKey(skillKey)
    setUseOverride(Boolean(overrides.find((override) => override.skill_key === skillKey)))
  }

  const displayedAccountProviderStatus =
    accountProviderMeta.supportsStatusCheck ? accountProviderStatus : null

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

  const tabs: Array<[Tab, string]> = [
    ['profile', '作品 AI 档案'],
    ['skills', 'AI 能力卡'],
    ['accounts', '全局账号']
  ]

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="flex h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] shadow-2xl">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-5">
          <div className="flex items-center gap-2 font-bold text-[var(--text-primary)]">
            <Bot size={18} className="text-emerald-400" />
            <span>AI 能力与作品配置</span>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
            title="关闭 AI 配置"
            aria-label="关闭 AI 配置"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex shrink-0 border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-2">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`border-b-2 px-4 py-3 text-xs font-bold transition ${
                tab === key
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'profile' && (
            <div className="space-y-4">
              <p className="text-xs text-[var(--text-muted)]">
                这里配置 AI 如何理解当前作品，不保存账号密钥。账号、API Key、Gemini CLI 和 Ollama 状态在“全局账号”里统一管理。
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="默认全局账号">
                  <select
                    value={profile.default_account_id ?? ''}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        default_account_id: event.target.value ? Number(event.target.value) : null
                      }))}
                    className="field"
                  >
                    <option value="">自动选择默认账号</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} / {account.provider}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="上下文策略">
                  <select
                    value={profile.context_policy}
                    onChange={(event) => setProfile((current) => ({ ...current, context_policy: event.target.value }))}
                    className="field"
                  >
                    <option value="smart_minimal">智能最小上下文</option>
                    <option value="manual">手动选择上下文</option>
                    <option value="full">尽可能完整上下文</option>
                  </select>
                </Field>
              </div>
              <TextArea label="文风偏好" value={profile.style_guide} onChange={(value) => setProfile((current) => ({ ...current, style_guide: value }))} />
              <TextArea label="题材规则" value={profile.genre_rules} onChange={(value) => setProfile((current) => ({ ...current, genre_rules: value }))} />
              <TextArea label="写作禁区 / 不允许改动" value={profile.content_boundaries} onChange={(value) => setProfile((current) => ({ ...current, content_boundaries: value }))} />
              <TextArea label="资产生成规则" value={profile.asset_rules} onChange={(value) => setProfile((current) => ({ ...current, asset_rules: value }))} />
              <TextArea label="章节节奏要求" value={profile.rhythm_rules} onChange={(value) => setProfile((current) => ({ ...current, rhythm_rules: value }))} />
              <div className="flex justify-end">
                <button type="button" onClick={() => void saveProfile()} className="primary-btn">
                  <Save size={14} /> 保存作品 AI 档案
                </button>
              </div>
            </div>
          )}

          {tab === 'skills' && selectedSkill && (
            <div className="grid min-h-0 gap-4 md:grid-cols-[260px_1fr]">
              <div className="space-y-2">
                {skills.map((skill) => (
                  <button
                    key={skill.key}
                    type="button"
                    onClick={() => selectSkill(skill.key)}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      selectedSkillKey === skill.key
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                        : 'border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] hover:border-[var(--border-secondary)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-bold">
                      <Sparkles size={14} /> {skill.name}
                    </div>
                    <div className="mt-1 line-clamp-2 text-[11px] text-[var(--text-muted)]">{skill.description}</div>
                    {overrides.some((override) => override.skill_key === skill.key) && (
                      <div className="mt-2 inline-flex items-center gap-1 rounded border border-emerald-500/30 px-1.5 py-0.5 text-[10px] text-emerald-300">
                        <Check size={10} /> 本作品覆盖
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <SkillDraftEditor
                key={`${selectedSkill.key}:${useOverride ? 'override' : 'global'}:${selectedOverride ? 'custom' : 'inherited'}`}
                selectedSkill={selectedSkill}
                selectedOverride={selectedOverride}
                useOverride={useOverride}
                onUseOverrideChange={setUseOverride}
                onReset={() => void resetSkillOverride()}
                onSave={(skillDraft) => void saveSkill(skillDraft)}
              />
            </div>
          )}

          {tab === 'accounts' && (
            <div className="space-y-4">
              <p className="text-xs text-[var(--text-muted)]">
                账号是全局资源，供所有作品选择使用；作品配置只引用账号和写作规则，不重复保存 key。
              </p>
              <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                  <KeyRound size={16} className="text-emerald-400" /> 新增 / 更新全局账号
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
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100 md:col-span-2">
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
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                      ) : (
                        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-400" />
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
                          {account.is_default ? <span className="rounded border border-emerald-500/30 px-1.5 py-0.5 text-[10px] text-emerald-300">默认</span> : null}
                          {account.has_secret ? <span className="rounded border border-sky-500/30 px-1.5 py-0.5 text-[10px] text-sky-300">已保存密钥</span> : null}
                        </div>
                        <div className="truncate text-[11px] text-[var(--text-muted)]">
                          {account.provider} / {account.model || '默认模型'} / {account.api_endpoint || '默认端点'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => editAccount(account)} className="secondary-btn">
                          <Pencil size={13} /> 编辑
                        </button>
                        <button type="button" onClick={() => void deleteAccount(account)} className="secondary-btn text-red-300 hover:text-red-200">
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
          )}
        </div>
      </div>
    </div>
  )
}

function SkillDraftEditor({
  selectedSkill,
  selectedOverride,
  useOverride,
  onUseOverrideChange,
  onReset,
  onSave
}: {
  selectedSkill: AiSkillTemplate
  selectedOverride: AiSkillOverride | null
  useOverride: boolean
  onUseOverrideChange: (value: boolean) => void
  onReset: () => void
  onSave: (skillDraft: SkillDraft) => void
}) {
  const [skillDraft, setSkillDraft] = useState<SkillDraft>(() =>
    createSkillDraft(selectedSkill, selectedOverride, useOverride)
  )

  return (
    <div className="space-y-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-[var(--text-primary)]">{selectedSkill.name}</div>
          <div className="text-[11px] text-[var(--text-muted)]">{selectedSkill.key}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onUseOverrideChange(false)}
            className={`seg-btn ${!useOverride ? 'seg-active' : ''}`}
          >
            继承/编辑全局
          </button>
          <button
            type="button"
            onClick={() => onUseOverrideChange(true)}
            className={`seg-btn ${useOverride ? 'seg-active' : ''}`}
          >
            本作品覆盖
          </button>
        </div>
      </div>
      <Field label="能力名称">
        <input
          value={String(skillDraft.name || '')}
          onChange={(event) => setSkillDraft((current) => ({ ...current, name: event.target.value }))}
          className="field"
        />
      </Field>
      <TextArea
        label="能力说明"
        rows={2}
        value={String(skillDraft.description || '')}
        onChange={(value) => setSkillDraft((current) => ({ ...current, description: value }))}
      />
      <TextArea
        label="系统提示词"
        rows={5}
        value={String(skillDraft.system_prompt || '')}
        onChange={(value) => setSkillDraft((current) => ({ ...current, system_prompt: value }))}
      />
      <TextArea
        label="用户提示词模板"
        rows={4}
        value={String(skillDraft.user_prompt_template || '')}
        onChange={(value) => setSkillDraft((current) => ({ ...current, user_prompt_template: value }))}
      />
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="上下文策略">
          <input
            value={String(skillDraft.context_policy || '')}
            onChange={(event) => setSkillDraft((current) => ({ ...current, context_policy: event.target.value }))}
            className="field"
          />
        </Field>
        <Field label="启用入口">
          <input
            value={String(skillDraft.enabled_surfaces || '')}
            onChange={(event) => setSkillDraft((current) => ({ ...current, enabled_surfaces: event.target.value }))}
            className="field"
          />
        </Field>
        <Field label="输出要求">
          <input
            value={String(skillDraft.output_contract || '')}
            onChange={(event) => setSkillDraft((current) => ({ ...current, output_contract: event.target.value }))}
            className="field"
          />
        </Field>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {selectedOverride && (
          <button type="button" onClick={onReset} className="secondary-btn">
            <RotateCcw size={14} /> 恢复全局
          </button>
        )}
        <button type="button" onClick={() => onSave(skillDraft)} className="primary-btn">
          <Save size={14} /> {useOverride ? '保存本作品覆盖' : '保存全局能力'}
        </button>
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

function TextArea({
  label,
  value,
  onChange,
  rows = 3
}: {
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
}) {
  return (
    <Field label={label}>
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field resize-y"
      />
    </Field>
  )
}
