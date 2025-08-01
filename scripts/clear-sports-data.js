const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc, query, where, updateDoc } = require('firebase/firestore');

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

async function clearSportsData() {
  console.log('🚀 Starting sports data cleanup...');
  
  try {
    // Collections to clear completely
    const collectionsToClear = [
      'picks',
      'games', 
      'weekRecaps',
      'liveGames'
    ];

    for (const collectionName of collectionsToClear) {
      console.log(`🗑️  Clearing ${collectionName} collection...`);
      const querySnapshot = await getDocs(collection(db, collectionName));
      
      const deletePromises = querySnapshot.docs.map(doc => {
        console.log(`  - Deleting ${collectionName} document: ${doc.id}`);
        return deleteDoc(doc.ref);
      });
      
      await Promise.all(deletePromises);
      console.log(`✅ Cleared ${querySnapshot.size} documents from ${collectionName}`);
    }

    // Collections to partially clear (remove sports-related fields)
    console.log('🔄 Updating user profiles (removing sports data)...');
    const usersSnapshot = await getDocs(collection(db, 'users'));
    
    const userUpdatePromises = usersSnapshot.docs.map(async (userDoc) => {
      const userData = userDoc.data();
      
      // Keep these fields
      const fieldsToKeep = [
        'name',
        'email', 
        'displayName',
        'topMoviePicks',
        'moviePreferences',
        'createdAt',
        'lastLogin',
        'settings',
        'profileComplete'
      ];
      
      // Create new user data with only non-sports fields
      const cleanedUserData = {};
      fieldsToKeep.forEach(field => {
        if (userData[field] !== undefined) {
          cleanedUserData[field] = userData[field];
        }
      });
      
      // Update the user document
      await updateDoc(userDoc.ref, cleanedUserData);
      console.log(`  - Updated user: ${userData.email || userData.displayName}`);
    });
    
    await Promise.all(userUpdatePromises);
    
    console.log('✅ Sports data cleanup completed successfully!');
    console.log('');
    console.log('📋 Summary:');
    console.log('- Cleared all picks, games, week recaps, and live games');
    console.log('- Removed Super Bowl picks from user profiles');
    console.log('- Preserved user profiles, names, emails, and movie preferences');
    console.log('- Ready for NFL season! 🏈');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

// Run the cleanup
if (require.main === module) {
  clearSportsData()
    .then(() => {
      console.log('🎉 Cleanup script completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Cleanup script failed:', error);
      process.exit(1);
    });
}

module.exports = { clearSportsData }; 