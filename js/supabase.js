// ============================================================
// CONFIG — điền Supabase keys của bạn vào đây
// ============================================================
const SUPABASE_URL = 'https://lyefuvyzbayvpxkbarvh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5ZWZ1dnl6YmF5dnB4a2JhcnZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzk5MjcsImV4cCI6MjA5NTkxNTkyN30.MdPZM38-jpkJ7XFen1_ZI--Ix80UnFVpPxjT2MC35q0';

// ============================================================
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// CATEGORIES load động từ Supabase (bảng `categories`)
// Fallback tạm thời — app.js & admin.js đều gọi loadCategories() trước khi dùng.
let CATEGORIES = [{ id: 'all', label: 'All' }];

async function loadCategories() {
  const { data, error } = await sb
    .from('categories')
    .select('id, label, "order"')
    .order('order', { ascending: true });
  if (!error && data && data.length) {
    CATEGORIES = [{ id: 'all', label: 'All' }, ...data];
  }
  return CATEGORIES;
}

const PAGE_SIZE = 12;
