export interface RelationTypeOption {
  value: string
  label: string
  color: string
  aliases?: string[]
}

export const RELATION_TYPES: RelationTypeOption[] = [
  { value: 'ally', label: '盟友', color: '#10b981', aliases: ['friend', 'partner', '盟友', '同伴', '朋友', '伙伴'] },
  { value: 'enemy', label: '敌对', color: '#ef4444', aliases: ['antagonist', 'villain', 'foe', '敌对', '仇敌', '反派', '敌人'] },
  { value: 'family', label: '亲属', color: '#f59e0b', aliases: ['relative', 'kin', '亲属', '家人', '亲人'] },
  { value: 'mentor', label: '师徒', color: '#8b5cf6', aliases: ['master', 'teacher', '师徒', '师父', '师傅', '导师'] },
  { value: 'rival', label: '竞争', color: '#f97316', aliases: ['competitor', 'competition', '竞争', '对手', '竞争者', '情敌'] },
  { value: 'romance', label: '恋人', color: '#ec4899', aliases: ['lover', 'love', 'couple', '恋人', '恋爱', '情侣'] },
  { value: 'subordinate', label: '从属', color: '#6366f1', aliases: ['follower', 'member', '从属', '下属', '部下', '成员'] }
]

const RELATION_TYPE_VALUES = new Set(RELATION_TYPES.map((type) => type.value))
const RELATION_TYPE_ALIASES = new Map<string, string>()

for (const type of RELATION_TYPES) {
  RELATION_TYPE_ALIASES.set(type.value, type.value)
  for (const alias of type.aliases || []) {
    RELATION_TYPE_ALIASES.set(alias.toLowerCase(), type.value)
  }
}

export function normalizeRelationType(value: unknown): string {
  const raw = String(value || '').trim()
  if (!raw) return 'ally'
  const normalized = raw.toLowerCase()
  if (RELATION_TYPE_VALUES.has(normalized)) return normalized
  return RELATION_TYPE_ALIASES.get(normalized) || 'ally'
}

export function relationTypeLabel(value: string): string {
  const normalized = normalizeRelationType(value)
  return RELATION_TYPES.find((type) => type.value === normalized)?.label || normalized
}

export function relationColor(value: string): string {
  const normalized = normalizeRelationType(value)
  return RELATION_TYPES.find((type) => type.value === normalized)?.color || '#64748b'
}

export function formatRelationLabel(type: string, note?: string | null): string {
  const label = relationTypeLabel(type)
  const cleanNote = String(note || '').trim()
  return cleanNote ? `${label} · ${cleanNote}` : label
}
