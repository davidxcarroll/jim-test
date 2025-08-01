const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

// Firebase config - you'll need to add your actual config here
const firebaseConfig = {
  // Add your Firebase config here
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Team color mappings - Panthers and other teams
const teamColorMappings = [
  {
    abbreviation: 'CAR',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'BUF',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'NE',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'NYJ',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'MIA',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'BAL',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'CIN',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'CLE',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'PIT',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'HOU',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'IND',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'JAX',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'TEN',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'DEN',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'KC',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'LAC',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'LV',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'DAL',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'NYG',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'PHI',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'WSH',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'CHI',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'DET',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'GB',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'MIN',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'ATL',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'NO',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'TB',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'ARI',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'LAR',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'SF',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  },
  {
    abbreviation: 'SEA',
    backgroundColorChoice: 'primary',
    logoType: 'dark'
  }
];

async function initializeTeamColors() {
  try {
    console.log('Initializing team color mappings...');
    
    const docRef = doc(db, 'teamColorMappings', 'mappings');
    await setDoc(docRef, { 
      mappings: teamColorMappings, 
      updatedAt: new Date() 
    });
    
    console.log('Team color mappings initialized successfully!');
    console.log(`Initialized ${teamColorMappings.length} team mappings`);
  } catch (error) {
    console.error('Error initializing team color mappings:', error);
  }
}

// Run the initialization
initializeTeamColors(); 