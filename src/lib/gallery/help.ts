/**
 * «Як це працює» blocks next to the gallery features in the dashboard
 * (there is no separate help centre). Kept next to the feature, not in the
 * shared dictionaries, so parallel releases editing uk.ts/en.ts don't
 * conflict. uk and en are full; every other locale falls back to English,
 * like the rest of the dashboard.
 *
 * Every line describes what the code does today — if the behaviour changes,
 * change the text with it:
 *   culling  → components/gallery/CullingPanel.tsx, lib/culling/*
 *   delivery → lib/gallery/delivery.ts (deliveryView), DeliveryStatusControl
 *   upload   → lib/upload/* (multipart 8 MB parts, network wait, resume)
 */

export interface HelpBlock {
  title: string
  items: string[]
}

export interface GalleryHelp {
  culling: HelpBlock
  delivery: HelpBlock
  upload: HelpBlock
}

const uk: GalleryHelp = {
  culling: {
    title: 'Як працює відбір кадрів',
    items: [
      'Натисніть «Відібрати кадри»: браузер перегляне превʼю галереї й позначить розмиті кадри, повтори в серіях і, якщо увімкнено, заплющені очі.',
      'Усе рахується на цьому компʼютері — фото нікуди не надсилаються. Для перевірки очей браузер один раз завантажує модель облич (~4 МБ) з нашого сервера.',
      'Позначки — лише підказки. «Залишити позначку» підтверджує брак, «Прибрати з позначки» каже, що кадр нормальний. У кожній серії один кадр позначено кращим — його можна змінити.',
      'Клієнт нічого не помітить, доки ви не натиснете «Сховати від клієнта». Сховані кадри не видаляються: вони у фільтрі «Сховані від клієнта», і кожен можна повернути.',
      'Поки вкладка прихована, аналіз стоїть на паузі. Його можна скасувати — уже перевірене збережеться, а нові фото потім доаналізуються окремо.',
    ],
  },
  delivery: {
    title: 'Як клієнт бачить статус',
    items: [
      'Оберіть етап — він зберігається одразу. Клієнт побачить його за звичайним посиланням на галерею, окреме посилання не потрібне.',
      'Поки в галереї менше двох фото, видимих клієнту, він бачить екран «Зйомка → Обробка → Готово». Один кадр стає тизером на фоні цього екрана.',
      'Від двох фото відкривається галерея, а етап показує плашка вгорі. «Готово» і «Без статусу» — звичайна галерея без плашки.',
      'Дата необовʼязкова: клієнт побачить «орієнтовно до …». Її можна змінити чи прибрати будь-коли.',
    ],
  },
  upload: {
    title: 'Що робити, якщо завантаження обірвалось',
    items: [
      'Зник інтернет — нічого не робіть і не закривайте вкладку. Зʼявиться «Немає зʼєднання», а завантаження продовжиться саме, щойно мережа повернеться (якщо протягом 15 хвилин).',
      'Великі файли (понад 16 МБ) ідуть частинами по 8 МБ, тож обрив повторює одну частину, а не весь файл.',
      'Закрили вкладку чи браузер — відкрийте цю галерею знову. Над полем буде список незавершених файлів: оберіть саме їх, і великі продовжаться з місця зупинки, а менші завантажаться заново.',
      'Біля файлу ✕ — оберіть цей файл ще раз. Файли, які вже є в галереї нижче, вдруге не додавайте: вони завантажаться повторно.',
    ],
  },
}

const en: GalleryHelp = {
  culling: {
    title: 'How photo culling works',
    items: [
      'Press «Cull photos»: the browser goes through the gallery previews and flags blurry frames, repeats within a burst and, if enabled, closed eyes.',
      'Everything runs on this computer — photos are not sent anywhere. For the eyes check the browser downloads a face model (~4 MB) once, from our own server.',
      'Flags are only suggestions. «Keep flag» confirms a reject, «Remove flag» says the photo is fine. One photo in every burst is marked as the best — you can pick another.',
      'The client notices nothing until you press «Hide from client». Hidden photos are not deleted: they are under the «Hidden from client» filter and each can be brought back.',
      'While the tab is hidden the analysis pauses. You can cancel it — what was already checked is kept, and new photos can be analysed later.',
    ],
  },
  delivery: {
    title: 'How the client sees the status',
    items: [
      'Pick a step — it is saved at once. The client sees it at the usual gallery link; no separate link is needed.',
      'While the gallery has fewer than two photos visible to the client, they see the «Shoot → Editing → Ready» screen. A single photo becomes a teaser behind it.',
      'From two photos on the gallery opens, with the step in a banner on top. «Ready» and «No status» show the usual gallery without a banner.',
      'The date is optional: the client sees «expected by …». You can change or remove it at any time.',
    ],
  },
  upload: {
    title: 'What to do if an upload is interrupted',
    items: [
      'The internet is gone — do nothing and keep the tab open. You will see «No connection», and the upload carries on by itself as soon as the network is back (if it is back within 15 minutes).',
      'Large files (over 16 MB) go up in 8 MB parts, so a drop repeats one part, not the whole file.',
      'The tab or browser was closed — open this gallery again. Above the drop zone you will see the unfinished files: choose exactly those, and large ones continue where they stopped while smaller ones upload again.',
      'A file shows ✕ — choose that file again. Do not re-add files that are already in the gallery below: they would be uploaded twice.',
    ],
  },
}

export function galleryHelp(locale: string): GalleryHelp {
  return locale === 'uk' ? uk : en
}
