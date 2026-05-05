import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

interface ClientPlatformFixture {
  desktop: {
    createBookRequest: {
      deviceId: string
      payloadSchemaVersion: number
      payload: {
        export_version: number
        book: Record<string, unknown>
        chapters: Array<Record<string, unknown>>
      }
    }
    updateBookRequest: {
      expectedVersion: number
      payloadSchemaVersion: number
      payload: {
        export_version: number
      }
    }
  }
  errors: {
    versionConflict: {
      status: number
      body: {
        code: string
        current?: {
          version?: number
        }
      }
    }
  }
  assistant: {
    nonStreamResponse: {
      message: {
        content: string
        metadata?: {
          authorThought?: { lines?: string[] }
        }
      }
      metadata?: {
        authorThought?: { lines?: string[] }
      }
    }
  }
}

function readClientFixture(): ClientPlatformFixture {
  return JSON.parse(
    readFileSync(
      resolve(process.cwd(), '../agentx-backend/packages/client-contracts/fixtures/client-platform-golden.json'),
      'utf8'
    )
  ) as ClientPlatformFixture
}

describe('desktop client contract parity', () => {
  it('uses the backend-owned desktop book package contract fixture', () => {
    const fixture = readClientFixture()

    expect(fixture.desktop.createBookRequest.payloadSchemaVersion).toBe(2)
    expect(fixture.desktop.createBookRequest.payload.export_version).toBe(2)
    expect(fixture.desktop.updateBookRequest.expectedVersion).toBeGreaterThan(0)
    expect(fixture.desktop.updateBookRequest.payload.export_version).toBe(2)
  })

  it('keeps the desktop sync fixture sanitized for client parity tests', () => {
    const fixtureText = readFileSync(
      resolve(process.cwd(), '../agentx-backend/packages/client-contracts/fixtures/client-platform-golden.json'),
      'utf8'
    )

    expect(fixtureText).not.toMatch(/api[_-]?key/i)
    expect(fixtureText).not.toMatch(/token/i)
    expect(fixtureText).not.toMatch(/cookie/i)
    expect(fixtureText).not.toMatch(/credential/i)
  })

  it('recognizes the shared optimistic conflict error envelope', () => {
    const fixture = readClientFixture()

    expect(fixture.errors.versionConflict.status).toBe(409)
    expect(fixture.errors.versionConflict.body.code).toBe('VERSION_CONFLICT')
    expect(fixture.errors.versionConflict.body.current?.version).toBeGreaterThan(0)
  })

  it('recognizes assistant presentation metadata without visible control markers', () => {
    const fixture = readClientFixture()

    expect(fixture.assistant.nonStreamResponse.message.content).not.toContain('<<<AUTHOR_THOUGHT_BLOCK>>>')
    expect(fixture.assistant.nonStreamResponse.message.metadata?.authorThought?.lines).toHaveLength(2)
    expect(fixture.assistant.nonStreamResponse.metadata?.authorThought?.lines).toEqual(
      fixture.assistant.nonStreamResponse.message.metadata?.authorThought?.lines
    )
  })
})
