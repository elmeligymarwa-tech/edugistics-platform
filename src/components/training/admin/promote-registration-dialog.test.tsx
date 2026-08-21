// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}))

const promoteRegistrationAction = vi.fn()
vi.mock('@/app/training/admin/(protected)/courses/[id]/waitlist/actions', () => ({
  promoteRegistrationAction: (...args: unknown[]) => promoteRegistrationAction(...args),
}))

const { PromoteRegistrationDialog } = await import('./promote-registration-dialog')

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderDialog(overrides: Partial<React.ComponentProps<typeof PromoteRegistrationDialog>> = {}) {
  const onOpenChange = vi.fn()
  const onPromoted = vi.fn()
  render(
    <PromoteRegistrationDialog
      open
      onOpenChange={onOpenChange}
      registrationId="reg-1"
      fullName="Jane Teacher"
      onPromoted={onPromoted}
      {...overrides}
    />,
  )
  return { onOpenChange, onPromoted }
}

describe('PromoteRegistrationDialog', () => {
  it('defaults the send-email choice to checked, since promoting off an active waitlist usually wants the email', () => {
    renderDialog()
    const checkbox = screen.getByRole('checkbox', { name: /send jane teacher the confirmation email now/i })
    expect(checkbox).toHaveAttribute('aria-checked', 'true')
  })

  it('promotes with sendEmail: true by default when confirmed', async () => {
    promoteRegistrationAction.mockResolvedValue({ success: true, data: { discountLost: false } })
    renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Promote' }))

    await waitFor(() => expect(promoteRegistrationAction).toHaveBeenCalledWith('reg-1', { override: false, sendEmail: true }))
  })

  it('promotes with sendEmail: false once the checkbox is unchecked — never automatic', async () => {
    promoteRegistrationAction.mockResolvedValue({ success: true, data: { discountLost: false } })
    renderDialog()

    fireEvent.click(screen.getByRole('checkbox', { name: /send jane teacher the confirmation email now/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Promote' }))

    await waitFor(() => expect(promoteRegistrationAction).toHaveBeenCalledWith('reg-1', { override: false, sendEmail: false }))
  })

  it('calls onOpenChange(false) and onPromoted on success', async () => {
    promoteRegistrationAction.mockResolvedValue({ success: true, data: { discountLost: true } })
    const { onOpenChange, onPromoted } = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Promote' }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(onPromoted).toHaveBeenCalledWith({ discountLost: true })
  })

  it('switches to a capacity-blocked confirmation, and overriding sends override: true with the same email choice', async () => {
    promoteRegistrationAction.mockResolvedValueOnce({ success: false, error: 'blocked', blockedAtCapacity: true })
    promoteRegistrationAction.mockResolvedValueOnce({ success: true, data: { discountLost: false } })
    renderDialog()

    fireEvent.click(screen.getByRole('checkbox', { name: /send jane teacher the confirmation email now/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Promote' }))

    await waitFor(() => expect(screen.getByText('This course is at capacity')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Promote anyway' }))

    await waitFor(() =>
      expect(promoteRegistrationAction).toHaveBeenLastCalledWith('reg-1', { override: true, sendEmail: false }),
    )
  })

  it('shows the server error and does not close the dialog on a non-capacity failure', async () => {
    promoteRegistrationAction.mockResolvedValue({ success: false, error: 'This registration is no longer on the waiting list.' })
    const { onOpenChange } = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Promote' }))

    await waitFor(() => expect(screen.getByText('This registration is no longer on the waiting list.')).toBeInTheDocument())
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
