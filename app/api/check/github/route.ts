import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username')?.trim().toLowerCase()

  if (!username || username.length < 1 || username.length > 39) {
    return NextResponse.json({ error: 'Invalid username' }, { status: 400 })
  }

  // GitHub username rules: alphanumeric + hyphen, cannot start/end with hyphen
  if (!/^[a-z0-9]([a-z0-9]|-(?=[a-z0-9]))*$/i.test(username)) {
    return NextResponse.json({ available: false, reason: 'invalid_format' })
  }

  try {
    const res = await fetch(`https://api.github.com/users/${username}`, {
      headers: {
        'User-Agent': 'username-checker',
        'Accept': 'application/vnd.github.v3+json',
      },
      next: { revalidate: 60 },
    })

    if (res.status === 404) {
      return NextResponse.json({ available: true, platform: 'github', username })
    }

    if (res.ok) {
      const data = await res.json()
      return NextResponse.json({
        available: false,
        platform: 'github',
        username,
        profile: {
          login: data.login,
          avatar: data.avatar_url,
          url: data.html_url,
        },
      })
    }

    return NextResponse.json({ available: null, error: 'rate_limited_or_error' }, { status: 502 })
  } catch (e) {
    return NextResponse.json({ available: null, error: 'fetch_failed' }, { status: 500 })
  }
}
