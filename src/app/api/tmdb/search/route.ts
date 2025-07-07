import { NextRequest, NextResponse } from 'next/server'

interface TMDBMovie {
  id: number
  title: string
  release_date: string
  poster_path?: string
  overview: string
  vote_average: number
}

interface TMDBSearchResponse {
  page: number
  results: TMDBMovie[]
  total_pages: number
  total_results: number
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('query')
  const page = searchParams.get('page') || '1'

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 })
  }

  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'TMDB API key not configured' }, { status: 500 })
  }

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}&page=${page}&include_adult=false&language=en-US`
    )

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }

    const data: TMDBSearchResponse = await response.json()
    
    // Limit results to 5 and format them
    const limitedResults = data.results.slice(0, 5).map(movie => ({
      id: movie.id,
      title: movie.title,
      release_date: movie.release_date,
      poster_path: movie.poster_path,
      overview: movie.overview,
      vote_average: movie.vote_average
    }))

    return NextResponse.json({
      results: limitedResults,
      total_results: data.total_results
    })
  } catch (error) {
    console.error('Error searching movies:', error)
    return NextResponse.json({ error: 'Failed to search movies' }, { status: 500 })
  }
} 