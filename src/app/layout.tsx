import "@/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";

import { TRPCReactProvider } from "@/trpc/react";

export const metadata: Metadata = {
  title: {
    default: "Urban Garden",
    template: "%s • Urban Garden",
  },
  description: "Walk, bike, grow your virtual garden.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body>
        <TRPCReactProvider>
          <header className="border-b border-white/10 bg-black/10 backdrop-blur supports-[backdrop-filter]:bg-black/20">
            <div className="container-slim flex items-center justify-between py-3">
              <Link href="/" className="flex items-center gap-2 font-semibold">
                <span className="inline-block h-2 w-2 rounded-full bg-[rgb(var(--color-primary))] shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
                Urban Garden
              </Link>
              <nav className="flex items-center gap-3 text-sm text-white/80">
                <Link className="hover:text-white" href="/trip">Trip</Link>
                <Link className="hover:text-white" href="/garden">Garden</Link>
                <Link className="hover:text-white" href="/leaderboard">Leaderboard</Link>
                <Link className="hover:text-white" href="/impact">Impact</Link>
                <Link className="ml-2 rounded-[var(--radius-sm)] bg-[rgb(var(--color-primary))] px-3 py-1.5 text-black hover:bg-[rgb(var(--color-primary-600))] hover:text-white" href="/auth">Sign in</Link>
              </nav>
            </div>
          </header>
          <main className="container-slim py-6">{children}</main>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
