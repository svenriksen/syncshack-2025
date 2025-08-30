import Link from "next/link";
import { Button } from "../_components/button";

export default function GardenPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Garden</h1>
        <Link href="/" className="text-sm text-[rgb(var(--color-primary))] hover:underline">Back</Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card p-4 md:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/80">Your Plot (8×10)</h2>
            <span className="text-xs text-white/50">Newest trees on the right</span>
          </div>
          <div className="grid-tiles">
            {Array.from({ length: 80 }).map((_, i) => (
              <div key={i} className="tile" />
            ))}
          </div>
        </div>
        <div className="card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-white/80">Shop</h2>
          <div className="flex items-center justify-between rounded-[var(--radius-sm)] bg-white/5 px-3 py-2">
            <div>
              <div className="font-medium">Sapling</div>
              <div className="text-xs text-white/60">100 coins</div>
            </div>
            <Button size="sm">Plant</Button>
          </div>
          <div className="flex items-center justify-between rounded-[var(--radius-sm)] bg-white/5 px-3 py-2">
            <div>
              <div className="font-medium">Young Tree</div>
              <div className="text-xs text-white/60">250 coins</div>
            </div>
            <Button size="sm">Plant</Button>
          </div>
          <div className="flex items-center justify-between rounded-[var(--radius-sm)] bg-white/5 px-3 py-2">
            <div>
              <div className="font-medium">Mature Tree</div>
              <div className="text-xs text-white/60">600 coins</div>
            </div>
            <Button size="sm">Plant</Button>
          </div>
          <div className="text-xs text-white/50">If you miss a day, your newest tree withers.</div>
        </div>
      </div>
    </div>
  );
}
