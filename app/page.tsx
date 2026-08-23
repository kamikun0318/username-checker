'use client'

import { useState } from 'react'

type PlatformResult = {
  platform: string
  available: boolean | null
  username: string
  url?: string
  error?: string
}

type MultiResult = {
  username: string
  results: PlatformResult[]
  summary: { available: number; taken: number; unknown: number }
}

type FoundItem = {
  username: string
  availableOn: string[]
}

const PLATFORM_LABELS: Record<string, string> = {
  github: 'GitHub',
  reddit: 'Reddit',
  discord: 'Discord',
  youtube: 'YouTube',
  gitlab: 'GitLab',
  hackernews: 'Hacker News',
  twitch: 'Twitch',
  steam: 'Steam',
}

const ALL_PLATFORMS = Object.keys(PLATFORM_LABELS)

export default function Home() {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [multiResult, setMultiResult] = useState<MultiResult | null>(null)

  const [autoLength, setAutoLength] = useState(5)
  const [autoCount, setAutoCount] = useState(10)
  const [autoLoading, setAutoLoading] = useState(false)
  const [foundList, setFoundList] = useState<FoundItem[]>([])
  const [checkedCount, setCheckedCount] = useState(0)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([
    'github',
    'reddit',
    'discord',
    'gitlab',
  ])

  const togglePlatform = (p: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    )
  }

  const checkUsername = async () => {
    if (!username.trim()) return
    setLoading(true)
    setMultiResult(null)
    try {
      const res = await fetch(`/api/check?username=${encodeURIComponent(username.trim())}`)
      const data = await res.json()
      setMultiResult(data)
    } catch {
      setMultiResult(null)
    } finally {
      setLoading(false)
    }
  }

  const generateRandom = (len: number) => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let s = ''
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)]
    return s
  }

  const runAutoFinder = async () => {
    if (selectedPlatforms.length === 0) return
    setAutoLoading(true)
    setFoundList([])
    setCheckedCount(0)
    const found: FoundItem[] = []
    const maxTry = Math.min(autoCount, 25)
    const platformsQs = selectedPlatforms.join(',')

    for (let i = 0; i < maxTry; i++) {
      const candidate = generateRandom(autoLength)
      try {
        const res = await fetch(
          `/api/check?username=${encodeURIComponent(candidate)}&platforms=${platformsQs}`
        )
        const data: MultiResult = await res.json()
        setCheckedCount(i + 1)

        const availableOn = data.results
          .filter((r) => r.available === true)
          .map((r) => r.platform)

        if (availableOn.length > 0) {
          found.push({ username: candidate, availableOn })
          setFoundList([...found])
        }
        // レート制限対策で待機
        await new Promise((r) => setTimeout(r, 700))
      } catch {}
    }
    setAutoLoading(false)
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <header className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-indigo-700 mb-2">
            Username Checker + Auto ID Finder
          </h1>
          <p className="text-gray-600">
            8プラットフォーム対応 · キャッシュ & タイムアウト強化済み
          </p>
        </header>

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

          {multiResult && (
            <div className="mt-6">
              <div className="flex gap-4 text-sm mb-4">
                <span className="text-green-600 font-medium">空き {multiResult.summary.available}</span>
                <span className="text-red-500 font-medium">使用中 {multiResult.summary.taken}</span>
                <span className="text-gray-400">不明 {multiResult.summary.unknown}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {multiResult.results.map((r) => (
                  <div
                    key={r.platform}
                    className={`p-4 rounded-xl border flex items-center justify-between ${
                      r.available === true
                        ? 'bg-green-50 border-green-200'
                        : r.available === false
                        ? 'bg-red-50 border-red-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div>
                      <div className="font-medium">{PLATFORM_LABELS[r.platform] || r.platform}</div>
                      <div className="text-sm text-gray-500">{r.username}</div>
                      {r.error && (
                        <div className="text-xs text-orange-500 mt-0.5">{r.error}</div>
                      )}
                    </div>
                    <div className="text-right">
                      {r.available === true && <span className="text-green-700 font-semibold">空き</span>}
                      {r.available === false && <span className="text-red-600 font-semibold">使用中</span>}
                      {r.available === null && <span className="text-gray-400">不明</span>}
                      {r.url && r.platform !== 'discord' && (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-xs text-indigo-600 mt-1 hover:underline"
                        >
                          見る
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-semibold mb-2">自動空きID探し</h2>
          <p className="text-sm text-gray-500 mb-4">
            選択したプラットフォームのみチェック（無駄なリクエストを削減）。レート制限対策で間隔を空けています。
          </p>

          <div className="mb-4">
            <div className="text-sm text-gray-600 mb-2">チェックするプラットフォーム</div>
            <div className="flex flex-wrap gap-2">
              {ALL_PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                    selectedPlatforms.includes(p)
                      ? 'bg-indigo-100 border-indigo-300 text-indigo-800'
                      : 'bg-gray-50 border-gray-200 text-gray-500'
                  }`}
                >
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">文字数</label>
              <select
                value={autoLength}
                onChange={(e) => setAutoLength(Number(e.target.value))}
                className="px-3 py-2 border rounded-lg"
              >
                {[4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n}文字
                  </option>
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
                {[5, 10, 15, 20, 25].map((n) => (
                  <option key={n} value={n}>
                    {n}回
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={runAutoFinder}
                disabled={autoLoading || selectedPlatforms.length === 0}
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {autoLoading ? `探索中... (${checkedCount})` : '空きを探す'}
              </button>
            </div>
          </div>

          {foundList.length > 0 && (
            <div className="mt-4">
              <h3 className="font-medium text-green-700 mb-2">見つかった空きID</h3>
              <div className="space-y-2">
                {foundList.map((item) => (
                  <div
                    key={item.username}
                    className="flex flex-wrap items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl"
                  >
                    <span className="font-mono font-semibold text-green-900">{item.username}</span>
                    <span className="text-sm text-green-700">→</span>
                    {item.availableOn.map((p) => (
                      <span
                        key={p}
                        className="px-2 py-0.5 bg-white border border-green-300 rounded text-xs text-green-800"
                      >
                        {PLATFORM_LABELS[p]}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!autoLoading && checkedCount > 0 && foundList.length === 0 && (
            <p className="text-gray-500 mt-3">今回は空きが見つかりませんでした。文字数を増やすか、もう一度試してください。</p>
          )}
        </section>

        <footer className="mt-10 text-center text-sm text-gray-400">
          対応: GitHub / Reddit / Discord / YouTube / GitLab / Hacker News / Twitch / Steam
          <br />
          10分キャッシュ · タイムアウト付き · 選択プラットフォームのみチェック
        </footer>
      </div>
    </main>
  )
}
