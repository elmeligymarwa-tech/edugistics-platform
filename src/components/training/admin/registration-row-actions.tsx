'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowUpCircle, Eye, MoreHorizontal, Pencil, RotateCw, XCircle } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cancelRegistrationAction, resendRegistrationEmailAction } from '@/app/training/admin/(protected)/registrations/actions'
import type { RegistrationListItem } from '@/lib/training/registrations'
import { PromoteRegistrationDialog } from './promote-registration-dialog'

export function RegistrationRowActions({ registration }: { registration: RegistrationListItem }) {
  const router = useRouter()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [promoteOpen, setPromoteOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelRegistrationAction(registration.id)
      if (!result.success) {
        setError(result.error)
        return
      }
      setCancelOpen(false)
      router.refresh()
    })
  }

  function handleResend() {
    startTransition(async () => {
      const result = await resendRegistrationEmailAction(registration.id)
      setError(result.success ? null : result.error)
      router.refresh()
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="Row actions">
              <MoreHorizontal />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href={`/training/admin/registrations/${registration.id}`} />}>
            <Eye /> View detail
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href={`/training/admin/registrations/${registration.id}?edit=1`} />}>
            <Pencil /> Edit
          </DropdownMenuItem>
          {registration.emailStatus === 'FAILED' && (
            <DropdownMenuItem onClick={handleResend} disabled={isPending}>
              <RotateCw /> Resend confirmation email
            </DropdownMenuItem>
          )}
          {registration.status === 'WAITLISTED' && (
            <DropdownMenuItem onClick={() => setPromoteOpen(true)}>
              <ArrowUpCircle /> Promote to confirmed
            </DropdownMenuItem>
          )}
          {registration.status !== 'CANCELLED' && (
            <DropdownMenuItem onClick={() => setCancelOpen(true)}>
              <XCircle /> Cancel registration
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {registration.fullName}&rsquo;s registration?</AlertDialogTitle>
            <AlertDialogDescription>
              This sets the registration to Cancelled. It is never deleted, and no automated email is sent to the
              teacher.
              {error && <span className="mt-2 block text-destructive">{error}</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep registration</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleCancel} disabled={isPending}>
              {isPending ? 'Cancelling…' : 'Cancel registration'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PromoteRegistrationDialog
        open={promoteOpen}
        onOpenChange={setPromoteOpen}
        registrationId={registration.id}
        fullName={registration.fullName}
      />
    </>
  )
}
