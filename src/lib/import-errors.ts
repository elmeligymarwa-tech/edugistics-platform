/** Formats an `importProject` validation error string into readable, itemised messages. */
export function formatImportErrors(error: string): string[] {
  try {
    const parsed: unknown = JSON.parse(error)
    if (Array.isArray(parsed)) {
      return parsed.map((issue) => {
        const record = issue as { path?: unknown; message?: unknown }
        const path =
          Array.isArray(record.path) && record.path.length > 0 ? record.path.join('.') : 'project'
        return `${path}: ${typeof record.message === 'string' ? record.message : 'Invalid value'}`
      })
    }
  } catch {
    // Not a JSON issue list — fall through to the raw message below.
  }
  return [error]
}
