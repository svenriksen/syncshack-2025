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
    <nav className="relative flex items-center gap-3 text-sm text-[rgb(var(--color-foreground))/0.85]">
      {/* Desktop links */}
      <div className="hidden items-center gap-3 md:flex">
        <Link className="hover:text-[rgb(var(--color-foreground))]" href="/trip">Trip</Link>
        <Link className="hover:text-[rgb(var(--color-foreground))]" href="/garden">Garden</Link>
        <Link className="hover:text-[rgb(var(--color-foreground))]" href="/leaderboard">Leaderboard</Link>
        <Link className="hover:text-[rgb(var(--color-foreground))]" href="/impact">Impact</Link>

        {/* Theme toggle (icon) */}
        <button
          type="button"
          onClick={toggleTheme}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] outline outline-1 outline-[rgb(var(--color-foreground))/0.12] hover:bg-[rgb(var(--color-foreground))/0.08]"
          aria-label="Toggle theme"
          title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
        >
          {theme === 'dark' ? (
            // Moon icon
            <svg
              aria-hidden="true"
              className="h-[18px] w-[18px] text-[rgb(var(--color-foreground))]"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M21.752 15.002A9 9 0 0 1 9.001 2.25a.75.75 0 0 0-.94.93 7.5 7.5 0 1 0 9.76 9.76.75.75 0 0 0 .931-.938z" />
            </svg>
          ) : (
            // Sun icon
            <svg
              aria-hidden="true"
              className="h-[18px] w-[18px] text-[rgb(var(--color-foreground))]"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 4.5a1 1 0 0 1 1-1h0a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1zm0 14a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1zm7.5-6.5a1 1 0 0 1 1 1h1a1 1 0 1 1 0 2h-1a1 1 0 1 1-2 0 1 1 0 0 1 1-1zm-16 0a1 1 0 0 1 1-1H5a1 1 0 1 1 0 2H4.5a1 1 0 0 1-1-1zM6.22 6.22a1 1 0 0 1 1.415-1.414l.707.707a1 1 0 0 1-1.414 1.414l-.708-.707zm9.94 9.94a1 1 0 0 1 1.415-1.414l.707.707a1 1 0 1 1-1.414 1.414l-.708-.707zM6.22 17.78a1 1 0 1 1 1.414-1.415l.707.708A1 1 0 1 1 6.927 18.2l-.707-.707zm9.94-9.94a1 1 0 1 1 1.414-1.415l.707.708A1 1 0 0 1 17.162 8.2l-.707-.707z" />
              <circle cx="12" cy="12" r="4" />
            </svg>
          )}
        </button>

        {status === "loading" ? (
          <div className="ml-2 h-8 w-16 animate-pulse rounded-[var(--radius-sm)] bg-[rgb(var(--color-foreground))/0.1]" />
        ) : session ? (
          <div className="ml-2 flex items-center gap-2">
            <Link className="hover:text-[rgb(var(--color-foreground))]" href="/profile"><span className="text-xs text-[rgb(var(--color-foreground))/0.6]">
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
        className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-[rgb(var(--color-foreground))/0.1] hover:bg-[rgb(var(--color-foreground))/0.15] md:hidden"
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
              className="mb-1 flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-left outline outline-1 outline-[rgb(var(--color-foreground))/0.12] hover:bg-[rgb(var(--color-foreground))/0.08]"
            >
              {theme === 'dark' ? (
                <svg aria-hidden="true" className="h-[18px] w-[18px] text-[rgb(var(--color-foreground))]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21.752 15.002A9 9 0 0 1 9.001 2.25a.75.75 0 0 0-.94.93 7.5 7.5 0 1 0 9.76 9.76.75.75 0 0 0 .931-.938z" />
                </svg>
              ) : (
                <svg aria-hidden="true" className="h-[18px] w-[18px] text-[rgb(var(--color-foreground))]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4.5a1 1 0 0 1 1-1h0a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1zm0 14a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1zm7.5-6.5a1 1 0 0 1 1 1h1a1 1 0 1 1 0 2h-1a1 1 0 1 1-2 0 1 1 0 0 1 1-1zm-16 0a1 1 0 0 1 1-1H5a1 1 0 1 1 0 2H4.5a1 1 0 0 1-1-1zM6.22 6.22a1 1 0 0 1 1.415-1.414l.707.707a1 1 0 0 1-1.414 1.414l-.708-.707zm9.94 9.94a1 1 0 0 1 1.415-1.414l.707.707a1 1 0 1 1-1.414 1.414l-.708-.707zM6.22 17.78a1 1 0 1 1 1.414-1.415l.707.708A1 1 0 1 1 6.927 18.2l-.707-.707zm9.94-9.94a1 1 0 1 1 1.414-1.415l.707.708A1 1 0 0 1 17.162 8.2l-.707-.707z" />
                  <circle cx="12" cy="12" r="4" />
                </svg>
              )}
              <span className="text-sm">Toggle theme</span>
            </button>
            <Link className="rounded-[var(--radius-sm)] px-3 py-2 hover:bg-[rgb(var(--color-foreground))/0.08]" href="/trip" onClick={() => setOpen(false)}>Trip</Link>
            <Link className="rounded-[var(--radius-sm)] px-3 py-2 hover:bg-[rgb(var(--color-foreground))/0.08]" href="/garden" onClick={() => setOpen(false)}>Garden</Link>
            <Link className="rounded-[var(--radius-sm)] px-3 py-2 hover:bg-[rgb(var(--color-foreground))/0.08]" href="/leaderboard" onClick={() => setOpen(false)}>Leaderboard</Link>
            <Link className="rounded-[var(--radius-sm)] px-3 py-2 hover:bg-[rgb(var(--color-foreground))/0.08]" href="/impact" onClick={() => setOpen(false)}>Impact</Link>

            {status === "loading" ? (
              <div className="mt-2 h-8 w-full animate-pulse rounded-[var(--radius-sm)] bg-[rgb(var(--color-foreground))/0.1]" />
            ) : session ? (
              <div className="mt-2 flex items-center justify-between gap-2">
                <Link className="truncate text-xs hover:text-[rgb(var(--color-foreground))]" href="/profile" onClick={() => setOpen(false)}>
                  Profile
                </Link>
                <span className="truncate text-xs text-[rgb(var(--color-foreground))/0.6]">
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
