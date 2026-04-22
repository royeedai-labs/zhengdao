type EditorSelectionLike = {
  state: {
    selection: {
      from: number
      to: number
      empty: boolean
    }
    doc: {
      textBetween: (from: number, to: number, blockSeparator?: string) => string
    }
  }
}

export function buildAiAssistantSelectionSnapshot(input: {
  currentChapterId: number | null
  editor: EditorSelectionLike | null | undefined
}) {
  if (input.currentChapterId == null) {
    return {
      text: '',
      chapterId: null,
      from: null,
      to: null
    }
  }

  if (!input.editor) {
    return {
      text: '',
      chapterId: input.currentChapterId,
      from: null,
      to: null
    }
  }

  const { from, to, empty } = input.editor.state.selection

  return {
    text: empty ? '' : input.editor.state.doc.textBetween(from, to, '\n'),
    chapterId: input.currentChapterId,
    from,
    to
  }
}
