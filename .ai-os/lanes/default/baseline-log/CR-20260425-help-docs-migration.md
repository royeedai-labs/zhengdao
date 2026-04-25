# CR-20260425-help-docs-migration

## Change

Remove the desktop app's built-in usage-help surface now that product
documentation is moving to the website docs center.

## Scope

- Remove the `help` modal route and `HelpModal` wiring from the renderer.
- Remove F1 / shortcut-store help binding.
- Remove account menu and command palette entries that open built-in help.
- Keep onboarding auto-tour behavior and all local writing, import/export,
  backup, snapshot, and editor capabilities intact.

## Out of Scope

- No new external-link IPC.
- No removal of TXT, DOCX, PDF, Markdown, HTML import/export workflows.
- No database schema or main-process data behavior changes.

## Validation

- `npm test`
- `npm run build`
- Static search for stale `help` modal references.
