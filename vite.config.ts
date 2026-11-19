import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const publicUrl = mode === 'production' ? '/FamilyTree' : '';
  // Accept the pre-Vite REACT_APP_* names so existing .env files and CI variables keep working.
  const supabaseUrl = env.VITE_SUPABASE_URL || env.REACT_APP_SUPABASE_URL;
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.REACT_APP_SUPABASE_ANON_KEY;

  return {
    base: publicUrl ? `${publicUrl}/` : '/',
    plugins: [react()],
    define: {
      'process.env.REACT_APP_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'process.env.REACT_APP_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
      'process.env.PUBLIC_URL': JSON.stringify(publicUrl),
    },
    build: { outDir: 'build' },
  };
});
