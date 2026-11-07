#!/usr/bin/env bash
# Bundles the harness twice: "before" = src/lib from origin/main, "after" = this checkout.
set -euo pipefail
D=$(cd "$(dirname "$0")" && pwd); R=$(cd "$D/../.." && pwd); E="$R/node_modules/.bin/esbuild"
BASE=${BASE:-origin/main}
# Outside the repo, so tsc never type-checks the old copy.
OLD="${TMPDIR:-/tmp}/upload-bench-before"
rm -rf "$OLD" "$D/static/before" "$D/static/after" && mkdir -p "$OLD" "$D/static/before" "$D/static/after"
git -C "$R" archive "$BASE" src/lib | tar -x -C "$OLD"
DEF=(--define:process.env.NEXT_PUBLIC_SENTRY_DSN='""' --log-level=error --bundle --format=esm)
"$E" "$D/harness.ts" "${DEF[@]}" --outfile="$D/static/after/harness.js" --alias:@="$R/src"
"$E" "$D/render-after.ts" "${DEF[@]}" --outfile="$D/static/after/render.js" --alias:@="$R/src"
"$E" "$R/src/lib/images/renditions.worker.ts" --bundle --format=iife --log-level=error --outfile="$D/static/after/renditions.worker.js"
# The client asks for ./renditions.worker.ts (webpack resolves it in Next); point the bundle at the .js.
sed -i 's#renditions\.worker\.ts#renditions.worker.js#' "$D/static/after/harness.js"
"$E" "$D/harness.ts" "${DEF[@]}" --outfile="$D/static/before/harness.js" --alias:@="$OLD/src"
"$E" "$D/render-before.ts" "${DEF[@]}" --outfile="$D/static/before/render.js" --alias:@="$OLD/src"
echo built
