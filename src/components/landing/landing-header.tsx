'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

const NAV_LINKS = [
  { href: '/training', label: 'Courses' },
  { href: '#about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
]

const POLICY_LINKS = [
  { href: '/policies/registration', label: 'Registration Policy' },
  { href: '/policies/payment', label: 'Payment Policy' },
  { href: '/policies/refund-and-cancellation', label: 'Refund and Cancellation Policy' },
  { href: '/policies/course-transfer', label: 'Course Transfer Policy' },
  { href: '/policies/attendance', label: 'Attendance Policy' },
  { href: '/policies/digital-delivery', label: 'Digital Delivery Policy' },
  { href: '/policies/certificate', label: 'Certificate Policy' },
  { href: '/policies/terms-and-conditions', label: 'Terms and Conditions' },
  { href: '/policies/privacy', label: 'Privacy Policy' },
  { href: '/policies', label: 'All Policies' },
]

function RegisterNowLink() {
  return (
    <Link
      href="/training"
      className="inline-flex items-center justify-center rounded-full bg-brand-gold px-4 py-2 text-sm font-medium text-brand-navy sm:px-5 sm:py-2.5"
    >
      Register Now
    </Link>
  )
}

function useFocusTrapAndEscape({
  open,
  onClose,
  panelRef,
  triggerRef,
}: {
  open: boolean
  onClose: () => void
  panelRef: React.RefObject<HTMLElement | null>
  triggerRef: React.RefObject<HTMLElement | null>
}) {
  useEffect(() => {
    if (!open) return

    const panel = panelRef.current
    if (!panel) return

    function getFocusable(): HTMLElement[] {
      if (!panel) return []
      return Array.from(panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'))
    }

    getFocusable()[0]?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
        triggerRef.current?.focus()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = getFocusable()
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose, panelRef, triggerRef])
}

function PoliciesDropdown() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useFocusTrapAndEscape({ open, onClose: () => setOpen(false), panelRef, triggerRef })

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="policies-dropdown-panel"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1 text-base text-brand-navy hover:underline hover:underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
      >
        Policies
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 stroke-current">
          <path d="M6 9l6 6 6-6" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          id="policies-dropdown-panel"
          ref={panelRef}
          className="absolute right-0 top-full z-50 mt-2 flex w-64 flex-col gap-1 rounded-md border border-brand-navy/10 bg-white p-2 shadow-lg"
        >
          {POLICY_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm text-brand-navy hover:underline hover:underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function MobilePoliciesGroup({ onNavigate }: { onNavigate: () => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-3 text-base text-brand-navy hover:underline hover:underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
      >
        Policies
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 stroke-current transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="flex flex-col gap-1 pl-4">
          {POLICY_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              className="rounded-md px-2 py-2 text-sm text-brand-navy hover:underline hover:underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useFocusTrapAndEscape({ open: menuOpen, onClose: () => setMenuOpen(false), panelRef, triggerRef: toggleRef })

  return (
    <header id="top" className="bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:h-20">
        <Link href="#top" className="flex items-center gap-2">
          <Image
            src="/brand/mark-dark.png"
            alt=""
            width={27}
            height={40}
            priority
            className="h-10 w-auto"
          />
          <span className="font-heading text-lg text-brand-navy">Edugistics</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-base text-brand-navy hover:underline hover:underline-offset-4"
            >
              {link.label}
            </Link>
          ))}
          <PoliciesDropdown />
        </nav>

        <div className="flex items-center gap-3">
          <RegisterNowLink />

          <button
            ref={toggleRef}
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-panel"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-11 w-11 items-center justify-center rounded-md text-brand-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy md:hidden"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 stroke-current">
              {menuOpen ? (
                <path
                  d="M6 6l12 12M18 6L6 18"
                  fill="none"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  fill="none"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div
          id="mobile-nav-panel"
          ref={panelRef}
          className="border-t border-brand-navy/10 px-4 pb-4 md:hidden"
        >
          <nav aria-label="Primary" className="flex flex-col gap-1 pt-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-2 py-3 text-base text-brand-navy hover:underline hover:underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
              >
                {link.label}
              </Link>
            ))}
            <MobilePoliciesGroup onNavigate={() => setMenuOpen(false)} />
          </nav>
        </div>
      )}
    </header>
  )
}
