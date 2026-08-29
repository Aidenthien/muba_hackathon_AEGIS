import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk, Unbounded } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "AEGIS — Pre-Execution Security Oracle for Sui",
  description:
    "AEGIS simulates every Sui transaction before it is signed. AI-verified outcomes, wallet-native warnings, zero custody. Stop the exploit before the signature.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${unbounded.variable} h-full antialiased`}
    >
      <body className="grain min-h-full flex flex-col bg-ink">{children}</body>
    </html>
  );
}
