import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getAnalytics } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
}

// Only initialize Firebase if we have the required config and we're not in a build environment
const shouldInitializeFirebase = () => {
  return (
    typeof window !== 'undefined' || // Client-side
    (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) || // Production with env vars
    process.env.NODE_ENV === 'development' // Development
  )
}

// Initialize Firebase only when needed
let app: any = null
let auth: any = null
let db: any = null
let analytics: any = null

if (shouldInitializeFirebase()) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
    auth = getAuth(app)
    db = getFirestore(app)
    
    // Initialize Analytics (only in browser environment)
    if (typeof window !== 'undefined') {
      analytics = getAnalytics(app)
    }
  } catch (error) {
    console.warn('Firebase initialization failed:', error)
  }
}

export { auth, db, analytics }
export default app 