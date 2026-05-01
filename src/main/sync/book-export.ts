import { exportBookPackageV2 } from './book-package'

export function exportBookPayload(bookId: number): Record<string, unknown> {
  return exportBookPackageV2(bookId) as unknown as Record<string, unknown>
}
