"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Button } from "./button";

export function Navigation() {
  const { data: session, status } = useSession();

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
  };

  return (
    <nav className="flex items-center gap-3 text-sm text-white/80">
      <Link className="hover:text-white" href="/trip">Trip</Link>
      <Link className="hover:text-white" href="/garden">Garden</Link>
      <Link className="hover:text-white" href="/leaderboard">Leaderboard</Link>
      <Link className="hover:text-white" href="/impact">Impact</Link>
      
      {status === "loading" ? (
        <div className="ml-2 h-8 w-16 animate-pulse rounded-[var(--radius-sm)] bg-white/10" />
      ) : session ? (
        <div className="ml-2 flex items-center gap-2">
          <span className="text-xs text-white/60">
            {session.user?.name || session.user?.email}
          </span>
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
    </nav>
  );
}
