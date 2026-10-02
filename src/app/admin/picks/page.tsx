import { redirect } from 'next/navigation'

export default function AdminPicksRedirect() {
  redirect('/settings?tab=admin')
}
