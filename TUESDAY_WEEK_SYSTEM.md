# Tuesday-Based Week System

## Overview

The application now uses a **Tuesday-based week system** where new weeks start every Tuesday. This provides a consistent "pick day" for users and aligns well with the NFL schedule.

## Why Tuesday?

- **Most NFL games are Sunday/Monday**: By Tuesday, all games from the previous week are complete
- **Thursday games are rare**: When they do occur, they're typically early in the week
- **Consistent user experience**: Users know exactly when to expect a new week
- **Optimal timing**: Tuesday gives users time to make picks before the next week's games

## Week Structure

- **Week Start**: Tuesday at 12:00 AM
- **Week End**: Monday at 11:59 PM
- **Pick Day**: Tuesday (indicated with 📅 emoji in the UI)

## Implementation Changes

### Date Helpers (`src/utils/date-helpers.ts`)

Added new functions:
- `getTuesdayWeekRange()` - Get Tuesday-based week range
- `isPickDay()` - Check if a date is Tuesday
- `getNextPickDay()` - Get the next Tuesday
- `getCurrentWeekStart()` - Get current Tuesday-based week start
- `isInCurrentWeek()` - Check if date is in current Tuesday-based week

Updated existing functions:
- `getWeekRange()` - Now uses Tuesday as week start (was Monday)

### Dashboard (`src/app/dashboard/page.tsx`)

- Updated `getStartOfWeekNDaysAgo()` to use `getTuesdayWeekRange()`
- Updated `getAvailableWeeks()` to only show current and past weeks
- Added Tuesday indicator (📅) in week selector
- Week selector now only shows current week if it's Tuesday or if games are complete

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