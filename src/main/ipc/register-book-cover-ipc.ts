import { ipcMain } from 'electron'
import {
  chooseCoverImageForBook,
  pickCoverImage,
  regenerateAutoCoverForBook
} from '../book-cover-service'

export function registerBookCoverIpc(): void {
  ipcMain.handle('book:pickCoverImage', () => pickCoverImage())
  ipcMain.handle('book:chooseCoverImage', (_, bookId: number) => chooseCoverImageForBook(bookId))
  ipcMain.handle('book:regenerateAutoCover', (_, bookId: number) => regenerateAutoCoverForBook(bookId))
}
