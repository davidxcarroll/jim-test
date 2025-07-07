// Manual team color mapping for background selection
// This allows manual control over which team color to use for backgrounds
// instead of relying on automatic detection

export type BackgroundColorChoice = 'primary' | 'secondary' | 'custom'
export type LogoType = 'default' | 'dark' | 'scoreboard' | 'darkScoreboard'

export interface TeamColorMapping {
  abbreviation: string
  backgroundColorChoice: BackgroundColorChoice
  customColor?: string // Only used if backgroundColorChoice is 'custom'
  logoType?: LogoType // Which logo variation to use
}

// Firebase imports for admin-level storage
import { doc, getDoc, setDoc, collection } from 'firebase/firestore'
import { db } from '@/lib/firebase'

// Firestore collection for team color mappings
const TEAM_COLOR_MAPPINGS_COLLECTION = 'teamColorMappings'
const TEAM_COLOR_MAPPINGS_DOC = 'mappings'

// Load mappings from Firestore or use empty array
export async function loadMappingsFromFirestore(): Promise<TeamColorMapping[]> {
  if (!db) {
    console.warn('Firebase not initialized, cannot load team color mappings')
    return []
  }
  
  try {
    console.log('[Firestore] Loading team color mappings...')
    const docRef = doc(db, TEAM_COLOR_MAPPINGS_COLLECTION, TEAM_COLOR_MAPPINGS_DOC)
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      const data = docSnap.data()
      console.log('[Firestore] Loaded mappings:', data.mappings)
      return data.mappings || []
    }
    
    console.log('[Firestore] No mappings document found')
    return []
  } catch (error) {
    console.error('[Firestore] Error loading team color mappings:', error)
    return []
  }
}

// Save mappings to Firestore
function cleanMapping(mapping: any) {
  return Object.fromEntries(Object.entries(mapping).filter(([_, v]) => v !== undefined))
}

export async function saveMappingsToFirestore(mappings: TeamColorMapping[]): Promise<void> {
  if (!db) {
    console.warn('Firebase not initialized, cannot save team color mappings')
    return
  }
  try {
    // Clean all mappings to remove undefined fields
    const cleanedMappings = mappings.map(cleanMapping)
    console.log('[Firestore] Saving mappings:', cleanedMappings)
    const docRef = doc(db, TEAM_COLOR_MAPPINGS_COLLECTION, TEAM_COLOR_MAPPINGS_DOC)
    await setDoc(docRef, { mappings: cleanedMappings, updatedAt: new Date() })
    console.log('[Firestore] Saved mappings successfully')
  } catch (error) {
    console.error('[Firestore] Error saving team color mappings:', error)
  }
}

// Default mapping - uses primary color for all teams
// You can override specific teams here
export let teamColorMappings: TeamColorMapping[] = []

// Initialize mappings from Firestore
export async function initializeMappings(): Promise<void> {
  teamColorMappings = await loadMappingsFromFirestore()
  console.log('Team color mappings initialized from Firestore:', teamColorMappings.length, 'mappings loaded')
}

// Helper function to get the background color for a team
export function getTeamBackgroundColor(
  team: { abbreviation: string; color?: string; alternateColor?: string },
  mappings: TeamColorMapping[] = teamColorMappings
): string {
  // Find custom mapping for this team
  const mapping = mappings.find(m => m.abbreviation === team.abbreviation)
  
  if (mapping) {
    switch (mapping.backgroundColorChoice) {
      case 'primary':
        return team.color ? `#${team.color}` : '#1a1a1a'
      case 'secondary':
        return team.alternateColor ? `#${team.alternateColor}` : '#1a1a1a'
      case 'custom':
        return mapping.customColor || '#1a1a1a'
    }
  }
  
  // Default: use primary color
  return team.color ? `#${team.color}` : '#1a1a1a'
}

// Helper function to get the logo type for a team
export function getTeamLogoType(
  team: { abbreviation: string },
  mappings: TeamColorMapping[] = teamColorMappings
): LogoType {
  // Find custom mapping for this team
  const mapping = mappings.find(m => m.abbreviation === team.abbreviation)
  
  // Return custom logo type or default to 'dark'
  return mapping?.logoType || 'dark'
}

// Helper function to get all team abbreviations for the mapping interface
export function getAllTeamAbbreviations(): string[] {
  return [
    'ARI', 'ATH', 'ATL', 'BAL', 'BOS', 'CHC', 'CHW', 'CIN', 'CLE', 'COL', 'DET',
    'HOU', 'KC', 'LAA', 'LAD', 'MIA', 'MIL', 'MIN', 'NYM', 'NYY', 'PHI',
    'PIT', 'SD', 'SEA', 'SF', 'STL', 'TB', 'TEX', 'TOR', 'WSH'
  ]
}

// Helper function to get current mapping for a team
export function getTeamMapping(abbreviation: string): TeamColorMapping | undefined {
  return teamColorMappings.find(m => m.abbreviation === abbreviation)
}

// Helper function to update a team mapping
export async function updateTeamMapping(
  abbreviation: string, 
  choice: BackgroundColorChoice, 
  customColor?: string,
  logoType?: LogoType
): Promise<void> {
  const existingIndex = teamColorMappings.findIndex(m => m.abbreviation === abbreviation)
  
  if (existingIndex >= 0) {
    // Update existing mapping
    teamColorMappings[existingIndex] = {
      ...teamColorMappings[existingIndex],
      abbreviation,
      backgroundColorChoice: choice,
      customColor: choice === 'custom' ? customColor : undefined,
      logoType: logoType || teamColorMappings[existingIndex].logoType
    }
  } else {
    // Add new mapping
    teamColorMappings.push({
      abbreviation,
      backgroundColorChoice: choice,
      customColor: choice === 'custom' ? customColor : undefined,
      logoType: logoType || 'dark'
    })
  }
  
  // Save to Firestore after updating
  await saveMappingsToFirestore(teamColorMappings)
}

// Helper function to reset all mappings to defaults
export async function resetAllMappings(): Promise<void> {
  teamColorMappings.length = 0
  await saveMappingsToFirestore(teamColorMappings)
}

// Helper function to get all current mappings
export function getAllMappings(): TeamColorMapping[] {
  return [...teamColorMappings]
} 