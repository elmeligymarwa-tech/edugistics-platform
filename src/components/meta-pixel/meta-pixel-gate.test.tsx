// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }))
vi.mock('next/navigation', () => ({ usePathname }))

// next/script's real implementation dedupes DOM script insertion by `id` in a
// module-level cache, so re-rendering with the same static id across
// sequential tests in one process would only ever insert once. Mocking it
// out lets these tests verify what MetaPixelGate itself decides to render —
// the actual gating logic — independent of Next's own script-loading
// mechanics (which are Next's to test, not ours).
vi.mock('next/script', () => ({
  default: ({ id, children }: { id?: string; children?: string }) => (
    <div data-testid="meta-pixel-script" data-script-id={id}>
      {children}
    </div>
  ),
}))

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.resetModules()
})

async function renderGate(pixelId: string | undefined, pathname: string) {
  vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', pixelId ?? '')
  usePathname.mockReturnValue(pathname)
  const { MetaPixelGate } = await import('./meta-pixel-gate')
  return render(<MetaPixelGate />)
}

describe('MetaPixelGate', () => {
  it('is present on the landing page, and injects the configured pixel id', async () => {
    const { queryByTestId } = await renderGate('123456', '/')
    const script = queryByTestId('meta-pixel-script')
    expect(script).not.toBeNull()
    expect(script?.textContent).toContain("fbq('init', '123456')")
  })

  it('is present on /training', async () => {
    const { queryByTestId } = await renderGate('123456', '/training')
    expect(queryByTestId('meta-pixel-script')).not.toBeNull()
  })

  it('is present on /training/privacy', async () => {
    const { queryByTestId } = await renderGate('123456', '/training/privacy')
    expect(queryByTestId('meta-pixel-script')).not.toBeNull()
  })

  it('is present on /unsubscribe', async () => {
    const { queryByTestId } = await renderGate('123456', '/unsubscribe')
    expect(queryByTestId('meta-pixel-script')).not.toBeNull()
  })

  it('is absent from every /training/admin route', async () => {
    for (const pathname of ['/training/admin', '/training/admin/login', '/training/admin/registrations']) {
      const { queryByTestId, unmount } = await renderGate('123456', pathname)
      expect(queryByTestId('meta-pixel-script')).toBeNull()
      unmount()
    }
  })

  it('is absent from every /app route', async () => {
    for (const pathname of ['/app', '/app/dashboard', '/app/setup']) {
      const { queryByTestId, unmount } = await renderGate('123456', pathname)
      expect(queryByTestId('meta-pixel-script')).toBeNull()
      unmount()
    }
  })

  it('does not render, and the app still works, when NEXT_PUBLIC_META_PIXEL_ID is absent', async () => {
    const { queryByTestId, container } = await renderGate(undefined, '/')
    expect(queryByTestId('meta-pixel-script')).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })
})
