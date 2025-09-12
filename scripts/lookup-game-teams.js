#!/usr/bin/env node

/**
 * Script to look up team information for game IDs in the picks database
 * This helps identify which teams are playing in each game
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { config } from '../src/lib/firebase.js';

// Initialize Firebase
const app = initializeApp(config);
const db = getFirestore(app);

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

/**
 * Look up team information for a specific game ID using ESPN API
 */
async function getGameTeams(gameId) {
  try {
    console.log(`🔍 Looking up teams for game ID: ${gameId}`);
    
    const response = await fetch(`${ESPN_BASE_URL}/summary?event=${gameId}`);
    const data = await response.json();
    
    if (!data.header) {
      console.log(`❌ No data found for game ID: ${gameId}`);
      return null;
    }

    const competition = data.header.competitions?.[0] || {};
    const competitors = competition.competitors || [];
    const home = competitors.find((c) => c.homeAway === 'home') || { team: {} };
    const away = competitors.find((c) => c.homeAway === 'away') || { team: {} };
    
    const homeTeam = home.team || {};
    const awayTeam = away.team || {};

    const gameInfo = {
      gameId,
      homeTeam: {
        id: homeTeam.id || '',
        name: homeTeam.name || '',
        abbreviation: homeTeam.abbreviation || '',
        city: homeTeam.location || '',
      },
      awayTeam: {
        id: awayTeam.id || '',
        name: awayTeam.name || '',
        abbreviation: awayTeam.abbreviation || '',
        city: awayTeam.location || '',
      },
      date: data.header.competitions?.[0]?.date || '',
      status: data.header.competitions?.[0]?.status?.type?.name || 'unknown'
    };

    console.log(`✅ Found: ${gameInfo.awayTeam.abbreviation} @ ${gameInfo.homeTeam.abbreviation}`);
    return gameInfo;
    
  } catch (error) {
    console.error(`❌ Error looking up game ${gameId}:`, error.message);
    return null;
  }
}

/**
 * Get all unique game IDs from a specific week's picks
 */
async function getGameIdsFromWeek(season, week) {
  try {
    console.log(`📊 Getting game IDs from ${season}_${week} picks...`);
    
    // Get all users
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const gameIds = new Set();
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const picksDoc = await getDoc(doc(db, 'users', userId, 'picks', `${season}_${week}`));
      
      if (picksDoc.exists()) {
        const picksData = picksDoc.data();
        Object.keys(picksData).forEach(gameId => {
          if (gameId !== 'pickedTeam' && gameId !== 'pickedAt') {
            gameIds.add(gameId);
          }
        });
      }
    }
    
    console.log(`📋 Found ${gameIds.size} unique game IDs`);
    return Array.from(gameIds);
    
  } catch (error) {
    console.error('❌ Error getting game IDs:', error);
    return [];
  }
}

/**
 * Look up teams for all games in a specific week
 */
async function lookupWeekGames(season, week) {
  console.log(`\n🏈 Looking up teams for ${season} Week ${week}\n`);
  
  const gameIds = await getGameIdsFromWeek(season, week);
  const gameTeams = {};
  
  for (const gameId of gameIds) {
    const gameInfo = await getGameTeams(gameId);
    if (gameInfo) {
      gameTeams[gameId] = gameInfo;
    }
    
    // Add a small delay to be respectful to ESPN's API
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return gameTeams;
}

/**
 * Display formatted results
 */
function displayResults(gameTeams) {
  console.log('\n📋 GAME TEAM LOOKUP RESULTS\n');
  console.log('=' .repeat(80));
  
  Object.entries(gameTeams).forEach(([gameId, gameInfo]) => {
    console.log(`\n🎮 Game ID: ${gameId}`);
    console.log(`   📅 Date: ${new Date(gameInfo.date).toLocaleDateString()}`);
    console.log(`   🏠 Home: ${gameInfo.homeTeam.abbreviation} (${gameInfo.homeTeam.name})`);
    console.log(`   ✈️  Away: ${gameInfo.awayTeam.abbreviation} (${gameInfo.awayTeam.name})`);
    console.log(`   📊 Status: ${gameInfo.status}`);
  });
  
  console.log('\n' + '=' .repeat(80));
  console.log(`\n✅ Successfully looked up ${Object.keys(gameTeams).length} games`);
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node lookup-game-teams.js <season> <week>');
    console.log('Example: node lookup-game-teams.js 2025 1');
    process.exit(1);
  }
  
  const [season, week] = args;
  
  try {
    const gameTeams = await lookupWeekGames(season, week);
    displayResults(gameTeams);
    
    // Optionally save to a JSON file for reference
    const fs = await import('fs');
    const filename = `game-teams-${season}-week-${week}.json`;
    fs.writeFileSync(filename, JSON.stringify(gameTeams, null, 2));
    console.log(`\n💾 Results saved to: ${filename}`);
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
main();
