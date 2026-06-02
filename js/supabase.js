// ============================================================
// CONFIG — điền Supabase keys của bạn vào đây
// ============================================================
const SUPABASE_URL = 'https://lyefuvyzbayvpxkbarvh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5ZWZ1dnl6YmF5dnB4a2JhcnZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzk5MjcsImV4cCI6MjA5NTkxNTkyN30.MdPZM38-jpkJ7XFen1_ZI--Ix80UnFVpPxjT2MC35q0';

// ============================================================
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CATEGORIES = [
  { id: 'all',              label: 'All' },
  { id: 'ads-storyboard',   label: 'Ads / Storyboard' },
  { id: 'comic-storyboard', label: 'Comic / Storyboard' },
  { id: 'character-sheet',  label: 'Character Sheet' },
  { id: 'anime-manga',      label: 'Anime / Manga' },
  { id: 'cinematic',        label: 'Cinematic' },
  { id: 'poster-flyer',     label: 'Poster / Flyer' },
  { id: 'infographic',      label: 'Infographic' },
  { id: 'other',            label: 'Other' },
];

const PAGE_SIZE = 12;
