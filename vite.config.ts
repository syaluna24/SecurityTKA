
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {
      API_KEY: JSON.stringify(process.env.API_KEY),
      // Integrasi Vercel Postgres / Prisma Connection Strings
      DATABASE_URL: JSON.stringify(process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL),
      SUPABASE_URL: JSON.stringify(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
      SUPABASE_ANON_KEY: JSON.stringify(process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    }
  }
});
