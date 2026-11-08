-- ============================================================================
-- Site themes v2: thirteen new one-page «візитка» themes. The sites.theme
-- CHECK from 0006 lists only the original seven ids, so saving any new theme
-- would fail without this. Widening a CHECK is safe for the code on
-- production (it keeps writing the old ids). Galleries are untouched: their
-- own CHECK (0008) and styles stay as they are — a new site theme maps to an
-- existing gallery style in code (resolveGalleryTheme).
-- ============================================================================

alter table public.sites drop constraint if exists sites_theme_check;

alter table public.sites
  add constraint sites_theme_check check (theme in (
    -- original (old themes stay valid for existing sites)
    'tysha', 'povitria', 'plivka', 'zhurnal', 'galereia', 'arkhiv', 'prodakshn',
    -- v2
    'start', 'nizhnist', 'kontent', 'lyst', 'portret', 'sviato', 'rozvorot',
    'indeks', 'paspartu', 'kontakt', 'temna', 'vydoshukach', 'marshrut'
  ));
