import type { Metadata, Viewport } from "next"
import { Bricolage_Grotesque, Inter } from "next/font/google"
import "./globals.css"

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display-face",
  display: "swap",
})

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Fluent — Live Sign Language Translation",
  description:
    "Real-time American Sign Language interpreter. Translate signs to text and speech, and watch a 3D avatar sign back your words — all on-device.",
  generator: "v0.app",
}

export const viewport: Viewport = {
  themeColor: "#f4efe9",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`bg-paper ${bricolage.variable} ${inter.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
