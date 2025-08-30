# 🌱 GreenStride – MVP Spec

## 1. Problem & Goal
- **Problem**: Students want to lower daily carbon footprint but lack consistent motivation.
- **Goal**: Reward verified walking/biking trips with coins that grow a **virtual garden**; maintain a daily **streak**; show **CO₂ saved**.

---

## 2. Primary User Stories (MVP)
1. User can **sign in** (Google/email) → see coin balance, streak, and **Start Trip** CTA.
2. User can **choose a destination** and **start a trip**.
3. During trip → **HUD** (time, distance, speed, polyline map).
4. At finish → trip validated; if valid → **coins awarded** + **CO₂ saved** shown.
5. User can **spend coins** to plant **virtual trees** in a garden grid.
6. If user misses a day → newest tree **withers**, streak resets.
7. **(Optional)** User can view a **weekly leaderboard**.
8. User can view **impact totals** (distance, CO₂ saved).

---

## 3. Non-Goals (MVP)
- No payments.
- No real tree purchases.
- No background tracking (tab must stay open).
- No mobile-native apps.

---

## 4. Functional Requirements

### A. Auth
- **NextAuth** with Google OAuth or magic-link email.
- First login → creates `User` + `Profile`.
- Redirect unauthenticated users → `/auth`.

### B. Trip Tracking & Validation
- **Start trip**: pick destination, start geofence radius 120–150m.
- **Validation rules**:
    - Distance ≥ 500 m
    - Duration ≥ 8 minutes
    - Avg speed ≤ 15 km/h; no point > 30 km/h
    - No “teleports” (Δ>200 m in 2s)
    - Start & end within geofence
- **GPS updated by request**: Click on the button "Where am I" every 5 minutes (to avoid rate limit) - also make it as a challenge to user
- **Coins formula**: `coins = min(300, round(5 + 20 * distance_km))`.
- **Mode guess**: walk/bike/unknown (based on avg speed).

### C. Garden
- **Grid**: 8×10 tiles.
- **Shop**: sapling (100), young (250), mature (600) coins.  (MIGHT ADD MORE)
- **Wither**: oldest tree withers if no valid trip that day.

### D. Streak
- +1 per day with ≥1 valid trip.
- +10% coin multiplier/day, capped at +50%.
- Reset if day missed; newest tree withers.

### E. Leaderboard (OPTIONAL)
- Weekly (Mon–Sun AEST).
- Show top 10 + my rank.

### F. Impact
- **CO₂ saved** = `distance_km × 120 g`.
- Show weekly & all-time.

### G. Progressive Web App & UX
- Installable PWA (manifest + SW).
- Toast: “Keep this tab open for best accuracy.”
- Skeleton loading, error toasts, empty states.

---

## 5. Non-Functional Requirements
- **Performance**: HUD updates ≤ 1s after GPS sample.
- **Reliability**: server validates deterministically.
- **Security**: protected routes, Zod validation.
- **Privacy**: only aggregates shown; user can delete trips.
- **Timezone**: all streaks/leaderboards use `Australia/Sydney`.

---

## 6. Data Model (Prisma)

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String?
  image         String?
  createdAt     DateTime @default(now())
  profile       Profile?
  trips         Trip[]
  gardens       Garden[]
  weeklyEntries LeaderboardWeek[]
}

model Profile {
  userId              String  @id
  user                User    @relation(fields: [userId], references: [id])
  totalCoins          Int     @default(0)
  currentStreak       Int     @default(0)
  longestStreak       Int     @default(0)
  treesPlantedVirtual Int     @default(0)
  treesPlantedReal    Int     @default(0)
  lastActiveDate      DateTime?
}

model Trip {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  startLat     Float
  startLng     Float
  endLat       Float
  endLng       Float
  distanceM    Int      @default(0)
  durationS    Int      @default(0)
  modeGuess    String   @default("unknown")
  valid        Boolean  @default(false)
  coinsAwarded Int      @default(0)
  startedAt    DateTime
  endedAt      DateTime?
  polyline     String   // JSON of {lat,lng,t,s}
  createdAt    DateTime @default(now())
  flags        AuditFlag[]
}

model AuditFlag {
  id        String   @id @default(cuid())
  tripId    String
  trip      Trip     @relation(fields: [tripId], references: [id])
  reason    String
  createdAt DateTime @default(now())
}

enum TreeType { sapling, young, mature, withered }

model Garden {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  type      TreeType
  x         Int
  y         Int
  status    String   @default("alive")
  plantedAt DateTime @default(now())
}
```



