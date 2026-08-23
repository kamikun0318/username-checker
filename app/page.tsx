'use client'

import { useState } from 'react'

type CheckResult = {
  available: boolean | null
  platform: string
  username: string
  profile?: { login: string; avatar: string; url: string }
  error?: string
  reason?: string
}

export default function Home() {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CheckResult | null>(null)

  // Auto finder state
  const [autoLength, setAutoLength] = useState(5)
  const [autoCount, setAutoCount] = useState(10)
  const [autoLoading, setAutoLoading] = useState(false)
  const [availableList, setAvailableList] = useState<string[]>([])
  const [checkedCount, setCheckedCount] = useState(0)

  const checkUsername = async () => {
    if (!username.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`/api/check/github?username=${encodeURIComponent(username.trim())}`)
      const data = await res.json()
      setResult(data)
    } catch {
      setResult({ available: null, platform: 'github', username, error: 'network_error' })
    } finally {
      setLoading(false)
    }
  }

  const generateRandom = (len: number) => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let s = ''
    for (let i = 0; i < len; i++) {
      s += chars[Math.floor(Math.random() * chars.length)]
    }
    return s
  }

  const runAutoFinder = async () => {
    setAutoLoading(true)
    setAvailableList([])
    setCheckedCount(0)
    const found: string[] = []
    const maxTry = Math.min(autoCount, 50) // safety limit

    for (let i = 0; i < maxTry; i++) {
      const candidate = generateRandom(autoLength)
      try {
        const res = await fetch(`/api/check/github?username=${encodeURIComponent(candidate)}`)
        const data = await res.json()
        setCheckedCount(i + 1)
        if (data.available === true) {
          found.push(candidate)
          setAvailableList([...found])
        }
        // small delay to be gentle
        await new Promise(r => setTimeout(r, 300))
      } catch {
        // skip
      }
    }
    setAutoLoading(false)
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <header className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-indigo-700 mb-3">
            Username Checker + Auto ID Finder
          </h1>
          <p className="text-gray-600">
            ユーザー名の空き確認 & 自動で空きIDを探す（現在GitHub対応）
          </p>
        </header>

        {/* 一括チェック（今はGitHubのみ） */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">ユーザー名チェック</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && checkUsername()}
              placeholder="例: coolname123"
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              onClick={checkUsername}
              disabled={loading || !username.trim()}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? '確認中...' : 'Check'}
            </button>
          </div>

          {result && (
            <div className="mt-6 p-4 rounded-xl border">
              {result.available === true && (
                <div className="text-green-700 font-medium">
                  ✅ <strong>{result.username}</strong> は GitHub で<strong>空き</strong>です！
                </div>
              )}
              {result.available === false && (
                <div className="text-red-600">
                  ❌ <strong>{result.username}</strong> は既に使われています
                  {result.profile && (
                    <a href={result.profile.url} target="_blank" rel="noreferrer" className="ml-2 text-indigo-600 underline">
                      プロフィールを見る
                    </a>
                  )}
                </div>
              )}
              {result.available === null && (
                <div className="text-gray-500">確認できませんでした（{result.error || '不明'}）</div>
              )}
            </div>
          )}
        </section>

        {/* 自動空きID探し */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-semibold mb-2">自動空きID探し（GitHub）</h2>
          <p className="text-sm text-gray-500 mb-4">
            指定した文字数のランダムIDを生成して空きを探します。短いほど見つかりにくいです。
          </p>

          <div className="flex flex-wrap gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">文字数</label>
              <select
                value={autoLength}
                onChange={(e) => setAutoLength(Number(e.target.value))}
                className="px-3 py-2 border rounded-lg"
              >
                {[4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>{n}文字</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">試行回数</label>
              <select
                value={autoCount}
                onChange={(e) => setAutoCount(Number(e.target.value))}
                className="px-3 py-2 border rounded-lg"
              >
                {[5, 10, 20, 30, 50].map((n) => (
                  <option key={n} value={n}>{n}回</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={runAutoFinder}
                disabled={autoLoading}
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {autoLoading ? `探索中... (${checkedCount})` : '空きを探す'}
              </button>
            </div>
          </div>

          {availableList.length > 0 && (
            <div className="mt-4">
              <h3 className="font-medium text-green-700 mb-2">見つかった空きID</h3>
              <div className="flex flex-wrap gap-2">
                {availableList.map((id) => (
                  <a
                    key={id}
                    href={`https://github.com/${id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-green-50 text-green-800 rounded-lg border border-green-200 hover:bg-green-100"
                  >
                    {id}
                  </a>
                ))}
              </div>
            </div>
          )}

          {autoLoading === false && checkedCount > 0 && availableList.length === 0 && (
            <p className="text-gray-500 mt-3">今回は空きが見つかりませんでした。文字数を増やすか、もう一度試してください。</p>
          )}
        </section>

        <footer className="mt-12 text-center text-sm text-gray-400">
          GitHub + Vercel で構築中 · 今後プラットフォームを追加予定
        </footer>
      </div>
    </main>
  )
}
