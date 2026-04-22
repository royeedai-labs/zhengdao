import { describe, expect, it } from 'vitest'
import { decideWorkspaceEntry } from '../workspace-entry'

describe('decideWorkspaceEntry', () => {
  it('shows onboarding first and skips overview when onboarding has not completed', () => {
    expect(
      decideWorkspaceEntry({
        onboardingDone: false,
        pendingOnboarding: true
      })
    ).toEqual({
      showOnboarding: true,
      markOnboardingDone: true,
      clearPendingOnboarding: true
    })
  })

  it('goes straight into the workspace after onboarding without auto-opening overview', () => {
    expect(
      decideWorkspaceEntry({
        onboardingDone: true,
        pendingOnboarding: false
      })
    ).toEqual({
      showOnboarding: false,
      markOnboardingDone: false,
      clearPendingOnboarding: false
    })
  })

  it('keeps the post-onboarding path minimal', () => {
    expect(
      decideWorkspaceEntry({
        onboardingDone: true,
        pendingOnboarding: false
      })
    ).toEqual({
      showOnboarding: false,
      markOnboardingDone: false,
      clearPendingOnboarding: false
    })
  })
})
