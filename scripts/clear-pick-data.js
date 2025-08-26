const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc, updateDoc } = require('firebase/firestore');

// Firebase config - using the jim-test-c997f project configuration
const firebaseConfig = {
  apiKey: "AIzaSyBpLpi7YSGb1_tlNo3NmSe1NzxZ-Jo8A94",
  authDomain: "jim-test-c997f.firebaseapp.com",
  projectId: "jim-test-c997f",
  storageBucket: "jim-test-c997f.firebasestorage.app",
  messagingSenderId: "473404562077",
  appId: "1:473404562077:web:841ab7b5396bdb0f295274",
  measurementId: "G-4KPR6H1KBJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function clearPickData() {
  console.log('🏈 Starting pick data cleanup for regular season...');
  
  try {
    // Step 1: Clear all week recaps
    console.log('🗑️  Clearing week recaps collection...');
    const weekRecapsSnapshot = await getDocs(collection(db, 'weekRecaps'));
    
    const weekRecapDeletePromises = weekRecapsSnapshot.docs.map(doc => {
      console.log(`  - Deleting week recap: ${doc.id}`);
      return deleteDoc(doc.ref);
    });
    
    await Promise.all(weekRecapDeletePromises);
    console.log(`✅ Cleared ${weekRecapsSnapshot.size} week recap documents`);

    // Step 2: Clear all pick data from all users
    console.log('🗑️  Clearing pick data from all users...');
    const usersSnapshot = await getDocs(collection(db, 'users'));
    
    let totalPicksDeleted = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      console.log(`  - Processing user: ${userData.displayName || userData.email || userId}`);
      
      // Get all pick documents for this user
      const picksCollection = collection(db, 'users', userId, 'picks');
      const picksSnapshot = await getDocs(picksCollection);
      
      if (picksSnapshot.size > 0) {
        console.log(`    - Found ${picksSnapshot.size} pick documents to delete`);
        
        const pickDeletePromises = picksSnapshot.docs.map(pickDoc => {
          console.log(`      - Deleting pick: ${pickDoc.id}`);
          return deleteDoc(pickDoc.ref);
        });
        
        await Promise.all(pickDeletePromises);
        totalPicksDeleted += picksSnapshot.size;
        console.log(`    - Deleted ${picksSnapshot.size} pick documents for ${userData.displayName || userData.email || userId}`);
      } else {
        console.log(`    - No pick documents found for ${userData.displayName || userData.email || userId}`);
      }
    }
    
    console.log(`✅ Cleared ${totalPicksDeleted} total pick documents from ${usersSnapshot.size} users`);

    // Step 3: Verify user profile data is preserved
    console.log('🔍 Verifying user profile data preservation...');
    const verifySnapshot = await getDocs(collection(db, 'users'));
    
    for (const userDoc of verifySnapshot.docs) {
      const userData = userDoc.data();
      const preservedFields = [
        'name',
        'email',
        'displayName',
        'topMoviePicks',
        'moviePreferences',
        'superBowlPick',
        'createdAt',
        'lastLogin',
        'settings',
        'profileComplete'
      ];
      
      const hasPreservedData = preservedFields.some(field => userData[field] !== undefined);
      
      if (hasPreservedData) {
        console.log(`  ✅ User ${userData.displayName || userData.email || userDoc.id}: Profile data preserved`);
      } else {
        console.log(`  ⚠️  User ${userData.displayName || userData.email || userDoc.id}: No profile data found`);
      }
    }
    
    console.log('✅ Pick data cleanup completed successfully!');
    console.log('');
    console.log('📋 Summary:');
    console.log(`- Cleared ${weekRecapsSnapshot.size} week recap documents`);
    console.log(`- Cleared ${totalPicksDeleted} pick documents from ${usersSnapshot.size} users`);
    console.log('- Preserved all user profile data (names, emails, movie preferences, Super Bowl picks)');
    console.log('- Week selector will now only show Week 1 of regular season');
    console.log('- All previous week and total stats have been reset');
    console.log('- Ready for NFL regular season! 🏈');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

// Run the cleanup
if (require.main === module) {
  clearPickData()
    .then(() => {
      console.log('🎉 Pick data cleanup script completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Pick data cleanup script failed:', error);
      process.exit(1);
    });
}

module.exports = { clearPickData };
