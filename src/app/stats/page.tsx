import { redirect } from 'next/navigation'

export default function StatsPage() {
  redirect('/settings?tab=stats')
}
