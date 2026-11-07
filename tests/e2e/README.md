# e2e — «Тиша»

`tysha.test.ts` opens the theme demo in Chromium (Playwright) and checks
status 200, horizontal overflow on iPhone 13 / 1440px, labels on the
enquiry form and a fully still page under `prefers-reduced-motion`.

The `/themes` routes redirect to `/gallery-demo` (next.config.js) while the
site builder is shelved, so for a local run disable those two redirects
temporarily (do **not** commit that), start the app and point the test at it:

```bash
npx next build && npx next start -p 3100
TYSHA_E2E_URL=http://localhost:3100/uk/themes/tysha npm run test:e2e:tysha
```

Playwright is not a project dependency (it brings browser downloads); the
test is skipped when `playwright` cannot be resolved or the URL is unset.
