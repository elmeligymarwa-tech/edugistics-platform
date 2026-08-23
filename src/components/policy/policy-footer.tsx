import Image from 'next/image'

export function PolicyFooter() {
  return (
    <footer className="bg-brand-navy px-4 py-12 text-white">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center">
        <Image
          src="/brand/mark-light.png"
          alt="Edugistics"
          width={32}
          height={48}
          className="h-12 w-auto"
        />
        <div className="space-y-1 text-sm">
          <p>Edugistics</p>
          <p>Educational Management and Consultancy</p>
          <p>Building 5, Zizina Gardens, New Cairo, Cairo, Egypt</p>
          <p>
            <a href="tel:01040400015" className="hover:underline">
              01040400015
            </a>
          </p>
          <p>
            <a href="tel:01040400016" className="hover:underline">
              01040400016
            </a>
          </p>
          <p>
            <a href="mailto:Info@edugistics.online" className="hover:underline">
              Info@edugistics.online
            </a>
          </p>
          <p>
            <a
              href="https://wa.me/201040400015"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              WhatsApp: +201040400015
            </a>
          </p>
          <p className="pt-2">(c) 2026 Edugistics. All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  )
}
