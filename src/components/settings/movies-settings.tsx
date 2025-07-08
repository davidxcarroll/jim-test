'use client'

import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/auth-store'
import { useRouter } from 'next/navigation'
import { MovieSearchInput } from '@/components/movie-search-input'
import { tmdbApi } from '@/lib/tmdb-api'

interface UserSettings {
  moviePicks: Array<{
    title: string
    tmdbId?: number
    posterPath?: string
  }>
}

interface MoviesSettingsProps {
  onToast: (toast: { message: string; type: 'success' | 'error' }) => void
}

export function MoviesSettings({ onToast }: MoviesSettingsProps) {
  const { user } = useAuthStore()
  const router = useRouter()
  const [settings, setSettings] = useState<UserSettings>({
    moviePicks: Array(10).fill({ title: '', tmdbId: undefined, posterPath: undefined })
  })
  const [saving, setSaving] = useState(false)

  // Load user settings on component mount
  useEffect(() => {
    if (user) {
      loadUserSettings()
    }
  }, [user])

  const loadUserSettings = async () => {
    if (!user) return

    // Check if Firebase is initialized
    if (!db) {
      console.warn('Firebase not initialized, cannot load user settings')
      return
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      if (userDoc.exists()) {
        const data = userDoc.data()
        
        // Handle backward compatibility for moviePicks
        const moviePicks = data.moviePicks || Array(10).fill('')
        const processedMoviePicks = moviePicks.map((movie: any) => {
          if (typeof movie === 'string') {
            // Old format - convert to new format
            return { title: movie, tmdbId: undefined, posterPath: undefined }
          } else if (movie && typeof movie === 'object') {
            // New format - use as is
            return movie
          } else {
            // Invalid format - use empty object
            return { title: '', tmdbId: undefined, posterPath: undefined }
          }
        })
        
        setSettings({
          moviePicks: processedMoviePicks
        })
      }
    } catch (error) {
      console.error('Error loading user settings:', error)
    }
  }

  const handleSave = async () => {
    if (!user || !db) return

    setSaving(true)
    try {
      await setDoc(doc(db, 'users', user.uid), {
        moviePicks: settings.moviePicks,
        updatedAt: new Date()
      }, { merge: true })

      onToast({ message: 'Movie picks saved!', type: 'success' })
      
      // Navigate to dashboard after successful save
      router.push('/dashboard')
    } catch (error) {
      console.error('Error saving movie picks:', error)
      onToast({ message: 'Error saving movie picks', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleMoviePickChange = (index: number, movieData: { title: string; tmdbId?: number; posterPath?: string }) => {
    const newMoviePicks = [...settings.moviePicks]
    newMoviePicks[index] = movieData
    setSettings(prev => ({ ...prev, moviePicks: newMoviePicks }))
    
    // Show toast when a movie is selected from dropdown (has tmdbId)
    if (movieData.tmdbId) {
      onToast({ message: `"${movieData.title}" added to your list!`, type: 'success' })
    }
  }

  const handleMoveMovieUp = (index: number) => {
    if (index === 0) return // Can't move first item up

    const newMoviePicks = [...settings.moviePicks]
    const temp = newMoviePicks[index]
    newMoviePicks[index] = newMoviePicks[index - 1]
    newMoviePicks[index - 1] = temp
    setSettings(prev => ({ ...prev, moviePicks: newMoviePicks }))
  }

  const handleMoveMovieDown = (index: number) => {
    if (index === settings.moviePicks.length - 1) return // Can't move last item down

    const newMoviePicks = [...settings.moviePicks]
    const temp = newMoviePicks[index]
    newMoviePicks[index] = newMoviePicks[index + 1]
    newMoviePicks[index + 1] = temp
    setSettings(prev => ({ ...prev, moviePicks: newMoviePicks }))
  }

  return (
    <div className="w-full max-w-[800px] mx-auto bg-neutral-100 space-y-6 text-center">

      <div className="w-full flex flex-col items-center justify-center py-8 gap-2">
        {settings.moviePicks.map((movie, index) => (
          <div key={index} className="w-full flex flex-row items-center justify-center">
            
            <label htmlFor={`movie-${index + 1}`} className="block xl:w-14 w-10 flex-shrink-0 font-bold text-black uppercase mb-1 text-center max-xl:text-base">
              #{index + 1}
            </label>
            
            {/* Movie poster */}
            <div className="flex-shrink-0 w-[60px] h-[90px] shadow-[0_0_0_1px_#000000] overflow-hidden">
              {movie.posterPath ? (
                <img
                  src={tmdbApi.getPosterUrl(movie.posterPath, 'w92')}
                  alt={`${movie.title} poster`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-neutral-100">
                  <span className="material-symbols-sharp text-black/30 text-sm">movie</span>
                </div>
              )}
            </div>
            
            <MovieSearchInput
              value={movie.title || ''}
              onChange={(value) => {
                if (typeof value === 'string') {
                  // User is typing manually - only update local state, don't save to database
                  const newMoviePicks = [...settings.moviePicks]
                  newMoviePicks[index] = { ...movie, title: value }
                  setSettings(prev => ({ ...prev, moviePicks: newMoviePicks }))
                } else {
                  // User selected from dropdown - update local state and show toast
                  handleMoviePickChange(index, value)
                }
              }}
              placeholder={`#${index + 1} Movie`}
            />
            <div className="w-16 flex flex-row items-center justify-center">
              <button
                onClick={() => handleMoveMovieUp(index)}
                className={`material-symbols-sharp cursor-pointer hover:text-black text-black/50 ${index === 0 ? 'invisible pointer-events-none' : ''}`}
                tabIndex={index === 0 ? -1 : 0}
                aria-disabled={index === 0}
              >
                keyboard_arrow_up
              </button>
              <button
                onClick={() => handleMoveMovieDown(index)}
                className={`material-symbols-sharp cursor-pointer hover:text-black text-black/50 ${index === settings.moviePicks.length - 1 ? 'invisible pointer-events-none' : ''}`}
                tabIndex={index === settings.moviePicks.length - 1 ? -1 : 0}
                aria-disabled={index === settings.moviePicks.length - 1}
              >
                keyboard_arrow_down
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-black text-white py-3 px-4 font-bold uppercase xl:text-3xl text-2xl focus:outline-none disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Done'}
      </button>
      
    </div>
  )
} 