export const dynamic = "force-static";

import Link from "next/link";
import { Button } from "../_components/button";

export default function AuthPage() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="text-white/70 text-sm">
        Sign in to start tracking trips and growing your garden.
      </p>
      <div className="card space-y-3 p-5">
        <Button className="w-full" size="lg">Continue with Google</Button>
        <div className="text-center text-xs text-white/40">or</div>
        <form className="space-y-3">
          <input
            type="email"
            placeholder="name@example.com"
            className="w-full rounded-[var(--radius-sm)] border border-white/10 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-white/40 focus:border-[rgb(var(--color-primary))]"
          />
          <Button className="w-full" variant="secondary">Send magic link</Button>
        </form>
      </div>
      <div className="text-sm text-white/60">
        By continuing you agree to our terms. <Link href="/" className="text-[rgb(var(--color-primary))] hover:underline">Back home</Link>
      </div>
    </div>
  );
}
