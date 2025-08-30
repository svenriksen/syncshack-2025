"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "./button";

export function Navigation() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false); // keep overlay mounted for exit animation
  // Lock scroll when the mobile menu is open
  useEffect(() => {
    const root = document.documentElement;
    if (open) {
      root.classList.add("overflow-hidden");
    } else {
      root.classList.remove("overflow-hidden");
    }
    return () => root.classList.remove("overflow-hidden");
  }, [open]);

  // Mount/unmount overlay for exit animation
  useEffect(() => {
    if (open) {
      setMounted(true);
    } else if (mounted) {
      const t = setTimeout(() => setMounted(false), 200); // match CSS duration
      return () => clearTimeout(t);
    }
  }, [open, mounted]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
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
      {/* Desktop */}
      <div className="hidden items-center gap-4 md:flex">
        <Link className="hover:text-[rgb(var(--color-foreground))]" href="/trip">Trip</Link>
        <Link className="hover:text-[rgb(var(--color-foreground))]" href="/garden">Garden</Link>
        <Link className="hover:text-[rgb(var(--color-foreground))]" href="/leaderboard">Leaderboard</Link>
        <Link className="hover:text-[rgb(var(--color-foreground))]" href="/impact">Impact</Link>
        <Link className="hover:text-[rgb(var(--color-foreground))]" href="/impact/everyone">Everyone's Impact</Link>

        <button
          type="button"
          onClick={toggleTheme}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] outline outline-1 outline-[rgb(var(--color-foreground))/0.12] hover:bg-[rgb(var(--color-foreground))/0.08]"
          aria-label="Toggle theme"
          title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
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
        </button>

        {status === "loading" ? (
          <div className="ml-1 h-8 w-16 animate-pulse rounded-[var(--radius-sm)] bg-[rgb(var(--color-foreground))/0.1]" />)
          : session ? (
          <div className="ml-1 flex items-center gap-2">
            <Link className="hover:text-[rgb(var(--color-foreground))]" href="/profile">
              <span className="text-xs text-[rgb(var(--color-foreground))/0.6]">
                {session.user?.name || session.user?.email}
              </span>
            </Link>
            <Button variant="secondary" size="sm" onClick={handleSignOut}>Sign out</Button>
          </div>
        ) : (
          <Link className="ml-1 rounded-[var(--radius-sm)] bg-[rgb(var(--color-primary))] px-3 py-1.5 text-black hover:bg-[rgb(var(--color-primary-600))] hover:text-white" href="/auth">Sign in</Link>
        )}
      </div>

      {/* Mobile trigger */}
      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] outline outline-1 outline-[rgb(var(--color-foreground))/0.1] md:hidden"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        )}
      </button>

      {/* Mobile overlay menu via Portal to avoid clipping by header/backdrop */}
      {mounted && (() => {
        const overlay = (
          <div className="fixed inset-0 z-[100] md:hidden" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <div
              className={`absolute inset-0 z-[105] bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
              onClick={() => setOpen(false)}
            />
            {/* Slide-in panel */}
            <aside
              className={`fixed right-0 top-0 z-[110] h-full w-[90%] max-w-sm overflow-y-auto rounded-l-[var(--radius-lg)] bg-[rgb(var(--color-card))] p-4 shadow-[var(--shadow-lg)] transition-transform duration-200 will-change-transform ${open ? "translate-x-0" : "translate-x-full"}`}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold">Menu</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] outline outline-1 outline-[rgb(var(--color-foreground))/0.1]"
                  aria-label="Close menu"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Links */}
              <div className="mb-2 px-3 text-[11px] uppercase tracking-wide text-[rgb(var(--color-foreground))/0.6]">Navigate</div>
              <nav className="grid gap-1">
                <Link className="flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-3 hover:bg-[rgb(var(--color-foreground))/0.06]" href="/trip" onClick={() => setOpen(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></svg>
                  <span>Trip</span>
                </Link>
                <Link className="flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-3 hover:bg-[rgb(var(--color-foreground))/0.06]" href="/garden" onClick={() => setOpen(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s-8-4-8-10a8 8 0 1 1 16 0c0 6-8 10-8 10Z"/><circle cx="12" cy="12" r="3"/></svg>
                  <span>Garden</span>
                </Link>
                <Link className="flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-3 hover:bg-[rgb(var(--color-foreground))/0.06]" href="/leaderboard" onClick={() => setOpen(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21V9"/><path d="M16 21V3"/><path d="M12 21v-6"/></svg>
                  <span>Leaderboard</span>
                </Link>
                <Link className="flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-3 hover:bg-[rgb(var(--color-foreground))/0.06]" href="/impact" onClick={() => setOpen(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m14.31 8 5.74 9.94"/><path d="M9.69 8h11.48"/><path d="M7.38 12 1.63 2.06"/><path d="M13.12 13.5h-2.24"/><path d="M16 7 7 17"/></svg>
                  <span>Impact</span>
                </Link>
                <Link className="flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-3 hover:bg-[rgb(var(--color-foreground))/0.06]" href="/impact/everyone" onClick={() => setOpen(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>
                  <span>Everyone's Impact</span>
                </Link>
              </nav>

              <div className="my-4 h-px bg-[rgb(var(--color-foreground))/0.08]" />

              {/* Theme toggle */}
              <button
                type="button"
                onClick={() => { toggleTheme(); }}
                className="flex items-center justify-between rounded-[var(--radius-sm)] px-3 py-3 outline outline-1 outline-[rgb(var(--color-foreground))/0.12] hover:bg-[rgb(var(--color-foreground))/0.06]"
              >
                <span>Toggle theme</span>
                {theme === 'dark' ? (
                  <svg aria-hidden="true" className="h-[18px] w-[18px] text-[rgb(var(--color-foreground))]" viewBox="0 0 24 24" fill="currentColor"><path d="M21.752 15.002A9 9 0 0 1 9.001 2.25a.75.75 0 0 0-.94.93 7.5 7.5 0 1 0 9.76 9.76.75.75 0 0 0 .931-.938z" /></svg>
                ) : (
                  <svg aria-hidden="true" className="h-[18px] w-[18px] text-[rgb(var(--color-foreground))]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5a1 1 0 0 1 1-1h0a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1zm0 14a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1zm7.5-6.5a1 1 0 0 1 1 1h1a1 1 0 1 1 0 2h-1a1 1 0 1 1-2 0 1 1 0 0 1 1-1zm-16 0a1 1 0 0 1 1-1H5a1 1 0 1 1 0 2H4.5a1 1 0 0 1-1-1zM6.22 6.22a1 1 0 0 1 1.415-1.414l.707.707a1 1 0 0 1-1.414 1.414l-.708-.707zm9.94 9.94a1 1 0 0 1 1.415-1.414l.707.707a1 1 0 1 1-1.414 1.414l-.708-.707zM6.22 17.78a1 1 0 1 1 1.414-1.415l.707.708A1 1 0 1 1 6.927 18.2l-.707-.707zm9.94-9.94a1 1 0 1 1 1.414-1.415l.707.708A1 1 0 0 1 17.162 8.2l-.707-.707z" /><circle cx="12" cy="12" r="4" /></svg>
                )}
              </button>

              <div className="my-4 h-px bg-[rgb(var(--color-foreground))/0.08]" />

              {/* Auth */}
              {status === "loading" ? (
                <div className="h-10 w-full animate-pulse rounded-[var(--radius-sm)] bg-[rgb(var(--color-foreground))/0.1]" />
              ) : session ? (
                <div className="flex items-center justify-between gap-2">
                  <Link className="truncate text-sm hover:text-[rgb(var(--color-foreground))]" href="/profile" onClick={() => setOpen(false)}>
                    Profile
                  </Link>
                  <Button variant="secondary" size="sm" onClick={handleSignOut}>Sign out</Button>
                </div>
              ) : (
                <Link className="w-full rounded-[var(--radius-sm)] bg-[rgb(var(--color-primary))] px-3 py-2 text-center text-black hover:bg-[rgb(var(--color-primary-600))] hover:text-white" href="/auth" onClick={() => setOpen(false)}>Sign in</Link>
              )}
            </aside>
          </div>
        );
        const target = typeof document !== 'undefined' ? document.body : null;
        return target ? createPortal(overlay, target) : overlay;
      })()}
    </nav>
  );
}

