import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Username Checker + Auto ID Finder',
  description: '複数プラットフォームでユーザー名の空き状況をチェック & 自動で空きIDを探す',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  )
}
