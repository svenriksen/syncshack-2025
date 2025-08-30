"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { Button } from "./button";

export function Navigation() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => 'dark');

  // Initialize theme on mount from localStorage or prefers-color-scheme
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const stored = localStorage.getItem('theme');
    let next: 'dark' | 'light' = 'dark';
    if (stored === 'light' || stored === 'dark') {
      next = stored;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      next = 'light';
    }
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  }, []);

  const toggleTheme = () => {
    const next: 'dark' | 'light' = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try { localStorage.setItem('theme', next); } catch {}
    if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', next);
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
  };

  return (
    <nav className="relative flex items-center gap-3 text-sm text-white/80">
      {/* Desktop links */}
      <div className="hidden items-center gap-3 md:flex">
        <Link className="hover:text-white" href="/trip">Trip</Link>
        <Link className="hover:text-white" href="/garden">Garden</Link>
        <Link className="hover:text-white" href="/leaderboard">Leaderboard</Link>
        <Link className="hover:text-white" href="/impact">Impact</Link>

        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-[var(--radius-sm)] px-2 py-1.5 text-xs outline outline-1 outline-white/10 hover:bg-white/10"
          aria-label="Toggle theme"
          title="Toggle theme"
        >
          {theme === 'light' ? 'Light' : 'Dark'}
        </button>

        {status === "loading" ? (
          <div className="ml-2 h-8 w-16 animate-pulse rounded-[var(--radius-sm)] bg-white/10" />
        ) : session ? (
          <div className="ml-2 flex items-center gap-2">
            <Link className="hover:text-white" href="/profile"><span className="text-xs text-white/60">
              {session.user?.name || session.user?.email}
            </span></Link>
            
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSignOut}
            >
              Sign out
            </Button>
          </div>
        ) : (
          <Link 
            className="ml-2 rounded-[var(--radius-sm)] bg-[rgb(var(--color-primary))] px-3 py-1.5 text-black hover:bg-[rgb(var(--color-primary-600))] hover:text-white" 
            href="/auth"
          >
            Sign in
          </Link>
        )}
      </div>

      {/* Mobile: menu button */}
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-white/10 hover:bg-white/15 md:hidden"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Mobile: dropdown panel */}
      {open && (
        <div className="absolute right-0 top-10 z-50 w-56 rounded-[var(--radius-md)] bg-[rgb(var(--color-card))] p-3 shadow-[var(--shadow-lg)] md:hidden">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => { toggleTheme(); setOpen(false); }}
              className="mb-1 rounded-[var(--radius-sm)] px-3 py-2 text-left outline outline-1 outline-white/10 hover:bg-white/10"
            >
              Toggle theme: {theme === 'light' ? 'Light' : 'Dark'}
            </button>
            <Link className="rounded-[var(--radius-sm)] px-3 py-2 hover:bg-white/10" href="/trip" onClick={() => setOpen(false)}>Trip</Link>
            <Link className="rounded-[var(--radius-sm)] px-3 py-2 hover:bg-white/10" href="/garden" onClick={() => setOpen(false)}>Garden</Link>
            <Link className="rounded-[var(--radius-sm)] px-3 py-2 hover:bg-white/10" href="/leaderboard" onClick={() => setOpen(false)}>Leaderboard</Link>
            <Link className="rounded-[var(--radius-sm)] px-3 py-2 hover:bg-white/10" href="/impact" onClick={() => setOpen(false)}>Impact</Link>

            {status === "loading" ? (
              <div className="mt-2 h-8 w-full animate-pulse rounded-[var(--radius-sm)] bg-white/10" />
            ) : session ? (
              <div className="mt-2 flex items-center justify-between gap-2">
                <Link className="truncate text-xs hover:text-white" href="/profile" onClick={() => setOpen(false)}>
                  Profile
                </Link>
                <span className="truncate text-xs text-white/60">
                  {session.user?.name || session.user?.email}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => { await handleSignOut(); setOpen(false); }}
                >
                  Sign out
                </Button>
              </div>
            ) : (
              <Link
                className="mt-2 w-full rounded-[var(--radius-sm)] bg-[rgb(var(--color-primary))] px-3 py-2 text-center text-black hover:bg-[rgb(var(--color-primary-600))] hover:text-white"
                href="/auth"
                onClick={() => setOpen(false)}
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
