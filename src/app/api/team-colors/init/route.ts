import { NextResponse } from 'next/server'
import { initializeMappings } from '@/utils/team-color-mapping'

export async function POST() {
  try {
    await initializeMappings()
    return NextResponse.json({ success: true, message: 'Team color mappings initialized' })
  } catch (error) {
    console.error('Error initializing team color mappings:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to initialize team color mappings' },
      { status: 500 }
    )
  }
} 