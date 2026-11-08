import type { EmailCopy } from '../types'
import { formatMessage } from '@/lib/i18n/format'

/** English. Plurals through Intl (formatMessage). */
const n = (count: number, template: string) => formatMessage(template, { n: count }, 'en')
const galleries = (count: number) => n(count, '{n, plural, one {# gallery} other {# galleries}}')
const files = (count: number) => n(count, '{n, plural, one {# file} other {# files}}')
const days = (count: number) => n(count, '{n, plural, one {# day} other {# days}}')

const fitIntoFree = (freeGb: number, then: string) =>
  `Or delete what you no longer need in your dashboard to fit into the free ${freeGb} GB — then nothing disappears: ${then}`

const SIGN = '— proiav'

export const en: EmailCopy = {
  hello: (name) => (name ? `Hi, ${name}!` : 'Hi!'),
  helloClient: 'Hello!',
  footerQuestions: 'Questions and invoices',
  planNames: {
    free: 'Free',
    basic: 'Basic',
    plus: 'Plus',
    pro: 'Maximum',
    site_basic: 'Site Basic',
    site_plus: 'Site Plus',
  },
  units: { mb: 'MB', gb: 'GB', tb: 'TB' },
  includes: {
    storage: (volume) => `${volume} of gallery storage`,
    galleries: 'Client galleries with a password, photo selection and zip downloads',
    video: 'Video in galleries',
    noBranding: 'No «proiav» mark in galleries',
    logo: 'Your logo in galleries',
    stats: 'View and download stats',
    support: 'Priority support',
    noExpiry: 'Galleries never expire while the plan is active',
    sites: (count) => `${count} portfolio sites`,
    site: 'Portfolio site',
    domain: 'Custom domain',
  },

  receipt(v) {
    const credit = v.credit ? ` (${v.credit} of it from referral credit)` : ''
    let renewal: string
    if (v.nextChargeAt) {
      renewal = `Auto-renewal is on: the next charge is on ${v.nextChargeAt}, ${v.nextChargeAmount}. We will send a reminder 3 days before. You can cancel any time in your dashboard — the paid period stays active until its end.`
    } else if (v.autopayConsent && v.wallet) {
      renewal = `Auto-renewal could not be set up: paying with ${v.wallet} does not save the card. The plan is active until ${v.periodEnd}. To renew automatically next time, pay by card with «Auto-renewal» ticked.`
    } else {
      renewal = `Auto-renewal is off: the plan is active until ${v.periodEnd}, then you keep full access for ${days(v.graceDays)} more, after which the account becomes free.`
    }
    return {
      subject: `Receipt: ${v.amount} — «${v.plan}» plan, proiav`,
      lead: ['Payment received. Thank you for being with us!'],
      rows: [
        ['Plan', `«${v.plan}»${v.volume ? `, ${v.volume}` : ''}`],
        ['Amount', `${v.amount}${credit}`],
        ['Payment date', v.paidAt],
        ['Period', `${v.period === 'year' ? 'year' : 'month'}, ${v.periodStart} – ${v.periodEnd}`],
        ['Active until', v.periodEnd],
        ['Payment method', v.wallet ? `${v.wallet} (${v.provider})` : `card, ${v.provider}`],
        ['Order', v.orderId],
      ],
      list: { title: 'What’s included', items: v.includes },
      after: [renewal, `${v.provider} sends the bank receipt separately.`],
      button: { label: 'Open dashboard', url: v.billingUrl },
    }
  },

  renewalNotice(v) {
    return {
      subject: `In ${days(v.days)} — auto-renewal of the «${v.plan}» plan, ${v.amount}`,
      lead: [
        `On ${v.chargeAt} we will charge ${v.amount} to your saved card — auto-renewal of the «${v.plan}» plan${v.volume ? ` (${v.volume})` : ''} for a ${v.period === 'year' ? 'year' : 'month'}.`,
      ],
      rows: [
        ['Plan', `«${v.plan}»`],
        ['Amount', v.amount],
        ['Charge date', v.chargeAt],
      ],
      after: [
        'If you have referral credit on your balance, we will take it into account — the charge will be smaller.',
        'Don’t want to renew? Cancel auto-renewal before the charge date: the paid period stays active until its end and the card is not charged again.',
      ],
      button: { label: 'Cancel auto-renewal', url: `${v.billingUrl}#autopay` },
      link: { label: 'Dashboard and plans', url: v.billingUrl },
    }
  },

  failedCharge(v) {
    return {
      subject: `proiav · could not charge ${v.amount} for the «${v.plan}» plan`,
      lines: [
        v.greeting,
        '',
        `Today we tried to charge ${v.amount} for the «${v.plan}» plan, but the bank declined the payment`,
        '(most often the card has expired or there were not enough funds).',
        '',
        `Nothing disappears. Until ${v.graceUntil} everything works as before:`,
        `galleries are open to clients${v.volume ? `, limit ${v.volume}` : ''}.`,
        '',
        `To keep the plan without a break, update your card by ${v.graceUntil}:`,
        v.billingUrl,
        '',
        'If you don’t:',
        `– from ${v.graceUntil} galleries will be unavailable to clients (you still see them and can download them);`,
        `– from ${v.deletesAt} the files will be deleted from storage.`,
        '',
        'We will remind you 30, 7 and 1 day before deletion.',
        '',
        SIGN,
      ],
    }
  },

  graceStart(v) {
    const what = v.promo ? 'Your free month of «Basic» for the import' : `The paid period of the «${v.plan}» plan`
    return {
      subject: `proiav · your «${v.plan}» plan has ended — everything works as before for ${days(v.graceDays)}`,
      lines: [
        v.greeting,
        '',
        `${what} ended on ${v.endedAt}.`,
        '',
        `Until ${v.closesAt} nothing changes: galleries are open to clients,`,
        `${v.volume ? `the limit is ${v.volume}, ` : ''}videos stay in place.`,
        '',
        'After that, if the plan is not renewed:',
        `– ${v.closesAt}: galleries close to clients. You still see everything in your dashboard`,
        '  and can download any gallery as a zip;',
        `– ${v.deletesAt}: files are deleted from storage for good.`,
        '',
        'Renewing the plan takes one payment, and everything opens right away:',
        v.billingUrl,
        '',
        `Not planning to pay? Download the galleries you need before ${v.deletesAt} — it’s free.`,
        fitIntoFree(v.freeGb, 'the account becomes free and galleries stay open to clients.'),
        '',
        SIGN,
      ],
    }
  },

  closed(v) {
    return {
      subject: `proiav · galleries are closed to clients, files are kept until ${v.deletesAt}`,
      lines: [
        v.greeting,
        '',
        `Today the transition period after the «${v.plan}» plan ended. Your ${galleries(v.galleryCount)}`,
        'are closed to clients: at the link they see «This gallery is temporarily unavailable» —',
        'in their own language, the one they opened the gallery in.',
        '',
        'Nothing has disappeared for you: all galleries and files are in your dashboard. You can',
        'download the archive of any gallery for free.',
        '',
        `Files are kept until ${v.deletesAt}. After that date they will be deleted from`,
        'storage and cannot be restored.',
        '',
        'To open the galleries again, pay for a plan; they will be available at the same',
        'links, and passwords and client selections will be kept:',
        v.billingUrl,
        '',
        fitIntoFree(v.freeGb, 'the remaining files stay, the account becomes free and galleries open to clients again.'),
        v.dashboardUrl,
        '',
        SIGN,
      ],
    }
  },

  deletionWarning(v) {
    const subject =
      v.daysLeft === 1
        ? 'proiav · files will be deleted tomorrow — last reminder'
        : `proiav · files will be deleted in ${days(v.daysLeft)} (${v.deletesAt})`
    const when = v.daysLeft === 1 ? 'Tomorrow' : `In ${days(v.daysLeft)}`
    return {
      subject,
      lines: [
        v.greeting,
        '',
        `${when}, ${v.deletesAt}, we will delete from storage the files`,
        `of your galleries: ${galleries(v.galleryCount)}, ${files(v.fileCount)}, ${v.size}.`,
        ...(v.daysLeft === 1 ? ['', 'This is the last reminder.'] : []),
        '',
        'This is final — once deleted, the files cannot be restored.',
        '',
        'Three ways to lose nothing:',
        '1. Pay for a plan — galleries open to clients right away and the files stay:',
        `   ${v.billingUrl}`,
        `2. Download the galleries as zips before ${v.deletesAt} — free, from your dashboard:`,
        `   ${v.dashboardUrl}`,
        `3. Delete what you no longer need to fit into the free ${v.freeGb} GB — the remaining files stay and galleries open to clients again.`,
        `   ${v.dashboardUrl}`,
        '',
        'If you no longer need these files, there is nothing to do.',
        '',
        SIGN,
      ],
    }
  },

  promoEnding(v) {
    return {
      subject: `proiav · your free month of «Basic» ends on ${v.endsAt}`,
      lines: [
        v.greeting,
        '',
        `Your free month of the «Basic» plan for importing a gallery ends on ${v.endsAt}.`,
        '',
        `To stay on «Basic» (${v.storageGb} GB, ${v.price}/month), turn on auto-payment:`,
        `we charge ${v.price} now, and the paid month starts on ${v.endsAt}.`,
        v.billingUrl,
        '',
        `Without auto-payment, after ${v.endsAt} everything works as before for ${days(v.graceDays)}, then galleries`,
        `close to clients, and ${days(v.retentionDays)} later the files are deleted from storage.`,
        'We will remind you in advance.',
        '',
        SIGN,
      ],
    }
  },

  freeExpiry(v) {
    const many = v.galleries.length > 1
    const when = v.daysLeft === 1 ? 'tomorrow' : `in ${days(v.daysLeft)}`
    const When = `${when[0].toUpperCase()}${when.slice(1)}`
    return {
      subject: many
        ? `proiav · ${galleries(v.galleries.length)} close ${when}`
        : `proiav · the gallery «${v.galleries[0].title}» closes ${when}`,
      lines: [
        v.greeting,
        '',
        many
          ? `On the free plan a gallery stays open for ${days(v.freeDays)}. ${When} these will close to clients:`
          : `On the free plan a gallery stays open for ${days(v.freeDays)}. ${When} this one will close to clients:`,
        ...v.galleries.map((g) => `• «${g.title}» — ${g.closesAt}`),
        '',
        `After it closes, the client sees «This gallery is closed, please contact the photographer». You still see it in your dashboard, and ${days(v.purgeDays)} after closing the files are deleted.`,
        '',
        `To keep galleries open with no time limit, switch to «Basic»: ${v.basicPrice}/month, ${v.basicGb} GB, video. The time limit is lifted from all galleries right after payment:`,
        v.billingUrl,
        '',
        SIGN,
      ],
    }
  },

  partnerEnding(v) {
    return {
      subject: `proiav · your partner period ends on ${v.endsAt}`,
      lines: [
        v.greeting,
        '',
        `Thank you for working with us! Your partner period on the «${v.plan}» plan ends on ${v.endsAt}.`,
        '',
        `To stay on «${v.plan}» without a break, take the plan with auto-payment: ${v.priceMonth}/month or ${v.priceYear}/year (two months free). You can also choose another plan, from «Basic» at ${v.basicPrice}/month.`,
        v.billingUrl,
        '',
        `If you do nothing, the account becomes free (${v.freeGb} GB): existing galleries stay available to clients for ${days(v.freeDays)} more, and each new one for ${days(v.freeDays)} from creation.`,
        '',
        SIGN,
      ],
    }
  },

  ready(v) {
    const lead = [
      `Your photos are ready: the gallery «${v.galleryTitle}» is now open — you can view them, pick your favourites and download.`,
    ]
    if (v.hasPassword) lead.push('The gallery is password-protected — the photographer will send you the password separately if they haven’t yet.')
    return {
      subject: `Your photos are ready — ${v.galleryTitle}`,
      lead,
      rows: v.photographerName ? [['Photographer', v.photographerName]] : undefined,
      button: { label: 'Open the gallery', url: v.url },
      after: [
        'You are receiving this email because the photographer added your address to be told when the photos are ready. If you reply, your reply goes to the photographer.',
      ],
    }
  },

  referralReward(v) {
    const what = v.isAmbassador ? 'referral reward' : 'referral credit'
    return {
      subject: `+${v.sum} — your ${v.first ? `first ${what}` : what}`,
      lines: [
        v.greeting,
        '',
        `A photographer who came through your link has just ${v.first ? 'taken a paid plan' : 'paid for their plan again'}.`,
        v.isAmbassador
          ? `You've earned ${v.sum} to withdraw — 10% of their payment. The same for each of their first ${v.cap} payments.`
          : `You've earned ${v.sum} in credit — 10% of their payment. And so with every payment they make.`,
        v.isAmbassador
          ? `Withdraw from ${v.minWithdrawal} in your dashboard: ${v.link}`
          : `The credit is applied to your next invoice automatically. Balance and link: ${v.link}`,
        '',
        'Thank you for recommending us to colleagues.',
        '',
        '— proiav.space',
      ],
    }
  },

  bookingNotify(v) {
    return {
      subject: `New booking: ${v.slot}`,
      lines: [
        `A shoot has just been booked for ${v.slot} (${v.minutes} min, ${v.price}).`,
        '',
        `Client: ${v.clientName}`,
        `Phone: ${v.clientPhone}`,
        `Email: ${v.clientEmail}`,
        '',
        'Check the payment status in your dashboard.',
      ],
    }
  },
}
