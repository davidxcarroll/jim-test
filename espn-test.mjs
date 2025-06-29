import fetch from 'node-fetch';

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb';

async function testGetTodaysGames() {
  const response = await fetch(`${ESPN_BASE_URL}/scoreboard`);
  const data = await response.json();
  console.log('Number of games:', data.events?.length || 0);
  
  if (data.events && data.events.length > 0) {
    console.log('\nAll team abbreviations from today\'s games:');
    const teamAbbreviations = new Set();
    
    data.events.forEach((event, index) => {
      const homeTeam = event.competitions[0].competitors.find((c) => c.homeAway === 'home').team;
      const awayTeam = event.competitions[0].competitors.find((c) => c.homeAway === 'away').team;
      
      teamAbbreviations.add(homeTeam.abbreviation);
      teamAbbreviations.add(awayTeam.abbreviation);
      
      console.log(`Game ${index + 1}: ${awayTeam.abbreviation} @ ${homeTeam.abbreviation} (${awayTeam.name} @ ${homeTeam.name})`);
    });
    
    console.log('\nUnique team abbreviations found:');
    console.log(Array.from(teamAbbreviations).sort());
  } else {
    console.log('No games found.');
  }
}

testGetTodaysGames().catch(console.error); 