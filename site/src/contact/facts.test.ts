import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { CONTACT, displayUrl, mailHref, smsHref, telHref } from './facts';

describe('contact facts', () => {
  it('derives every phone href from one E.164 number', () => {
    expect(telHref()).toBe('tel:+15124972838');
    expect(smsHref()).toBe('sms:+15124972838');
    expect(mailHref()).toBe('mailto:zacharylyonstx@gmail.com');
    // The display form is the same digits.
    expect(CONTACT.phoneDisplay.replace(/\D/g, '')).toBe(
      CONTACT.phoneE164.replace(/\D/g, '').slice(1),
    );
  });

  it('prints URLs the way a card reads them', () => {
    expect(displayUrl(CONTACT.linkedin)).toBe('linkedin.com/in/zacharylyonstx');
    expect(displayUrl(CONTACT.github)).toBe('github.com/zacharylyonstx');
    expect(displayUrl('https://lyonszak.com/')).toBe('lyonszak.com');
  });

  it('points at files that are actually shipped in public/', () => {
    const pub = new URL('../../public/', import.meta.url);
    for (const rel of [
      CONTACT.vcard,
      CONTACT.resume,
      CONTACT.headshot,
      CONTACT.headshotWebp,
      CONTACT.headshotSquare,
      CONTACT.headshotAvatar,
    ]) {
      expect(existsSync(new URL('.' + rel, pub)), rel).toBe(true);
    }
  });

  it('ships a vCard that carries the same facts and the photo', () => {
    const vcf = readFileSync(new URL('../../public' + CONTACT.vcard, import.meta.url), 'utf8');
    expect(vcf.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n')).toBe(true);
    expect(vcf).toContain(`FN:${CONTACT.name}`);
    expect(vcf).toContain(`TEL;TYPE=CELL,VOICE,PREF:${CONTACT.phoneE164}`);
    expect(vcf).toContain(`EMAIL;TYPE=INTERNET,PREF:${CONTACT.email}`);
    expect(vcf).toContain('PHOTO;ENCODING=b;TYPE=JPEG:');
    expect(vcf.trimEnd().endsWith('END:VCARD')).toBe(true);
    // RFC 2426 folding: no physical line longer than 75 octets + CRLF.
    for (const line of vcf.split('\r\n')) expect(line.length).toBeLessThanOrEqual(75);
  });
});
