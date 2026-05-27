import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { sql } from '@/lib/db';
import bcrypt from 'bcryptjs';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const rows = await sql`SELECT id, email, name, password_hash FROM users WHERE email = ${credentials.email as string}`;
        if (!rows.length) return null;
        const user = rows[0];
        const valid = await bcrypt.compare(credentials.password as string, user.password_hash as string);
        if (!valid) return null;
        return { id: user.id as string, email: user.email as string, name: user.name as string };
      }
    })
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/auth/sign-in' },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string;
      return session;
    }
  }
});
