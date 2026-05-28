import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { artist, track } = await req.json();
    const geminiKey = req.headers.get('X-Gemini-Key') || process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({ error: 'Gemini API key required' }, { status: 400 });
    }

    const prompt = `Analyze the song "${track}" by "${artist}".
Return ONLY valid JSON (no markdown, no code fences, no extra text):
{
  "bubbles": [
    {"type":"genre","label":"Genre & Stil","value":"<primary genre>"},
    {"type":"genre","label":"Genre & Stil","value":"<secondary genre>"},
    {"type":"genre","label":"Genre & Stil","value":"<subgenre>"},
    {"type":"mood","label":"Stimmung","value":"<mood 1>"},
    {"type":"mood","label":"Stimmung","value":"<mood 2>"},
    {"type":"mood","label":"Stimmung","value":"<mood 3>"},
    {"type":"artist","label":"Ähnliche Künstler","value":"<similar artist 1>"},
    {"type":"artist","label":"Ähnliche Künstler","value":"<similar artist 2>"},
    {"type":"artist","label":"Ähnliche Künstler","value":"<similar artist 3>"},
    {"type":"artist","label":"Ähnliche Künstler","value":"<similar artist 4>"},
    {"type":"era","label":"Ära & Bewegung","value":"<era/decade e.g. 90s Indie>"},
    {"type":"era","label":"Ära & Bewegung","value":"<movement e.g. Britpop>"},
    {"type":"era","label":"Ära & Bewegung","value":"<scene e.g. Glasgow Scene>"},
    {"type":"song","label":"Verwandte Songs","value":"<Artist - Track Title>"},
    {"type":"song","label":"Verwandte Songs","value":"<Artist - Track Title>"},
    {"type":"song","label":"Verwandte Songs","value":"<Artist - Track Title>"},
    {"type":"song","label":"Verwandte Songs","value":"<Artist - Track Title>"}
  ],
  "seedPrompt": "<a short 12-word music description suitable for generating a similar playlist>"
}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
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
      result = match ? JSON.parse(match[0]) : { bubbles: [], seedPrompt: '' };
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('Advisor analyze error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
