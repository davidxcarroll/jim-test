import { create } from 'zustand'
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'

interface ClipboardVisibilitySettings {
  visibleUsers: Set<string>
  lastUpdated: Date | null
}

interface ClipboardVisibilityStore {
  settings: ClipboardVisibilitySettings
  isLoading: boolean
  error: string | null
  
  // Actions
  loadSettings: (userId: string) => Promise<void>
  updateVisibleUsers: (userId: string, visibleUsers: Set<string>) => Promise<void>
  subscribeToChanges: (userId: string) => () => void
  reset: () => void
}

export const useClipboardVisibilityStore = create<ClipboardVisibilityStore>((set, get) => ({
  settings: {
    visibleUsers: new Set(),
    lastUpdated: null
  },
  isLoading: false,
  error: null,

  loadSettings: async (userId: string) => {
    if (!db) {
      set({ error: 'Firebase not initialized' })
      return
    }

    set({ isLoading: true, error: null })

    try {
      const docRef = doc(db, 'users', userId, 'settings', 'clipboard-visibility')
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        const data = docSnap.data()
        set({
          settings: {
            visibleUsers: new Set((data.visibleUsers || []) as string[]),
            lastUpdated: data.lastUpdated?.toDate() || null
          },
          isLoading: false
        })
      } else {
        // Initialize with empty settings
        set({
          settings: {
            visibleUsers: new Set(),
            lastUpdated: null
          },
          isLoading: false
        })
      }
    } catch (error) {
      console.error('Error loading clipboard visibility settings:', error)
      set({ 
        error: 'Failed to load clipboard visibility settings',
        isLoading: false 
      })
    }
  },

  updateVisibleUsers: async (userId: string, visibleUsers: Set<string>) => {
    if (!db) {
      set({ error: 'Firebase not initialized' })
      return
    }

    try {
      const docRef = doc(db, 'users', userId, 'settings', 'clipboard-visibility')
      await setDoc(docRef, {
        visibleUsers: Array.from(visibleUsers),
        lastUpdated: new Date()
      }, { merge: true })

      set({
        settings: {
          visibleUsers,
          lastUpdated: new Date()
        },
        error: null
      })
    } catch (error) {
      console.error('Error updating clipboard visibility settings:', error)
      set({ error: 'Failed to update clipboard visibility settings' })
    }
  },

  subscribeToChanges: (userId: string) => {
    if (!db) {
      console.warn('Firebase not initialized, cannot subscribe to changes')
      return () => {}
    }

    const docRef = doc(db, 'users', userId, 'settings', 'clipboard-visibility')
    
    const unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data()
        set({
          settings: {
            visibleUsers: new Set((data.visibleUsers || []) as string[]),
            lastUpdated: data.lastUpdated?.toDate() || null
          }
        })
      }
    }, (error) => {
      console.error('Error subscribing to clipboard visibility changes:', error)
      set({ error: 'Failed to subscribe to clipboard visibility changes' })
    })

    return unsubscribe
  },

  reset: () => {
    set({
      settings: {
        visibleUsers: new Set(),
        lastUpdated: null
      },
      isLoading: false,
      error: null
    })
  }
})) 