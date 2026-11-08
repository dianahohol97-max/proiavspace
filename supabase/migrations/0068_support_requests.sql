-- 0068 · звернення в підтримку (кабінет «Допомога» і публічна /contact)
--
-- support_requests — архів звернень. Кожне звернення також іде листом на
-- hello@proiav.space (Reply-To = email фотографа); таблиця — для історії й
-- статусу в адмінці (/dashboard/stats, блок «Звернення в підтримку»).
--
--   user_id      — власник акаунта, NULL для публічної форми;
--   email        — куди відповідати (з акаунта або з форми);
--   topic        — bug | question | billing | idea;
--   message      — текст, до 5000 символів;
--   context      — що ми передали разом із текстом: url, userAgent, language,
--                  viewport, time, locale, receivedAt, plan (кабінет) або
--                  ipHash (публічна форма; сам IP не зберігаємо, лише sha256 —
--                  щоб рахувати ліміт «5 на годину»);
--   attachments  — [{key, type, size}] скриншотів у приватному бакеті
--                  (support/<user_id>/… або support/public/…);
--   status       — new | answered | closed.
--
-- RLS: вставка лише сервером (service role, маршрут /api/support) — для
-- anon/authenticated немає ні insert-політики, ні гранту. Читати власник
-- може лише свої звернення. Оновлення статусу — лише сервером (адмінка).
--
-- Безпечно для коду на проді: нова таблиця, нічого не змінює. Код цього
-- релізу без міграції теж працює: insert падає → лист однаково йде, помилка
-- в Sentry; ліміт на IP тоді тримає лише памʼять інстансу.
--
-- Відкат:
--   drop table if exists public.support_requests;

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text not null check (char_length(email) between 3 and 254),
  topic text not null check (topic in ('bug', 'question', 'billing', 'idea')),
  message text not null check (char_length(message) between 1 and 5000),
  context jsonb not null default '{}'::jsonb,
  attachments jsonb not null default '[]'::jsonb check (jsonb_typeof(attachments) = 'array'),
  status text not null default 'new' check (status in ('new', 'answered', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists support_requests_created_at_idx
  on public.support_requests (created_at desc);
create index if not exists support_requests_user_id_created_at_idx
  on public.support_requests (user_id, created_at desc)
  where user_id is not null;
-- Ліміт публічної форми: «скільки звернень з цього ipHash за годину».
create index if not exists support_requests_ip_hash_created_at_idx
  on public.support_requests ((context ->> 'ipHash'), created_at desc)
  where user_id is null;

alter table public.support_requests enable row level security;

revoke all on table public.support_requests from anon, authenticated;
grant select on table public.support_requests to authenticated;

drop policy if exists support_requests_select_own on public.support_requests;
create policy support_requests_select_own
  on public.support_requests
  for select
  to authenticated
  using (user_id = (select auth.uid()));
