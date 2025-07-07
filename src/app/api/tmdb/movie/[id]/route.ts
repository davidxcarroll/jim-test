import { NextRequest, NextResponse } from 'next/server'

interface TMDBMovie {
  id: number
  title: string
  release_date: string
  poster_path?: string
  overview: string
  vote_average: number
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const movieId = params.id

  if (!movieId) {
    return NextResponse.json({ error: 'Movie ID is required' }, { status: 400 })
  }

  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'TMDB API key not configured' }, { status: 500 })
  }

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/movie/${movieId}?api_key=${apiKey}&language=en-US`
    )

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }

    const data: TMDBMovie = await response.json()
    
    return NextResponse.json({
      id: data.id,
      title: data.title,
      release_date: data.release_date,
      poster_path: data.poster_path,
      overview: data.overview,
      vote_average: data.vote_average
    })
  } catch (error) {
    console.error('Error fetching movie details:', error)
    return NextResponse.json({ error: 'Failed to fetch movie details' }, { status: 500 })
  }
} 