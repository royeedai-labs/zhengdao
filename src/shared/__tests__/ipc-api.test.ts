import { describe, expect, it } from 'vitest'
import {
  IPC_INVOKE_CHANNELS,
  IPC_RECEIVE_CHANNELS,
  IPC_SEND_CHANNELS,
  type IpcInvokeChannel,
  type IpcReceiveChannel,
  type IpcSendChannel
} from '../ipc-api'

/**
 * SPLIT-009 — IPC channel inventory contract test.
 *
 * The literal unions and the runtime arrays must stay in sync. A type
 * mismatch here means someone added a channel to one and forgot the
 * other; the TS compiler catches the overflow direction (an invalid
 * literal in the array fails to assign to readonly Channel[]) and this
 * test catches the underflow direction (a missing channel) by counting.
 */

describe('IPC channel registry', () => {
  it('IPC_INVOKE_CHANNELS has no duplicates', () => {
    expect(new Set(IPC_INVOKE_CHANNELS).size).toBe(IPC_INVOKE_CHANNELS.length)
  })

  it('IPC_SEND_CHANNELS has no duplicates', () => {
    expect(new Set(IPC_SEND_CHANNELS).size).toBe(IPC_SEND_CHANNELS.length)
  })

  it('IPC_RECEIVE_CHANNELS has no duplicates', () => {
    expect(new Set(IPC_RECEIVE_CHANNELS).size).toBe(IPC_RECEIVE_CHANNELS.length)
  })

  it('every invoke channel uses a colon-separated namespace prefix', () => {
    const allowedPrefixes = new Set([
      'db', 'ai', 'auth', 'team', 'app', 'window', 'sync', 'backup', 'data',
      'fs', 'dialog', 'export'
    ])
    for (const ch of IPC_INVOKE_CHANNELS) {
      const [prefix] = ch.split(':')
      expect(allowedPrefixes.has(prefix), `unknown prefix in ${ch}`).toBe(true)
    }
  })

  it('the three channel arrays are mutually disjoint for invoke vs send', () => {
    // ai:streamComplete is intentionally on both IPC_SEND_CHANNELS (renderer
    // → main initiation) and IPC_RECEIVE_CHANNELS (main → renderer
    // completion). All other names should be unique across categories.
    const invokeSet = new Set<string>(IPC_INVOKE_CHANNELS)
    for (const ch of IPC_SEND_CHANNELS) {
      expect(invokeSet.has(ch), `${ch} should not be both invoke and send`).toBe(false)
    }
  })

  it('per-prefix counts stay in lockstep with the documented register-*-ipc surface', () => {
    const counts: Record<string, number> = {}
    for (const ch of IPC_INVOKE_CHANNELS) {
      const [prefix] = ch.split(':')
      counts[prefix] = (counts[prefix] ?? 0) + 1
    }

    // Numbers below mirror the comment in src/main/ipc-handlers.ts. Update
    // both this expectation and the registry literal union when adding a
    // handler — that's the whole point of the contract.
    expect(counts).toEqual({
      db: 103,
      ai: 28,
      auth: 6,
      team: 8,
      app: 7,
      window: 5,
      sync: 3,
      backup: 5,
      data: 2,
      fs: 1,
      dialog: 3,
      export: 1
    })
  })
})

// Type-level checks: each runtime array element must be assignable to the
// matching literal union; if you add a string to the array that the union
// doesn't list, this fails at typecheck — making the boundary contract
// type-safe even before vitest runs.
const _typeCheckInvoke: ReadonlyArray<IpcInvokeChannel> = IPC_INVOKE_CHANNELS
const _typeCheckSend: ReadonlyArray<IpcSendChannel> = IPC_SEND_CHANNELS
const _typeCheckReceive: ReadonlyArray<IpcReceiveChannel> = IPC_RECEIVE_CHANNELS

void _typeCheckInvoke
void _typeCheckSend
void _typeCheckReceive
