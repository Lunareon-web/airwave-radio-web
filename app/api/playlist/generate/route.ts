import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { prompt, count = 20, exclude = [], currentTrack, advisorContext } = await req.json();
    const geminiKey = req.headers.get('X-Gemini-Key') || process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({ error: 'Gemini API key required' }, { status: 400 });
    }

    const contextLines: string[] = [];
    if (currentTrack?.artist && currentTrack?.track) {
      contextLines.push(`Currently playing: "${currentTrack.track}" by ${currentTrack.artist}`);
    }
    if (advisorContext) {
      contextLines.push(`Musical context: ${advisorContext}`);
    }
    const contextBlock = contextLines.length > 0
      ? `\nContext:\n${contextLines.join('\n')}\n`
      : '';
    const excludeStr = exclude.length > 0
      ? `\nAlready in playlist — do NOT repeat: ${exclude.join(', ')}.`
      : '';

    const systemPrompt = `You are a professional music curator with encyclopedic knowledge across all genres, eras, and styles.

Task: Generate exactly ${count} tracks that authentically match this request: "${prompt}".
${contextBlock}
Rules:
- Every recommendation must be a REAL, VERIFIABLE song by a REAL artist
- Prioritize quality and fit over popularity — include hidden gems and deep cuts alongside classics
- Keep mood, energy, and style consistent throughout the playlist
- Do NOT repeat the same artist more than twice unless specifically requested
- Use the context above to make recommendations that genuinely complement what the user is already listening to
${excludeStr}

Return ONLY a JSON array, no markdown, no commentary:
[{"artist":"Exact Artist Name","track":"Exact Track Title","search_term":"Artist Name Track Title official audio"}]`;

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
