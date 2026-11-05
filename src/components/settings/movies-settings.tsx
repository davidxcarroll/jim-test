'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/auth-store'
import { useRouter } from 'next/navigation'
import { MovieSearchInput } from '@/components/movie-search-input'
import { tmdbApi } from '@/lib/tmdb-api'
import { useReorderAnimation } from '@/hooks/use-reorder-animation'
import { isHiddenUser } from '@/utils/hidden-user'

interface MoviePick {
    title: string
    tmdbId?: number
    posterPath?: string
    clientId: string
}

interface ProfileOption {
    id: string
    displayName: string
}

interface UserSettings {
    moviePicks: MoviePick[]
}

function createClientId() {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `movie-${Math.random().toString(36).slice(2)}`
}

function createEmptyMoviePick(): MoviePick {
    return { title: '', tmdbId: undefined, posterPath: undefined, clientId: createClientId() }
}

function createEmptyMoviePicks() {
    return Array.from({ length: 10 }, (_, i) => ({
        title: '',
        tmdbId: undefined,
        posterPath: undefined,
        clientId: `movie-init-${i}`
    }))
}

function createdAtMillis(value: unknown): number {
    if (!value || typeof value !== 'object') return 0
    if ('toMillis' in value && typeof value.toMillis === 'function') return value.toMillis()
    if ('seconds' in value && typeof value.seconds === 'number') return value.seconds * 1000
    return 0
}

function parseMoviePicks(raw: unknown): MoviePick[] {
    const moviePicks = Array.isArray(raw) ? raw : Array(10).fill('')
    const processed = moviePicks.map((movie: unknown) => {
        if (typeof movie === 'string') {
            return { title: movie, tmdbId: undefined, posterPath: undefined, clientId: createClientId() }
        }
        if (movie && typeof movie === 'object') {
            const record = movie as { title?: unknown; tmdbId?: unknown; posterPath?: unknown }
            return {
                title: typeof record.title === 'string' ? record.title : '',
                tmdbId: typeof record.tmdbId === 'number' ? record.tmdbId : undefined,
                posterPath: typeof record.posterPath === 'string' ? record.posterPath : undefined,
                clientId: createClientId()
            }
        }
        return createEmptyMoviePick()
    })
    while (processed.length < 10) processed.push(createEmptyMoviePick())
    return processed
}

function serializeMoviePicks(picks: MoviePick[]) {
    return JSON.stringify(picks.map(movie => ({
        title: movie.title || '',
        tmdbId: movie.tmdbId ?? null,
        posterPath: movie.posterPath ?? null,
    })))
}

function top10Heading(displayName: string) {
    const first = displayName.trim().split(/\s+/)[0]
    if (!first) return 'Your Top 10'
    return `${first}'s Top 10`
}

function profileLabel(displayName: string) {
    return displayName.trim() || 'Select'
}

interface MoviesSettingsProps {
    onToast: (toast: { message: string; type: 'success' | 'error' }) => void
}

export function MoviesSettings({ onToast }: MoviesSettingsProps) {
    const { user } = useAuthStore()
    const router = useRouter()
    const [settings, setSettings] = useState<UserSettings>({
        moviePicks: createEmptyMoviePicks()
    })
    const [profiles, setProfiles] = useState<ProfileOption[]>([])
    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
    const [savedSnapshot, setSavedSnapshot] = useState('')
    const [menuOpen, setMenuOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const profileLoadId = useRef(0)
    const movieIds = useMemo(
        () => settings.moviePicks.map(movie => movie.clientId),
        [settings.moviePicks]
    )
    const setItemRef = useReorderAnimation(movieIds)
    const selectedProfile = profiles.find(profile => profile.id === selectedProfileId)
    const heading = top10Heading(selectedProfile?.displayName || '')
    const picksDirty = savedSnapshot !== '' && serializeMoviePicks(settings.moviePicks) !== savedSnapshot

    useEffect(() => {
        if (!menuOpen) return

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element
            if (!target.closest('.profile-selector')) {
                setMenuOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [menuOpen])

    useEffect(() => {
        if (!user || !db) return

        let cancelled = false

        const loadProfiles = async () => {
            try {
                const accountRef = doc(db, 'users', user.uid)
                const profilesQuery = query(collection(db, 'users'), where('ownerUid', '==', user.uid))
                const [accountSnap, profilesSnap] = await Promise.all([
                    getDoc(accountRef),
                    getDocs(profilesQuery)
                ])
                if (cancelled) return

                const accountData = accountSnap.exists() ? accountSnap.data() : {}
                const accountName = typeof accountData.displayName === 'string' ? accountData.displayName : ''
                const owned = profilesSnap.docs
                    .filter((profileDoc) => profileDoc.id !== user.uid && !isHiddenUser(profileDoc.data()))
                    .map((profileDoc) => {
                        const data = profileDoc.data()
                        const displayName = typeof data.displayName === 'string' ? data.displayName : ''
                        return {
                            profile: { id: profileDoc.id, displayName },
                            createdAt: data.createdAt
                        }
                    })
                    .sort((a, b) => createdAtMillis(a.createdAt) - createdAtMillis(b.createdAt))
                    .map(({ profile }) => profile)

                const picks = parseMoviePicks(accountData.moviePicks)
                setProfiles([{ id: user.uid, displayName: accountName }, ...owned])
                setSelectedProfileId(user.uid)
                setSettings({ moviePicks: picks })
                setSavedSnapshot(serializeMoviePicks(picks))
            } catch (error) {
                console.error('Error loading movie picks:', error)
            }
        }

        loadProfiles()
        return () => {
            cancelled = true
        }
    }, [user])

    const handleSelectProfile = async (profileId: string) => {
        setMenuOpen(false)
        if (!user || !db || saving || profileId === selectedProfileId) return
        if (!profiles.some(profile => profile.id === profileId)) return
        if (picksDirty && !window.confirm('Leave without saving these movie picks?')) return

        const requestId = ++profileLoadId.current
        try {
            const profileSnap = await getDoc(doc(db, 'users', profileId))
            if (requestId !== profileLoadId.current) return
            const picks = parseMoviePicks(profileSnap.exists() ? profileSnap.data().moviePicks : undefined)
            setSelectedProfileId(profileId)
            setSettings({ moviePicks: picks })
            setSavedSnapshot(serializeMoviePicks(picks))
        } catch (error) {
            console.error('Error loading movie picks:', error)
            onToast({ message: 'Error loading movie picks', type: 'error' })
        }
    }

    const handleSave = async () => {
        if (!user || !db || !selectedProfileId || saving) return
        if (!profiles.some(profile => profile.id === selectedProfileId)) return

        setSaving(true)
        try {
            const sanitizedMoviePicks = settings.moviePicks.map(movie => ({
                title: movie.title || '',
                tmdbId: movie.tmdbId ?? null,
                posterPath: movie.posterPath ?? null,
            }))

            await setDoc(doc(db, 'users', selectedProfileId), {
                moviePicks: sanitizedMoviePicks,
                updatedAt: new Date()
            }, { merge: true })

            setSavedSnapshot(serializeMoviePicks(settings.moviePicks))
            onToast({ message: 'Movie picks saved!', type: 'success' })
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
        newMoviePicks[index] = { ...movieData, clientId: newMoviePicks[index].clientId }
        setSettings(prev => ({ ...prev, moviePicks: newMoviePicks }))

        if (movieData.tmdbId) {
            onToast({ message: `"${movieData.title}" added to your list!`, type: 'success' })
        }
    }

    const handleMoveMovieUp = (index: number) => {
        if (index === 0) return

        const newMoviePicks = [...settings.moviePicks]
        const temp = newMoviePicks[index]
        newMoviePicks[index] = newMoviePicks[index - 1]
        newMoviePicks[index - 1] = temp
        setSettings(prev => ({ ...prev, moviePicks: newMoviePicks }))
    }

    const handleMoveMovieDown = (index: number) => {
        if (index === settings.moviePicks.length - 1) return

        const newMoviePicks = [...settings.moviePicks]
        const temp = newMoviePicks[index]
        newMoviePicks[index] = newMoviePicks[index + 1]
        newMoviePicks[index + 1] = temp
        setSettings(prev => ({ ...prev, moviePicks: newMoviePicks }))
    }

    const handleRemoveMovie = (index: number) => {
        const newMoviePicks = [...settings.moviePicks]
        newMoviePicks[index] = { ...createEmptyMoviePick(), clientId: newMoviePicks[index].clientId }
        setSettings(prev => ({ ...prev, moviePicks: newMoviePicks }))
    }

    return (
        <div className="w-full max-w-[1000px] min-w-0 mx-auto bg-neutral-100 space-y-6 text-center">

            <div className="w-full min-w-0 flex flex-col items-center justify-center sm:py-4 gap-2">

                <div className={`w-full min-w-0 flex flex-row flex-wrap items-center sm:mb-6 mb-2 px-4 ${profiles.length > 1 ? 'justify-between sm:gap-x-8 gap-x-4' : 'justify-center'}`}>
                    <h1 className="uppercase font-bold xl:text-4xl text-2xl text-center min-w-0 whitespace-nowrap">{heading}</h1>
                    {profiles.length > 1 && (
                        <div className="profile-selector relative shrink-0">
                            <div
                                className="w-fit flex items-center justify-between gap-1 p-2 pl-4 bg-neutral-100 whitespace-nowrap font-bold uppercase xl:text-base text-sm shadow-[inset_0_0_0_1px_#000000] cursor-pointer"
                                onClick={() => setMenuOpen(open => !open)}
                            >
                                {profileLabel(selectedProfile?.displayName || '')}
                                <span className="material-symbols-sharp">
                                    arrow_drop_down
                                </span>
                            </div>
                            {menuOpen && (
                                <div className="absolute top-full right-0 z-[70] mt-1 min-w-full w-max max-w-[70vw] bg-white shadow-[inset_0_0_0_1px_#000000] shadow-2xl max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-black scrollbar-track-black xl:text-base text-sm">
                                    {profiles.map((profile) => (
                                        <div
                                            key={profile.id}
                                            className={`px-3 py-2 cursor-pointer hover:bg-black hover:text-white font-bold text-center uppercase ${profile.id === selectedProfileId ? 'bg-black/30' : ''}`}
                                            onClick={() => handleSelectProfile(profile.id)}
                                        >
                                            {profileLabel(profile.displayName)}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {settings.moviePicks.map((movie, index) => (
                    <div key={movie.clientId} ref={setItemRef(movie.clientId)} className="w-full min-w-0 flex flex-row items-center justify-center">

                        <label htmlFor={`movie-${index + 1}`} className="block xl:w-12 w-8 flex-shrink-0 font-bold text-black uppercase mb-1 text-center max-xl:text-base">
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
                                    const newMoviePicks = [...settings.moviePicks]
                                    newMoviePicks[index] = { ...movie, title: value }
                                    setSettings(prev => ({ ...prev, moviePicks: newMoviePicks }))
                                } else {
                                    handleMoviePickChange(index, value)
                                }
                            }}
                            onClear={() => handleRemoveMovie(index)}
                            placeholder={`#${index + 1} Movie`}
                        />
                        <div className="w-12 shrink-0 flex flex-row items-center justify-center">
                            <div className="flex flex-col gap-4">
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
                    </div>
                ))}
            </div>

            <button
                onClick={handleSave}
                disabled={saving || !selectedProfileId}
                className="bg-black text-white py-3 px-4 font-bold uppercase xl:text-3xl text-2xl focus:outline-none disabled:opacity-50"
            >
                {saving ? 'Saving...' : 'Done'}
            </button>

        </div>
    )
}
