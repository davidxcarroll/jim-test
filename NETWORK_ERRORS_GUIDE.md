# Network Errors Troubleshooting Guide

## Current Issues Identified

Based on the console errors, your application is experiencing several connectivity problems:

### 1. **Primary Issue: Network Connectivity**
- `net::ERR_ADDRESS_UNREACHABLE` errors indicate your device cannot reach external services
- This affects ESPN API, Firebase, Google Fonts, and other services

### 2. **Firebase Offline Mode**
- Firebase is operating in offline mode due to connectivity issues
- User data, settings, and team color mappings cannot be loaded

### 3. **ESPN API Failures**
- Team data loading is failing at multiple points
- This prevents the Super Bowl pick dropdown from populating

## Solutions Implemented

### ✅ **Enhanced Error Handling**
- Added retry logic with exponential backoff for ESPN API calls
- Improved error messages to prevent app crashes
- Added graceful fallbacks when services are unavailable

### ✅ **Network Status Monitoring**
- Added real-time network status indicator in settings
- Automatic detection of online/offline state
- User-friendly error messages

### ✅ **Firebase Offline Handling**
- Better handling of Firebase offline mode
- Preserves existing data when offline
- Automatic sync when connection is restored

## Immediate Steps to Fix

### 1. **Check Your Internet Connection**
```bash
# Test basic connectivity
ping google.com

# Test specific services
node scripts/test-network.js
```

### 2. **Network Troubleshooting**
- **Disable VPN** if you're using one
- **Try a different network** (mobile hotspot, different WiFi)
- **Check firewall settings** - ensure these domains are allowed:
  - `site.api.espn.com`
  - `firebase.googleapis.com`
  - `identitytoolkit.googleapis.com`
  - `fonts.googleapis.com`
  - `www.googletagmanager.com`

### 3. **Browser Cache Issues**
- Clear browser cache and cookies
- Try incognito/private browsing mode
- Disable browser extensions temporarily

### 4. **DNS Issues**
- Try using different DNS servers (8.8.8.8, 1.1.1.1)
- Flush DNS cache:
  ```bash
  # macOS
  sudo dscacheutil -flushcache
  sudo killall -HUP mDNSResponder
  ```

## Code Improvements Made

### ESPN API Reliability
```typescript
// Added retry logic with exponential backoff
async function fetchWithRetry(url: string, options: RequestInit = {}): Promise<Response> {
  // 3 retries with 1-5 second delays
  // 10 second timeout per attempt
}
```

### Better Error Messages
```typescript
// User-friendly error messages instead of crashes
onToast({ 
  message: 'Unable to load team data. Please check your internet connection.', 
  type: 'error' 
})
```

### Network Status Indicator
```typescript
// Real-time network status in settings
const networkStatus = getNetworkStatusMessage()
// Shows green for online, red for offline
```

## Testing the Fixes

### 1. **Run Network Test**
```bash
node scripts/test-network.js
```

### 2. **Check Browser Console**
- Look for improved error messages
- Network status indicator should appear in settings
- ESPN API calls should retry automatically

### 3. **Test Settings Page**
- Network status should be visible
- Team dropdown should load (if online)
- Error messages should be user-friendly

## Expected Behavior After Fixes

### When Online:
- ✅ Team data loads successfully
- ✅ User settings sync with Firebase
- ✅ Network status shows green
- ✅ All features work normally

### When Offline:
- ⚠️ Network status shows red
- ⚠️ Team data unavailable (shows empty dropdown)
- ⚠️ Settings work locally but don't sync
- ✅ App doesn't crash
- ✅ User-friendly error messages

## Long-term Improvements

### 1. **Offline Support**
- Cache team data locally
- Allow offline team selection
- Sync when connection restored

### 2. **Progressive Web App**
- Add service worker for offline caching
- Installable app experience

### 3. **Better Error Recovery**
- Automatic retry when connection restored
- Background sync for pending changes

## Contact Support

If issues persist after trying these solutions:

1. **Check the network test results**
2. **Note any specific error messages**
3. **Try on a different device/network**
4. **Report the specific error patterns**

The application should now be much more resilient to network issues and provide better feedback when problems occur. 