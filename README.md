# SyncShack 2025

A gamified environmental impact tracking app that encourages sustainable transportation through trip tracking, virtual gardens, and community leaderboards.

## Features

- **Trip Tracking**: Record and validate sustainable transportation trips
- **Virtual Garden**: Plant trees with earned coins
- **Leaderboards**: Weekly competitions and rankings
- **Impact Visualization**: See your environmental impact and CO₂ savings
- **Everyone's Impact**: Global heatmap showing collective environmental impact across regions

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Mapbox API key

### Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and configure your environment variables
4. Set up the database: `npm run db:push`
5. Start the development server: `npm run dev`

### Environment Variables

Create a `.env` file with the following variables:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/database_name"

# Auth
AUTH_SECRET="your-secret-key"

# OAuth Providers (optional)
DISCORD_CLIENT_ID="your-discord-client-id"
DISCORD_CLIENT_SECRET="your-discord-client-secret"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Mapbox
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN="your-mapbox-access-token"
```

## Mock Database Setup

To populate the database with realistic test data for development and testing:

### Option 1: Using the shell script
```bash
./mock-database.sh
```

### Option 2: Using npm script
```bash
npm run inject-test-data
```

### Option 3: Direct Node.js execution
```bash
node scripts/inject-test-data.js
```

### What the mock data includes:

- **10 test users** with realistic profiles and avatars
- **50-250 trips** across 8 global regions:
  - Northeast US (NYC, Boston, Philadelphia)
  - Southeast US (Atlanta, Miami, Jacksonville)
  - Western US (San Francisco, Los Angeles, Seattle)
  - Canada (Toronto, Montreal, Vancouver)
  - UK & Ireland (London, Dublin, Edinburgh)
  - Europe (Paris, Berlin, Rome)
  - East Asia (Tokyo, Beijing, Seoul)
  - Australia (Sydney, Melbourne, Perth)
- **Virtual gardens** with various tree types (pine, bamboo, maple, bonsai, sakura)
- **5 weeks of leaderboard data** including current and historical weeks
- **Realistic trip validation** with some invalid trips and audit flags
- **Proper CO₂ calculations** based on distance (120g CO₂ per km saved)

### Testing the "Everyone's Impact" Feature

After running the mock data script, you can test the heatmap visualization:

1. Start the development server: `npm run dev`
2. Navigate to: `http://localhost:3000/impact/everyone`
3. Explore the interactive heatmap with:
   - Trip density visualization
   - Regional impact statistics
   - Time range filtering
   - Valid/invalid trip filtering
   - Clickable trip points with detailed information

## Development

### Database Commands

- `npm run db:push` - Push schema changes to database
- `npm run db:studio` - Open Prisma Studio for database management
- `npm run db:generate` - Generate Prisma client

### Code Quality

- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking
- `npm run format:write` - Format code with Prettier

## CO₂ Impact Calculation

The app calculates environmental impact using the formula:
```
CO₂ saved = distance_km × 120 grams
```

This represents the CO₂ emissions avoided by choosing sustainable transportation over driving.

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **Maps**: Mapbox GL JS
- **Styling**: Tailwind CSS
- **Type Safety**: TypeScript
- **API**: tRPC for type-safe API routes
- **3D Graphics**: Three.js with React Three Fiber

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.


