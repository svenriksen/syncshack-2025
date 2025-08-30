#!/usr/bin/env node

/**
 * Cleanup Test Data Script for SyncShack 2025
 * 
 * Usage:
 *   node scripts/cleanup-test-data.js
 *   npm run cleanup-test-data
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Test user emails to identify test data
const testUserEmails = [
  "alice@example.com",
  "bob@example.com", 
  "carol@example.com",
  "david@example.com",
  "eva@example.com",
  "frank@example.com",
  "grace@example.com",
  "henry@example.com",
  "iris@example.com",
  "jack@example.com",
];

async function cleanupTestData() {
  try {
    console.log("🗑️ Cleaning up test data...");
    
    // Get test user IDs
    const testUsers = await prisma.user.findMany({
      where: {
        email: {
          in: testUserEmails
        }
      },
      select: { id: true }
    });
    
    const testUserIds = testUsers.map(user => user.id);
    
    if (testUserIds.length === 0) {
      console.log("ℹ️ No test data found to clean up.");
      return;
    }
    
    console.log(`Found ${testUserIds.length} test users to remove...`);
    
    // Clean up in the correct order (respecting foreign key constraints)
    await prisma.auditFlag.deleteMany({
      where: {
        trip: {
          userId: {
            in: testUserIds
          }
        }
      }
    });
    
    await prisma.trip.deleteMany({
      where: {
        userId: {
          in: testUserIds
        }
      }
    });
    
    await prisma.garden.deleteMany({
      where: {
        userId: {
          in: testUserIds
        }
      }
    });
    
    await prisma.leaderboardWeek.deleteMany({
      where: {
        userId: {
          in: testUserIds
        }
      }
    });
    
    await prisma.profile.deleteMany({
      where: {
        userId: {
          in: testUserIds
        }
      }
    });
    
    await prisma.user.deleteMany({
      where: {
        id: {
          in: testUserIds
        }
      }
    });
    
    console.log("✅ Test data cleanup completed successfully!");
    console.log(`🗑️ Removed ${testUserIds.length} test users and all associated data`);

  } catch (error) {
    console.error("❌ Error cleaning up test data:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupTestData().catch(console.error);
