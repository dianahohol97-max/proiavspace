-- Blog CMS: AI-generated articles live here as drafts until an admin publishes
-- them in the dashboard. Hand-written "curated" articles stay in code and are
-- always published; the public blog merges both.

create table if not exists public.blog_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  published_date date not null default current_date,
  reading_minutes int not null default 5,
  tags jsonb not null default '[]'::jsonb,
  body jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  source text not null default 'ai',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.blog_articles enable row level security;
drop policy if exists "blog_articles: public read published" on public.blog_articles;
create policy "blog_articles: public read published"
  on public.blog_articles for select using (status = 'published');

create table if not exists public.blog_topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  query text not null,
  angle text not null default '',
  status text not null default 'todo' check (status in ('todo', 'done')),
  position int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.blog_topics enable row level security;
-- No public access — only the service role (generator + admin) touches topics.
-- Seed rows (30 Ukrainian topics) applied via the dashboard migration.
