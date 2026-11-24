'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ProtectedRoute } from '@/components/protected-route'
import { Navigation } from '@/components/navigation'
import { Toast } from '@/components/toast'
import { GeneralSettings } from '@/components/settings/general-settings'
import { StatsSettings } from '@/components/settings/stats-settings'
import { TipsSettings } from '@/components/settings/tips-settings'
import { PeopleSettings } from '@/components/settings/people-settings'
import { MoviesSettings } from '@/components/settings/movies-settings'
import { AdminSettings } from '@/components/settings/admin-settings'
import { useAuthStore } from '@/store/auth-store'
import { isAdminUser } from '@/utils/admin-user'

type SettingsTab = 'general' | 'people' | 'stats' | 'info' | 'movies' | 'admin'

function isSettingsTab(value: string | null): value is SettingsTab {
  return (
    value === 'general' ||
    value === 'people' ||
    value === 'stats' ||
    value === 'info' ||
    value === 'movies' ||
    value === 'admin'
  )
}

function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuthStore()
  const isAdmin = isAdminUser(user?.uid)
  const tabParam = searchParams.get('tab')
  const requestedTab: SettingsTab = isSettingsTab(tabParam) ? tabParam : 'general'
  const activeTab: SettingsTab = requestedTab === 'admin' && !isAdmin ? 'general' : requestedTab
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (tabParam === 'admin' && !isAdmin) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('tab')
      const qs = params.toString()
      router.replace(qs ? `/settings?${qs}` : '/settings', { scroll: false })
    }
  }, [tabParam, isAdmin, router, searchParams])

  const setActiveTab = (tab: SettingsTab) => {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'general') {
      params.delete('tab')
    } else {
      params.set('tab', tab)
    }
    const qs = params.toString()
    router.replace(qs ? `/settings?${qs}` : '/settings', { scroll: false })
  }

  return (
    <div className="w-full max-w-full min-w-0 font-chakra text-2xl pb-16 select-none">
      <Navigation />
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="flex flex-col min-w-0 lg:px-8 md:px-4 sm:px-2">
        <div className="relative flex flex-col min-w-0 sm:pt-10 pt-4 pb-16 bg-neutral-100">

          <div className="w-full min-w-0 flex flex-col items-center justify-center mb-4">

            <h1 className="font-jim xl:text-7xl lg:text-6xl text-5xl text-center">Settings</h1>

            <ul className="w-full flex flex-row sm:gap-[2svw] sm:justify-center justify-evenly font-bold uppercase max-xl:text-base">
              <li
                className={`flex py-2 cursor-pointer ${activeTab === 'general' ? 'underline' : 'opacity-40'}`}
                onClick={() => setActiveTab('general')}
              >
                You
              </li>
              <li
                className={`flex py-2 cursor-pointer ${activeTab === 'people' ? 'underline' : 'opacity-40'}`}
                onClick={() => setActiveTab('people')}
              >
                People
              </li>
              <li
                className={`flex py-2 cursor-pointer ${activeTab === 'stats' ? 'underline' : 'opacity-40'}`}
                onClick={() => setActiveTab('stats')}
              >
                Stats
              </li>
              <li
                className={`flex py-2 cursor-pointer ${activeTab === 'info' ? 'underline' : 'opacity-40'}`}
                onClick={() => setActiveTab('info')}
              >
                Info
              </li>
              <li
                className={`flex py-2 cursor-pointer ${activeTab === 'movies' ? 'underline' : 'opacity-40'}`}
                onClick={() => setActiveTab('movies')}
              >
                Movies
              </li>
              {isAdmin && (
                <li
                  className={`flex py-2 cursor-pointer ${activeTab === 'admin' ? 'underline' : 'opacity-40'}`}
                  onClick={() => setActiveTab('admin')}
                >
                  Admin
                </li>
              )}
            </ul>

            <hr className="w-full border-t-[1px] border-black/50" />

          </div>

          {activeTab === 'general' ? (
            <GeneralSettings onToast={setToast} />
          ) : activeTab === 'people' ? (
            <PeopleSettings onToast={setToast} />
          ) : activeTab === 'stats' ? (
            <StatsSettings />
          ) : activeTab === 'info' ? (
            <TipsSettings />
          ) : activeTab === 'movies' ? (
            <MoviesSettings onToast={setToast} />
          ) : isAdmin ? (
            <AdminSettings />
          ) : (
            <GeneralSettings onToast={setToast} />
          )}

        </div>

      </div>

    </div>
  )
}

export default function ProtectedSettingsPage() {
  return (
    <ProtectedRoute>
      <Suspense>
        <SettingsPage />
      </Suspense>
    </ProtectedRoute>
  )
}
