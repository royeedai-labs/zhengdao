import { useEffect, useRef } from 'react'
import type { UpdateSnapshot } from '../../../../shared/update'
import { useUpdateStore } from '@/stores/update-store'
import { useToastStore } from '@/stores/toast-store'
import { useUIStore } from '@/stores/ui-store'
import { buildReadyToInstallMessage, shouldAutoOpenUpdateDialog, UPDATE_PROMPTED_VERSION_KEY } from '@/utils/update-prompt'

export default function UpdateBootstrap() {
  const setAppVersion = useUpdateStore((s) => s.setAppVersion)
  const setSnapshot = useUpdateStore((s) => s.setSnapshot)
  const promptedVersionRef = useRef<string | null>(null)
  const notifiedReadyVersionRef = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    let unsubscribe = () => void 0

    const applySnapshot = async (snapshot: UpdateSnapshot) => {
      setSnapshot(snapshot)

      if (shouldAutoOpenUpdateDialog(snapshot, promptedVersionRef.current)) {
        promptedVersionRef.current = snapshot.version
        useUIStore.getState().openModal('appSettings')
        try {
          await window.api.setAppState(UPDATE_PROMPTED_VERSION_KEY, snapshot.version!)
        } catch (error) {
          console.error('[Updater] Failed to persist prompted version:', error)
        }
      }

      if (snapshot.status === 'ready' && snapshot.version && notifiedReadyVersionRef.current !== snapshot.version) {
        notifiedReadyVersionRef.current = snapshot.version
        useToastStore.getState().addToast('info', buildReadyToInstallMessage(snapshot), 5000)
      }
    }

    void Promise.all([
      window.api.getAppVersion(),
      window.api.getAppState(UPDATE_PROMPTED_VERSION_KEY),
      window.api.getUpdateState()
    ])
      .then(([version, promptedVersion, snapshot]) => {
        if (!active) return
        setAppVersion(version)
        promptedVersionRef.current =
          typeof promptedVersion === 'string' && promptedVersion.trim() ? promptedVersion : null
        void applySnapshot(snapshot)
      })
      .catch((error) => {
        console.error('[Updater] Failed to bootstrap update state:', error)
      })

    unsubscribe = window.api.onUpdateState((snapshot) => {
      if (!active) return
      void applySnapshot(snapshot)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [setAppVersion, setSnapshot])

  return null
}
