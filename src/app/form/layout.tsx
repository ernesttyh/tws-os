import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'TWS OS — Design Request',
  description: 'Submit an artwork request to the TWS design team',
}

export default function FormLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
