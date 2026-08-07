// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import { useProjectStore } from '@/store/project-store'
import { createStaffPosition } from './create-staff-position'
import { PositionEditor } from './position-editor'

function StaffingHarness({ projectId }: { projectId: string }) {
  const project = useProjectStore((state) => state.projects[projectId])
  if (!project) return null
  return <PositionEditor project={project} />
}

beforeEach(() => {
  useProjectStore.setState({ projects: {}, costModels: {}, capitalModels: {}, scenarios: {}, activeProjectId: null })
  // react-virtual reads offsetHeight/offsetWidth to size its viewport; jsdom reports 0 for
  // both, which would make the grid render no rows at all.
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 400 })
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 800 })
})

afterEach(() => {
  cleanup()
})

describe('PositionEditor', () => {
  it('removes a position from the store when its delete icon is clicked', () => {
    const id = useProjectStore.getState().createProject('Delete Test School')
    useProjectStore.getState().updateStaffing(id, {
      positions: [
        createStaffPosition({ id: 'pos-teacher', title: 'Teacher', section: 'teaching', headcount: 2 }),
        createStaffPosition({ id: 'pos-principal', title: 'Principal', section: 'leadership', headcount: 1 }),
      ],
    })

    render(<StaffingHarness projectId={id} />)

    const grid = screen.getByRole('grid', { name: 'Staff positions' })
    const cell = within(grid).getByText('Teacher').closest('[role="gridcell"]')
    if (!cell) throw new Error('No gridcell ancestor found for "Teacher"')

    const removeButton = within(cell as HTMLElement).getByRole('button', { name: 'Remove Teacher' })
    fireEvent.mouseDown(removeButton)
    fireEvent.click(removeButton)

    expect(
      useProjectStore.getState().projects[id]?.staffing.positions.map((position) => position.title),
    ).toEqual(['Principal'])
    expect(within(grid).queryByText('Teacher')).not.toBeInTheDocument()
  })

  it('duplicates a position with a numeric suffix, skipping any suffix already taken', () => {
    const id = useProjectStore.getState().createProject('Duplicate Test School')
    useProjectStore.getState().updateStaffing(id, {
      positions: [
        createStaffPosition({ id: 'pos-eyfs-1', title: 'EYFS 1 Teacher', section: 'teaching', headcount: 1 }),
      ],
    })

    render(<StaffingHarness projectId={id} />)

    const grid = screen.getByRole('grid', { name: 'Staff positions' })
    const cell = within(grid).getByText('EYFS 1 Teacher').closest('[role="gridcell"]')
    if (!cell) throw new Error('No gridcell ancestor found for "EYFS 1 Teacher"')

    const duplicateButton = within(cell as HTMLElement).getByRole('button', { name: 'Duplicate EYFS 1 Teacher' })
    fireEvent.mouseDown(duplicateButton)
    fireEvent.click(duplicateButton)

    expect(
      useProjectStore.getState().projects[id]?.staffing.positions.map((position) => position.title),
    ).toEqual(['EYFS 1 Teacher', 'EYFS 1 Teacher 2'])

    // Duplicating the original again must skip straight to 3 rather than colliding with the
    // "EYFS 1 Teacher 2" that already exists. The new copy is inserted right after the
    // original, same as the first duplicate, landing ahead of "EYFS 1 Teacher 2".
    fireEvent.mouseDown(duplicateButton)
    fireEvent.click(duplicateButton)

    expect(
      useProjectStore.getState().projects[id]?.staffing.positions.map((position) => position.title),
    ).toEqual(['EYFS 1 Teacher', 'EYFS 1 Teacher 3', 'EYFS 1 Teacher 2'])
  })

  it('does not enter edit mode on the title cell when the delete icon is clicked', () => {
    const id = useProjectStore.getState().createProject('Edit Guard School')
    useProjectStore.getState().updateStaffing(id, {
      positions: [createStaffPosition({ id: 'pos-teacher', title: 'Teacher', section: 'teaching', headcount: 2 })],
    })

    render(<StaffingHarness projectId={id} />)

    const grid = screen.getByRole('grid', { name: 'Staff positions' })
    const cell = within(grid).getByText('Teacher').closest('[role="gridcell"]')
    if (!cell) throw new Error('No gridcell ancestor found for "Teacher"')

    const removeButton = within(cell as HTMLElement).getByRole('button', { name: 'Remove Teacher' })
    fireEvent.mouseDown(removeButton)

    // The cell must stay in its rendered (non-editing) state — no text input should replace
    // the title span, otherwise the button underneath it would unmount before its click fires.
    expect(within(cell as HTMLElement).queryByRole('textbox')).not.toBeInTheDocument()
  })
})
