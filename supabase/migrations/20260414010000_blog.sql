-- Blog System Migration
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  excerpt text,
  content text,
  cover_image_url text,
  author text default 'Tixora Team',
  published boolean default false,
  published_at timestamptz,
  created_at timestamptz default now()
);

-- Enable RLS
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Public can read published posts
DROP POLICY IF EXISTS "Public read published posts" ON public.blog_posts;
CREATE POLICY "Public read published posts"
  ON public.blog_posts FOR SELECT
  USING (published = true);

-- Admin manage all posts
DROP POLICY IF EXISTS "Admin manage all posts" ON public.blog_posts;
CREATE POLICY "Admin manage all posts"
  ON public.blog_posts FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'yusufquadir50@gmail.com');
