import { TeamColorMapping, loadMappingsFromFirestore, saveMappingsToFirestore } from '@/utils/team-color-mapping'

// In-memory cache
let mappings: TeamColorMapping[] = []
let loaded = false
let loadingPromise: Promise<TeamColorMapping[]> | null = null

// Listeners for changes
const listeners: Array<() => void> = []

export async function loadTeamColorMappings(forceReload = false): Promise<TeamColorMapping[]> {
  if (loaded && !forceReload) {
    console.log('[Store] Returning cached team color mappings:', mappings)
    return mappings
  }
  if (loadingPromise) {
    console.log('[Store] Waiting for in-progress mapping load...')
    return loadingPromise
  }
  console.log('[Store] Loading team color mappings from Firestore...')
  loadingPromise = loadMappingsFromFirestore().then((data) => {
    mappings = data
    loaded = true
    loadingPromise = null
    listeners.forEach(fn => fn())
    console.log('[Store] Loaded and cached mappings:', mappings)
    return mappings
  })
  return loadingPromise
}

export function getTeamColorMappings(): TeamColorMapping[] {
  return mappings
}

export function getTeamColorMapping(abbreviation: string): TeamColorMapping | undefined {
  return mappings.find(m => m.abbreviation === abbreviation)
}

export async function setTeamColorMappings(newMappings: TeamColorMapping[]): Promise<void> {
  console.log('[Store] setTeamColorMappings called:', newMappings)
  await saveMappingsToFirestore(newMappings)
  mappings = newMappings
  loaded = true
  listeners.forEach(fn => fn())
  console.log('[Store] Updated in-memory mappings:', mappings)
}

export function subscribeToTeamColorMappingChanges(fn: () => void): () => void {
  listeners.push(fn)
  return () => {
    const idx = listeners.indexOf(fn)
    if (idx !== -1) listeners.splice(idx, 1)
  }
} 