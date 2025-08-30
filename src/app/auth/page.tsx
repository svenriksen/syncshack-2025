import { Suspense } from "react";
import AuthClient from "./auth-client";

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md space-y-6">
          <div className="h-7 w-32 animate-pulse rounded bg-white/10" />
          <div className="space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-white/10" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-white/10" />
          </div>
          <div className="card space-y-3 p-5">
            <div className="h-10 w-full animate-pulse rounded bg-white/10" />
            <div className="text-center text-xs text-white/40">or</div>
            <div className="h-10 w-full animate-pulse rounded bg-white/10" />
          </div>
        </div>
      }
    >
      <AuthClient />
    </Suspense>
  );
}
