import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sql } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rows = await sql`SELECT id FROM disliked_tracks WHERE user_id = ${session.user.id}`;
  return NextResponse.json({ disliked: rows.map((r: Record<string, unknown>) => r.id as string) });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await req.json();
  await sql`
    INSERT INTO disliked_tracks (id, user_id) VALUES (${id}, ${session.user.id})
    ON CONFLICT DO NOTHING
  `;
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await req.json();
  await sql`DELETE FROM disliked_tracks WHERE id = ${id} AND user_id = ${session.user.id}`;
  return NextResponse.json({ success: true });
}
