import { randomUUID } from 'crypto'
import * as appStateRepo from '../database/app-state-repo'
import type { ZhengdaoAuth } from '../auth/zhengdao-auth'
import * as bookRepo from '../database/book-repo'
import { exportBookPayload } from './book-export'
import {
  computeBookPayloadHash,
  importBookPackageV2,
  DESKTOP_BOOK_PACKAGE_VERSION
} from './book-package'

const WEBSITE_URL = (process.env.ZHENGDAO_WEBSITE_URL || 'https://agent.xiangweihu.com').replace(/\/$/, '')
const API_BASE = (process.env.ZHENGDAO_API_URL || `${WEBSITE_URL}/api/v1`).replace(/\/$/, '')
const SYNC_TOGGLE_KEY = 'zhengdao_sync_enabled'
const DEVICE_ID_KEY = 'zhengdao_device_id'

export interface CloudBookFile {
  id: string
  name: string
  modifiedTime: string
  version?: number
  archivedAt?: string | null
}

interface CloudBookSummary {
  id: string
  title: string
  author: string
  payloadSchemaVersion: number
  payloadHash: string
  version: number
  lastDeviceId: string | null
  archivedAt: string | null
  updatedAt: string
}

interface CloudBookDetail extends CloudBookSummary {
  payload: unknown
}

export interface SyncBookResult {
  status: 'created' | 'uploaded' | 'downloaded' | 'conflict' | 'archived' | 'skipped'
  bookId?: number
  cloudBookId?: string
  message?: string
}

export interface SyncAllBooksResult {
  ok: true
  skipped?: string
  results: SyncBookResult[]
}

class CloudVersionConflict extends Error {
  constructor(readonly current: CloudBookSummary | null) {
    super('Cloud book changed on another device')
    this.name = 'CloudVersionConflict'
  }
}

async function apiRequest<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  })
  const text = await res.text()
  const payload = text ? JSON.parse(text) as T : ({} as T)
  if (!res.ok) {
    if (res.status === 409 && typeof payload === 'object' && payload && (payload as { code?: string }).code === 'VERSION_CONFLICT') {
      throw new CloudVersionConflict(((payload as { current?: CloudBookSummary }).current ?? null))
    }
    const message = typeof payload === 'object' && payload && 'message' in payload
      ? String((payload as { message?: string }).message)
      : text
    throw new Error(message || `官网云备份请求失败 (${res.status})`)
  }
  return payload
}

export class CloudSync {
  private timer: NodeJS.Timeout | null = null

  constructor(private auth: ZhengdaoAuth) {}

  startBackgroundSync(intervalMs = 5 * 60 * 1000): void {
    if (this.timer) return
    setTimeout(() => {
      void this.syncAllBooks().catch((error) => console.warn('[CloudSync] initial sync skipped', error))
    }, 15_000)
    this.timer = setInterval(() => {
      void this.syncAllBooks().catch((error) => console.warn('[CloudSync] background sync skipped', error))
    }, intervalMs)
  }

  async syncBook(bookId: number): Promise<SyncBookResult> {
    const token = await this.auth.getAccessToken()
    if (!token) throw new Error('请先登录证道账号')
    await this.assertSyncEntitlement()

    const book = bookRepo.getBookById(bookId)
    if (!book) throw new Error(`Book ${bookId} not found`)
    if (book.archived_at) return { status: 'skipped', bookId, message: '作品已归档' }

    try {
      const payload = exportBookPayload(bookId)
      const payloadHash = computeBookPayloadHash(payload)
      const title = String((payload.book as { title?: unknown } | undefined)?.title || book.title || `作品 ${bookId}`)
      const author = String((payload.book as { author?: unknown } | undefined)?.author || book.author || '')
      const deviceId = this.getOrCreateDeviceId()

      const cloudBookId = typeof book.cloud_book_id === 'string' && book.cloud_book_id ? book.cloud_book_id : null
      const result = cloudBookId
        ? await apiRequest<{ book: CloudBookDetail }>(`/desktop-sync/books/${encodeURIComponent(cloudBookId)}`, token, {
            method: 'PUT',
            body: JSON.stringify({
              deviceId,
              expectedVersion: Number(book.cloud_sync_version || 0),
              title,
              author,
              payloadSchemaVersion: DESKTOP_BOOK_PACKAGE_VERSION,
              payload
            })
          })
        : await apiRequest<{ book: CloudBookDetail }>('/desktop-sync/books', token, {
            method: 'POST',
            body: JSON.stringify({
              deviceId,
              title,
              author,
              payloadSchemaVersion: DESKTOP_BOOK_PACKAGE_VERSION,
              payload
            })
          })

      this.markSynced(bookId, result.book, payloadHash)
      return {
        status: cloudBookId ? 'uploaded' : 'created',
        bookId,
        cloudBookId: result.book.id
      }
    } catch (err) {
      if (err instanceof CloudVersionConflict && err.current) {
        return this.createConflictCopy(bookId, err.current, token)
      }
      bookRepo.markBookSyncStatus(bookId, 'error')
      throw err
    }
  }

  async syncAllBooks(options: { force?: boolean } = {}): Promise<SyncAllBooksResult> {
    const token = await this.auth.getAccessToken()
    if (!token) return { ok: true, skipped: 'not_authenticated', results: [] }
    const user = await this.auth.getUser()
    if (!this.hasSyncEntitlement(user)) return { ok: true, skipped: 'not_pro', results: [] }
    if (!options.force && !this.isAutoSyncEnabled(user)) {
      return { ok: true, skipped: 'disabled', results: [] }
    }

    const cloudBooks = await this.listDesktopCloudBooks(token, true)
    const remoteById = new Map(cloudBooks.map((book) => [book.id, book]))
    const localBooks = bookRepo.getBooks({ includeArchived: true }) as Array<Record<string, any>>
    const localByCloudId = new Map<string, Record<string, any>>()
    const results: SyncBookResult[] = []

    for (const local of localBooks) {
      if (local.cloud_book_id) localByCloudId.set(String(local.cloud_book_id), local)
    }

    for (const local of localBooks) {
      if (local.archived_at) continue
      if (!local.cloud_book_id) {
        results.push(await this.syncBook(Number(local.id)))
        continue
      }

      const remote = remoteById.get(String(local.cloud_book_id))
      if (!remote) {
        bookRepo.clearBookCloudSync(Number(local.id))
        results.push(await this.syncBook(Number(local.id)))
        continue
      }
      if (remote.archivedAt) {
        bookRepo.archiveBookLocal(Number(local.id), 'archived')
        this.markSynced(Number(local.id), remote, String(local.cloud_payload_hash || ''))
        results.push({ status: 'archived', bookId: Number(local.id), cloudBookId: remote.id })
        continue
      }

      const payload = exportBookPayload(Number(local.id))
      const localHash = computeBookPayloadHash(payload)
      const localDirty = localHash !== String(local.cloud_payload_hash || '')
      const remoteNewer = Number(remote.version) > Number(local.cloud_sync_version || 0)

      if (remoteNewer && localDirty) {
        results.push(await this.createConflictCopy(Number(local.id), remote, token))
      } else if (remoteNewer) {
        const detail = await this.getDesktopCloudBook(token, remote.id)
        const imported = importBookPackageV2(detail.payload, {
          targetBookId: Number(local.id),
          syncMetadata: this.syncMetadata(detail, computeBookPayloadHash(detail.payload))
        })
        results.push({ status: 'downloaded', bookId: imported.bookId, cloudBookId: detail.id })
      } else if (localDirty) {
        results.push(await this.syncBook(Number(local.id)))
      }
    }

    for (const remote of cloudBooks) {
      if (remote.archivedAt || localByCloudId.has(remote.id)) continue
      const detail = await this.getDesktopCloudBook(token, remote.id)
      const imported = importBookPackageV2(detail.payload, {
        syncMetadata: this.syncMetadata(detail, computeBookPayloadHash(detail.payload))
      })
      results.push({ status: 'downloaded', bookId: imported.bookId, cloudBookId: detail.id })
    }

    return { ok: true, results }
  }

  async listCloudBooks(): Promise<CloudBookFile[]> {
    const token = await this.auth.getAccessToken()
    if (!token) throw new Error('请先登录证道账号')
    const books = await this.listDesktopCloudBooks(token, true)
    return books.map((book) => ({
      id: book.id,
      name: book.title,
      modifiedTime: book.updatedAt,
      version: book.version,
      archivedAt: book.archivedAt
    }))
  }

  async downloadBook(fileId: string): Promise<unknown> {
    const token = await this.auth.getAccessToken()
    if (!token) throw new Error('请先登录证道账号')
    const res = await this.getDesktopCloudBook(token, fileId)
    return res.payload
  }

  async archiveLocalBook(bookId: number): Promise<SyncBookResult> {
    const book = bookRepo.getBookById(bookId)
    if (!book) throw new Error(`Book ${bookId} not found`)
    const cloudBookId = typeof book.cloud_book_id === 'string' && book.cloud_book_id ? book.cloud_book_id : null
    if (!cloudBookId) {
      bookRepo.deleteBook(bookId)
      return { status: 'archived', bookId }
    }

    const token = await this.auth.getAccessToken()
    if (!token) throw new Error('请先登录证道账号')
    await this.assertSyncEntitlement()
    const res = await apiRequest<{ book: CloudBookSummary }>(`/desktop-sync/books/${encodeURIComponent(cloudBookId)}/archive`, token, {
      method: 'PATCH',
      body: JSON.stringify({ deviceId: this.getOrCreateDeviceId() })
    })
    this.markSynced(bookId, res.book, String(book.cloud_payload_hash || ''))
    bookRepo.archiveBookLocal(bookId, 'archived')
    return { status: 'archived', bookId, cloudBookId }
  }

  private async listDesktopCloudBooks(token: string, includeArchived: boolean): Promise<CloudBookSummary[]> {
    const res = await apiRequest<{ books: CloudBookSummary[] }>(
      `/desktop-sync/books?includeArchived=${includeArchived ? 'true' : 'false'}`,
      token
    )
    return res.books
  }

  private async getDesktopCloudBook(token: string, cloudBookId: string): Promise<CloudBookDetail> {
    const res = await apiRequest<{ book: CloudBookDetail }>(`/desktop-sync/books/${encodeURIComponent(cloudBookId)}`, token)
    return res.book
  }

  private async createConflictCopy(bookId: number, remote: CloudBookSummary, token: string): Promise<SyncBookResult> {
    const detail = await this.getDesktopCloudBook(token, remote.id)
    const suffix = `（云端冲突副本 ${new Date().toISOString().slice(0, 19).replace('T', ' ')}）`
    const imported = importBookPackageV2(detail.payload, {
      titleSuffix: suffix,
      detachCloudLinkFromBookId: bookId,
      syncMetadata: this.syncMetadata(detail, computeBookPayloadHash(detail.payload))
    })
    return {
      status: 'conflict',
      bookId,
      cloudBookId: remote.id,
      message: `云端版本已另存为《${imported.title}》`
    }
  }

  private markSynced(bookId: number, cloudBook: CloudBookSummary, payloadHash: string): void {
    bookRepo.markBookCloudSync(bookId, this.syncMetadata(cloudBook, payloadHash))
    appStateRepo.setAppState(
      `sync_book_${bookId}`,
      JSON.stringify({ at: new Date().toISOString(), file: cloudBook.id, version: cloudBook.version })
    )
  }

  private syncMetadata(
    cloudBook: CloudBookSummary,
    payloadHash: string,
    status: bookRepo.BookSyncMetadata['cloudSyncStatus'] = cloudBook.archivedAt ? 'archived' : 'synced'
  ): bookRepo.BookSyncMetadata {
    return {
      cloudBookId: cloudBook.id,
      cloudSyncVersion: cloudBook.version,
      cloudPayloadHash: payloadHash,
      cloudUpdatedAt: cloudBook.updatedAt,
      cloudSyncStatus: status,
      archivedAt: cloudBook.archivedAt
    }
  }

  private getOrCreateDeviceId(): string {
    const existing = appStateRepo.getAppState(DEVICE_ID_KEY)
    if (existing) return existing
    const next = randomUUID()
    appStateRepo.setAppState(DEVICE_ID_KEY, next)
    return next
  }

  private isAutoSyncEnabled(user: Awaited<ReturnType<ZhengdaoAuth['getUser']>>): boolean {
    const raw = appStateRepo.getAppState(SYNC_TOGGLE_KEY)
    if (raw === null) return this.hasSyncEntitlement(user)
    return raw === '1'
  }

  private async assertSyncEntitlement(): Promise<void> {
    const user = await this.auth.getUser()
    if (!this.hasSyncEntitlement(user)) throw new Error('当前账号需要 Pro 或 Team 权益才能使用官方云同步')
  }

  private hasSyncEntitlement(user: Awaited<ReturnType<ZhengdaoAuth['getUser']>>): boolean {
    return Boolean(user && (user.pro || user.tier === 'pro' || user.tier === 'team'))
  }
}
