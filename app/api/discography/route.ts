import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const artist = req.nextUrl.searchParams.get('q');
    if (!artist) return NextResponse.json({ error: 'Artist query required' }, { status: 400 });

    const geminiKey = req.headers.get('X-Gemini-Key') || process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({ error: 'Gemini API key required' }, { status: 400 });
    }

    const prompt = `List the complete discography of the artist or band "${artist}". Return ONLY valid JSON (no markdown, no code fences):
{
  "artist": {
    "name": "<artist name>",
    "genre": "<primary genre>",
    "origin": "<country/city>",
    "period": "<active years e.g. 1990-present>",
    "albums": <number of studio albums>,
    "listeners": "<approximate monthly listeners e.g. 5M>"
  },
  "tracks": [
    {"artist":"<artist>","track":"<track name>","album":"<album name>","year":"<year>","status":"idle"}
  ]
}
Include all notable tracks from all albums, sorted by album and year. Include at least 30 tracks if available.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 8192 }
        })
      }
    );
    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Gemini error: ${err}` }, { status: 500 });
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let result;
    try {
      result = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      result = match ? JSON.parse(match[0]) : { artist: { name: artist }, tracks: [] };
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('Discography error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
