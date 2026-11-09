-- 0072 — мови листів (feat/i18n-emails → release/4)
--
-- 1) profiles.locale: усі 9 мов інтерфейсу (було лише uk/en, 0001). Кабінет
--    запамʼятовує мову, якою фотограф ним користується; листи фотографу
--    (квитанції, нагадування, lifecycle, реферальні, нове бронювання) йдуть
--    цією мовою.
-- 2) galleries.share_locale — мова посилання, яку фотограф вибрав у
--    «Поділитися»; лист клієнту «Ваші фото готові» йде цією мовою і з цим
--    посиланням. Порожньо → мова профілю фотографа.
--
-- Безпечно для коду на проді: лише ширший CHECK і нова nullable-колонка без
-- дефолту, грант на одну колонку. Код без цієї міграції працює як раніше:
-- запис мови профілю мовчки не проходить (немає гранту), лишається як є, а share_locale
-- читається з урахуванням відсутньої колонки.
--
-- Відкат:
--   alter table public.galleries drop column if exists share_locale;
--   revoke update (locale) on public.profiles from authenticated;
--   update public.profiles set locale = 'en' where locale not in ('uk', 'en');
--   alter table public.profiles drop constraint if exists profiles_locale_check;
--   alter table public.profiles add constraint profiles_locale_check check (locale in ('uk', 'en'));

-- Старий CHECK з 0001 був inline, тож його імʼя згенероване; знімаємо кожен
-- CHECK на profiles, що згадує locale, і ставимо один з відомим імʼям.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'profiles'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%locale%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_locale_check
  check (locale in ('uk', 'en', 'pl', 'de', 'es', 'fr', 'it', 'ro', 'pt'));

-- Кабінет пише мову сам, клієнтом користувача (як display_name, 0040).
grant update (locale) on public.profiles to authenticated;

alter table public.galleries
  add column if not exists share_locale text;

alter table public.galleries
  drop constraint if exists galleries_share_locale_check;
alter table public.galleries
  add constraint galleries_share_locale_check
  check (share_locale is null or share_locale in ('uk', 'en', 'pl', 'de', 'es', 'fr', 'it', 'ro', 'pt'));

-- Як client_email (0066): службове поле листа, пишеться й читається лише
-- через service role з перевіркою власника.
revoke select (share_locale) on public.galleries from anon, authenticated;
revoke update (share_locale) on public.galleries from anon, authenticated;
