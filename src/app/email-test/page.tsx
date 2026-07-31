import { notFound } from 'next/navigation'
import { EmailTestClient } from './email-test-client'

export default function EmailTestPage() {
  const enabled =
    process.env.NODE_ENV !== 'production' ||
    process.env.ENABLE_EMAIL_TEST === 'true'

  if (!enabled) {
    notFound()
  }

  return <EmailTestClient />
}
