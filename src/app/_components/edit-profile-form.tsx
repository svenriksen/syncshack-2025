"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { Button } from "./button";
import { toast } from "sonner";

type Props = {
  defaultName: string;
  defaultBio: string;
  defaultLocation: string;
};

export function EditProfileForm({ defaultName, defaultBio, defaultLocation }: Props) {
  const router = useRouter();
  const utils = api.useUtils();
  const [name, setName] = useState(defaultName);
  const [bio, setBio] = useState(defaultBio);
  const [location, setLocation] = useState(defaultLocation);
  const [detectedLocation, setDetectedLocation] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const mutation = api.profile.update.useMutation({
    onSuccess: async () => {
      toast.success("Profile updated");
      await utils.profile.get.invalidate();
      router.push("/profile");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update profile");
    },
  });

  const isValid = name.trim().length > 0 && !!location;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      toast.error("Please select a location and enter a name");
      return;
    }
    mutation.mutate({ name: name.trim(), bio, location });
  };

  // Close dropdown on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!open) return;
      const el = dropdownRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const suggestedLocations = useMemo(
    () => [
      "San Francisco, USA",
      "New York, USA",
      "London, UK",
      "Sydney, Australia",
      "Melbourne, Australia",
      "Auckland, New Zealand",
      "Singapore",
      "Berlin, Germany",
      "Paris, France",
      "Tokyo, Japan",
    ],
    [],
  );

  const detectLocation = async () => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation not supported");
      return;
    }
    setDetecting(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 }),
      );
      const { latitude, longitude } = pos.coords;
      // Reverse geocode via OpenStreetMap Nominatim (no key required)
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`;
      const res = await fetch(url, { headers: { "Accept": "application/json" } });
      if (!res.ok) throw new Error("Reverse geocoding failed");
      const data = (await res.json()) as any;
      const city = data.address?.city || data.address?.town || data.address?.village || data.address?.suburb;
      const state = data.address?.state || data.address?.region;
      const country = data.address?.country;
      const pretty = [city, state, country].filter(Boolean).join(", ");
      if (pretty) {
        setDetectedLocation(pretty);
        setLocation(pretty);
        toast.success("Detected location set");
      } else {
        toast.error("Could not detect a nearby city");
      }
    } catch (err: any) {
      toast.error(err?.message || "Location detection failed");
    } finally {
      setDetecting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm text-[rgb(var(--color-foreground))/0.7]">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-[var(--radius-sm)] border border-[rgb(var(--color-foreground))/0.12] bg-[rgb(var(--color-foreground))/0.06] px-3 py-2 outline-none placeholder:text-[rgb(var(--color-foreground))/0.45] focus:border-[rgb(var(--color-foreground))/0.2]"
          placeholder="Your display name"
          maxLength={80}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-[rgb(var(--color-foreground))/0.7]">Bio</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="w-full min-h-24 rounded-[var(--radius-sm)] border border-[rgb(var(--color-foreground))/0.12] bg-[rgb(var(--color-foreground))/0.06] px-3 py-2 outline-none placeholder:text-[rgb(var(--color-foreground))/0.45] focus:border-[rgb(var(--color-foreground))/0.2]"
          placeholder="Tell us about yourself"
          maxLength={280}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-[rgb(var(--color-foreground))/0.7]">Location</label>
        <div className="flex gap-2">
          <div ref={dropdownRef} className="relative w-full">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-[var(--radius-sm)] border border-[rgb(var(--color-foreground))/0.12] bg-[rgb(var(--color-foreground))/0.08] px-3 py-2 text-left text-[rgb(var(--color-foreground))] outline-none transition hover:bg-[rgb(var(--color-foreground))/0.12] focus:border-[rgb(var(--color-foreground))/0.2]"
            >
              <span className={location ? "" : "text-[rgb(var(--color-foreground))/0.5]"}>
                {location || "Select a location"}
              </span>
              <svg className="ml-2 h-4 w-4 text-[rgb(var(--color-foreground))/0.7]" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.188l3.71-3.96a.75.75 0 111.08 1.04l-4.24 4.53a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </button>
            {open && (
              <div className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-[var(--radius-sm)] border border-[rgb(var(--color-foreground))/0.12] bg-[rgb(var(--color-card))] p-1 shadow-[var(--shadow-lg)]">
                {detectedLocation && (
                  <div
                    role="option"
                    tabIndex={0}
                    onClick={() => {
                      setLocation(detectedLocation);
                      setOpen(false);
                    }}
                    className="cursor-pointer rounded px-2 py-2 text-sm text-[rgb(var(--color-foreground))] hover:bg-[rgb(var(--color-foreground))/0.08]"
                  >
                    Detected: {detectedLocation}
                  </div>
                )}
                {suggestedLocations.map((opt) => (
                  <div
                    key={opt}
                    role="option"
                    tabIndex={0}
                    onClick={() => {
                      setLocation(opt);
                      setOpen(false);
                    }}
                    className={`cursor-pointer rounded px-2 py-2 text-sm text-[rgb(var(--color-foreground))] hover:bg-[rgb(var(--color-foreground))/0.08] ${
                      location === opt ? "bg-[rgb(var(--color-foreground))/0.08]" : ""
                    }`}
                  >
                    {opt}
                  </div>
                ))}
              </div>
            )}
          </div>
          <Button type="button" variant="secondary" onClick={detectLocation} disabled={detecting}>
            {detecting ? "Detecting..." : "Detect"}
          </Button>
        </div>
        <p className="mt-1 text-xs text-[rgb(var(--color-foreground))/0.5]">Choose a suggested location or use Detect. Custom entries are disabled.</p>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={mutation.isPending || !isValid}>
          {mutation.isPending ? "Saving..." : "Save changes"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
