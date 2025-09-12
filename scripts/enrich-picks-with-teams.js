#!/usr/bin/env node

/**
 * Script to enrich existing pick data with team information
 * This adds team details to the picks database so you can see which teams are playing
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
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
    const response = await fetch(`${ESPN_BASE_URL}/summary?event=${gameId}`);
    const data = await response.json();
    
    if (!data.header) {
      return null;
    }

    const competition = data.header.competitions?.[0] || {};
    const competitors = competition.competitors || [];
    const home = competitors.find((c) => c.homeAway === 'home') || { team: {} };
    const away = competitors.find((c) => c.homeAway === 'away') || { team: {} };
    
    const homeTeam = home.team || {};
    const awayTeam = away.team || {};

    return {
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
    
  } catch (error) {
    console.error(`❌ Error looking up game ${gameId}:`, error.message);
    return null;
  }
}

/**
 * Enrich picks for a specific user and week with team information
 */
async function enrichUserPicks(userId, season, week) {
  try {
    console.log(`👤 Enriching picks for user: ${userId}`);
    
    const picksDoc = await getDoc(doc(db, 'users', userId, 'picks', `${season}_${week}`));
    
    if (!picksDoc.exists()) {
      console.log(`   ⚠️  No picks found for ${season}_${week}`);
      return { enriched: 0, skipped: 0 };
    }
    
    const picksData = picksDoc.data();
    const enrichedPicks = { ...picksData };
    let enriched = 0;
    let skipped = 0;
    
    // Process each game pick
    for (const [gameId, pickData] of Object.entries(picksData)) {
      // Skip if it's not a game ID (like metadata fields)
      if (gameId === 'pickedTeam' || gameId === 'pickedAt') {
        continue;
      }
      
      // Skip if already enriched
      if (pickData.homeTeam && pickData.awayTeam) {
        console.log(`   ⏭️  Game ${gameId} already enriched`);
        skipped++;
        continue;
      }
      
      console.log(`   🔍 Looking up teams for game ${gameId}...`);
      const gameTeams = await getGameTeams(gameId);
      
      if (gameTeams) {
        enrichedPicks[gameId] = {
          ...pickData,
          homeTeam: gameTeams.homeTeam,
          awayTeam: gameTeams.awayTeam,
          gameDate: gameTeams.date,
          gameStatus: gameTeams.status
        };
        console.log(`   ✅ Enriched: ${gameTeams.awayTeam.abbreviation} @ ${gameTeams.homeTeam.abbreviation}`);
        enriched++;
      } else {
        console.log(`   ❌ Failed to lookup game ${gameId}`);
        skipped++;
      }
      
      // Add delay to be respectful to ESPN's API
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Save enriched picks back to database
    if (enriched > 0) {
      await setDoc(doc(db, 'users', userId, 'picks', `${season}_${week}`), enrichedPicks, { merge: true });
      console.log(`   💾 Saved ${enriched} enriched picks to database`);
    }
    
    return { enriched, skipped };
    
  } catch (error) {
    console.error(`❌ Error enriching picks for user ${userId}:`, error);
    return { enriched: 0, skipped: 0 };
  }
}

/**
 * Enrich all picks for a specific week
 */
async function enrichWeekPicks(season, week) {
  console.log(`\n🏈 Enriching picks for ${season} Week ${week}\n`);
  
  try {
    // Get all users
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`👥 Found ${users.length} users`);
    
    let totalEnriched = 0;
    let totalSkipped = 0;
    
    for (const user of users) {
      const result = await enrichUserPicks(user.id, season, week);
      totalEnriched += result.enriched;
      totalSkipped += result.skipped;
    }
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`   ✅ Enriched: ${totalEnriched} picks`);
    console.log(`   ⏭️  Skipped: ${totalSkipped} picks`);
    console.log(`   👥 Users processed: ${users.length}`);
    
  } catch (error) {
    console.error('❌ Error enriching week picks:', error);
  }
}

/**
 * Display current pick structure for a week (for debugging)
 */
async function showPickStructure(season, week) {
  console.log(`\n🔍 Current pick structure for ${season} Week ${week}\n`);
  
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    let sampleShown = false;
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const picksDoc = await getDoc(doc(db, 'users', userId, 'picks', `${season}_${week}`));
      
      if (picksDoc.exists() && !sampleShown) {
        const picksData = picksDoc.data();
        console.log('📋 Sample pick structure:');
        console.log(JSON.stringify(picksData, null, 2));
        sampleShown = true;
        break;
      }
    }
    
  } catch (error) {
    console.error('❌ Error showing pick structure:', error);
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node enrich-picks-with-teams.js <season> <week> [command]');
    console.log('Commands:');
    console.log('  enrich  - Enrich picks with team information (default)');
    console.log('  show    - Show current pick structure');
    console.log('Example: node enrich-picks-with-teams.js 2025 1 enrich');
    process.exit(1);
  }
  
  const [season, week, command = 'enrich'] = args;
  
  try {
    if (command === 'show') {
      await showPickStructure(season, week);
    } else if (command === 'enrich') {
      await enrichWeekPicks(season, week);
    } else {
      console.log('❌ Unknown command. Use "enrich" or "show"');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
main();
