-- assets / portfolio_assets: rows are created only by the server.
--
-- The old "owner all" policies checked only owner_id, so through PostgREST a
-- signed-in user could insert or update an asset row pointing at ANOTHER
-- user's gallery (it then showed up there) or put a victim's storage keys into
-- `variants` and have deleteAsset remove the victim's files. They could also
-- rewrite size_bytes to dodge the storage quota.
--
-- Now:
--   * INSERT: no grant for anon/authenticated. Rows are written by the upload /
--     import / portfolio routes with the service role, after the gallery-
--     ownership and key-prefix checks (lib/uploads.ts registerAsset,
--     api/portfolio/complete).
--   * UPDATE: only the columns the app edits with the user's client —
--     assets: focal_x, focal_y (setAssetFocus);
--     portfolio_assets: visible, category, caption, position.
--   * SELECT / DELETE of one's own rows: unchanged.
--   * The public read policy on assets is untouched here (see 0042).
-- Storage accounting (apply_storage_delta) is SECURITY DEFINER and unaffected.

-- assets ---------------------------------------------------------------------
drop policy if exists "assets: owner all" on public.assets;

create policy "assets: owner select" on public.assets
  for select using (auth.uid() = owner_id);
create policy "assets: owner update" on public.assets
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "assets: owner delete" on public.assets
  for delete using (auth.uid() = owner_id);

revoke insert, update on public.assets from anon, authenticated;
grant update (focal_x, focal_y) on public.assets to authenticated;

-- portfolio_assets -----------------------------------------------------------
drop policy if exists "portfolio_assets: owner all" on public.portfolio_assets;

create policy "portfolio_assets: owner select" on public.portfolio_assets
  for select using (auth.uid() = owner_id);
create policy "portfolio_assets: owner update" on public.portfolio_assets
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "portfolio_assets: owner delete" on public.portfolio_assets
  for delete using (auth.uid() = owner_id);

revoke insert, update on public.portfolio_assets from anon, authenticated;
grant update (visible, category, caption, position) on public.portfolio_assets to authenticated;
