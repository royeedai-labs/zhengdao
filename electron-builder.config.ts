import type { Configuration } from 'electron-builder'

const ghOwner = process.env.GH_OWNER?.trim()
const ghRepo = process.env.GH_REPO?.trim()

// LB-06 v2: macOS hardened runtime + notarize is gated behind the presence of
// CSC_LINK / MAC_CSC_LINK. When the workflow has no Apple Developer secrets
// configured (typical local dev or CI fallback), we keep the legacy unsigned
// build path so we do not regress against existing release.yml. Once OPS
// uploads MAC_CSC_LINK + APPLE_ID + APPLE_TEAM_ID to GitHub Actions secrets
// the new release-multiplatform.yml flips this to true automatically.
const hasAppleCodeSign =
  !!(process.env.CSC_LINK?.trim() || process.env.MAC_CSC_LINK?.trim())
const hasAppleNotarize = hasAppleCodeSign && !!process.env.APPLE_TEAM_ID?.trim()

const config: Configuration = {
  appId: 'com.zhengdao.app',
  productName: '证道',
  directories: {
    buildResources: 'resources',
    output: 'dist'
  },
  asarUnpack: ['node_modules/@google/gemini-cli/**'],
  extraResources: [
    {
      from: 'resources/icon.png',
      to: 'icon.png'
    },
    {
      from: 'resources/icon.ico',
      to: 'icon.ico'
    }
  ],
  npmRebuild: false,
  files: [
    '!**/.vscode/*',
    '!src/*',
    '!electron.vite.config.*',
    '!{.eslintignore,.eslintrc*,.prettierrc*,tsconfig.*}',
    '!{*.md,*.txt}'
  ],
  electronUpdaterCompatibility: '>=2.16',
  ...(ghOwner && ghRepo
    ? {
        publish: {
          provider: 'github',
          owner: ghOwner,
          repo: ghRepo,
          releaseType: 'release'
        }
      }
    : {}),
  mac: {
    icon: 'resources/icon.icns',
    artifactName: 'zhengdao-${version}-${arch}.${ext}',
    target: ['dmg', 'zip'],
    category: 'public.app-category.productivity',
    darkModeSupport: true,
    ...(hasAppleCodeSign
      ? {
          hardenedRuntime: true,
          gatekeeperAssess: false,
          entitlements: 'resources/entitlements.mac.plist',
          entitlementsInherit: 'resources/entitlements.mac.plist'
        }
      : {}),
    ...(hasAppleNotarize
      ? {
          notarize: {
            teamId: process.env.APPLE_TEAM_ID!.trim()
          }
        }
      : {})
  },
  win: {
    icon: 'resources/icon.ico',
    artifactName: 'zhengdao-${version}-${arch}-setup.${ext}',
    target: ['nsis']
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    deleteAppDataOnUninstall: false,
    installerIcon: 'resources/icon.ico',
    installerHeaderIcon: 'resources/icon.ico',
    uninstallerIcon: 'resources/icon.ico',
    uninstallDisplayName: '证道',
    shortcutName: '证道'
  },
  linux: {
    icon: 'resources/icon.png',
    artifactName: 'zhengdao-${version}.${ext}',
    target: ['AppImage'],
    category: 'Office'
  }
}

export default config
