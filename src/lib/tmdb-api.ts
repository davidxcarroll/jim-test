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

class TMDBAPI {
  private baseUrl = 'https://api.themoviedb.org/3'

  constructor() {
    // API key is now handled server-side
  }

  async searchMovies(query: string, page: number = 1): Promise<TMDBMovie[]> {
    if (!query.trim()) {
      return []
    }

    try {
      const response = await fetch(
        `/api/tmdb/search?query=${encodeURIComponent(query)}&page=${page}`
      )

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      return data.results || []
    } catch (error) {
      console.error('Error searching movies:', error)
      return []
    }
  }

  async getMovieDetails(movieId: number): Promise<TMDBMovie | null> {
    try {
      const response = await fetch(
        `/api/tmdb/movie/${movieId}`
      )

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data: TMDBMovie = await response.json()
      return data
    } catch (error) {
      console.error('Error fetching movie details:', error)
      return null
    }
  }

  getPosterUrl(posterPath: string | null, size: 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w185'): string {
    if (!posterPath) {
      return '/images/clip-305.png' // Default placeholder image
    }
    return `https://image.tmdb.org/t/p/${size}${posterPath}`
  }
}

export const tmdbApi = new TMDBAPI()
export type { TMDBMovie } 