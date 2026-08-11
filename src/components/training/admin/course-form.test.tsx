// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const createCourseAction = vi.fn()
const updateCourseAction = vi.fn()
vi.mock('@/app/training/admin/(protected)/courses/actions', () => ({
  createCourseAction: (...args: unknown[]) => createCourseAction(...args),
  updateCourseAction: (...args: unknown[]) => updateCourseAction(...args),
}))

const { CourseForm } = await import('./course-form')

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// The regression this guards: a native `type="date"` input reports "" while
// a digit-by-digit entry is still incomplete. Before the fix, the courseDate
// Controller converted that straight to `new Date('')` (Invalid Date) and
// re-rendered it through an unguarded `.toISOString()`, crashing the form.
describe('CourseForm — Date field, typed digit by digit', () => {
  it('never throws while the value is empty or partial, and shows no error mid-typing', () => {
    render(<CourseForm onSuccess={() => {}} />)
    const dateInput = screen.getByLabelText('Date') as HTMLInputElement

    // Simulates the exact intermediate state a browser reports mid-entry —
    // this is the value that used to reach `new Date(...)` unguarded.
    expect(() => fireEvent.change(dateInput, { target: { value: '' } })).not.toThrow()
    expect(dateInput).toHaveValue('')
    expect(screen.queryByText(/date is required/i)).not.toBeInTheDocument()

    expect(() => fireEvent.change(dateInput, { target: { value: '2026' } })).not.toThrow()

    expect(() => fireEvent.change(dateInput, { target: { value: '2026-03-15' } })).not.toThrow()
    expect(dateInput).toHaveValue('2026-03-15')
    expect(screen.queryByText(/date is required/i)).not.toBeInTheDocument()
  })

  it('still accepts a complete date exactly as the calendar picker would produce one', () => {
    render(<CourseForm onSuccess={() => {}} />)
    const dateInput = screen.getByLabelText('Date') as HTMLInputElement

    // A picker selection and a fully-typed date arrive at the input the
    // same way: a single onChange with a complete ISO value.
    fireEvent.change(dateInput, { target: { value: '2026-11-20' } })
    expect(dateInput).toHaveValue('2026-11-20')
  })

  it('rejects an empty required date on submit with a clear message, without crashing', async () => {
    createCourseAction.mockResolvedValue({
      success: false,
      error: 'Please fix the highlighted fields.',
      fieldErrors: { courseDate: 'Date is required.' },
    })
    render(<CourseForm onSuccess={() => {}} />)

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Test course' } })
    fireEvent.change(screen.getByLabelText('Short description'), { target: { value: 'x' } })
    fireEvent.change(screen.getByLabelText('Full description'), { target: { value: 'x' } })
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '' } })

    fireEvent.click(screen.getByRole('button', { name: 'Create course' }))

    await waitFor(() => expect(screen.getByText('Date is required.')).toBeInTheDocument())
    expect(createCourseAction).toHaveBeenCalledTimes(1)
    expect(createCourseAction.mock.calls[0]![0]).toMatchObject({ courseDate: '' })
  })
})

function enableMultiDay() {
  fireEvent.click(screen.getByRole('switch', { name: 'Multi-day course' }))
}

describe('CourseForm — multi-day session dates, typed digit by digit', () => {
  it('never throws while the new-session-date value is empty or partial', () => {
    render(<CourseForm onSuccess={() => {}} />)
    enableMultiDay()

    const sessionInput = screen.getByLabelText('Session dates') as HTMLInputElement
    expect(() => fireEvent.change(sessionInput, { target: { value: '' } })).not.toThrow()
    expect(() => fireEvent.change(sessionInput, { target: { value: '2026-0' } })).not.toThrow()
  })

  it('can still add a fully-typed session date, same as a picker selection would', () => {
    render(<CourseForm onSuccess={() => {}} />)
    enableMultiDay()

    const sessionInput = screen.getByLabelText('Session dates') as HTMLInputElement
    fireEvent.change(sessionInput, { target: { value: '2026-09-05' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add date' }))

    expect(screen.getByText('5 Sept 2026')).toBeInTheDocument()
    expect(screen.getByText(/1 session — starts 5 Sept 2026/)).toBeInTheDocument()
  })

  it('does not add anything when Add date is clicked while the field is still empty', () => {
    render(<CourseForm onSuccess={() => {}} />)
    enableMultiDay()

    fireEvent.click(screen.getByRole('button', { name: 'Add date' }))

    expect(screen.getByText('0 sessions')).toBeInTheDocument()
  })
})
