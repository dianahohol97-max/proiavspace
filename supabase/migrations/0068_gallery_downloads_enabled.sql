-- 0068 · «Клієнт може завантажувати фото» (вкл/викл) для кожної галереї
--
-- Навіщо: фотограф хоче показати клієнту галерею (відбір, погодження), але
-- не віддавати оригінали. Коли вимкнено:
--   - /api/assets/[id]/download і /api/galleries/[slug]/archive-urls
--     відповідають 403 з людським текстом (власник галереї — як і раніше
--     може завантажувати);
--   - у галереї клієнта зникають кнопки «Завантажити оригінал»,
--     «Завантажити все» і підказка про завантаження.
--
-- Безпечно для коду на проді: нова колонка з дефолтом true — усі наявні
-- галереї поводяться як зараз. Код release/4 без цієї міграції теж працює:
-- колонку читає окремий запит (lib/gallery/downloads.ts), і коли її нема,
-- завантаження вважаються дозволеними; перемикач у кабінеті тоді каже, що
-- запрацює після оновлення бази.
--
-- Гранти: public.galleries читається клієнтськими ролями лише за списком
-- колонок (0021, правило з 0032), тож колонку треба видати явно, інакше
-- select з нею падає «permission denied». Писати її може власник
-- (update на galleries у authenticated — табличний, RLS galleries_owner_all).
--
-- Відкат:
--   alter table public.galleries drop column if exists downloads_enabled;

alter table public.galleries
  add column if not exists downloads_enabled boolean not null default true;

grant select (downloads_enabled) on public.galleries to anon, authenticated;
