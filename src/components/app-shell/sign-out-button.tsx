'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function SignOutButton() {
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSignOut() {
    if (isSigningOut) return
    setIsSigningOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      // A full navigation (rather than client-side routing) ensures the
      // browser doesn't restore a cached authenticated page from history.
      window.location.href = '/login'
    }
  }

  return (
    <Button variant="ghost" size="icon-sm" aria-label="Sign out" onClick={handleSignOut} disabled={isSigningOut}>
      <LogOut />
    </Button>
  )
}
