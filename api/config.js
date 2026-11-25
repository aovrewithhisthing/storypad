/**
 * Vercel Serverless Function: Public Supabase Client Configuration
 * Membaca environment variables dari Vercel Project Settings (tanpa hardcode di repo).
 */
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    ok: true,
    studioName: process.env.STORYPAD_STUDIO_NAME || 'Kelompok 10',
    supabase: {
      url: process.env.SUPABASE_URL || '',
      anonKey: process.env.SUPABASE_ANON_KEY || '',
      projectId: process.env.SUPABASE_PROJECT_ID || '',
      storageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'storypad-media'
    }
  });
};
