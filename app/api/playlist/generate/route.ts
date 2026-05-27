import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { prompt, count = 20, exclude = [] } = await req.json();
    const geminiKey = req.headers.get('X-Gemini-Key') || process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({ error: 'Gemini API key required' }, { status: 400 });
    }
    const excludeStr = exclude.length > 0 ? `Exclude these tracks: ${exclude.join(', ')}. ` : '';
    const systemPrompt = `Generate a playlist of ${count} songs for: "${prompt}". ${excludeStr}Return ONLY a valid JSON array with no markdown, no code fences, no explanation. Format: [{"artist":"Artist Name","track":"Track Name","search_term":"Artist Name Track Name official audio"}]. Make sure artists and tracks are real and well-known.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 4096 }
        })
      }
    );
    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Gemini error: ${err}` }, { status: 500 });
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let tracks = [];
    try {
      tracks = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (match) tracks = JSON.parse(match[0]);
    }
    const playlist = tracks.map((t: { artist: string; track: string; search_term?: string }) => ({
      artist: t.artist,
      track: t.track,
      search_term: t.search_term || `${t.artist} ${t.track}`,
      status: 'idle'
    }));
    return NextResponse.json({ playlist });
  } catch (error) {
    console.error('Playlist generate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
