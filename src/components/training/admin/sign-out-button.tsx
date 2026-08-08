'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function TrainingAdminSignOutButton() {
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSignOut() {
    if (isSigningOut) return
    setIsSigningOut(true)
    try {
      await fetch('/api/training/admin/logout', { method: 'POST' })
    } finally {
      window.location.href = '/training/admin/login'
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleSignOut} disabled={isSigningOut}>
      <LogOut />
      Sign out
    </Button>
  )
}
