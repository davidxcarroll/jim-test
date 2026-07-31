'use client'

import { Navigation } from '@/components/navigation'
import { StatsContent } from '@/components/stats-content'
import { ClipboardFooter } from '@/components/clipboard-footer'

export default function StatsPage() {
  return (
    <div className="font-chakra pb-16 select-none">
      <Navigation />
      <div className="flex flex-col lg:px-8 md:px-4 sm:px-2">
        <div className="flex flex-col pt-10 bg-neutral-100">
          <div className="lg:pt-4 lg:p-16 p-4">
            <StatsContent />
          </div>
        </div>
      </div>
      <ClipboardFooter />
    </div>
  )
}
