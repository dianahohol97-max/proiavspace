-- Blog generator v2: long-form, fact-checked articles.
-- Additive only — every column is nullable or defaulted, existing rows keep
-- rendering exactly as before.

alter table public.blog_articles
  -- <title> (≤ 60 chars); falls back to `title` when null.
  add column if not exists seo_title text,
  -- Author slug (src/lib/blog/authors.ts).
  add column if not exists author text not null default 'eva-khudiuk',
  -- Optional co-author, e.g. {"name":"…","url":"https://…","role":"фото"}.
  add column if not exists coauthor jsonb,
  -- dateModified: set only by a real update of a live article (edit or an
  -- applied revision). Null → the article was never updated.
  add column if not exists modified_date date,
  -- Research facts the article was written from (claim, value, url, checked).
  add column if not exists sources jsonb,
  -- Automatic quality check of the current body (see generator/quality.ts).
  add column if not exists quality_report jsonb,
  -- "Update existing article" mode writes the rewrite here instead of the live
  -- fields; the admin applies it in the dashboard (slug + published_date kept).
  add column if not exists revision jsonb;

-- Per-topic brief: mandatory table columns, special sections, etc.
alter table public.blog_topics
  add column if not exists brief text not null default '';
