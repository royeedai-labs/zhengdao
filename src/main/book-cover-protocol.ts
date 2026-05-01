import { protocol } from 'electron'
import { BOOK_COVER_PROTOCOL, createBookCoverProtocolResponse } from './book-cover-service'

let registered = false

export function registerBookCoverProtocolScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: BOOK_COVER_PROTOCOL,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true
      }
    }
  ])
}

export function registerBookCoverProtocol(): void {
  if (registered) return
  registered = true
  protocol.handle(BOOK_COVER_PROTOCOL, (request) => createBookCoverProtocolResponse(request.url))
}
