'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { tmdbApi, TMDBMovie } from '@/lib/tmdb-api'

interface MovieSearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
}

export function MovieSearchInput({ value, onChange, placeholder, className = '' }: MovieSearchInputProps) {
  const [searchResults, setSearchResults] = useState<TMDBMovie[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const searchTimeoutRef = useRef<NodeJS.Timeout>()
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Debounced search function
  const searchMovies = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }

    setIsSearching(true)
    try {
      const results = await tmdbApi.searchMovies(query, 1)
      setSearchResults(results.slice(0, 3)) // Limit to 3 results
      setShowDropdown(results.length > 0)
      setHighlightedIndex(0)
    } catch (error) {
      console.error('Error searching movies:', error)
      setSearchResults([])
      setShowDropdown(false)
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setSearchQuery(newValue)
    onChange(newValue)

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      searchMovies(newValue)
    }, 300)
  }

  // Handle movie selection
  const selectMovie = (movie: TMDBMovie) => {
    const movieTitle = movie.title
    setSearchQuery(movieTitle)
    onChange(movieTitle)
    setShowDropdown(false)
    setSearchResults([])
    inputRef.current?.blur()
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || searchResults.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev => 
          prev < searchResults.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : searchResults.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (searchResults[highlightedIndex]) {
          selectMovie(searchResults[highlightedIndex])
        }
        break
      case 'Escape':
        setShowDropdown(false)
        inputRef.current?.blur()
        break
    }
  }

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current && 
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  // Update search query when value prop changes
  useEffect(() => {
    setSearchQuery(value)
  }, [value])

  const formatReleaseYear = (releaseDate: string) => {
    if (!releaseDate) return ''
    return new Date(releaseDate).getFullYear().toString()
  }

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={searchQuery}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (searchResults.length > 0) {
            setShowDropdown(true)
          }
        }}
        className={`w-full py-2 bg-neutral-100 uppercase text-center font-bold max-xl:text-base placeholder:text-black/30 shadow-[0_0_0_1px_#000000] focus:outline-none focus:bg-white ${className}`}
        placeholder={placeholder}
      />
      
      {/* Loading indicator */}
      {isSearching && (
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
          <span className="material-symbols-sharp animate-spin text-black">progress_activity</span>
        </div>
      )}

      {/* Dropdown */}
      {showDropdown && searchResults.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full bg-white shadow-[0_0_0_1px_#000000,0_10px_20px_rgba(0,0,0,0.5)] overflow-y-auto"
        >
          {searchResults.map((movie, index) => (
            <div
              key={movie.id}
              className={`cursor-pointer hover:bg-black hover:text-white ${
                index === highlightedIndex ? 'bg-black text-white' : ''
              }`}
              onClick={() => selectMovie(movie)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <div className="flex items-center gap-3 shadow-[0_-1px_0_0_#000000]">
                {/* Movie poster thumbnail */}
                <div className="flex-shrink-0 h-24 shadow-[0_0_0_1px_#000000] overflow-hidden">
                  {movie.poster_path ? (
                    <img
                      src={tmdbApi.getPosterUrl(movie.poster_path, 'w92')}
                      alt={`${movie.title} poster`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="material-symbols-sharp text-black/30 text-sm">movie</span>
                    </div>
                  )}
                </div>
                
                {/* Movie title and year */}
                <div className="flex-1 min-w-0">
                  <div className="font-bold max-xl:text-base uppercase leading-none line-clamp-2">
                    {movie.title}
                  </div>
                  <div className="text-xs">
                    {formatReleaseYear(movie.release_date)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 