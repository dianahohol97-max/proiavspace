import { Picture } from '../motion/Picture'
import type { CardData } from './data'
import { CardFilterIsland } from './islands'
import { PackCta } from '../tysha/PackCta'

/** A theme's class map for the shared blocks (missing keys simply style nothing). */
export type CardSkin = Record<string, string>

/** «Усі · Весілля · …» — only when the grid has 2+ directions. */
export function FilterBar({ card, gridId, s }: { card: CardData; gridId: string; s: CardSkin }) {
  if (card.filters.length === 0) return null
  return (
    <CardFilterIsland
      gridId={gridId}
      filters={card.filters}
      allLabel={card.L.filterAll}
      className={s.filterBar}
      chipClassName={s.filterChip}
      activeClassName={s.filterChipOn}
    />
  )
}

/** Booking terms under the packages: deposit, delivery, travel, what to bring. */
export function TermsBlock({ card, s }: { card: CardData; s: CardSkin }) {
  if (card.terms.length === 0) return null
  return (
    <div className={s.terms}>
      <p className={s.termsTitle}>{card.L.termsTitle}</p>
      <dl className={s.termsList}>
        {card.terms.map((t) => (
          <div key={t.key} className={s.termsItem}>
            <dt className={s.termsLabel}>{t.label}</dt>
            <dd className={s.termsText}>{t.text}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/**
 * «Подарунки та друк»: up to three cards. «Замовити» never takes payment —
 * it opens the booking form with the topic filled in (and, for the
 * certificate, the «номінал / кому / від кого» fields).
 */
export function GiftsBlock({ card, s, heading }: { card: CardData; s: CardSkin; heading?: React.ReactNode }) {
  if (card.gifts.length === 0) return null
  return (
    <section id="gifts" className={s.gifts} aria-label={card.L.giftsTitle}>
      {heading}
      <div className={s.giftGrid}>
        {card.gifts.map((g) => (
          <article key={g.kind} className={s.gift} data-gift={g.kind}>
            {g.photo && (
              <div className={s.giftImg}>
                <Picture src={g.photo.previewUrl} srcSet={g.photo.srcSet} alt="" sizes="(max-width: 760px) 40vw, 26vw" />
              </div>
            )}
            <div className={s.giftBody}>
              <h3 className={s.giftTitle}>{g.title}</h3>
              {g.text && <p className={s.giftText}>{g.text}</p>}
              <div className={s.giftFoot}>
                {g.price && <span className={s.giftPrice}>{g.price}</span>}
                <PackCta pack={g.title} href={card.bookHref} className={s.giftCta}>
                  {card.L.order} <span aria-hidden="true">→</span>
                </PackCta>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

/** Contacts list: phone, Telegram, Instagram, email. */
export function ContactLinks({ card, s }: { card: CardData; s: CardSkin }) {
  if (card.contactLinks.length === 0) return null
  return (
    <ul className={s.contactList}>
      {card.contactLinks.map((link) => (
        <li key={link.href} className={s.contactItem} data-kind={link.kind}>
          <a
            href={link.href}
            {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  )
}

/** «Фотограф · Весілля, Хрестини · Київ» — the facts of the first screen. */
export function HeroFacts({ card, s }: { card: CardData; s: CardSkin }) {
  return (
    <p className={s.heroFacts}>
      <span className={s.heroRole} data-card="role">{card.role}</span>
      {card.directions.length > 0 && <span className={s.heroDirections} data-card="directions">{card.directions.join(' · ')}</span>}
      {card.city && <span className={s.heroCity} data-card="city">{card.city}</span>}
    </p>
  )
}
