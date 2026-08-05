'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Menu } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { SidebarNav } from './sidebar-nav'

export function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Open navigation menu" className="md:hidden">
            <Menu className="size-5" />
          </Button>
        }
      />
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Image src="/brand/mark-light.png" alt="" width={158} height={238} className="h-6 w-auto dark:hidden" />
            <Image
              src="/brand/mark-dark.png"
              alt=""
              width={158}
              height={238}
              className="hidden h-6 w-auto dark:block"
            />
            Edugistics
          </SheetTitle>
        </SheetHeader>
        <SidebarNav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
