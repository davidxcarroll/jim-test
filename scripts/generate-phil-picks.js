#!/usr/bin/env node

/**
 * Script to generate Phil's picks for a specific week or all weeks
 * Usage:
 *   node scripts/generate-phil-picks.js [weekOffset]
 *   
 * Examples:
 *   node scripts/generate-phil-picks.js 0    # Current week
 *   node scripts/generate-phil-picks.js 1    # Previous week
 *   node scripts/generate-phil-picks.js all  # All available weeks
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, getDocs } = require('firebase/firestore');

// Firebase config (you'll need to add your config here)
const firebaseConfig = {
  // Add your Firebase config here
  // This should match your src/lib/firebase.ts config
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Phil's user data
const PHIL_USER = {
  id: 'phil-hardcoded',
  uid: 'phil-hardcoded',
  displayName: 'Phil',
  email: 'phil@example.com',
  superBowlPick: 'CAR',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01')
};

// Helper functions (simplified versions)
function getNFLSeasonStart() {
  return new Date('2024-09-05'); // Adjust as needed
}

function getSeasonAndWeek(date) {
  const season = String(date.getFullYear());
  const seasonStart = getNFLSeasonStart();
  const daysSinceStart = Math.floor((date.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24));
  const weekNumber = Math.floor(daysSinceStart / 7) + 1;
  const week = `week-${weekNumber}`;
  return { season, week };
}

function getTuesdayWeekRange(date) {
  // Find the Tuesday of the week containing the given date
  const dayOfWeek = date.getDay();
  const daysToTuesday = dayOfWeek === 0 ? 2 : (2 - dayOfWeek + 7) % 7;
  const tuesday = new Date(date);
  tuesday.setDate(date.getDate() - daysToTuesday);
  
  const start = new Date(tuesday);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

function getStartOfWeekNDaysAgo(weeksAgo) {
  const today = new Date();
  const { start } = getTuesdayWeekRange(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7 * weeksAgo)
  );
  return start;
}

// Mock ESPN API (you'll need to implement this or use the real one)
async function getGamesForDateRange(start, end) {
  // This is a placeholder - you'll need to implement the actual ESPN API call
  // or import it from your existing code
  console.log(`Would fetch games from ${start.toISOString()} to ${end.toISOString()}`);
  return []; // Return empty array for now
}

function generatePhilPicks(games) {
  const philPicks = {};
  
  games.forEach(game => {
    // Use the existing favoriteTeam value from the game object
    const favoriteTeam = game.favoriteTeam || 'home';
    philPicks[game.id] = {
      pickedTeam: favoriteTeam,
      pickedAt: new Date()
    };
  });
  
  return philPicks;
}

async function generateAndStorePhilPicks(games, weekKey) {
  try {
    // Check if Phil's picks already exist for this week
    const philPicksDoc = await getDoc(doc(db, 'users', PHIL_USER.id, 'picks', weekKey));
    
    if (philPicksDoc.exists()) {
      console.log(`🏈 Phil picks already exist for week: ${weekKey}`);
      return;
    }

    // Generate Phil's picks for this week
    const philPicks = generatePhilPicks(games);
    
    // Add timestamp to each pick
    const picksWithTimestamp = Object.fromEntries(
      Object.entries(philPicks).map(([gameId, pick]) => [
        gameId,
        {
          ...pick,
          pickedAt: serverTimestamp()
        }
      ])
    );

    // Store Phil's picks in the database
    await setDoc(doc(db, 'users', PHIL_USER.id, 'picks', weekKey), picksWithTimestamp);
    
    console.log(`🏈 Generated and stored Phil picks for week: ${weekKey} with ${games.length} games`);
  } catch (error) {
    console.error('Error generating and storing Phil picks:', error);
  }
}

async function generatePhilPicksForWeek(weekOffset) {
  const weekStart = getStartOfWeekNDaysAgo(weekOffset);
  const { start, end } = getTuesdayWeekRange(weekStart);
  const { season, week } = getSeasonAndWeek(weekStart);
  const weekKey = `${season}_${week}`;

  console.log(`🔄 Generating Phil picks for week ${weekKey} (${start.toISOString()} to ${end.toISOString()})`);

  // Fetch games for this week
  const games = await getGamesForDateRange(start, end);
  console.log(`🎮 Found ${games.length} games for week ${weekKey}`);

  if (games.length === 0) {
    console.log(`⚠️ No games found for week ${weekKey}, skipping...`);
    return;
  }

  await generateAndStorePhilPicks(games, weekKey);
}

async function generatePhilPicksForAllWeeks() {
  console.log('🔄 Generating Phil picks for all available weeks...');
  
  // Generate for current week + up to 4 past weeks
  for (let i = 0; i < 5; i++) {
    try {
      await generatePhilPicksForWeek(i);
    } catch (error) {
      console.error(`Error generating picks for week offset ${i}:`, error);
    }
  }
  
  console.log('✅ Finished generating Phil picks for all weeks');
}

async function main() {
  const weekOffset = process.argv[2];
  
  if (!weekOffset) {
    console.log('Usage: node scripts/generate-phil-picks.js [weekOffset|all]');
    console.log('Examples:');
    console.log('  node scripts/generate-phil-picks.js 0    # Current week');
    console.log('  node scripts/generate-phil-picks.js 1    # Previous week');
    console.log('  node scripts/generate-phil-picks.js all  # All available weeks');
    process.exit(1);
  }

  try {
    if (weekOffset === 'all') {
      await generatePhilPicksForAllWeeks();
    } else {
      const offset = parseInt(weekOffset, 10);
      if (isNaN(offset)) {
        console.error('Invalid week offset. Must be a number or "all"');
        process.exit(1);
      }
      await generatePhilPicksForWeek(offset);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  generatePhilPicksForWeek,
  generatePhilPicksForAllWeeks,
  generateAndStorePhilPicks
};
