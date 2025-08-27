import { create } from 'zustand'
import { doc, getDoc, setDoc, onSnapshot, collection, getDocs, writeBatch } from 'firebase/firestore'
import { db } from '@/lib/firebase'

interface ClipboardVisibilitySettings {
  visibleUsers: Set<string>
  userOrder: string[] // Array of user IDs in the order they should appear
  lastUpdated: Date | null
  showNewUsersByDefault: boolean
}

interface ClipboardVisibilityStore {
  settings: ClipboardVisibilitySettings
  isLoading: boolean
  error: string | null
  
  // Actions
  loadSettings: (userId: string, allUserIds?: string[]) => Promise<void>
  updateVisibleUsers: (userId: string, visibleUsers: Set<string>) => Promise<void>
  updateUserOrder: (userId: string, userOrder: string[]) => Promise<void>
  moveUserInOrder: (userId: string, userToMove: string, direction: 'up' | 'down') => Promise<void>

  addNewUserToAllUsers: (newUserId: string) => Promise<void>
  subscribeToChanges: (userId: string) => () => void
  reset: () => void
}

export const useClipboardVisibilityStore = create<ClipboardVisibilityStore>((set, get) => ({
  settings: {
    visibleUsers: new Set(),
    userOrder: [],
    lastUpdated: null,
    showNewUsersByDefault: true
  },
  isLoading: false,
  error: null,

  loadSettings: async (userId: string, allUserIds?: string[]) => {
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
        // Ensure current user is always first in user order
        let userOrder = (data.userOrder || []) as string[]
        if (!userOrder.includes(userId)) {
          userOrder = [userId, ...userOrder]
        } else if (userOrder[0] !== userId) {
          userOrder = [userId, ...userOrder.filter(id => id !== userId)]
        }
        
        set({
          settings: {
            visibleUsers: new Set((data.visibleUsers || []) as string[]),
            userOrder,
            lastUpdated: data.lastUpdated?.toDate() || null,
            showNewUsersByDefault: data.showNewUsersByDefault !== false // Default to true if not set
          },
          isLoading: false
        })
      } else {
        // Initialize with all users visible by default
        const defaultVisibleUsers = allUserIds ? new Set(allUserIds as string[]) : new Set<string>()
        
        // Initialize user order with current user first, then others
        const defaultUserOrder = allUserIds ? [userId, ...allUserIds.filter(id => id !== userId)] : [userId]
        
        // Save the default settings to Firestore
        await setDoc(docRef, {
          visibleUsers: Array.from(defaultVisibleUsers),
          userOrder: defaultUserOrder,
          lastUpdated: new Date(),
          showNewUsersByDefault: true
        }, { merge: true })
        
        set({
          settings: {
            visibleUsers: defaultVisibleUsers,
            userOrder: defaultUserOrder,
            lastUpdated: new Date(),
            showNewUsersByDefault: true
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
          ...get().settings,
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

  updateUserOrder: async (userId: string, userOrder: string[]) => {
    if (!db) {
      set({ error: 'Firebase not initialized' })
      return
    }

    try {
      const docRef = doc(db, 'users', userId, 'settings', 'clipboard-visibility')
      await setDoc(docRef, {
        userOrder,
        lastUpdated: new Date()
      }, { merge: true })

      set({
        settings: {
          ...get().settings,
          userOrder,
          lastUpdated: new Date()
        },
        error: null
      })
    } catch (error) {
      console.error('Error updating user order:', error)
      set({ error: 'Failed to update user order' })
    }
  },

  moveUserInOrder: async (userId: string, userToMove: string, direction: 'up' | 'down') => {
    let currentOrder = [...get().settings.userOrder]
    
    // If user order is empty, initialize it with all visible users
    if (currentOrder.length === 0) {
      const visibleUsers = Array.from(get().settings.visibleUsers)
      currentOrder = [userId, ...visibleUsers.filter(id => id !== userId)]
    }
    
    const currentIndex = currentOrder.indexOf(userToMove)
    
    if (currentIndex === -1) {
      currentOrder.push(userToMove)
      await get().updateUserOrder(userId, currentOrder)
      return
    }
    
    // Prevent moving the current user (they should always be first)
    if (userToMove === userId) {
      return
    }
    
    let newIndex: number
    if (direction === 'up') {
      newIndex = Math.max(1, currentIndex - 1) // Don't go below index 1 (current user is at 0)
    } else {
      newIndex = Math.min(currentOrder.length - 1, currentIndex + 1)
    }
    
    if (newIndex === currentIndex) {
      return
    }
    
    // Swap the users
    const temp = currentOrder[currentIndex]
    currentOrder[currentIndex] = currentOrder[newIndex]
    currentOrder[newIndex] = temp
    
    await get().updateUserOrder(userId, currentOrder)
  },

  addNewUserToAllUsers: async (newUserId: string) => {
    if (!db) {
      set({ error: 'Firebase not initialized' })
      return
    }

    try {
      // Get all existing users
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const batch = writeBatch(db)
      
      // For each existing user, add the new user to their visible users and user order
      for (const userDoc of usersSnapshot.docs) {
        const existingUserId = userDoc.id
        
        // Skip the new user themselves
        if (existingUserId === newUserId) continue
        
        const settingsRef = doc(db, 'users', existingUserId, 'settings', 'clipboard-visibility')
        const settingsDoc = await getDoc(settingsRef)
        
        if (settingsDoc.exists()) {
          const data = settingsDoc.data()
          const currentVisibleUsers = new Set((data.visibleUsers || []) as string[])
          const currentUserOrder = (data.userOrder || []) as string[]
          
          currentVisibleUsers.add(newUserId)
          
          // Add new user to the end of the user order if not already present
          if (!currentUserOrder.includes(newUserId)) {
            currentUserOrder.push(newUserId)
          }
          
          batch.update(settingsRef, {
            visibleUsers: Array.from(currentVisibleUsers),
            userOrder: currentUserOrder,
            lastUpdated: new Date()
          })
        } else {
          // If no settings exist, create them with the new user visible by default
          batch.set(settingsRef, {
            visibleUsers: [newUserId],
            userOrder: [existingUserId, newUserId], // Current user first, then new user
            lastUpdated: new Date(),
            showNewUsersByDefault: true
          })
        }
      }
      
      await batch.commit()
    } catch (error) {
      console.error('Error adding new user to all users visibility settings:', error)
      set({ error: 'Failed to add new user to all users visibility settings' })
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
        
        // Ensure current user is always first in user order
        let userOrder = (data.userOrder || []) as string[]
        if (!userOrder.includes(userId)) {
          userOrder = [userId, ...userOrder]
        } else if (userOrder[0] !== userId) {
          userOrder = [userId, ...userOrder.filter(id => id !== userId)]
        }
        
        set({
          settings: {
            visibleUsers: new Set((data.visibleUsers || []) as string[]),
            userOrder,
            lastUpdated: data.lastUpdated?.toDate() || null,
            showNewUsersByDefault: data.showNewUsersByDefault !== false
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
        userOrder: [],
        lastUpdated: null,
        showNewUsersByDefault: true
      },
      isLoading: false,
      error: null
    })
  }
})) 