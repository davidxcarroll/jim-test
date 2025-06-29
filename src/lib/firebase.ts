import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getAnalytics } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: "AIzaSyBpLpi7YSGb1_tlNo3NmSe1NzxZ-Jo8A94",
  authDomain: "jim-test-c997f.firebaseapp.com",
  projectId: "jim-test-c997f",
  storageBucket: "jim-test-c997f.firebasestorage.app",
  messagingSenderId: "473404562077",
  appId: "1:473404562077:web:841ab7b5396bdb0f295274",
  measurementId: "G-4KPR6H1KBJ"
}

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

// Initialize Firebase services
export const auth = getAuth(app)
export const db = getFirestore(app)

// Initialize Analytics (only in browser environment)
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null

export default app 