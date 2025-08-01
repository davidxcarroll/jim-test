/**
 * Network connectivity utilities
 */

export interface NetworkStatus {
  isOnline: boolean
  isFirebaseConnected: boolean
  lastChecked: Date
}

let networkStatus: NetworkStatus = {
  isOnline: navigator.onLine,
  isFirebaseConnected: true,
  lastChecked: new Date()
}

// Listen for online/offline events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    networkStatus.isOnline = true
    networkStatus.lastChecked = new Date()
    console.log('Network: Back online')
  })

  window.addEventListener('offline', () => {
    networkStatus.isOnline = false
    networkStatus.lastChecked = new Date()
    console.log('Network: Gone offline')
  })
}

/**
 * Check if the device is currently online
 */
export function isOnline(): boolean {
  return navigator.onLine
}

/**
 * Get current network status
 */
export function getNetworkStatus(): NetworkStatus {
  return { ...networkStatus }
}

/**
 * Test connectivity to external services
 */
export async function testConnectivity(): Promise<{
  espn: boolean
  firebase: boolean
  google: boolean
}> {
  const results = {
    espn: false,
    firebase: false,
    google: false
  }

  try {
    // Test ESPN API
    const espnResponse = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams', {
      method: 'HEAD',
      mode: 'no-cors'
    })
    results.espn = true
  } catch (error) {
    console.warn('ESPN API connectivity test failed:', error)
  }

  try {
    // Test Google (for Firebase)
    const googleResponse = await fetch('https://www.googleapis.com', {
      method: 'HEAD',
      mode: 'no-cors'
    })
    results.google = true
  } catch (error) {
    console.warn('Google API connectivity test failed:', error)
  }

  // Firebase connectivity is harder to test without making actual requests
  // We'll assume it's connected if Google is reachable
  results.firebase = results.google

  return results
}

/**
 * Get user-friendly network status message
 */
export function getNetworkStatusMessage(): string {
  if (!isOnline()) {
    return 'You are currently offline. Please check your internet connection.'
  }

  return 'Network connection appears to be working.'
} 