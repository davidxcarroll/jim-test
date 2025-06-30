import fetch from 'node-fetch';

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb';

async function testTeamColors() {
  const response = await fetch(`${ESPN_BASE_URL}/teams`);
  const data = await response.json();
  
  console.log('Examining team color data from ESPN API...\n');
  
  if (data.sports[0].leagues[0].teams.length > 0) {
    // Show detailed color data for first few teams
    console.log('Detailed color data for first 5 teams:');
    data.sports[0].leagues[0].teams.slice(0, 5).forEach((teamData, index) => {
      const team = teamData.team;
      console.log(`\n${index + 1}. ${team.abbreviation} - ${team.name}`);
      console.log(`   Primary Color: ${team.color || 'N/A'}`);
      console.log(`   Alternate Color: ${team.alternateColor || 'N/A'}`);
      
      // Check for any other color-related fields
      const colorFields = Object.keys(team).filter(key => 
        key.toLowerCase().includes('color') || 
        key.toLowerCase().includes('colour') ||
        key.toLowerCase().includes('brand')
      );
      if (colorFields.length > 0) {
        console.log(`   Other color fields: ${colorFields.join(', ')}`);
        colorFields.forEach(field => {
          console.log(`     ${field}: ${team[field]}`);
        });
      }
    });
    
    // Show all available fields for the first team
    console.log('\n\nAll available fields for first team:');
    const firstTeam = data.sports[0].leagues[0].teams[0].team;
    console.log(Object.keys(firstTeam).sort());
    
    // Show color summary for all teams
    console.log('\n\nColor summary for all teams:');
    data.sports[0].leagues[0].teams.forEach((teamData) => {
      const team = teamData.team;
      console.log(`${team.abbreviation}: Primary=${team.color || 'N/A'}, Alternate=${team.alternateColor || 'N/A'}`);
    });
  } else {
    console.log('No teams found.');
  }
}

testTeamColors().catch(console.error); 