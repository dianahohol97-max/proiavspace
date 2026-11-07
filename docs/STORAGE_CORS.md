# CORS бакета B2 (`proiav-media`, us-east-005)

Браузер працює з B2 напряму за підписаними посиланнями:

- **завантаження** (`PUT`, також частини multipart). Треба бачити `ETag` частин, щоб докачування збирало файл без зайвого `ListParts`;
- **читання оригіналів через `fetch()`**: «Завантажити все» в клієнтській галереї (zip у браузері) та експорт альбомів (JPEG/PDF/PSD).

`<img>` і звичайні посилання CORS не потребують — лише `fetch()` і `PUT`.

Повний набір правил записано в коді: `src/lib/storage/cors.ts` (`DESIRED_CORS_RULES`):

| Правило | Origin-и | Методи | Заголовки | ExposeHeaders |
|---|---|---|---|---|
| завантаження | https://proiav.space, https://www.proiav.space, https://*.vercel.app, http://localhost:3000 | PUT | `*` | ETag |
| читання | https://proiav.space, https://www.proiav.space | GET, HEAD | `*` | ETag, Content-Length, Content-Type |

> ⚠️ Запис CORS **замінює весь набір правил** бакета. Тому не застосовуйте окремо лише GET або лише PUT: щоразу пишіть увесь набір.

## Основний шлях: одна адреса в адмінці

Увійдіть адмінським акаунтом (email з allowlist адмінів) і відкрийте:

```
https://proiav.space/api/admin/storage-cors
```

Сторінка:
1. читає поточні правила бакета;
2. якщо вони вже збігаються з повним набором — **нічого не пише** («уже актуальний»);
3. інакше записує повний набір і читає його назад;
4. показує «Було», «Стало» й очікуваний набір.

Відкривати повторно безпечно. Ключ B2 у Vercel (`B2_KEY_ID` / `B2_APPLICATION_KEY`) має мати права `readBuckets` і `writeBuckets`. Без них сторінка скаже про це і порадить запасний шлях.

## Запасний шлях: CLI

Той самий набір у форматі S3 (`cors.json`):

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://proiav.space", "https://www.proiav.space", "https://*.vercel.app", "http://localhost:3000"],
      "AllowedMethods": ["PUT"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    },
    {
      "AllowedOrigins": ["https://proiav.space", "https://www.proiav.space"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

```bash
aws s3api put-bucket-cors --endpoint-url https://s3.us-east-005.backblazeb2.com --bucket proiav-media --cors-configuration file://cors.json
```

```bash
aws s3api get-bucket-cors --endpoint-url https://s3.us-east-005.backblazeb2.com --bucket proiav-media
```

Нативний b2 CLI (`cors-b2.json`, операції `s3_*`, бо застосунок ходить через S3 API):

```json
[
  {
    "corsRuleName": "proiavUpload",
    "allowedOrigins": ["https://proiav.space", "https://www.proiav.space", "https://*.vercel.app", "http://localhost:3000"],
    "allowedOperations": ["s3_put"],
    "allowedHeaders": ["*"],
    "exposeHeaders": ["ETag"],
    "maxAgeSeconds": 3600
  },
  {
    "corsRuleName": "proiavRead",
    "allowedOrigins": ["https://proiav.space", "https://www.proiav.space"],
    "allowedOperations": ["s3_get", "s3_head"],
    "allowedHeaders": ["*"],
    "exposeHeaders": ["ETag", "Content-Length", "Content-Type"],
    "maxAgeSeconds": 3600
  }
]
```

b2 CLI 4.x:

```bash
b2 bucket update --cors-rules "$(cat cors-b2.json)" proiav-media allPrivate
```

b2 CLI 3.x:

```bash
b2 update-bucket --corsRules "$(cat cors-b2.json)" proiav-media allPrivate
```

## Перевірка

Візьміть будь-яке підписане посилання на оригінал (наприклад, адресу, на яку переадресовує `/api/assets/<id>/download`) і виконайте:

```bash
curl -s -D - -o /dev/null -H "Origin: https://proiav.space" "<підписане посилання>" | grep -i '^access-control'
```

Має бути `access-control-allow-origin: https://proiav.space` і `access-control-expose-headers` з `ETag`.

Зміна проти старого адмін-маршруту (одне правило GET/PUT/HEAD для всіх чотирьох origin-ів): **GET/HEAD з `*.vercel.app` і `localhost` більше не дозволені**. «Завантажити все» та експорт альбомів на прев'ю-деплоях і локально не читатимуть оригінали. Якщо це потрібно, додайте ці origin-и до правила читання в `src/lib/storage/cors.ts` і знову відкрийте сторінку.
