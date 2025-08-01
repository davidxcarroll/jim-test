const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc } = require('firebase/firestore');

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

async function clearSuperBowlPicks() {
  console.log('🏈 Starting Super Bowl picks cleanup...');
  
  try {
    console.log('🔄 Updating user profiles (removing Super Bowl picks)...');
    const usersSnapshot = await getDocs(collection(db, 'users'));
    
    const userUpdatePromises = usersSnapshot.docs.map(async (userDoc) => {
      const userData = userDoc.data();
      
      // Remove Super Bowl pick fields
      const fieldsToRemove = [
        'superBowlPick',  // This field is used for Super Bowl picks
        'superbowlPick',
        'superBowlPick',
        'nflPick',
        'championshipPick'
      ];
      
      // Create update object with fields to remove set to null
      const updateData = {};
      fieldsToRemove.forEach(field => {
        if (userData[field] !== undefined) {
          updateData[field] = null;
          console.log(`  - Removing ${field} for user: ${userData.email || userData.displayName}`);
        }
      });
      
      if (Object.keys(updateData).length > 0) {
        // Update the user document to remove the fields
        await updateDoc(userDoc.ref, updateData);
        console.log(`  - Updated user: ${userData.email || userData.displayName}`);
      } else {
        console.log(`  - No Super Bowl picks found for: ${userData.email || userData.displayName}`);
      }
    });
    
    await Promise.all(userUpdatePromises);
    
    console.log('✅ Super Bowl picks cleanup completed successfully!');
    console.log('');
    console.log('📋 Summary:');
    console.log('- Removed all Super Bowl picks from user profiles');
    console.log('- Cleared superBowlPick field (used for NFL picks)');
    console.log('- Ready for fresh Super Bowl picks! 🏈');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

// Run the cleanup
if (require.main === module) {
  clearSuperBowlPicks()
    .then(() => {
      console.log('🎉 Super Bowl picks cleanup completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Super Bowl picks cleanup failed:', error);
      process.exit(1);
    });
}

module.exports = { clearSuperBowlPicks }; 