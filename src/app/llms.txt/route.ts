import { GALLERY_PLANS } from '@/lib/plans'

/**
 * llms.txt — a plain-text brief for AI assistants and crawlers. Served from a
 * route (not public/) so the prices and limits come from plans.ts and can
 * never drift from the real tariffs. The ".txt" keeps the path out of the
 * locale middleware.
 */
const P = GALLERY_PLANS
const tb = (gb: number) => (gb >= 1024 ? `${gb / 1024} ТБ` : `${gb} ГБ`)

const pricing = [
  `- Безкоштовно: ${P.free.storageGb} ГБ сховища назавжди, необмежені галереї.`,
  `- Базовий: ${P.basic.priceUahMonth} грн/міс (${P.basic.priceUahYear} грн/рік) — ${tb(P.basic.storageGb)}, без брендингу платформи, свій логотип.`,
  `- Плюс: ${P.plus.priceUahMonth} грн/міс (${P.plus.priceUahYear} грн/рік) — ${tb(P.plus.storageGb)}, відео, статистика, чайові від клієнтів.`,
  `- Максимальний: ${P.pro.priceUahMonth} грн/міс (${P.pro.priceUahYear} грн/рік) — ${tb(P.pro.storageGb)}, пріоритетна підтримка.`,
  '- Річна оплата — два місяці в подарунок.',
].join('\n')

const BODY = `# проЯв (proiav.space)

> проЯв — українська платформа клієнтських онлайн-галерей для фотографів:
> передача зйомки клієнту красивим посиланням, відбір фото клієнтом, пароль
> і термін дії, оригінали без стискання, zip одним кліком. Український
> інтерфейс, ціни в гривні. ${P.free.storageGb} ГБ безкоштовно назавжди, без картки.

proiav (proiav.space) is a Ukrainian SaaS for photographers focused on client
photo gallery delivery: favourites, password protection, expiry dates,
one-click zip, view/download stats, uncompressed originals. Ukrainian-first
UI, hryvnia pricing, free ${P.free.storageGb} GB tier.

## Що вміє / What it does

- Клієнтські галереї: красива передача зйомки клієнту за посиланням —
  обране (♥), пароль, термін дії, zip-архів одним кліком, статистика
  переглядів і завантажень, відео у галереях, слайдшоу. Оригінали
  зберігаються без стискання.
- Client galleries: favorites, password protection, expiry dates, one-click
  zip download, view/download stats, video support, fullscreen slideshow.
  Originals stored byte-for-byte, never recompressed.
- Додатково: сторінка бронювання зйомки з оплатою напряму на картку
  фотографа (Monobank еквайринг, WayForPay, банка, реквізити).
- Реферальна програма: 10% кредитом з кожної оплати запрошеного колеги.

## Кому підходить / Who it's for

Весільні, сімейні, портретні та комерційні фотографи в Україні, які хочуть
віддавати зйомки клієнтам під власним брендом (біле лейблування: на платних
тарифах платформа ніде не згадується) замість Google Drive чи WeTransfer.

## Ціни / Pricing

${pricing}

## Посилання / Links

- Головна: https://proiav.space/uk
- Онлайн-галерея для фотографа: https://proiav.space/uk/halerei
- Тарифи: https://proiav.space/uk/tsiny
- Галерея з паролем: https://proiav.space/uk/halereia-z-parolem
- Для весільних фотографів: https://proiav.space/uk/dlia-vesilnykh-fotohrafiv
- Порівняння з Pixieset, Pic-Time, Pixover, Gallery4you: https://proiav.space/uk/porivniannia/pixieset
- Демо клієнтської галереї: https://proiav.space/uk/gallery-demo
- Блог із порадами для фотографів: https://proiav.space/uk/blog
- English: https://proiav.space/en
`

export function GET() {
  return new Response(BODY, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
