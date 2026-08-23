import Image from 'next/image'
import Link from 'next/link'

export function PolicyHeader() {
  return (
    <header className="flex h-16 items-center bg-white">
      <div className="mx-auto flex w-full max-w-5xl items-center px-4">
        <Link href="/" className="flex items-center gap-2">
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
      </div>
    </header>
  )
}
