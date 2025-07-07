'use client'

import { useState, useEffect } from 'react'
import { useTeams } from '@/hooks/use-mlb-data'
import { getTeamDisplayName } from '@/utils/team-names'
import { getTeamLogo } from '@/utils/team-utils'
import { Toast } from '@/components/toast'
import {
  getAllTeamAbbreviations,
  getTeamMapping,
  updateTeamMapping,
  getTeamBackgroundColor,
  loadMappingsFromFirestore,
  initializeMappings,
  resetAllMappings,
  type BackgroundColorChoice,
  type LogoType
} from '@/utils/team-color-mapping'
import { Navigation } from '@/components/navigation'
import { loadTeamColorMappings, setTeamColorMappings, getTeamColorMappings, subscribeToTeamColorMappingChanges } from '@/store/team-color-mapping-store'

export default function TeamColorsPage() {
  const { data: teams } = useTeams()
  const [mappings, setMappings] = useState<Record<string, BackgroundColorChoice>>({})
  const [customColors, setCustomColors] = useState<Record<string, string>>({})
  const [logoTypes, setLogoTypes] = useState<Record<string, LogoType>>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Load current mappings on mount
  useEffect(() => {
    const loadMappings = async () => {
      await loadTeamColorMappings(true)
      const storedMappings = getTeamColorMappings()
      console.log('[TeamColors] Loaded mappings from Firestore:', storedMappings)
      const currentMappings: Record<string, BackgroundColorChoice> = {}
      const currentCustomColors: Record<string, string> = {}
      const currentLogoTypes: Record<string, LogoType> = {}
      getAllTeamAbbreviations().forEach(abbr => {
        const mapping = storedMappings.find((m: any) => m.abbreviation === abbr)
        if (mapping) {
          currentMappings[abbr] = mapping.backgroundColorChoice
          if (mapping.customColor) {
            currentCustomColors[abbr] = mapping.customColor
          }
          if (mapping.logoType) {
            currentLogoTypes[abbr] = mapping.logoType
          }
        }
      })
      setMappings(currentMappings)
      setCustomColors(currentCustomColors)
      setLogoTypes(currentLogoTypes)
    }
    loadMappings()
    // Subscribe to mapping changes
    const unsubscribe = subscribeToTeamColorMappingChanges(() => {
      const storedMappings = getTeamColorMappings()
      console.log('[TeamColors] Mapping changed, loaded from Firestore:', storedMappings)
      const currentMappings: Record<string, BackgroundColorChoice> = {}
      const currentCustomColors: Record<string, string> = {}
      const currentLogoTypes: Record<string, LogoType> = {}
      getAllTeamAbbreviations().forEach(abbr => {
        const mapping = storedMappings.find((m: any) => m.abbreviation === abbr)
        if (mapping) {
          currentMappings[abbr] = mapping.backgroundColorChoice
          if (mapping.customColor) {
            currentCustomColors[abbr] = mapping.customColor
          }
          if (mapping.logoType) {
            currentLogoTypes[abbr] = mapping.logoType
          }
        }
      })
      setMappings(currentMappings)
      setCustomColors(currentCustomColors)
      setLogoTypes(currentLogoTypes)
    })
    return unsubscribe
  }, [])

  const handleColorChoiceChange = async (abbreviation: string, choice: BackgroundColorChoice) => {
    const newMappings = { ...mappings, [abbreviation]: choice }
    setMappings(newMappings)

    // Update the mapping
    const customColor = choice === 'custom' ? customColors[abbreviation] : undefined
    try {
      await updateTeamMapping(abbreviation, choice, customColor, logoTypes[abbreviation])
      setToast({ message: `${getTeamDisplayName(abbreviation)} background updated`, type: 'success' })
    } catch (error) {
      setToast({ message: 'Error saving background choice', type: 'error' })
    }
  }

  const handleLogoTypeChange = async (abbreviation: string, logoType: LogoType) => {
    const newLogoTypes = { ...logoTypes, [abbreviation]: logoType }
    setLogoTypes(newLogoTypes)

    // Update the mapping
    const customColor = mappings[abbreviation] === 'custom' ? customColors[abbreviation] : undefined
    try {
      await updateTeamMapping(abbreviation, mappings[abbreviation] || 'primary', customColor, logoType)
      setToast({ message: `${getTeamDisplayName(abbreviation)} logo updated`, type: 'success' })
    } catch (error) {
      setToast({ message: 'Error saving logo choice', type: 'error' })
    }
  }

  const handleCustomColorChange = async (abbreviation: string, color: string) => {
    const newCustomColors = { ...customColors, [abbreviation]: color }
    setCustomColors(newCustomColors)

    // Update the mapping if this team is using custom color
    if (mappings[abbreviation] === 'custom') {
      try {
        await updateTeamMapping(abbreviation, 'custom', color, logoTypes[abbreviation])
        setToast({ message: `${getTeamDisplayName(abbreviation)} custom color updated`, type: 'success' })
      } catch (error) {
        setToast({ message: 'Error saving custom color', type: 'error' })
      }
    }
  }

  const handleSaveAll = async () => {
    setSaving(true)
    try {
      const allMappings = getAllTeamAbbreviations().map(abbr => ({
        abbreviation: abbr,
        backgroundColorChoice: mappings[abbr] || 'primary',
        customColor: mappings[abbr] === 'custom' ? customColors[abbr] : undefined,
        logoType: logoTypes[abbr] || 'dark'
      }))
      console.log('[TeamColors] Saving mappings to Firestore:', allMappings)
      await setTeamColorMappings(allMappings)
      setToast({ message: 'All team color mappings saved successfully!', type: 'success' })
    } catch (error) {
      setToast({ message: 'Error saving mappings', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleResetAll = async () => {
    if (confirm('Are you sure you want to reset all team color mappings to defaults?')) {
      setSaving(true)
      try {
        await resetAllMappings()
        setMappings({})
        setCustomColors({})
        setLogoTypes({})
        setToast({ message: 'All team color mappings reset to defaults', type: 'success' })
      } catch (error) {
        setToast({ message: 'Error resetting mappings', type: 'error' })
      } finally {
        setSaving(false)
      }
    }
  }

  return (
    <div className="min-h-screen">
      {/* <Navigation /> */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="p-8">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold">Team Color Mapping</h1>
          <div className="flex gap-2">
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white  hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
            >
              {saving ? 'Saving...' : 'Save All'}
            </button>
            <button
              onClick={handleResetAll}
              disabled={saving}
              className="px-4 py-2 bg-red-600 text-white  hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
            >
              {saving ? 'Resetting...' : 'Reset All'}
            </button>
          </div>
        </div>

        {/* Status indicator */}
        <div className="bg-blue-50 border border-blue-200  p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-blue-900">Configuration Status</h3>
              <p className="text-sm text-blue-700">
                {Object.keys(mappings).length} of {getAllTeamAbbreviations().length} teams configured
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-700">
                Changes are saved automatically as you make them
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Use "Save All" to ensure all changes are persisted
              </p>
            </div>
          </div>
        </div>

        {/* Team Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {getAllTeamAbbreviations().map(abbr => {
            const team = teams?.find(t => t.abbreviation === abbr)
            const currentChoice = mappings[abbr] || 'primary'
            const currentLogoType = logoTypes[abbr] || 'dark'

            return (
              <div key={abbr} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                {/* Team Header */}
                {/* <div className="text-center mb-4">
                  <h3 className="font-semibold text-gray-900 mb-1">{getTeamDisplayName(abbr)}</h3>
                  <p className="text-sm text-gray-500">{abbr}</p>
                </div> */}

                {/* Preview Display */}
                <div className="mb-4">
                  <div
                    className="p-3 text-white flex items-center justify-center rounded-md"
                    style={{
                      background: team ?
                        getTeamBackgroundColor(team, Object.entries(mappings).map(([abbr, choice]) => ({
                          abbreviation: abbr,
                          backgroundColorChoice: choice,
                          customColor: choice === 'custom' ? customColors[abbr] : undefined
                        }))) : '#1a1a1a'
                    }}
                  >
                    {team && getTeamLogo(team, currentLogoType) && (
                      <img
                        src={getTeamLogo(team, currentLogoType)}
                        alt={`${team.name} logo`}
                        className="w-12 h-12 mr-2"
                      />
                    )}
                    <span className="font-bold text-sm">{abbr}</span>
                  </div>
                </div>

                {/* Color Choice Selector */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Background Color
                  </label>
                  <div className="space-y-1">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name={`color-${abbr}`}
                        value="primary"
                        checked={currentChoice === 'primary'}
                        onChange={() => handleColorChoiceChange(abbr, 'primary')}
                        className="mr-2"
                      />
                      <span className="text-xs">Primary</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name={`color-${abbr}`}
                        value="secondary"
                        checked={currentChoice === 'secondary'}
                        onChange={() => handleColorChoiceChange(abbr, 'secondary')}
                        className="mr-2"
                      />
                      <span className="text-xs">Secondary</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name={`color-${abbr}`}
                        value="custom"
                        checked={currentChoice === 'custom'}
                        onChange={() => handleColorChoiceChange(abbr, 'custom')}
                        className="mr-2"
                      />
                      <span className="text-xs">Custom</span>
                    </label>
                  </div>

                  {/* Custom Color Input */}
                  {currentChoice === 'custom' && (
                    <div className="mt-2">
                      <input
                        type="color"
                        value={customColors[abbr] || '#000000'}
                        onChange={(e) => handleCustomColorChange(abbr, e.target.value)}
                        className="w-full h-8 border border-gray-300 rounded-md"
                      />
                    </div>
                  )}
                </div>

                {/* Logo Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Logo Type
                  </label>
                  <div className="space-y-1">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name={`logo-${abbr}`}
                        value="default"
                        checked={currentLogoType === 'default'}
                        onChange={() => handleLogoTypeChange(abbr, 'default')}
                        className="mr-2"
                      />
                      <span className="text-xs">Default</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name={`logo-${abbr}`}
                        value="dark"
                        checked={currentLogoType === 'dark'}
                        onChange={() => handleLogoTypeChange(abbr, 'dark')}
                        className="mr-2"
                      />
                      <span className="text-xs">Dark</span>
                    </label>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
} 