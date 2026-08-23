import { NextRequest, NextResponse } from 'next/server'

type PlatformResult = {
  platform: string
  available: boolean | null
  username: string
  url?: string
  error?: string
}

async function checkGitHub(username: string): Promise<PlatformResult> {
  try {
    const res = await fetch(`https://api.github.com/users/${username}`, {
      headers: { 'User-Agent': 'username-checker', Accept: 'application/vnd.github.v3+json' },
      next: { revalidate: 30 },
    })
    if (res.status === 404) return { platform: 'github', available: true, username, url: `https://github.com/${username}` }
    if (res.ok) return { platform: 'github', available: false, username, url: `https://github.com/${username}` }
    return { platform: 'github', available: null, username, error: 'rate_limit_or_error' }
  } catch {
    return { platform: 'github', available: null, username, error: 'fetch_failed' }
  }
}

async function checkReddit(username: string): Promise<PlatformResult> {
  try {
    const res = await fetch(`https://www.reddit.com/user/${username}/about.json`, {
      headers: { 'User-Agent': 'username-checker/1.0' },
      next: { revalidate: 30 },
    })
    if (res.status === 404) return { platform: 'reddit', available: true, username, url: `https://www.reddit.com/user/${username}` }
    if (res.ok) return { platform: 'reddit', available: false, username, url: `https://www.reddit.com/user/${username}` }
    return { platform: 'reddit', available: null, username, error: 'error' }
  } catch {
    return { platform: 'reddit', available: null, username, error: 'fetch_failed' }
  }
}

async function checkSteam(username: string): Promise<PlatformResult> {
  // Steam custom URL check via community page
  try {
    const res = await fetch(`https://steamcommunity.com/id/${username}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'manual',
      next: { revalidate: 30 },
    })
    // Steam returns 200 even for non-existing sometimes, better check body or status carefully
    // Simple heuristic: if redirected or specific, but for now status based
    if (res.status === 404) return { platform: 'steam', available: true, username, url: `https://steamcommunity.com/id/${username}` }
    // Many non-existing return 200 with error page, so this is approximate
    return { platform: 'steam', available: false, username, url: `https://steamcommunity.com/id/${username}` }
  } catch {
    return { platform: 'steam', available: null, username, error: 'fetch_failed' }
  }
}

async function checkTwitch(username: string): Promise<PlatformResult> {
  try {
    // Public way is limited; using a simple profile check
    const res = await fetch(`https://www.twitch.tv/${username}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 30 },
    })
    // Twitch returns 200 for both, so this is imperfect without API key
    // For demo we treat non-200 as available (rare)
    if (res.status === 404) return { platform: 'twitch', available: true, username, url: `https://www.twitch.tv/${username}` }
    return { platform: 'twitch', available: false, username, url: `https://www.twitch.tv/${username}` }
  } catch {
    return { platform: 'twitch', available: null, username, error: 'fetch_failed' }
  }
}

async function checkYouTube(username: string): Promise<PlatformResult> {
  try {
    const res = await fetch(`https://www.youtube.com/@${username}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 30 },
    })
    if (res.status === 404) return { platform: 'youtube', available: true, username, url: `https://www.youtube.com/@${username}` }
    return { platform: 'youtube', available: false, username, url: `https://www.youtube.com/@${username}` }
  } catch {
    return { platform: 'youtube', available: null, username, error: 'fetch_failed' }
  }
}

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username')?.trim().toLowerCase()
  if (!username || username.length < 1) {
    return NextResponse.json({ error: 'username required' }, { status: 400 })
  }

  // Parallel checks
  const results = await Promise.all([
    checkGitHub(username),
    checkReddit(username),
    checkYouTube(username),
    checkTwitch(username),
    checkSteam(username),
  ])

  return NextResponse.json({
    username,
    results,
    summary: {
      available: results.filter(r => r.available === true).length,
      taken: results.filter(r => r.available === false).length,
      unknown: results.filter(r => r.available === null).length,
    },
  })
}
