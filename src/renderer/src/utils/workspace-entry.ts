export interface WorkspaceEntryInput {
  onboardingDone: boolean
  pendingOnboarding: boolean
}

export interface WorkspaceEntryDecision {
  showOnboarding: boolean
  markOnboardingDone: boolean
  clearPendingOnboarding: boolean
}

export function decideWorkspaceEntry(input: WorkspaceEntryInput): WorkspaceEntryDecision {
  if (!input.onboardingDone && input.pendingOnboarding) {
    return {
      showOnboarding: true,
      markOnboardingDone: true,
      clearPendingOnboarding: true
    }
  }

  return {
    showOnboarding: false,
    markOnboardingDone: false,
    clearPendingOnboarding: false
  }
}
