import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { Button } from "../_components/button";
import { api } from "@/trpc/server";

export const metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  const session = await auth();
  if (!session) {
    redirect("/auth");
  }

  const data = await api.profile.get();
  const user = {
    name: data.name ?? session.user?.name ?? "—",
    username: data.username ?? (session.user?.email ? `@${session.user.email.split("@")[0]}` : "@you"),
    bio: data.bio ?? "",
    avatar: data.avatar ?? "/favicon.ico",
    location: data.location ?? "—",
    joined: data.joined
      ? new Date(data.joined).toLocaleString("en-US", { month: "short", year: "numeric" })
      : "—",
    stats: data.stats,
  } as const;

  return (
    <div className="flex min-h-[85svh] flex-col gap-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[var(--radius-lg)] bg-gradient-to-b from-[rgb(var(--color-foreground))/0.1] to-[rgb(var(--color-foreground))/0.05]">
        <div className="absolute inset-0 -z-10 opacity-50 [mask-image:radial-gradient(60%_60%_at_50%_0%,#000_20%,transparent_70%)]">
          {/* soft glow accents */}
          <div className="absolute -top-24 left-1/3 h-56 w-56 rounded-full bg-[rgba(16,185,129,.25)] blur-3xl" />
          <div className="absolute -top-12 right-1/4 h-40 w-40 rounded-full bg-[rgba(34,197,94,.25)] blur-2xl" />
        </div>
        <div className="p-6 md:px-8 md:py-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="flex items-start gap-4">
              <div className="relative h-20 w-20 shrink-0 rounded-full border border-[rgb(var(--color-foreground))/0.12] bg-[rgb(var(--color-foreground))/0.06] p-1 shadow-[var(--shadow-md)] md:h-24 md:w-24">
                <div className="relative h-full w-full overflow-hidden rounded-full ring-1 ring-[rgb(var(--color-foreground))/0.1]">
                  <Image src={user.avatar} alt="avatar" fill sizes="96px" className="object-cover" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-semibold leading-tight md:text-2xl">{user.name}</h1>
                <div className="text-sm text-[rgb(var(--color-foreground))/0.6]">{user.username}</div>
                <p className="mt-2 max-w-prose text-sm text-[rgb(var(--color-foreground))/0.85]">{user.bio}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[rgb(var(--color-foreground))/0.6]">
                  <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-[rgb(var(--color-foreground))/0.06] px-2 py-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                    {user.location}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-[rgb(var(--color-foreground))/0.06] px-2 py-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
                    Joined {user.joined}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link href="/garden">
                <Button className="shadow-[0_0_0_1px_rgba(255,255,255,.08)_inset]">Manage Garden</Button>
              </Link>
              <Link href="/profile/edit">
                <Button variant="secondary">Edit Profile</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {([
          { label: "Trips", value: user.stats.trips },
          { label: "Distance", value: `${user.stats.distanceKm} km` },
          { label: "Coins", value: user.stats.coins },
          { label: "Trees", value: user.stats.trees },
        ] as const).map((s) => (
          <div key={s.label} className="card p-5">
            <div className="text-sm text-[rgb(var(--color-foreground))/0.6]">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold">{s.value}</div>
          </div>
        ))}
      </section>

      {/* Sections */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card p-5 md:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            <Link href="/trip" className="text-sm text-[rgb(var(--color-primary))] hover:underline">View trips</Link>
          </div>
          <ul className="space-y-2 text-sm text-[rgb(var(--color-foreground))/0.85]">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-center justify-between rounded-md bg-[rgb(var(--color-foreground))/0.06] px-3 py-2">
                <span>No activity yet</span>
                <span className="text-[rgb(var(--color-foreground))/0.6]">—</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-lg font-semibold">About</h2>
          <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-sm text-[rgb(var(--color-foreground))/0.85]">
            <dt className="col-span-1 text-[rgb(var(--color-foreground))/0.6]">Username</dt>
            <dd className="col-span-2">{user.username}</dd>
            <dt className="col-span-1 text-[rgb(var(--color-foreground))/0.6]">Location</dt>
            <dd className="col-span-2">{user.location}</dd>
            <dt className="col-span-1 text-[rgb(var(--color-foreground))/0.6]">Joined</dt>
            <dd className="col-span-2">{user.joined}</dd>
          </dl>
        </div>
      </section>
    </div>
  );
}
