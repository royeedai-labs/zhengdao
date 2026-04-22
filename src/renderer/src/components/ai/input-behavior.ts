export function shouldSubmitAiAssistantInput(event: {
  key: string
  shiftKey: boolean
  nativeEvent?: { isComposing?: boolean }
}): boolean {
  if (event.key !== 'Enter') return false
  if (event.shiftKey) return false
  if (event.nativeEvent?.isComposing) return false
  return true
}
