import type { Dictionary } from '@/lib/i18n'
import type { LeadFormLabels } from '@/components/site/LeadForm'
import type { SiteLabels } from '@/components/site/SiteRenderer'

/** Public-site wording from the dictionary — one place for every caller. */
export function siteLabelsFromDict(dict: Dictionary, locale: string): SiteLabels {
  const uk = locale === 'uk'
  const p = dict.publicSite
  return {
    portfolio: p.portfolio,
    about: p.about,
    pricing: p.pricing,
    contacts: p.contacts,
    book: p.book,
    photos: uk ? 'фото' : 'photos',
    viewSeries: uk ? 'Дивитись серію' : 'View series',
    close: uk ? 'Закрити' : 'Close',
    bookDate: p.bookDate,
    scrollHint: p.scrollHint,
    menu: p.menu,
    process: p.process,
    selectedWork: p.selectedWork,
    series: p.series,
    testimonials: p.testimonials,
    popular: p.popular,
    choosePack: p.choosePack,
    madeOn: p.madeOn,
    allPortfolio: p.allPortfolio,
    bookEvening: p.bookEvening,
    filmStrip: p.filmStrip,
    swipeHint: p.swipeHint,
    prev: p.prev,
    next: p.next,
    inThisIssue: p.inThisIssue,
    seasons: p.seasons,
    editorLetter: p.editorLetter,
    spread: p.spread,
    pageShort: p.pageShort,
    bookShoot: p.bookShoot,
    dayInLight: p.dayInLight,
  }
}

export function leadFormLabelsFromDict(dict: Dictionary): LeadFormLabels {
  const p = dict.publicSite
  return {
    title: p.leadTitle,
    name: p.leadName,
    contact: p.leadContact,
    message: p.leadMessage,
    send: p.leadSend,
    sent: p.leadSent,
    error: p.leadError,
    email: p.leadEmail,
    phone: p.leadPhone,
    date: p.leadDate,
    shootType: p.leadShootType,
    shootOther: p.leadShootOther,
    contactHint: p.leadContactHint,
    sending: p.leadSending,
  }
}
