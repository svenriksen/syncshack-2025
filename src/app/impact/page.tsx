import Link from "next/link";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";

export default function ImpactPage() {
  const { data: session } = useSession();
  if (!session) return redirect("/auth");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Impact</h1>
        <Link href="/" className="text-sm text-[rgb(var(--color-primary))] hover:underline">Back</Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card p-5">
          <div className="text-sm text-white/60">Weekly Distance</div>
          <div className="mt-1 text-3xl font-semibold">0.0 km</div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-white/60">Weekly CO₂ Saved</div>
          <div className="mt-1 text-3xl font-semibold">0 g</div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-white/60">All-time CO₂ Saved</div>
          <div className="mt-1 text-3xl font-semibold">0 g</div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-lg font-semibold">Recent Trips</h2>
        <div className="rounded-[var(--radius-sm)] bg-white/5 p-4 text-sm text-white/60">
          No trips yet.
        </div>
      </div>
    </div>
  );
}
