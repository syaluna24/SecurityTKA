
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {
      API_KEY: JSON.stringify(process.env.API_KEY),
      // DATABASE_URL adalah standar untuk koneksi Vercel Postgres melalui Prisma
      DATABASE_URL: JSON.stringify(process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL)
    }
  }
});
