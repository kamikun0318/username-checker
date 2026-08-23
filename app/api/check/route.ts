import { NextRequest, NextResponse } from 'next/server'

type PlatformResult = {
  platform: string
  available: boolean | null
  username: string
  url?: string
  error?: string
}

const cache = new Map<string, { data: PlatformResult; expires: number }>()
const CACHE_TTL = 10 * 60 * 1000 // 10 min

function getCache(key: string): PlatformResult | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expires) {
    cache.delete(key)
    return null
  }
  return entry.data
}

function setCache(key: string, data: PlatformResult) {
  if (cache.size > 2000) {
    const firstKey = cache.keys().next().value
    if (firstKey) cache.delete(firstKey)
  }
  cache.set(key, { data, expires: Date.now() + CACHE_TTL })
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

async function safeFetch(url: string, init: RequestInit = {}, timeoutMs = 8000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function checkGitHub(username: string): Promise<PlatformResult> {
  const cacheKey = `github:${username}`
  const cached = getCache(cacheKey)
  if (cached) return cached

  try {
    const res = await safeFetch(`https://api.github.com/users/${username}`, {
      headers: { 'User-Agent': 'username-checker', Accept: 'application/vnd.github.v3+json' },
    })

    let result: PlatformResult
    if (res.status === 404) {
      result = { platform: 'github', available: true, username, url: `https://github.com/${username}` }
    } else if (res.ok) {
      result = { platform: 'github', available: false, username, url: `https://github.com/${username}` }
    } else if (res.status === 403 || res.status === 429) {
      result = { platform: 'github', available: null, username, error: 'rate_limited' }
    } else {
      result = { platform: 'github', available: null, username, error: `status_${res.status}` }
    }

    if (result.available !== null) setCache(cacheKey, result)
    return result
  } catch {
    return { platform: 'github', available: null, username, error: 'fetch_failed' }
  }
}

async function checkReddit(username: string): Promise<PlatformResult> {
  const cacheKey = `reddit:${username}`
  const cached = getCache(cacheKey)
  if (cached) return cached

  try {
    const res = await safeFetch(`https://www.reddit.com/user/${username}/about.json`, {
      headers: { 'User-Agent': 'username-checker/1.0' },
    })

    let result: PlatformResult
    if (res.status === 404) {
      result = { platform: 'reddit', available: true, username, url: `https://www.reddit.com/user/${username}` }
    } else if (res.ok) {
      result = { platform: 'reddit', available: false, username, url: `https://www.reddit.com/user/${username}` }
    } else if (res.status === 429) {
      result = { platform: 'reddit', available: null, username, error: 'rate_limited' }
    } else {
      result = { platform: 'reddit', available: null, username, error: `status_${res.status}` }
    }

    if (result.available !== null) setCache(cacheKey, result)
    return result
  } catch {
    return { platform: 'reddit', available: null, username, error: 'fetch_failed' }
  }
}

async function checkDiscord(username: string): Promise<PlatformResult> {
  const cacheKey = `discord:${username}`
  const cached = getCache(cacheKey)
  if (cached) return cached

  if (username.length < 2 || username.length > 32 || !/^[a-z0-9._]+$/.test(username)) {
    const result = { platform: 'discord', available: false, username, error: 'invalid_format' }
    setCache(cacheKey, result)
    return result
  }

  try {
    const res = await safeFetch('https://discord.com/api/v9/unique-username/username-attempt-unauthed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': UA,
        Origin: 'https://discord.com',
        Referer: 'https://discord.com/',
      },
      body: JSON.stringify({ username }),
    })

    let result: PlatformResult

    if (res.status === 200) {
      const data = await res.json()
      result = { platform: 'discord', available: data.taken !== true, username }
    } else if (res.status === 400) {
      const data = await res.json().catch(() => ({}))
      if (typeof data.taken === 'boolean') {
        result = { platform: 'discord', available: !data.taken, username }
      } else {
        result = { platform: 'discord', available: false, username, error: 'invalid_or_reserved' }
      }
    } else if (res.status === 403 || res.status === 429) {
      result = { platform: 'discord', available: null, username, error: 'blocked_or_rate_limited' }
    } else {
      result = { platform: 'discord', available: null, username, error: `status_${res.status}` }
    }

    if (result.available !== null) setCache(cacheKey, result)
    return result
  } catch {
    return { platform: 'discord', available: null, username, error: 'fetch_failed' }
  }
}

async function checkYouTube(username: string): Promise<PlatformResult> {
  const cacheKey = `youtube:${username}`
  const cached = getCache(cacheKey)
  if (cached) return cached

  try {
    const res = await safeFetch(`https://www.youtube.com/@${username}`, {
      headers: { 'User-Agent': UA },
    })

    let result: PlatformResult
    if (res.status === 404) {
      result = { platform: 'youtube', available: true, username, url: `https://www.youtube.com/@${username}` }
    } else if (res.ok) {
      result = { platform: 'youtube', available: false, username, url: `https://www.youtube.com/@${username}` }
    } else {
      result = { platform: 'youtube', available: null, username, error: `status_${res.status}` }
    }

    if (result.available !== null) setCache(cacheKey, result)
    return result
  } catch {
    return { platform: 'youtube', available: null, username, error: 'fetch_failed' }
  }
}

async function checkGitLab(username: string): Promise<PlatformResult> {
  const cacheKey = `gitlab:${username}`
  const cached = getCache(cacheKey)
  if (cached) return cached

  try {
    const res = await safeFetch(`https://gitlab.com/api/v4/users?username=${encodeURIComponent(username)}`, {
      headers: { 'User-Agent': 'username-checker' },
    })

    let result: PlatformResult
    if (res.ok) {
      const data = await res.json()
      const taken = Array.isArray(data) && data.length > 0
      result = { platform: 'gitlab', available: !taken, username, url: `https://gitlab.com/${username}` }
    } else if (res.status === 429) {
      result = { platform: 'gitlab', available: null, username, error: 'rate_limited' }
    } else {
      result = { platform: 'gitlab', available: null, username, error: `status_${res.status}` }
    }

    if (result.available !== null) setCache(cacheKey, result)
    return result
  } catch {
    return { platform: 'gitlab', available: null, username, error: 'fetch_failed' }
  }
}

async function checkHackerNews(username: string): Promise<PlatformResult> {
  const cacheKey = `hackernews:${username}`
  const cached = getCache(cacheKey)
  if (cached) return cached

  try {
    const res = await safeFetch(`https://hacker-news.firebaseio.com/v0/user/${username}.json`, {
      headers: { 'User-Agent': 'username-checker' },
    })

    if (!res.ok) {
      return { platform: 'hackernews', available: null, username, error: `status_${res.status}` }
    }

    const data = await res.json()
    const available = data === null
    const result: PlatformResult = {
      platform: 'hackernews',
      available,
      username,
      url: available ? undefined : `https://news.ycombinator.com/user?id=${username}`,
    }
    setCache(cacheKey, result)
    return result
  } catch {
    return { platform: 'hackernews', available: null, username, error: 'fetch_failed' }
  }
}

async function checkTwitch(username: string): Promise<PlatformResult> {
  const cacheKey = `twitch:${username}`
  const cached = getCache(cacheKey)
  if (cached) return cached

  try {
    const res = await safeFetch(`https://www.twitch.tv/${username}`, {
      headers: { 'User-Agent': UA },
    })

    let result: PlatformResult
    if (res.status === 404) {
      result = { platform: 'twitch', available: true, username, url: `https://www.twitch.tv/${username}` }
    } else {
      result = { platform: 'twitch', available: false, username, url: `https://www.twitch.tv/${username}` }
    }
    setCache(cacheKey, result)
    return result
  } catch {
    return { platform: 'twitch', available: null, username, error: 'fetch_failed' }
  }
}

async function checkSteam(username: string): Promise<PlatformResult> {
  const cacheKey = `steam:${username}`
  const cached = getCache(cacheKey)
  if (cached) return cached

  try {
    const res = await safeFetch(`https://steamcommunity.com/id/${username}`, {
      headers: { 'User-Agent': UA },
      redirect: 'manual',
    })

    let result: PlatformResult
    if (res.status === 404) {
      result = { platform: 'steam', available: true, username, url: `https://steamcommunity.com/id/${username}` }
    } else {
      result = { platform: 'steam', available: false, username, url: `https://steamcommunity.com/id/${username}` }
    }
    setCache(cacheKey, result)
    return result
  } catch {
    return { platform: 'steam', available: null, username, error: 'fetch_failed' }
  }
}

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username')?.trim().toLowerCase()
  if (!username || username.length < 1) {
    return NextResponse.json({ error: 'username required' }, { status: 400 })
  }

  const platformsParam = req.nextUrl.searchParams.get('platforms')
  const requested = platformsParam
    ? platformsParam.split(',').map((p) => p.trim().toLowerCase())
    : null

  const allChecks: Record<string, () => Promise<PlatformResult>> = {
    github: () => checkGitHub(username),
    reddit: () => checkReddit(username),
    discord: () => checkDiscord(username),
    youtube: () => checkYouTube(username),
    gitlab: () => checkGitLab(username),
    hackernews: () => checkHackerNews(username),
    twitch: () => checkTwitch(username),
    steam: () => checkSteam(username),
  }

  const toRun = requested
    ? requested.filter((p) => p in allChecks).map((p) => allChecks[p])
    : Object.values(allChecks)

  const results = await Promise.all(toRun.map((fn) => fn()))

  return NextResponse.json({
    username,
    results,
    summary: {
      available: results.filter((r) => r.available === true).length,
      taken: results.filter((r) => r.available === false).length,
      unknown: results.filter((r) => r.available === null).length,
    },
  })
}
