# CORS для бакета B2 `proiav-media` (us-east-005)

Навіщо це потрібно. Експорт альбому (JPEG/PDF/PSD) збирає розвороти **у браузері**. Для цього він робить `fetch()` оригіналів за підписаними B2-посиланнями, отриманими від `signAlbumOriginals`, — це звичайний S3 SigV4 URL, наприклад `https://proiav-media.s3.us-east-005.backblazeb2.com/u/…/o/…jpg?X-Amz-…`.

На відміну від `<img>`, `fetch()` прочитає відповідь лише тоді, коли B2 поверне `Access-Control-Allow-Origin` з нашим доменом. Без правила CORS експорт зупиниться з повідомленням «Сховище не дозволяє браузеру читати оригінали (CORS)».

Запит простий (GET без власних заголовків), тому preflight (OPTIONS) для експорту не потрібен. Правило з `PUT` лишаємо, бо на ньому тримаються завантаження фото й частини multipart.

> ⚠️ Оновлення CORS **замінює весь набір правил** бакета. Якщо залишити лише GET/HEAD, перестануть працювати завантаження (браузер робить `PUT` напряму в B2). Нижче — повний набір: читання і завантаження.

> Адмінський маршрут `/api/admin/storage-cors` ставить одне спільне правило (GET/PUT/HEAD, ті самі домени плюс `*.vercel.app` і `localhost:3000`). Воно теж покриває експорт альбомів. Якщо ви колись його відкривали, CORS, імовірно, вже є — перевірка нижче. Після ручного застосування правил цей маршрут **не відкривайте**: він перезапише їх своїм набором.

## Варіант 1. S3 API (`PutBucketCors`) — той самий шлях, що в адмін-маршруті

`cors-s3.json`:

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://proiav.space", "https://www.proiav.space"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["Content-Length", "Content-Type", "ETag"],
      "MaxAgeSeconds": 86400
    },
    {
      "AllowedOrigins": ["https://proiav.space", "https://www.proiav.space"],
      "AllowedMethods": ["PUT"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 86400
    }
  ]
}
```

Застосувати (AWS CLI з ключем B2, у якого є `writeBuckets`):

```bash
aws s3api put-bucket-cors --endpoint-url https://s3.us-east-005.backblazeb2.com --bucket proiav-media --cors-configuration file://cors-s3.json
```

Перевірити, що збереглося:

```bash
aws s3api get-bucket-cors --endpoint-url https://s3.us-east-005.backblazeb2.com --bucket proiav-media
```

## Варіант 2. b2 CLI (нативні правила B2)

`cors-b2.json`. Операції `s3_*` відповідають запитам через S3 API, а саме ними ходять і завантаження, і експорт:

```json
[
  {
    "corsRuleName": "proiavRead",
    "allowedOrigins": ["https://proiav.space", "https://www.proiav.space"],
    "allowedOperations": ["s3_get", "s3_head"],
    "allowedHeaders": ["*"],
    "exposeHeaders": ["Content-Length", "Content-Type", "ETag"],
    "maxAgeSeconds": 86400
  },
  {
    "corsRuleName": "proiavUpload",
    "allowedOrigins": ["https://proiav.space", "https://www.proiav.space"],
    "allowedOperations": ["s3_put"],
    "allowedHeaders": ["*"],
    "exposeHeaders": ["ETag"],
    "maxAgeSeconds": 86400
  }
]
```

b2 CLI 4.x:

```bash
b2 bucket update --cors-rules "$(cat cors-b2.json)" proiav-media allPrivate
```

b2 CLI 3.x (стара форма команди):

```bash
b2 update-bucket --corsRules "$(cat cors-b2.json)" proiav-media allPrivate
```

Бакет лишається приватним (`allPrivate`): CORS лише дозволяє браузеру прочитати те, на що в нього вже є підписане посилання.

### Прев'ю-деплої й локальна розробка (за потреби)

Щоб завантаження й експорт працювали на `*.vercel.app` і `localhost`, додайте в обидва правила ці origin-и:

```
"https://*.vercel.app", "http://localhost:3000"
```

B2 дозволяє одну зірочку в origin. Для проду вони не потрібні.

## Як перевірити

1. Візьміть будь-яке підписане посилання на оригінал. Наприклад: кабінет → галерея → «Завантажити» на фото, потім скопіюйте адресу, на яку переадресовує `/api/assets/<id>/download`. Або запустіть експорт альбому з відкритими DevTools → Network.
2. Виконайте:

```bash
curl -s -D - -o /dev/null -H "Origin: https://proiav.space" "<підписане посилання>" | grep -i '^access-control'
```

Має бути щонайменше `access-control-allow-origin: https://proiav.space`. Якщо рядків немає — правило не застосувалось або origin записано з помилкою: без `/` у кінці, саме `https://`.

3. У браузері на `https://proiav.space` експорт будь-якого розвороту має дійти до «Готово».

## Що показує експорт, коли щось не так

| Ситуація | Повідомлення |
|---|---|
| CORS не налаштований (або B2 недоступний із мережі) | «Сховище не дозволяє браузеру читати оригінали (CORS)…» з посиланням на цей файл |
| 403 від B2 (посилання прострочене, збитий годинник) | «Сховище відхилило посилання на оригінал (403)…» |
| 404 | «Оригінал … не знайдено у сховищі» |
| Немає мережі | «Немає з'єднання з інтернетом» |
