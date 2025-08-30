#!/usr/bin/env node

/**
 * Test Data Injection Script for SyncShack 2025
 * 
 * Usage:
 *   node scripts/inject-test-data.js
 *   npm run inject-test-data
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// Sample user data
const sampleUsers = [
  { name: "Alice Johnson", email: "alice@example.com" },
  { name: "Bob Smith", email: "bob@example.com" },
  { name: "Carol Davis", email: "carol@example.com" },
  { name: "David Wilson", email: "david@example.com" },
  { name: "Eva Brown", email: "eva@example.com" },
  { name: "Frank Miller", email: "frank@example.com" },
  { name: "Grace Lee", email: "grace@example.com" },
  { name: "Henry Taylor", email: "henry@example.com" },
  { name: "Iris Garcia", email: "iris@example.com" },
  { name: "Jack Martinez", email: "jack@example.com" },
];

// Sample trip coordinates for different regions
const tripCoordinates = {
  "Northeast US": [
    { start: [40.7128, -74.0060], end: [40.7589, -73.9851] }, // NYC
    { start: [42.3601, -71.0589], end: [42.3736, -71.1097] }, // Boston
    { start: [39.9526, -75.1652], end: [39.9612, -75.1519] }, // Philadelphia
  ],
  "Southeast US": [
    { start: [33.7490, -84.3880], end: [33.7636, -84.3952] }, // Atlanta
    { start: [25.7617, -80.1918], end: [25.7907, -80.1300] }, // Miami
    { start: [30.3322, -81.6557], end: [30.3163, -81.7016] }, // Jacksonville
  ],
  "Western US": [
    { start: [37.7749, -122.4194], end: [37.7849, -122.4094] }, // San Francisco
    { start: [34.0522, -118.2437], end: [34.0736, -118.2400] }, // Los Angeles
    { start: [47.6062, -122.3321], end: [47.6205, -122.3493] }, // Seattle
  ],
  "Canada": [
    { start: [43.6532, -79.3832], end: [43.6426, -79.3871] }, // Toronto
    { start: [45.5017, -73.5673], end: [45.5152, -73.5622] }, // Montreal
    { start: [49.2827, -123.1207], end: [49.2897, -123.1192] }, // Vancouver
  ],
  "UK & Ireland": [
    { start: [51.5074, -0.1278], end: [51.5200, -0.1000] }, // London
    { start: [53.3498, -6.2603], end: [53.3441, -6.2675] }, // Dublin
    { start: [55.9533, -3.1883], end: [55.9464, -3.2026] }, // Edinburgh
  ],
  "Europe": [
    { start: [48.8566, 2.3522], end: [48.8584, 2.2945] }, // Paris
    { start: [52.5200, 13.4050], end: [52.5163, 13.3777] }, // Berlin
    { start: [41.9028, 12.4964], end: [41.8902, 12.4922] }, // Rome
  ],
  "East Asia": [
    { start: [35.6762, 139.6503], end: [35.6895, 139.6917] }, // Tokyo
    { start: [39.9042, 116.4074], end: [39.9163, 116.3972] }, // Beijing
    { start: [37.5665, 126.9780], end: [37.5519, 126.9882] }, // Seoul
  ],
  "Australia": [
    { start: [-33.8688, 151.2093], end: [-33.8568, 151.2153] }, // Sydney
    { start: [-37.8136, 144.9631], end: [-37.8140, 144.9633] }, // Melbourne
    { start: [-31.9505, 115.8605], end: [-31.9522, 115.8614] }, // Perth
  ],
};

// Sample tree types
const treeTypes = ["pine", "bamboo", "maple", "bonsai", "sakura"];

// Helper function to get random element from array
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Helper function to get random number between min and max
function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper function to get random date within range
function getRandomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Helper function to calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

// Helper function to generate polyline
function generatePolyline(startLat, startLng, endLat, endLng) {
  const points = [];
  const steps = 10;
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = startLat + (endLat - startLat) * t;
    const lng = startLng + (endLng - startLng) * t;
    const time = Date.now() + i * 60000; // Add 1 minute per step
    
    points.push({
      lat: lat + (Math.random() - 0.5) * 0.001, // Add some noise
      lng: lng + (Math.random() - 0.5) * 0.001,
      t: time
    });
  }
  
  return JSON.stringify(points);
}

async function injectTestData() {
  try {
    console.log("🗑️ Cleaning existing test data...");
    
    // Clean up existing test data
    await prisma.auditFlag.deleteMany({});
    await prisma.trip.deleteMany({});
    await prisma.garden.deleteMany({});
    await prisma.leaderboardWeek.deleteMany({});
    await prisma.profile.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        email: {
          in: sampleUsers.map(u => u.email)
        }
      }
    });

    console.log("👥 Creating test users...");
    
    // Create test users
    const createdUsers = [];
    for (const userData of sampleUsers) {
      const user = await prisma.user.create({
        data: {
          id: uuidv4(),
          email: userData.email,
          name: userData.name,
          image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.name}`,
        }
      });
      createdUsers.push(user);
      
      // Create profile for each user
      await prisma.profile.create({
        data: {
          userId: user.id,
          bio: `Environmental enthusiast from ${getRandomElement(Object.keys(tripCoordinates))}`,
          location: getRandomElement(Object.keys(tripCoordinates)),
          totalCoins: getRandomNumber(100, 2000),
          currentStreak: getRandomNumber(0, 30),
          longestStreak: getRandomNumber(5, 60),
          treesPlantedVirtual: getRandomNumber(0, 20),
          treesPlantedReal: getRandomNumber(0, 5),
          lastActiveDate: new Date(),
        }
      });
    }

    console.log("🌍 Creating test trips...");
    
    // Create test trips
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    for (const user of createdUsers) {
      const userTripCount = getRandomNumber(5, 25);
      
      for (let i = 0; i < userTripCount; i++) {
        const region = getRandomElement(Object.keys(tripCoordinates));
        const coordinates = getRandomElement(tripCoordinates[region]);
        
        const startLat = coordinates.start[0] + (Math.random() - 0.5) * 0.1;
        const startLng = coordinates.start[1] + (Math.random() - 0.5) * 0.1;
        const endLat = coordinates.end[0] + (Math.random() - 0.5) * 0.1;
        const endLng = coordinates.end[1] + (Math.random() - 0.5) * 0.1;
        
        const distanceM = calculateDistance(startLat, startLng, endLat, endLng);
        const durationS = getRandomNumber(300, 1800); // 5-30 minutes
        const startedAt = getRandomDate(oneMonthAgo, now);
        const endedAt = new Date(startedAt.getTime() + durationS * 1000);
        
        // Determine if trip is valid based on distance and duration
        const avgSpeedKmh = (distanceM / 1000) / (durationS / 3600);
        const isValid = distanceM >= 500 && durationS >= 480 && avgSpeedKmh <= 15;
        const coinsAwarded = isValid ? Math.max(1, Math.round(distanceM / 100)) : 0;
        
        // Determine mode based on average speed
        let modeGuess = "unknown";
        if (avgSpeedKmh <= 6) modeGuess = "walk";
        else if (avgSpeedKmh <= 25) modeGuess = "bike";
        
        const trip = await prisma.trip.create({
          data: {
            userId: user.id,
            startLat,
            startLng,
            endLat,
            endLng,
            distanceM,
            durationS,
            modeGuess,
            valid: isValid,
            coinsAwarded,
            startedAt,
            endedAt,
            polyline: generatePolyline(startLat, startLng, endLat, endLng),
          }
        });
        
        // Add some audit flags for invalid trips
        if (!isValid && Math.random() < 0.3) {
          await prisma.auditFlag.create({
            data: {
              tripId: trip.id,
              reason: getRandomElement([
                "Distance too short",
                "Duration too short", 
                "Speed too high",
                "Suspicious route"
              ]),
            }
          });
        }
      }
    }

    console.log("🌳 Creating test gardens...");
    
    // Create test gardens
    for (const user of createdUsers) {
      const gardenSize = getRandomNumber(3, 12);
      
      for (let i = 0; i < gardenSize; i++) {
        const x = getRandomNumber(-50, 50);
        const y = getRandomNumber(-50, 50);
        const treeType = getRandomElement(treeTypes);
        
        await prisma.garden.create({
          data: {
            userId: user.id,
            type: treeType,
            x,
            y,
            status: Math.random() < 0.9 ? "alive" : "withered",
            plantedAt: getRandomDate(oneMonthAgo, now),
          }
        });
      }
    }

    console.log("🏆 Creating test leaderboard data...");
    
    // Create test leaderboard data for current week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    for (const user of createdUsers) {
      const weeklyCoins = getRandomNumber(50, 500);
      
      await prisma.leaderboardWeek.create({
        data: {
          weekStartDate: weekStart,
          userId: user.id,
          coins: weeklyCoins,
        }
      });
    }

    // Create some historical leaderboard data
    for (let week = 1; week <= 4; week++) {
      const historicalWeekStart = new Date(weekStart.getTime() - week * 7 * 24 * 60 * 60 * 1000);
      
      for (const user of createdUsers) {
        const weeklyCoins = getRandomNumber(30, 400);
        
        await prisma.leaderboardWeek.create({
          data: {
            weekStartDate: historicalWeekStart,
            userId: user.id,
            coins: weeklyCoins,
          }
        });
      }
    }

    console.log("✅ Test data injection completed successfully!");
    console.log(`📊 Created ${createdUsers.length} users`);
    console.log(`🌍 Created trips across ${Object.keys(tripCoordinates).length} regions`);
    console.log(`🌳 Created gardens with ${treeTypes.length} tree types`);
    console.log(`🏆 Created leaderboard data for 5 weeks`);

  } catch (error) {
    console.error("❌ Error injecting test data:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the injection
injectTestData().catch(console.error);
