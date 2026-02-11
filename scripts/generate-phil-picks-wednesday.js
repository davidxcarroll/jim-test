#!/usr/bin/env node

/**
 * Manual script to generate Phil's picks for the current week
 * This simulates what the Wednesday cron job will do
 */

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { espnApi } from '../src/lib/espn-api.js';
import { getCurrentNFLWeekFromAPI } from '../src/utils/date-helpers.js';

// Firebase config (you'll need to add your config here)
const firebaseConfig = {
  // Add your Firebase config here
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const PHIL_USER_ID = 'phil-user-id';

async function generatePhilPicksForCurrentWeek() {
  console.log('🏈 Starting Wednesday Phil picks generation...\n');

  try {
    // Get current NFL week from ESPN API
    const currentWeek = await getCurrentNFLWeekFromAPI();
    if (!currentWeek) {
      console.error('❌ Could not get current NFL week from ESPN API');
      return;
    }

    console.log(`📅 Current week: ${currentWeek.week} (${currentWeek.weekType})`);
    console.log(`📅 Week range: ${currentWeek.startDate.toISOString()} to ${currentWeek.endDate.toISOString()}`);

    // Fetch games for the current week
    const games = await espnApi.getGamesForDateRange(currentWeek.startDate, currentWeek.endDate);
    console.log(`🎮 Found ${games.length} games for current week\n`);

    if (games.length === 0) {
      console.log('⚠️ No games found for current week, skipping Phil picks generation');
      return;
    }

    // Generate week key
    // Skip pro bowl (inconsequential for team records)
    if (currentWeek.weekType === 'pro-bowl') {
      console.log('📅 Current week is Pro Bowl; skipping Phil picks generation');
      return;
    }
    const weekKey = `${currentWeek.season}_${currentWeek.weekType === 'preseason' ? `preseason-${currentWeek.week}` : currentWeek.weekType === 'pro-bowl' ? `pro-bowl-${currentWeek.week}` : `week-${currentWeek.week}`}`;
    console.log(`🔑 Week key: ${weekKey}\n`);

    // Generate Phil's picks
    const philPicks = generatePhilPicks(games);
    
    // Log the picks being generated
    console.log('🏈 Phil picks generated:');
    Object.entries(philPicks).forEach(([gameId, pick]) => {
      const game = games.find(g => g.id === gameId);
      if (game) {
        const pickedTeamName = pick.pickedTeam === 'home' ? game.homeTeam.name : game.awayTeam.name;
        const favoriteTeamName = game.favoriteTeam === 'home' ? game.homeTeam.name : game.awayTeam.name;
        const isCorrect = pick.pickedTeam === game.favoriteTeam;
        const status = isCorrect ? '✅' : '❌';
        console.log(`  ${status} ${game.awayTeam.name} @ ${game.homeTeam.name}: Phil picked ${pickedTeamName} (favorite: ${favoriteTeamName})`);
      }
    });

    console.log(`\n📊 Summary:`);
    console.log(`  Total games: ${games.length}`);
    console.log(`  Phil picks generated: ${Object.keys(philPicks).length}`);
    
    // Count correct picks
    const correctPicks = Object.entries(philPicks).filter(([gameId, pick]) => {
      const game = games.find(g => g.id === gameId);
      return game && pick.pickedTeam === game.favoriteTeam;
    }).length;
    
    console.log(`  Correct picks: ${correctPicks}/${games.length} (${((correctPicks/games.length)*100).toFixed(1)}%)`);

    // Check if picks already exist in database
    const { doc, getDoc, setDoc, serverTimestamp } = await import('firebase/firestore');
    const philPicksDoc = await getDoc(doc(db, 'users', PHIL_USER_ID, 'picks', weekKey));
    
    if (philPicksDoc.exists()) {
      console.log(`\n⚠️ Phil picks already exist for week ${weekKey} in database`);
      console.log('   Use --force flag to overwrite existing picks');
      
      if (process.argv.includes('--force')) {
        console.log('🔄 Force flag detected, overwriting existing picks...');
      } else {
        console.log('   Skipping database update');
        return;
      }
    }

    // Store Phil's picks in the database
    const picksWithTimestamp = Object.fromEntries(
      Object.entries(philPicks).map(([gameId, pick]) => [
        gameId,
        {
          ...pick,
          pickedAt: serverTimestamp()
        }
      ])
    );

    await setDoc(doc(db, 'users', PHIL_USER_ID, 'picks', weekKey), picksWithTimestamp);
    
    console.log(`\n✅ Successfully generated and stored Phil picks for week: ${weekKey}`);

  } catch (error) {
    console.error('❌ Error generating Phil picks:', error);
  }
}

// Helper function to generate Phil's picks (copied from team-utils.ts)
function generatePhilPicks(games) {
  const philPicks = {};
  
  games.forEach(game => {
    // Use the existing favoriteTeam value from the game object
    // This ensures Phil's picks always match the dots displayed next to team names
    const favoriteTeam = game.favoriteTeam || 'home'; // Default to home if not set
    philPicks[game.id] = {
      pickedTeam: favoriteTeam,
      pickedAt: new Date() // Use current timestamp for Phil's picks
    };
  });
  
  return philPicks;
}

// Run the script
generatePhilPicksForCurrentWeek().then(() => {
  console.log('\n🏁 Phil picks generation complete');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
