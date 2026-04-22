import type { Configuration } from 'electron-builder'

const ghOwner = process.env.GH_OWNER?.trim()
const ghRepo = process.env.GH_REPO?.trim()

const config: Configuration = {
  appId: 'com.zhengdao.app',
  productName: '证道',
  directories: {
    buildResources: 'resources',
    output: 'dist'
  },
  asarUnpack: [
    'node_modules/@google/gemini-cli/**'
  ],
  extraResources: [
    {
      from: 'resources/icon.png',
      to: 'icon.png'
    }
  ],
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
    darkModeSupport: true
  },
  win: {
    icon: 'resources/icon.ico',
    artifactName: 'zhengdao-${version}-${arch}-setup.${ext}',
    target: ['nsis']
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: 'resources/icon.ico',
    installerHeaderIcon: 'resources/icon.ico',
    uninstallerIcon: 'resources/icon.ico',
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
