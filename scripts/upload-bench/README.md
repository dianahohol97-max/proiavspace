# Заміри завантаження (план 4.3)

Стенд, на якому зроблено цифри в `docs/UPLOAD_PERF.md`: справжній `lib/upload/client.ts`
(«до» — з `origin/main`, «після» — з цієї гілки) у Chromium проти моку нашого API і моку B2
за емулятором каналу. Без бази й бакета.

- `link-proxy.mjs` — канал: спільний аплінк (20 Мбіт/с), 60 мс в кожен бік (RTT 120 мс),
  вікно 512 КБ на з'єднання, рукостискання TCP+TLS = 2 RTT, опційно ліміт на одне з'єднання
  (`PER_CONN_MBIT`, модель TCP з втратами), `/blackhole?ms=` — «тихий» обрив.
- `mock.mjs` — `/api/uploads/*` із затримками маршрутів (Vercel → Supabase/B2) і «B2» з CORS
  preflight на кожен PUT, ETag, multipart, ListParts.
- `run.mjs` — драйвер Playwright: час до 100 %, CPU процесів Chromium, лаг головного потоку,
  long tasks; сценарії `--offline=30000@40`, `--blackhole=30000@40`, `--reload-at=60`, `--no-etag`.
- `render-run.mjs` — лише прев'ю (без мережі): час, CPU, пік RSS, лаг.

```bash
cd scripts/upload-bench && mkdir -p data/png data/jpg && python3 gen.py png 16 && python3 gen.py jpg 16
```

```bash
bash scripts/upload-bench/build.sh
```

```bash
node scripts/upload-bench/run.mjs before png --per-conn=5
```

```bash
node scripts/upload-bench/run.mjs after png --per-conn=5
```

Порти 4000/4001/4101/4201/4300 мають бути вільні.
