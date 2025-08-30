import "@/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "sonner";

import { TRPCReactProvider } from "@/trpc/react";
import { SessionProvider } from "next-auth/react";
import { Navigation } from "./_components/navigation";

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
    <html lang="en" className={`${geist.variable}`} suppressHydrationWarning>
      <body>
        <SessionProvider>
          <TRPCReactProvider>
            <header className="border-b border-white/10 bg-black/10 backdrop-blur supports-[backdrop-filter]:bg-black/20">
              <div className="container-slim flex items-center justify-between py-3">
                <a href="/" className="flex items-center gap-2 font-semibold">
                  <span className="inline-block h-2 w-2 rounded-full bg-[rgb(var(--color-primary))] shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
                  Urban Garden
                </a>
                <Navigation />
              </div>
            </header>
            <main className="container-slim py-6">{children}</main>
            <Toaster />
          </TRPCReactProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
