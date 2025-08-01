#!/usr/bin/env node

/**
 * Network connectivity test script
 * Run with: node scripts/test-network.js
 */

const https = require('https');

const endpoints = [
  { name: 'ESPN API', url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams' },
  { name: 'Google APIs', url: 'https://www.googleapis.com' },
  { name: 'Firebase Auth', url: 'https://identitytoolkit.googleapis.com' },
  { name: 'Google Fonts', url: 'https://fonts.googleapis.com' },
  { name: 'Google Tag Manager', url: 'https://www.googletagmanager.com' }
];

function testEndpoint(name, url) {
  return new Promise((resolve) => {
    const req = https.get(url, (res) => {
      console.log(`✅ ${name}: ${res.statusCode} ${res.statusMessage}`);
      resolve({ name, status: 'success', code: res.statusCode });
    });

    req.on('error', (error) => {
      console.log(`❌ ${name}: ${error.message}`);
      resolve({ name, status: 'error', error: error.message });
    });

    req.setTimeout(5000, () => {
      console.log(`⏰ ${name}: Timeout after 5 seconds`);
      req.destroy();
      resolve({ name, status: 'timeout' });
    });
  });
}

async function runTests() {
  console.log('🌐 Testing network connectivity...\n');
  
  const results = await Promise.all(
    endpoints.map(endpoint => testEndpoint(endpoint.name, endpoint.url))
  );

  console.log('\n📊 Summary:');
  const successful = results.filter(r => r.status === 'success').length;
  const failed = results.length - successful;
  
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Check your internet connection');
    console.log('2. Try disabling VPN if you\'re using one');
    console.log('3. Check if your firewall is blocking these services');
    console.log('4. Try using a different network');
  }
}

runTests().catch(console.error); 