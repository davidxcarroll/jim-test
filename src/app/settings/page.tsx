'use client'

import { useState } from 'react'
import { ProtectedRoute } from '@/components/protected-route'
import { Navigation } from '@/components/navigation'
import { Toast } from '@/components/toast'
import { GeneralSettings } from '@/components/settings/general-settings'
import { PeopleSettings } from '@/components/settings/people-settings'
import { MoviesSettings } from '@/components/settings/movies-settings'

function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'people' | 'movies'>('general')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  return (
    <div className="w-full font-chakra text-2xl pb-16 select-none">
      <Navigation />
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="flex flex-col lg:px-8 md:px-4 sm:px-2">
        <div className="relative flex flex-col pt-10 pb-16 bg-neutral-100">

          <div className="w-full flex flex-col items-center justify-center">

            <h1 className="font-jim xl:text-7xl lg:text-6xl text-5xl text-center">Settings</h1>

            <ul className="flex flex-row font-bold uppercase max-xl:text-base">
              <li
                className={`flex sm:px-4 px-2 py-2 cursor-pointer ${activeTab === 'general' ? 'underline' : 'opacity-40'}`}
                onClick={() => setActiveTab('general')}
              >
                General
              </li>
              <li
                className={`flex sm:px-4 px-2 py-2 cursor-pointer ${activeTab === 'people' ? 'underline' : 'opacity-40'}`}
                onClick={() => setActiveTab('people')}
              >
                People
              </li>
              <li
                className={`flex sm:px-4 px-2 py-2 cursor-pointer ${activeTab === 'movies' ? 'underline' : 'opacity-40'}`}
                onClick={() => setActiveTab('movies')}
              >
                Movies
              </li>
            </ul>

            <hr className="w-full border-t-[1px] border-black/50" />

          </div>

          {activeTab === 'general' ? (
            <GeneralSettings onToast={setToast} />
          ) : activeTab === 'people' ? (
            <PeopleSettings onToast={setToast} />
          ) : (
            <MoviesSettings onToast={setToast} />
          )}

        </div>

      </div>

    </div>
  )
}

export default function ProtectedSettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsPage />
    </ProtectedRoute>
  )
} 