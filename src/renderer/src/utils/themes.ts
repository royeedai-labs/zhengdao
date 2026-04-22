export const THEME_IDS = [
  'system',
  'light',
  'dark',
  'dark-green',
  'dark-blue',
  'dark-warm',
  'dark-oled'
] as const

export type ThemeId = (typeof THEME_IDS)[number]
export type ResolvedThemeId = Exclude<ThemeId, 'system'>

export const THEME_LABELS: Record<ThemeId, string> = {
  system: '跟随系统',
  light: '冷白浅色',
  dark: '夜间深色',
  'dark-green': '墨绿夜',
  'dark-blue': '深蓝夜',
  'dark-warm': '暖灰',
  'dark-oled': '纯黑 OLED'
}

export type ThemeCssVariables = {
  '--bg-primary': string
  '--bg-secondary': string
  '--bg-tertiary': string
  '--bg-editor': string
  '--surface-primary': string
  '--surface-secondary': string
  '--surface-elevated': string
  '--border-primary': string
  '--border-secondary': string
  '--text-primary': string
  '--text-secondary': string
  '--text-muted': string
  '--text-inverse': string
  '--accent-primary': string
  '--accent-secondary': string
  '--accent-surface': string
  '--accent-border': string
  '--accent-contrast': string
  '--brand-primary': string
  '--brand-surface': string
  '--success-primary': string
  '--success-surface': string
  '--success-border': string
  '--warning-primary': string
  '--warning-surface': string
  '--warning-border': string
  '--danger-primary': string
  '--danger-surface': string
  '--danger-border': string
  '--info-primary': string
  '--info-surface': string
  '--info-border': string
}

export function isThemeId(value: string): value is ThemeId {
  return (THEME_IDS as readonly string[]).includes(value)
}

export function resolveThemeMode(theme: ThemeId, prefersDark: boolean): ResolvedThemeId {
  if (theme === 'system') return prefersDark ? 'dark' : 'light'
  return theme
}

const lightTokens: ThemeCssVariables = {
  '--bg-primary': '#f4f7fb',
  '--bg-secondary': '#ffffff',
  '--bg-tertiary': '#eef3f8',
  '--bg-editor': '#fbfdff',
  '--surface-primary': '#ffffff',
  '--surface-secondary': '#f8fbff',
  '--surface-elevated': '#ffffff',
  '--border-primary': '#dbe4ee',
  '--border-secondary': '#c8d5e3',
  '--text-primary': '#182230',
  '--text-secondary': '#526173',
  '--text-muted': '#8291a5',
  '--text-inverse': '#ffffff',
  '--accent-primary': '#3f6f9f',
  '--accent-secondary': '#2f5f91',
  '--accent-surface': 'rgba(63, 111, 159, 0.1)',
  '--accent-border': 'rgba(63, 111, 159, 0.28)',
  '--accent-contrast': '#ffffff',
  '--brand-primary': '#a77a2f',
  '--brand-surface': 'rgba(167, 122, 47, 0.1)',
  '--success-primary': '#2f855a',
  '--success-surface': 'rgba(47, 133, 90, 0.1)',
  '--success-border': 'rgba(47, 133, 90, 0.26)',
  '--warning-primary': '#c77919',
  '--warning-surface': 'rgba(199, 121, 25, 0.12)',
  '--warning-border': 'rgba(199, 121, 25, 0.3)',
  '--danger-primary': '#c2413b',
  '--danger-surface': 'rgba(194, 65, 59, 0.1)',
  '--danger-border': 'rgba(194, 65, 59, 0.26)',
  '--info-primary': '#3976a8',
  '--info-surface': 'rgba(57, 118, 168, 0.1)',
  '--info-border': 'rgba(57, 118, 168, 0.25)'
}

const darkTokens: ThemeCssVariables = {
  '--bg-primary': '#11161d',
  '--bg-secondary': '#171d25',
  '--bg-tertiary': '#202833',
  '--bg-editor': '#151b23',
  '--surface-primary': '#171d25',
  '--surface-secondary': '#1c2430',
  '--surface-elevated': '#222b37',
  '--border-primary': '#2b3542',
  '--border-secondary': '#3a4655',
  '--text-primary': '#dce5ef',
  '--text-secondary': '#a8b5c4',
  '--text-muted': '#758397',
  '--text-inverse': '#08111d',
  '--accent-primary': '#6f93bc',
  '--accent-secondary': '#8aa8ca',
  '--accent-surface': 'rgba(111, 147, 188, 0.14)',
  '--accent-border': 'rgba(111, 147, 188, 0.32)',
  '--accent-contrast': '#08111d',
  '--brand-primary': '#c6a76d',
  '--brand-surface': 'rgba(198, 167, 109, 0.12)',
  '--success-primary': '#68a987',
  '--success-surface': 'rgba(104, 169, 135, 0.13)',
  '--success-border': 'rgba(104, 169, 135, 0.28)',
  '--warning-primary': '#d69a45',
  '--warning-surface': 'rgba(214, 154, 69, 0.14)',
  '--warning-border': 'rgba(214, 154, 69, 0.32)',
  '--danger-primary': '#d36a62',
  '--danger-surface': 'rgba(211, 106, 98, 0.14)',
  '--danger-border': 'rgba(211, 106, 98, 0.28)',
  '--info-primary': '#78a4cf',
  '--info-surface': 'rgba(120, 164, 207, 0.13)',
  '--info-border': 'rgba(120, 164, 207, 0.3)'
}

export const THEME_TOKENS: Record<ResolvedThemeId, ThemeCssVariables> = {
  light: {
    ...lightTokens
  },
  dark: {
    ...darkTokens
  },
  'dark-green': {
    ...darkTokens,
    '--bg-primary': '#101914',
    '--bg-secondary': '#162119',
    '--bg-tertiary': '#1e2b22',
    '--bg-editor': '#141e18',
    '--border-primary': '#2c3a31',
    '--border-secondary': '#3a4a40',
    '--accent-primary': '#739d85',
    '--accent-secondary': '#8fb49e',
    '--accent-surface': 'rgba(115, 157, 133, 0.14)',
    '--accent-border': 'rgba(115, 157, 133, 0.3)'
  },
  'dark-blue': {
    ...darkTokens,
    '--bg-primary': '#101722',
    '--bg-secondary': '#151d2a',
    '--bg-tertiary': '#1d2838',
    '--bg-editor': '#131b27',
    '--accent-primary': '#6f95c4',
    '--accent-secondary': '#8fb0d4'
  },
  'dark-warm': {
    ...darkTokens,
    '--bg-primary': '#181716',
    '--bg-secondary': '#201e1b',
    '--bg-tertiary': '#292620',
    '--bg-editor': '#1d1b18',
    '--border-primary': '#38342d',
    '--border-secondary': '#494237',
    '--text-primary': '#e9e1d5',
    '--text-secondary': '#b9ad9d',
    '--text-muted': '#8c8171'
  },
  'dark-oled': {
    ...darkTokens,
    '--bg-primary': '#000000',
    '--bg-secondary': '#080a0d',
    '--bg-tertiary': '#101419',
    '--bg-editor': '#000000',
    '--surface-primary': '#080a0d',
    '--surface-secondary': '#101419',
    '--surface-elevated': '#151a21',
    '--border-primary': '#1b222b',
    '--border-secondary': '#28313d'
  }
}
