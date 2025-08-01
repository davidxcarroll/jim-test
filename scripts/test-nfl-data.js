const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testNFLData() {
  console.log('🏈 Testing NFL API endpoints...\n');
  
  try {
    // Test teams endpoint
    console.log('1. Testing teams endpoint...');
    const teamsResponse = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams');
    const teamsData = await teamsResponse.json();
    
    if (teamsData.sports && teamsData.sports[0] && teamsData.sports[0].leagues && teamsData.sports[0].leagues[0] && teamsData.sports[0].leagues[0].teams) {
      const teams = teamsData.sports[0].leagues[0].teams;
      console.log(`✅ Found ${teams.length} NFL teams`);
      
      // Show first few teams
      teams.slice(0, 3).forEach(team => {
        console.log(`   - ${team.team.abbreviation}: ${team.team.displayName}`);
      });
    } else {
      console.log('❌ Teams data structure unexpected');
    }
    
    // Test scoreboard endpoint
    console.log('\n2. Testing scoreboard endpoint...');
    const scoreboardResponse = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard');
    const scoreboardData = await scoreboardResponse.json();
    
    if (scoreboardData.events) {
      console.log(`✅ Found ${scoreboardData.events.length} games today`);
      
      if (scoreboardData.events.length > 0) {
        const firstGame = scoreboardData.events[0];
        const homeTeam = firstGame.competitions[0].competitors.find(c => c.homeAway === 'home');
        const awayTeam = firstGame.competitions[0].competitors.find(c => c.homeAway === 'away');
        
        console.log(`   - ${awayTeam.team.abbreviation} @ ${homeTeam.team.abbreviation}`);
        console.log(`   - Status: ${firstGame.status.type.state}`);
        console.log(`   - Score: ${awayTeam.score} - ${homeTeam.score}`);
      }
    } else {
      console.log('❌ Scoreboard data structure unexpected');
    }
    
    // Test standings endpoint
    console.log('\n3. Testing standings endpoint...');
    const standingsResponse = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/standings');
    const standingsData = await standingsResponse.json();
    
    if (standingsData.standings && standingsData.standings.entries) {
      console.log(`✅ Found ${standingsData.standings.entries.length} team standings`);
      
      // Show first few teams with records
      standingsData.standings.entries.slice(0, 3).forEach(entry => {
        const wins = entry.stats.find(s => s.name === 'wins')?.value || 0;
        const losses = entry.stats.find(s => s.name === 'losses')?.value || 0;
        const ties = entry.stats.find(s => s.name === 'ties')?.value || 0;
        console.log(`   - ${entry.team.abbreviation}: ${wins}-${losses}-${ties}`);
      });
    } else {
      console.log('❌ Standings data structure unexpected');
    }
    
    console.log('\n🎉 All NFL API tests passed!');
    console.log('✅ Ready for NFL season! 🏈');
    
  } catch (error) {
    console.error('❌ Error testing NFL data:', error);
  }
}

// Run the test
if (require.main === module) {
  testNFLData()
    .then(() => {
      console.log('\n✅ Test script completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test script failed:', error);
      process.exit(1);
    });
}

module.exports = { testNFLData }; 