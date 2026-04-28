import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Copy,
  Loader2,
  Mail,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X
} from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { useToastStore } from '@/stores/toast-store'

/**
 * DI-06 v2 — 桌面端团队管理 modal
 *
 * 调用 main 进程的 team:* IPC, 后者透传到 agentx-backend /v1/teams/*。
 * 三栏布局:
 *  - 左侧: 我所属的团队列表 + "创建新团队"按钮 + "用 token 接受邀请"快捷入口
 *  - 右侧顶部: 团队名 / 我的角色 / 已用座席 / 套餐
 *  - 右侧标签页: 成员 / 邀请
 *
 * 邀请生命周期: pending → accepted / revoked / expired。token 仅在创建那次
 * 返回, "复制邀请链接"按钮把 https://agent.xiangweihu.com/accept-team-invite?token=xxx
 * 写到剪贴板。DI-06 v3 web 端 /accept-team-invite 落地页接通。
 */

interface TeamSummary {
  id: string
  name: string
  plan: string
  seatLimit: number
  ownerUserId: string
  myRole?: 'owner' | 'admin' | 'member'
  joinedAt?: string
  createdAt: string
}

interface Member {
  userId: string
  role: 'owner' | 'admin' | 'member'
  joinedAt: string
}

interface Invitation {
  id: string
  teamId: string
  email: string
  role: 'admin' | 'member'
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  token?: string
  expiresAt: string
  createdAt: string
  acceptedAt: string | null
}

interface ApiResult<T> {
  ok: boolean
  data?: T
  error?: string
  code?: string
}

const WEBSITE_URL = 'https://agent.xiangweihu.com'

function buildAcceptUrl(token: string): string {
  return `${WEBSITE_URL}/accept-team-invite?token=${encodeURIComponent(token)}`
}

export default function TeamManagementModal() {
  const closeModal = useUIStore((s) => s.closeModal)
  const addToast = useToastStore((s) => s.addToast)

  const [teams, setTeams] = useState<TeamSummary[]>([])
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null)
  const [tab, setTab] = useState<'members' | 'invitations'>('members')

  const [loadingTeams, setLoadingTeams] = useState(true)
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [creatingTeamName, setCreatingTeamName] = useState('')
  const [acceptToken, setAcceptToken] = useState('')

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [submitting, setSubmitting] = useState(false)

  const activeTeam = useMemo(() => teams.find((t) => t.id === activeTeamId) || null, [
    teams,
    activeTeamId
  ])

  const refreshTeams = useCallback(async () => {
    setLoadingTeams(true)
    try {
      const r = (await window.api.teamListMine()) as ApiResult<{ teams: TeamSummary[] }>
      if (!r.ok) {
        addToast('error', r.error || '加载团队失败')
        return
      }
      const list = r.data?.teams || []
      setTeams(list)
      if (list.length > 0 && !list.some((t) => t.id === activeTeamId)) {
        setActiveTeamId(list[0].id)
      }
    } finally {
      setLoadingTeams(false)
    }
  }, [activeTeamId, addToast])

  useEffect(() => {
    void refreshTeams()
  }, [refreshTeams])

  const refreshDetail = useCallback(
    async (teamId: string) => {
      setLoadingDetail(true)
      try {
        const [mRes, iRes] = await Promise.all([
          window.api.teamListMembers(teamId) as Promise<ApiResult<{ members: Member[] }>>,
          window.api.teamListInvitations(teamId) as Promise<ApiResult<{ invitations: Invitation[] }>>
        ])
        if (mRes.ok) setMembers(mRes.data?.members || [])
        if (iRes.ok) setInvitations(iRes.data?.invitations || [])
        if (!mRes.ok) addToast('error', mRes.error || '加载成员失败')
        if (!iRes.ok && iRes.code !== 'INSUFFICIENT_TEAM_ROLE') {
          addToast('error', iRes.error || '加载邀请失败')
        }
      } finally {
        setLoadingDetail(false)
      }
    },
    [addToast]
  )

  useEffect(() => {
    if (activeTeamId) void refreshDetail(activeTeamId)
  }, [activeTeamId, refreshDetail])

  const handleCreateTeam = async () => {
    const name = creatingTeamName.trim()
    if (!name) {
      addToast('error', '请填写团队名')
      return
    }
    setSubmitting(true)
    try {
      const r = (await window.api.teamCreate({ name })) as ApiResult<{ team: TeamSummary }>
      if (!r.ok) {
        addToast('error', r.error || '创建团队失败')
        return
      }
      addToast('success', `已创建团队 "${name}"`)
      setCreatingTeamName('')
      await refreshTeams()
      if (r.data?.team.id) setActiveTeamId(r.data.team.id)
    } finally {
      setSubmitting(false)
    }
  }

  const handleAcceptByToken = async () => {
    const tok = acceptToken.trim()
    if (!tok) return
    setSubmitting(true)
    try {
      const r = (await window.api.teamAcceptInvitation(tok)) as ApiResult<{
        team: TeamSummary
        role: string
      }>
      if (!r.ok) {
        const msg =
          r.code === 'INVITATION_EXPIRED'
            ? '邀请已过期'
            : r.code === 'INVITATION_NOT_FOUND'
              ? '邀请 token 无效'
              : r.code === 'INVITATION_ALREADY_USED'
                ? '该邀请已被使用 / 撤回'
                : r.error || '接受邀请失败'
        addToast('error', msg)
        return
      }
      addToast('success', `已加入团队 "${r.data?.team.name}", 角色: ${r.data?.role}`)
      setAcceptToken('')
      await refreshTeams()
      if (r.data?.team.id) setActiveTeamId(r.data.team.id)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!activeTeam) return
    if (!window.confirm(`确定要把 ${userId} 移出团队?`)) return
    const r = (await window.api.teamRemoveMember(activeTeam.id, userId)) as ApiResult<unknown>
    if (!r.ok) {
      addToast('error', r.error || '移除成员失败')
      return
    }
    addToast('success', '已移除成员')
    await refreshDetail(activeTeam.id)
  }

  const handleSendInvite = async () => {
    if (!activeTeam) return
    const email = inviteEmail.trim()
    if (!email.includes('@')) {
      addToast('error', '请填写有效邮箱')
      return
    }
    setSubmitting(true)
    try {
      const r = (await window.api.teamCreateInvitation(activeTeam.id, {
        email,
        role: inviteRole
      })) as ApiResult<{ invitation: Invitation }>
      if (!r.ok) {
        const msg =
          r.code === 'SEAT_LIMIT_EXCEEDED'
            ? `团队已达座席上限 (${activeTeam.seatLimit}), 无法继续邀请`
            : r.code === 'INSUFFICIENT_TEAM_ROLE'
              ? '只有 owner / admin 可发起邀请'
              : r.error || '创建邀请失败'
        addToast('error', msg)
        return
      }
      const tok = r.data?.invitation.token
      if (tok) {
        try {
          await navigator.clipboard.writeText(buildAcceptUrl(tok))
          addToast('success', '邀请已创建, 接受链接已复制到剪贴板')
        } catch {
          addToast('success', '邀请已创建, 请在邀请列表中复制链接')
        }
      }
      setInviteEmail('')
      await refreshDetail(activeTeam.id)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRevokeInvite = async (invitationId: string) => {
    if (!activeTeam) return
    const r = (await window.api.teamRevokeInvitation(activeTeam.id, invitationId)) as ApiResult<unknown>
    if (!r.ok) {
      addToast('error', r.error || '撤销邀请失败')
      return
    }
    addToast('success', '邀请已撤销')
    await refreshDetail(activeTeam.id)
  }

  const canManage = activeTeam?.myRole === 'owner' || activeTeam?.myRole === 'admin'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] shadow-2xl">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-5">
          <div className="flex items-center gap-2 font-bold text-[var(--text-primary)]">
            <Users size={18} className="text-[var(--accent-secondary)]" />
            团队空间 (DI-06)
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
            aria-label="关闭"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-[280px_1fr] overflow-hidden">
          <aside className="flex flex-col border-r border-[var(--border-primary)] bg-[var(--bg-primary)]">
            <div className="border-b border-[var(--border-primary)] p-3">
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                创建新团队
              </label>
              <div className="flex gap-1">
                <input
                  value={creatingTeamName}
                  onChange={(e) => setCreatingTeamName(e.target.value)}
                  placeholder="团队名"
                  className="field flex-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() => void handleCreateTeam()}
                  disabled={submitting || !creatingTeamName.trim()}
                  className="inline-flex items-center justify-center rounded bg-[var(--accent-primary)] px-2 text-[var(--accent-contrast)] hover:bg-[var(--accent-secondary)] disabled:opacity-40"
                  aria-label="创建团队"
                  title="创建团队"
                >
                  <Plus size={14} />
                </button>
              </div>
              <label className="mb-1 mt-3 block text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                用 token 接受邀请
              </label>
              <div className="flex gap-1">
                <input
                  value={acceptToken}
                  onChange={(e) => setAcceptToken(e.target.value)}
                  placeholder="invitation token"
                  className="field flex-1 font-mono text-[10px]"
                />
                <button
                  type="button"
                  onClick={() => void handleAcceptByToken()}
                  disabled={submitting || !acceptToken.trim()}
                  className="inline-flex items-center justify-center rounded border border-[var(--accent-border)] bg-[var(--accent-surface)] px-2 text-[var(--accent-secondary)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-contrast)] disabled:opacity-40"
                  aria-label="接受邀请"
                  title="接受邀请"
                >
                  <UserPlus size={14} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingTeams ? (
                <div className="p-4 text-center text-xs text-[var(--text-muted)]">
                  <Loader2 size={14} className="mx-auto animate-spin" /> 加载团队中...
                </div>
              ) : teams.length === 0 ? (
                <div className="p-4 text-center text-xs text-[var(--text-muted)]">
                  尚未加入任何团队。可以新建团队, 或粘贴邀请 token 加入。
                </div>
              ) : (
                <ul className="divide-y divide-[var(--border-primary)]">
                  {teams.map((team) => {
                    const active = activeTeamId === team.id
                    return (
                      <li key={team.id}>
                        <button
                          type="button"
                          onClick={() => setActiveTeamId(team.id)}
                          className={`flex w-full flex-col items-start gap-1 p-3 text-left transition ${
                            active
                              ? 'bg-[var(--accent-surface)] text-[var(--accent-secondary)]'
                              : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                          }`}
                        >
                          <div className="text-sm font-bold">{team.name}</div>
                          <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                            <span className="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 uppercase tracking-wider">
                              {team.myRole || 'member'}
                            </span>
                            <span>{team.plan}</span>
                            <span>seat {team.seatLimit}</span>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </aside>

          <main className="flex flex-col overflow-hidden">
            {!activeTeam ? (
              <div className="flex flex-1 items-center justify-center text-sm text-[var(--text-muted)]">
                请在左侧选择 / 创建团队
              </div>
            ) : (
              <>
                <header className="flex items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-5 py-3">
                  <div>
                    <div className="text-base font-bold text-[var(--text-primary)]">{activeTeam.name}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-[var(--text-muted)]">
                      <span className="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 uppercase tracking-wider">
                        {activeTeam.myRole || 'member'}
                      </span>
                      <span>套餐 {activeTeam.plan}</span>
                      <span>
                        座席 {members.length} / {activeTeam.seatLimit}
                      </span>
                      <span>团队 ID: {activeTeam.id.slice(0, 8)}…</span>
                    </div>
                  </div>
                  <div className="flex border border-[var(--border-primary)]">
                    <TabButton active={tab === 'members'} onClick={() => setTab('members')}>
                      <Users size={12} /> 成员 ({members.length})
                    </TabButton>
                    <TabButton active={tab === 'invitations'} onClick={() => setTab('invitations')}>
                      <Mail size={12} /> 邀请 ({invitations.length})
                    </TabButton>
                  </div>
                </header>

                <div className="flex-1 overflow-y-auto p-5">
                  {loadingDetail ? (
                    <div className="text-center text-xs text-[var(--text-muted)]">
                      <Loader2 size={14} className="mx-auto animate-spin" /> 加载中...
                    </div>
                  ) : tab === 'members' ? (
                    <MembersList
                      members={members}
                      canManage={canManage}
                      ownerUserId={activeTeam.ownerUserId}
                      onRemove={(uid) => void handleRemoveMember(uid)}
                    />
                  ) : (
                    <InvitationsTab
                      activeTeam={activeTeam}
                      invitations={invitations}
                      canManage={Boolean(canManage)}
                      submitting={submitting}
                      inviteEmail={inviteEmail}
                      setInviteEmail={setInviteEmail}
                      inviteRole={inviteRole}
                      setInviteRole={setInviteRole}
                      onSendInvite={() => void handleSendInvite()}
                      onRevoke={(id) => void handleRevokeInvite(id)}
                      onCopyLink={async (token) => {
                        try {
                          await navigator.clipboard.writeText(buildAcceptUrl(token))
                          addToast('success', '接受链接已复制到剪贴板')
                        } catch {
                          addToast('error', '复制失败')
                        }
                      }}
                    />
                  )}
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-3 py-1 text-xs transition ${
        active
          ? 'bg-[var(--accent-surface)] text-[var(--accent-secondary)]'
          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
      }`}
    >
      {children}
    </button>
  )
}

function MembersList({
  members,
  canManage,
  ownerUserId,
  onRemove
}: {
  members: Member[]
  canManage?: boolean
  ownerUserId: string
  onRemove: (userId: string) => void
}) {
  if (members.length === 0) {
    return <div className="text-xs text-[var(--text-muted)]">暂无成员</div>
  }
  return (
    <ul className="divide-y divide-[var(--border-primary)] rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)]">
      {members.map((m) => {
        const isOwner = m.userId === ownerUserId
        return (
          <li key={m.userId} className="flex items-center justify-between gap-3 p-3 text-xs">
            <div className="flex min-w-0 items-center gap-2">
              <ShieldCheck
                size={14}
                className={
                  m.role === 'owner'
                    ? 'text-[var(--accent-secondary)]'
                    : m.role === 'admin'
                      ? 'text-[var(--info-primary)]'
                      : 'text-[var(--text-muted)]'
                }
              />
              <div className="min-w-0">
                <div className="truncate font-mono text-[var(--text-primary)]">{m.userId}</div>
                <div className="text-[10px] text-[var(--text-muted)]">
                  {m.role} · 加入于 {new Date(m.joinedAt).toLocaleString()}
                </div>
              </div>
            </div>
            {canManage && !isOwner && (
              <button
                type="button"
                onClick={() => onRemove(m.userId)}
                className="rounded p-1 text-[var(--text-muted)] transition hover:text-red-500"
                aria-label="移除成员"
                title="移除成员"
              >
                <Trash2 size={14} />
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function InvitationsTab({
  activeTeam,
  invitations,
  canManage,
  submitting,
  inviteEmail,
  setInviteEmail,
  inviteRole,
  setInviteRole,
  onSendInvite,
  onRevoke,
  onCopyLink
}: {
  activeTeam: TeamSummary
  invitations: Invitation[]
  canManage: boolean
  submitting: boolean
  inviteEmail: string
  setInviteEmail: (v: string) => void
  inviteRole: 'admin' | 'member'
  setInviteRole: (v: 'admin' | 'member') => void
  onSendInvite: () => void
  onRevoke: (id: string) => void
  onCopyLink: (token: string) => void
}) {
  return (
    <div className="space-y-4">
      {canManage ? (
        <section className="rounded-lg border border-[var(--accent-border)] bg-[var(--accent-surface)]/30 p-3">
          <div className="mb-2 text-xs font-bold text-[var(--accent-secondary)]">邀请新成员</div>
          <div className="grid grid-cols-[1fr_140px_auto] gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="被邀请人邮箱"
              className="field text-xs"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
              className="field text-xs"
            >
              <option value="member">成员 (member)</option>
              <option value="admin">管理员 (admin)</option>
            </select>
            <button
              type="button"
              onClick={onSendInvite}
              disabled={submitting}
              className="inline-flex items-center gap-1 rounded bg-[var(--accent-primary)] px-3 text-xs text-[var(--accent-contrast)] hover:bg-[var(--accent-secondary)] disabled:opacity-40"
            >
              {submitting ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
              发送邀请
            </button>
          </div>
          <div className="mt-2 text-[10px] text-[var(--text-muted)]">
            创建邀请会自动复制接受链接到剪贴板, 把链接发给被邀请人即可。座席上限{' '}
            {activeTeam.seatLimit}, 邮件通知 (DI-06 v4) 在后续版本接通。
          </div>
        </section>
      ) : (
        <section className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-surface)]/30 p-3 text-xs text-[var(--warning-primary)]">
          <AlertCircle size={12} className="mr-1 inline" />
          只有 owner / admin 可发起邀请, 你目前是普通成员。
        </section>
      )}

      <section>
        <h4 className="mb-2 text-xs font-bold text-[var(--text-primary)]">邀请记录 ({invitations.length})</h4>
        {invitations.length === 0 ? (
          <div className="rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4 text-center text-xs text-[var(--text-muted)]">
            暂无邀请记录
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border-primary)] rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)]">
            {invitations.map((inv) => {
              const expired = new Date(inv.expiresAt).getTime() < Date.now()
              return (
                <li key={inv.id} className="flex items-center justify-between gap-3 p-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-[var(--text-primary)]">{inv.email}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                          inv.status === 'pending' && !expired
                            ? 'bg-[var(--accent-surface)] text-[var(--accent-secondary)]'
                            : inv.status === 'accepted'
                              ? 'bg-[var(--success-surface)] text-[var(--success-primary)]'
                              : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                        }`}
                      >
                        {expired && inv.status === 'pending' ? 'expired' : inv.status}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">{inv.role}</span>
                    </div>
                    <div className="mt-1 text-[10px] text-[var(--text-muted)]">
                      创建于 {new Date(inv.createdAt).toLocaleString()} · 过期 {new Date(inv.expiresAt).toLocaleString()}
                      {inv.acceptedAt && ` · 接受于 ${new Date(inv.acceptedAt).toLocaleString()}`}
                    </div>
                  </div>
                  {canManage && inv.status === 'pending' && !expired && (
                    <div className="flex items-center gap-1">
                      {inv.token && (
                        <button
                          type="button"
                          onClick={() => onCopyLink(inv.token!)}
                          className="rounded p-1 text-[var(--accent-secondary)] hover:bg-[var(--accent-surface)]"
                          title="复制接受链接"
                        >
                          <Copy size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onRevoke(inv.id)}
                        className="rounded p-1 text-[var(--text-muted)] transition hover:text-red-500"
                        title="撤销邀请"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
