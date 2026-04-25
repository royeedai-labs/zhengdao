import { getDb } from '../database/connection'
import * as appStateRepo from '../database/app-state-repo'
import type { ZhengdaoAuth } from '../auth/zhengdao-auth'
import { exportBookPayload } from './book-export'

const WEBSITE_URL = (process.env.ZHENGDAO_WEBSITE_URL || 'https://agent.xiangweihu.com').replace(/\/$/, '')
const API_BASE = (process.env.ZHENGDAO_API_URL || `${WEBSITE_URL}/api/v1`).replace(/\/$/, '')

export interface CloudBookFile {
  id: string
  name: string
  modifiedTime: string
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
    const message = typeof payload === 'object' && payload && 'message' in payload
      ? String((payload as { message?: string }).message)
      : text
    throw new Error(message || `官网云备份请求失败 (${res.status})`)
  }
  return payload
}

export class CloudSync {
  constructor(private auth: ZhengdaoAuth) {}

  async syncBook(bookId: number): Promise<void> {
    const token = await this.auth.getAccessToken()
    if (!token) throw new Error('请先登录证道账号')

    const db = getDb()
    const queueId = db
      .prepare(`INSERT INTO sync_queue (book_id, action, status) VALUES (?, 'upload', 'pending')`)
      .run(bookId).lastInsertRowid as number

    try {
      const payload = exportBookPayload(bookId)
      const book = payload.book as { title?: string } | undefined
      await apiRequest<{ backup: unknown }>('/backups', token, {
        method: 'POST',
        body: JSON.stringify({
          deviceId: appStateRepo.getAppState('zhengdao_device_id') || 'desktop',
          localBookId: String(bookId),
          title: book?.title || `作品 ${bookId}`,
          payload
        })
      })
      db.prepare(`UPDATE sync_queue SET status = 'completed' WHERE id = ?`).run(queueId)
      appStateRepo.setAppState(`sync_book_${bookId}`, JSON.stringify({ at: new Date().toISOString(), file: `book_${bookId}` }))
    } catch (err) {
      db.prepare(`UPDATE sync_queue SET status = 'failed' WHERE id = ?`).run(queueId)
      throw err
    }
  }

  async listCloudBooks(): Promise<CloudBookFile[]> {
    const token = await this.auth.getAccessToken()
    if (!token) throw new Error('请先登录证道账号')
    const res = await apiRequest<{
      backups: Array<{ id: string; title: string; createdAt: string }>
    }>('/backups', token)
    return res.backups.map((backup) => ({
      id: backup.id,
      name: backup.title,
      modifiedTime: backup.createdAt
    }))
  }

  async downloadBook(fileId: string): Promise<unknown> {
    const token = await this.auth.getAccessToken()
    if (!token) throw new Error('请先登录证道账号')
    const res = await apiRequest<{ backup: { payload: unknown } }>(`/backups/${encodeURIComponent(fileId)}/download`, token)
    return res.backup.payload
  }
}
