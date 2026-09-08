'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/auth-store'

interface UserRow {
  uid: string
  displayName: string
  email: string
}

export default function UsersPage() {
  const { user } = useAuthStore()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!user) return

    const loadUsers = async () => {
      if (!db) {
        setError('Firebase not initialized. Please refresh the page.')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        const usersQuery = query(collection(db, 'users'), orderBy('displayName'))
        const querySnapshot = await getDocs(usersQuery)

        const usersData: UserRow[] = []
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data()
          usersData.push({
            uid: docSnap.id,
            displayName: data.displayName || 'Unknown',
            email: data.email || '',
          })
        })

        setUsers(usersData)
      } catch (err) {
        console.error('Error loading users:', err)
        setError('Error loading users. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    loadUsers()
  }, [user])

  const emailList = Array.from(
    new Set(
      users
        .map((row) => row.email.trim())
        .filter(Boolean)
    )
  ).join(', ')

  const copyEmails = async () => {
    if (!emailList) return

    try {
      await navigator.clipboard.writeText(emailList)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy emails:', err)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Users</h1>
          <p className="text-gray-600">Please sign in to access admin functions.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-100 font-chakra">
      <div className="">
        <div className="flex items-center justify-between gap-4 p-6">
          <h1 className="text-2xl font-bold text-black uppercase">Users</h1>
          <button
            type="button"
            onClick={copyEmails}
            disabled={loading || !emailList}
            className="bg-black text-white px-4 py-2 border-[1px] border-black font-bold uppercase disabled:opacity-50"
          >
            {copied ? 'Copied' : 'Copy emails'}
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="text-black font-bold uppercase">Loading users...</div>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <div className="text-black font-bold uppercase">{error}</div>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-black font-bold uppercase">No users found</div>
          </div>
        ) : (
          <div className="shadow-[inset_0_0_0_1px_#000000] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-black">
                <thead className="bg-neutral-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">
                      Email
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black">
                  {users.map((row) => (
                    <tr key={row.uid}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-black">
                        {row.displayName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-black">
                        {row.email}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
