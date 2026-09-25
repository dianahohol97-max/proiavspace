-- Topic triage: besides todo/done a topic can be a duplicate, already covered,
-- needing a new angle, or not to be written. Only `todo` is picked up by the
-- generator, so every other status is skipped automatically.
alter table public.blog_topics drop constraint if exists blog_topics_status_check;
alter table public.blog_topics
  add constraint blog_topics_status_check
  check (status in ('todo', 'done', 'duplicate', 'covered', 'review', 'skip'));

-- Why a topic got its status (what it duplicates, which article covers it, …).
alter table public.blog_topics add column if not exists note text not null default '';
