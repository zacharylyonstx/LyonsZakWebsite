// The plain facts — one source for every place the site says how to reach
// Zak (the film's contact card, the end card, and, by hand-mirroring, the
// static /contact page and the vCard in scripts/headshot.mjs). Real content
// for a real reader; the same strings the Person schema carries.

export const CONTACT = {
  name: 'Zak Lyons',
  legalName: 'Zachary Alan Lyons',
  role: 'Senior Software Engineer',
  place: 'Georgetown, Texas',
  placeLong: 'Georgetown, TX · Austin area · remote-friendly',
  /** E.164 — the one form every href below derives from. */
  phoneE164: '+15124972838',
  phoneDisplay: '(512) 497-2838',
  email: 'zacharylyonstx@gmail.com',
  github: 'https://github.com/zacharylyonstx',
  linkedin: 'https://www.linkedin.com/in/zacharylyonstx',
  youtube: 'https://www.youtube.com/@ZacharyLyonsZak',
  vcard: '/downloads/zak-lyons.vcf',
  resume: '/downloads/zachary-lyons-resume.pdf',
  /** The professional headshot's derivatives (scripts/headshot.mjs). */
  headshot: '/zak-headshot.jpg',
  headshotWebp: '/zak-headshot.webp',
  headshotSquare: '/zak-headshot-sq.jpg',
  headshotAvatar: '/zak-headshot-avatar.webp',
  headshotAlt:
    'Zak Lyons — gray suit, plum tie, a wide smile, in a bright glass atrium. The professional headshot.',
} as const;

export const telHref = (e164: string = CONTACT.phoneE164): string => `tel:${e164}`;
export const smsHref = (e164: string = CONTACT.phoneE164): string => `sms:${e164}`;
export const mailHref = (email: string = CONTACT.email): string => `mailto:${email}`;

/** A URL as people read it on a card: no scheme, no www, no trailing slash. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}
