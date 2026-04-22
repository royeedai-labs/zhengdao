import { describe, expect, it } from 'vitest'
import { createIdleUpdateSnapshot, reduceUpdateSnapshot } from '../update'

describe('reduceUpdateSnapshot', () => {
  it('transitions from checking to available to downloading to ready with release info', () => {
    const checking = reduceUpdateSnapshot(createIdleUpdateSnapshot(), { type: 'checking' })
    const available = reduceUpdateSnapshot(checking, {
      type: 'update-available',
      payload: {
        version: '1.2.3',
        releaseDate: '2026-04-20T12:00:00.000Z',
        releaseNotes: '修复在线更新'
      }
    })
    const downloading = reduceUpdateSnapshot(available, { type: 'download-started' })
    const ready = reduceUpdateSnapshot(downloading, {
      type: 'update-downloaded',
      payload: {
        version: '1.2.3',
        releaseDate: '2026-04-20T12:00:00.000Z',
        releaseNotes: '修复在线更新'
      }
    })

    expect(checking).toMatchObject({ status: 'checking' })
    expect(available).toMatchObject({
      status: 'available',
      version: '1.2.3',
      releaseDate: '2026-04-20T12:00:00.000Z',
      releaseNotesSummary: '修复在线更新'
    })
    expect(downloading).toMatchObject({
      status: 'downloading',
      version: '1.2.3',
      releaseDate: '2026-04-20T12:00:00.000Z',
      releaseNotesSummary: '修复在线更新'
    })
    expect(ready).toMatchObject({
      status: 'ready',
      version: '1.2.3',
      releaseDate: '2026-04-20T12:00:00.000Z',
      releaseNotesSummary: '修复在线更新'
    })
  })

  it('returns to idle when no update is available and keeps metadata on retryable failures', () => {
    const checking = reduceUpdateSnapshot(createIdleUpdateSnapshot(), { type: 'checking' })
    const idle = reduceUpdateSnapshot(checking, { type: 'update-not-available' })
    const available = reduceUpdateSnapshot(checking, {
      type: 'update-available',
      payload: {
        version: '1.2.3',
        releaseDate: '2026-04-20T12:00:00.000Z',
        releaseNotes: '修复在线更新'
      }
    })
    const errored = reduceUpdateSnapshot(available, {
      type: 'error',
      errorMessage: 'network down',
      recoveryAction: 'download'
    })
    const installing = reduceUpdateSnapshot(
      reduceUpdateSnapshot(available, {
        type: 'update-downloaded',
        payload: {
          version: '1.2.3',
          releaseDate: '2026-04-20T12:00:00.000Z',
          releaseNotes: '修复在线更新'
        }
      }),
      { type: 'installing' }
    )
    const installFailed = reduceUpdateSnapshot(installing, {
      type: 'install-failed',
      errorMessage: '未能自动退出，请手动关闭应用后重试'
    })

    expect(idle).toEqual(createIdleUpdateSnapshot())
    expect(errored).toMatchObject({
      status: 'error',
      version: '1.2.3',
      releaseNotesSummary: '修复在线更新',
      errorMessage: 'network down',
      errorRecoveryAction: 'download'
    })
    expect(installFailed).toMatchObject({
      status: 'ready',
      version: '1.2.3',
      errorMessage: '未能自动退出，请手动关闭应用后重试',
      errorRecoveryAction: 'install'
    })
  })
})
