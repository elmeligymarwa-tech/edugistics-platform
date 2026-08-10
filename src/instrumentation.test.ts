import { afterEach, describe, expect, it, vi } from 'vitest'

const findMissingEmailConfigVarsMock = vi.fn<() => string[]>()
vi.mock('@/lib/training/email/resend-client', () => ({
  findMissingEmailConfigVars: () => findMissingEmailConfigVarsMock(),
}))

const { register } = await import('./instrumentation')

afterEach(() => {
  vi.restoreAllMocks()
  findMissingEmailConfigVarsMock.mockReset()
})

describe('register', () => {
  it('logs nothing when every required email variable is configured', async () => {
    findMissingEmailConfigVarsMock.mockReturnValue([])
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await register()

    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('warns, naming every missing variable, when configuration is incomplete', async () => {
    findMissingEmailConfigVarsMock.mockReturnValue(['MARKETING_EMAIL_FROM', 'EMAIL_FROM'])
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await register()

    expect(warnSpy).toHaveBeenCalledTimes(1)
    const message = warnSpy.mock.calls[0]![0] as string
    expect(message).toContain('MARKETING_EMAIL_FROM')
    expect(message).toContain('EMAIL_FROM')
  })
})
