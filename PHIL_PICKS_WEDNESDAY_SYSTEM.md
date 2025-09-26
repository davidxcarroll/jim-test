# Phil Picks Wednesday Generation System

## Overview

Phil's picks are now automatically generated every Wednesday morning at 8 AM PT using a two-pass system. This ensures that Phil's picks are always based on the most up-to-date ESPN API data, including the latest betting odds and team records.

## Two-Pass System

**Pass 1**: Generate picks for the current/upcoming week (new picks)
**Pass 2**: Regenerate picks for the previous week (update existing picks with final data)

## Why Wednesday?

- **ESPN API Alignment**: The ESPN API uses a Wednesday-to-Tuesday week structure
- **Fresh Data**: Wednesday morning ensures we have the latest betting odds and team records
- **Consistency**: All users see Phil's picks at the same time each week
- **Reliability**: Eliminates on-demand generation that might use stale data
- **Accuracy**: Two-pass system ensures picks match favorites as closely as possible

## System Components

### 1. Cron Job (`/api/cron/generate-phil-picks`)

**Schedule**: `0 8 * * 3` (Every Wednesday at 8 AM PT)

**What it does**:
- **Pass 1**: Gets current NFL week from ESPN API and generates picks for upcoming week
- **Pass 2**: Calculates previous week and regenerates picks with final data
- Fetches all games for both weeks
- Generates Phil's picks based on ESPN favorites
- Stores picks in Firebase database
- Provides detailed logging for both passes

### 2. Updated Phil User Utility (`src/utils/phil-user.ts`)

**Enhanced logging**:
- Shows which team Phil picked for each game
- Displays the favorite team for each game
- Confirms picks are correctly aligned with favorites

### 3. Dashboard Changes (`src/app/dashboard/page.tsx`)

**Removed on-demand generation**:
- No longer generates Phil's picks when dashboard loads
- Relies on Wednesday cron job for pick generation
- Prevents stale data issues

## Manual Testing

### Test Script

Use the manual test script to verify the system:

```bash
# Test current week generation
node scripts/generate-phil-picks-wednesday.js

# Force overwrite existing picks
node scripts/generate-phil-picks-wednesday.js --force
```

### Manual Cron Trigger

You can manually trigger the cron job for testing:

```bash
curl -X POST https://your-domain.com/api/cron/generate-phil-picks \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

## Monitoring

### Logs to Watch

The system provides detailed logging:

```
🏈 Starting Wednesday Phil picks generation...
📅 Current week: 3 (regular)
🎮 Found 16 games for current week
🔑 Week key: 2025_week-3
🏈 Phil picks generated:
  ✅ Colts @ Titans: Phil picked Colts (favorite: Colts)
  ✅ Packers @ Browns: Phil picked Packers (favorite: Packers)
  ...
✅ Successfully generated and stored Phil picks for week: 2025_week-3
```

### Verification

Check that Phil's picks are correctly aligned with favorites:
- All picks should show ✅ (correct) status
- Phil should always pick the team marked as favorite
- Picks should be stored in Firebase with proper timestamps

## Troubleshooting

### Common Issues

1. **No games found**: Check if ESPN API is returning data for the current week
2. **Picks already exist**: Use `--force` flag in manual script to overwrite
3. **Cron job fails**: Check Vercel logs and CRON_SECRET environment variable

### Fallback

If the Wednesday cron job fails, you can:
1. Run the manual script to generate picks
2. Check Vercel function logs for errors
3. Verify ESPN API is accessible

## Benefits

1. **Consistency**: Phil's picks are always generated at the same time
2. **Accuracy**: Uses the most up-to-date ESPN API data
3. **Reliability**: Eliminates timing issues with on-demand generation
4. **Transparency**: Detailed logging shows exactly what Phil picked and why
5. **Maintenance**: Automated system reduces manual intervention

## Future Enhancements

- Add email notifications when picks are generated
- Include pick accuracy statistics in logs
- Add retry logic for failed cron jobs
- Monitor pick generation success rates
