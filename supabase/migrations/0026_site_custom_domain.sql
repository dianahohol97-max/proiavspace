-- Custom domain for a photographer's public site. The photographer enters the
-- domain they own; DNS is pointed at the platform and the domain is attached to
-- hosting out-of-band (Vercel project domains). `custom_domain_status` tracks
-- where that wiring is: pending (just entered) → active (verified & serving).
alter table public.sites add column if not exists custom_domain text;
alter table public.sites
  add column if not exists custom_domain_status text not null default 'pending'
  check (custom_domain_status in ('pending', 'active'));

-- One domain per site across the platform.
create unique index if not exists sites_custom_domain_key
  on public.sites (custom_domain)
  where custom_domain is not null;
