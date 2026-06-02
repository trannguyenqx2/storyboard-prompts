# Supabase Setup Guide

## 1. Tạo project tại https://supabase.com

## 2. Chạy SQL này trong SQL Editor:

```sql
-- Bảng prompts
CREATE TABLE prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  category TEXT NOT NULL,
  image_url TEXT,
  author TEXT DEFAULT 'LeeveoAI',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Public read" ON prompts
  FOR SELECT USING (true);

-- Admin write (dùng service role key)
CREATE POLICY "Admin write" ON prompts
  FOR ALL USING (true);

-- Index tìm kiếm nhanh
CREATE INDEX idx_prompts_category ON prompts(category);
CREATE INDEX idx_prompts_created_at ON prompts(created_at DESC);

-- Full text search
ALTER TABLE prompts ADD COLUMN fts tsvector
  GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || prompt)) STORED;
CREATE INDEX idx_fts ON prompts USING GIN(fts);
```

## 3. Tạo Storage bucket:
- Vào Storage → New bucket → tên: `storyboard-images`
- Public bucket: ON

## 4. Lấy keys:
- Settings → API
- Copy: Project URL và anon public key → điền vào js/supabase.js
- Copy: service_role key → điền vào admin.html (CONFIG section)

## 5. Deploy lên GitHub Pages:
- Push toàn bộ folder lên GitHub repo
- Settings → Pages → Branch: main / root
