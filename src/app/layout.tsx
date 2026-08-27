import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono, League_Spartan, Source_Sans_3 } from "next/font/google";

import { MetaPixelGate } from "@/components/meta-pixel/meta-pixel-gate";
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/components/theme/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// A high-contrast display serif reserved for page titles — everything else
// (body copy, card titles, tabular figures) stays on the grotesk above.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
});

// Landing-page-only typefaces (phase 2b design), loaded here because
// next/font/google requires loading at the module scope of a file in the
// route tree, not because any existing page uses them. Only the new
// landing components reference these variables via Tailwind arbitrary
// values — no existing page's className changes, so nothing outside the
// landing page picks these up. Calibri (the design's original choice) has
// no web licence and is absent from Android/iOS; Source Sans 3 is the
// approved substitute.
const leagueSpartan = League_Spartan({
  variable: "--font-league-spartan",
  subsets: ["latin"],
  weight: "700",
});

const sourceSans3 = Source_Sans_3({
  variable: "--font-source-sans-3",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Edugistics — School Financial Planning",
  description: "Financial planning and forecasting for school operators.",
  applicationName: "Edugistics",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F7FA" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1626" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${leagueSpartan.variable} ${sourceSans3.variable} antialiased`}
      >
        <ThemeProvider>
          <TooltipProvider>
            <ServiceWorkerRegistrar />
            <MetaPixelGate />
            {children}
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
