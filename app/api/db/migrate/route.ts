import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sql } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    // Split by semicolons and run each statement
    const statements = schema
      .split(';')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    for (const stmt of statements) {
      await sql.unsafe(stmt);
    }
    return NextResponse.json({ success: true, message: 'Schema migrated successfully' });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
