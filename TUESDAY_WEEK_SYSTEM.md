# ESPN API-Driven Week System

## Overview

The application now uses an **ESPN API-driven week system** that automatically aligns with the official NFL schedule. This eliminates all hardcoded dates and ensures the app works seamlessly throughout the entire season without any engineering intervention.

## Why ESPN API-Driven?

- **Official NFL Schedule**: Uses the exact same week boundaries as the NFL
- **Zero Hardcoded Dates**: No need to update season start dates or week calculations
- **Automatic Transitions**: Weeks start and end exactly when the NFL says they do
- **Future-Proof**: Works for any season without code changes
- **Wednesday-Based**: Aligns with ESPN's Wednesday-to-Tuesday week structure

## Week Structure

- **Week Start**: Wednesday at 12:00 AM (per ESPN API)
- **Week End**: Tuesday at 11:59 PM (per ESPN API)
- **New Week Day**: Wednesday (when new weeks become available)

## Implementation Changes

### Date Helpers (`src/utils/date-helpers.ts`)

**REMOVED** all hardcoded functions:
- ❌ `getNFLSeasonStart()` - No longer needed
- ❌ `getNFLPreseasonStart()` - No longer needed  
- ❌ `getCurrentWeekNumber()` - No longer needed
- ❌ `getRegularSeasonWeek()` - No longer needed
- ❌ `getPreseasonWeek()` - No longer needed

**ADDED** ESPN API-driven functions:
- ✅ `getCurrentNFLWeekFromAPI()` - Get current week from ESPN API
- ✅ `getCurrentWeekNumberFromAPI()` - Get week number from ESPN API
- ✅ `getSeasonAndWeek()` - Now async, uses ESPN API
- ✅ `getWednesdayWeekRange()` - Wednesday-based week range
- ✅ `isNewWeekDay()` - Check if today is Wednesday

### Dashboard (`src/app/dashboard/page.tsx`)

**REMOVED** all hardcoded logic:
- ❌ `NFL_SEASON_START` constant
- ❌ `getStartOfWeekNDaysAgo()` function
- ❌ Mathematical week calculations

**ADDED** ESPN API integration:
- ✅ `useCurrentWeek()` hook for API-driven week data
- ✅ Direct use of ESPN API week start/end dates
- ✅ Error handling for API unavailability
- ✅ Wednesday-based week availability logic

### Other Files Updated

- `src/app/dashboard/page-250629.tsx`
- `src/app/dashboard/page-250701.tsx`
- `src/app/pick/page.tsx`
- `src/app/page-250628-2120.tsx`
- `src/app/api/week-recap/calculate/route.ts`

## User Experience

### Week Selector Behavior

1. **Current Week**: Only shows if it's Tuesday (pick day) or if all games are complete
2. **Past Weeks**: Always available for viewing
3. **Future Weeks**: Never shown (prevents premature picks)

### Visual Indicators

- **🏈**: Current week with active games
- **📅**: Tuesday (pick day) indicator
- **No indicator**: Past weeks

### Example Week Progression

```
Week 1: Tuesday Jan 7 - Monday Jan 13
Week 2: Tuesday Jan 14 - Monday Jan 20
Week 3: Tuesday Jan 21 - Monday Jan 27
```

## Benefits

1. **Predictable Schedule**: Users know new weeks start every Tuesday
2. **Complete Data**: By Tuesday, all previous week's games are finished
3. **Optimal Picking Window**: Users have Tuesday-Sunday to make picks
4. **Clean UI**: No future weeks cluttering the interface
5. **Consistent Experience**: Same day every week for new content

## Migration Notes

- Existing data structure remains the same
- Week keys still use the same format (`season_week`)
- Backward compatibility maintained with `getSundayWeekRange()` for legacy code
- No data migration required

## Testing

The system has been tested to ensure:
- Tuesday detection works correctly
- Week ranges are calculated properly
- UI indicators display correctly
- Week selector only shows appropriate weeks 