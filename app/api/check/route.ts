import { NextRequest, NextResponse } from 'next/server'

type PlatformResult = {
  platform: string
  available: boolean | null
  username: string
  url?: string
  error?: string
}

// Simple in-memory cache to reduce rate limits (works per serverless instance)
const cache = new Map<string, { data: PlatformResult; expires: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

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
  cache.set(key, { data, expires: Date.now() + CACHE_TTL })
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function checkGitHub(username: string): Promise<PlatformResult> {
  const cacheKey = `github:${username}`
  const cached = getCache(cacheKey)
  if (cached) return cached

  try {
    const res = await fetch(`https://api.github.com/users/${username}`, {
      headers: {
        'User-Agent': 'username-checker',
        Accept: 'application/vnd.github.v3+json',
      },
      next: { revalidate: 60 },
    })

    let result: PlatformResult
    if (res.status === 404) {
      result = { platform: 'github', available: true, username, url: `https://github.com/${username}` }
    } else if (res.ok) {
      result = { platform: 'github', available: false, username, url: `https://github.com/${username}` }
    } else if (res.status === 403 || res.status === 429) {
      result = { platform: 'github', available: null, username, error: 'rate_limited' }
    } else {
      result = { platform: 'github', available: null, username, error: 'error' }
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
    const res = await fetch(`https://www.reddit.com/user/${username}/about.json`, {
      headers: { 'User-Agent': 'username-checker/1.0 by username-checker' },
      next: { revalidate: 60 },
    })

    let result: PlatformResult
    if (res.status === 404) {
      result = { platform: 'reddit', available: true, username, url: `https://www.reddit.com/user/${username}` }
    } else if (res.ok) {
      result = { platform: 'reddit', available: false, username, url: `https://www.reddit.com/user/${username}` }
    } else if (res.status === 429) {
      result = { platform: 'reddit', available: null, username, error: 'rate_limited' }
    } else {
      result = { platform: 'reddit', available: null, username, error: 'error' }
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

  // Discord unauthenticated username attempt endpoint
  // Note: often blocked from datacenter IPs (returns 403). Works better from residential.
  try {
    const res = await fetch('https://discord.com/api/v9/unique-username/username-attempt-unauthed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': UA,
        Origin: 'https://discord.com',
        Referer: 'https://discord.com/',
      },
      body: JSON.stringify({ username }),
      next: { revalidate: 30 },
    })

    let result: PlatformResult

    if (res.status === 200) {
      const data = await res.json()
      // { taken: true/false } or similar
      const taken = data.taken === true
      result = {
        platform: 'discord',
        available: !taken,
        username,
        url: `https://discord.com/users`, // no public profile URL for username
      }
    } else if (res.status === 400) {
      // Invalid form body often means username rules violated or taken in some cases
      const data = await res.json().catch(() => ({}))
      // If it has taken field use it, otherwise treat as taken/invalid
      if (typeof data.taken === 'boolean') {
        result = { platform: 'discord', available: !data.taken, username }
      } else {
        result = { platform: 'discord', available: false, username, error: 'invalid_or_taken' }
      }
    } else if (res.status === 403 || res.status === 429) {
      result = { platform: 'discord', available: null, username, error: 'rate_limited_or_blocked' }
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
    const res = await fetch(`https://www.youtube.com/@${username}`, {
      headers: { 'User-Agent': UA },
      next: { revalidate: 60 },
    })

    let result: PlatformResult
    if (res.status === 404) {
      result = { platform: 'youtube', available: true, username, url: `https://www.youtube.com/@${username}` }
    } else if (res.ok) {
      result = { platform: 'youtube', available: false, username, url: `https://www.youtube.com/@${username}` }
    } else {
      result = { platform: 'youtube', available: null, username, error: 'error' }
    }

    if (result.available !== null) setCache(cacheKey, result)
    return result
  } catch {
    return { platform: 'youtube', available: null, username, error: 'fetch_failed' }
  }
}

async function checkTwitch(username: string): Promise<PlatformResult> {
  const cacheKey = `twitch:${username}`
  const cached = getCache(cacheKey)
  if (cached) return cached

  try {
    const res = await fetch(`https://www.twitch.tv/${username}`, {
      headers: { 'User-Agent': UA },
      next: { revalidate: 60 },
    })

    // Twitch is imperfect without API key; 404 is rare
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
    const res = await fetch(`https://steamcommunity.com/id/${username}`, {
      headers: { 'User-Agent': UA },
      redirect: 'manual',
      next: { revalidate: 60 },
    })

    let result: PlatformResult
    if (res.status === 404) {
      result = { platform: 'steam', available: true, username, url: `https://steamcommunity.com/id/${username}` }
    } else {
      // Approximate: many non-existing still return 200
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

  // Discord usernames have rules: 2-32 chars, lowercase letters numbers _ .
  // We still check all platforms even if rules differ

  const results = await Promise.all([
    checkGitHub(username),
    checkReddit(username),
    checkDiscord(username),
    checkYouTube(username),
    checkTwitch(username),
    checkSteam(username),
  ])

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
