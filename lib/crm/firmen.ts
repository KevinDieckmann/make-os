// ─── CRM — Firmen als eigene Stammdaten (rein, getestet) ───────────────────
// Bis 24.09. standen die Firmenfelder (Branche, Stadt, Webseite …) in jedem
// Kontakt einzeln — drei Leute derselben Firma, dreimal die Branche, jede
// Änderung an einer Stelle. Jetzt gibt es eine Firma je Unternehmen (Speicher
// „crm“, Liste „firmen“), und jeder Kontakt zeigt über firmaId darauf.
// Der Abgleich ist wiederholbar: er legt fehlende Firmen an, verknüpft
// Kontakte und füllt nur LEERE Felder — was von Hand gepflegt ist, bleibt.

import type { Kontakt } from '@/lib/make-one/crm';
import type { Firma, FirmaRolle } from './typen';

export const FREEMAIL = new Set(['gmail.com', 'googlemail.com', 'gmx.de', 'gmx.net', 'gmx.at', 'gmx.ch', 'web.de', 't-online.de', 'yahoo.com', 'yahoo.de', 'outlook.com', 'outlook.de', 'hotmail.com', 'hotmail.de', 'icloud.com', 'me.com', 'mac.com', 'live.de', 'live.com', 'aol.com', 'freenet.de', 'posteo.de', 'mail.de', 'protonmail.com', 'proton.me']);
const RECHTSFORM = /\b(gmbh|mbh|ag|ug|kg|ohg|gbr|e\.?\s?k|e\.?\s?v|se|ltd|limited|inc|llc|co|haftungsbeschränkt|&)\b/g;
export const firmenSchluessel = (name: string) => name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/\(.*?\)/g, '').replace(RECHTSFORM, ' ').replace(/[^a-z0-9]/g, '');
export function domainVon(k: Pick<Kontakt, 'email' | 'firmaDomain' | 'firmaWebseite'>): string | undefined {
  const aus = (t?: string) => (t ?? '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0].trim();
  const mail = (k.email ?? '').toLowerCase().split('@')[1];
  const d = (mail && !FREEMAIL.has(mail) ? mail : '') || aus(k.firmaDomain) || aus(k.firmaWebseite);
  return d && d.includes('.') && !FREEMAIL.has(d) ? d : undefined;
}
function hash(t: string): string { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36).slice(0, 6); }
export const firmenId = (name: string) => `f-${firmenSchluessel(name).slice(0, 30) || 'firma'}-${hash(firmenSchluessel(name) || name)}`;

/** Rolle aus den Personen: Kunde schlägt alles, dann Ex-Kunde, Partner … */
export function rolleAus(personen: Kontakt[]): FirmaRolle {
  const hat = (f: (k: Kontakt) => boolean) => personen.some(f);
  if (hat(k => k.lebensphase === 'kunde')) return 'kunde';
  if (hat(k => k.lebensphase === 'ex_kunde')) return 'ex_kunde';
  if (hat(k => k.lebensphase === 'partner' || k.typ === 'Vertriebspartner')) return 'partner';
  if (hat(k => k.typ === 'Investor')) return 'investor';
  if (hat(k => k.typ === 'Dienstleister')) return 'dienstleister';
  if (hat(k => k.typ === 'Lead' || k.lebensphase === 'interessent')) return 'zielkunde';
  if (hat(k => k.typ === 'Netzwerk')) return 'netzwerk';
  return 'offen';
}

const FELDER: [keyof Firma, keyof Kontakt][] = [
  ['webseite', 'firmaWebseite'], ['branche', 'firmaBranche'], ['mitarbeiter', 'firmaMitarbeiter'], ['umsatz', 'firmaUmsatz'],
  ['stadt', 'firmaStadt'], ['gegruendet', 'firmaGegruendet'], ['linkedin', 'firmaLinkedin'], ['telefon', 'firmaTelefon'], ['email', 'firmaEmail'], ['marktinfo', 'marktinfo'],
];

export interface AbgleichErgebnis { firmen: Firma[]; kontakte: Kontakt[]; neu: number; verknuepft: number; ergaenzt: number }

export function firmenAbgleich(kontakte: Kontakt[], firmen: Firma[], jetzt: string): AbgleichErgebnis {
  const liste = firmen.map(f => ({ ...f }));
  const nachSchluessel = new Map(liste.map(f => [firmenSchluessel(f.name), f]));
  const nachDomain = new Map(liste.filter(f => f.domain).map(f => [f.domain!, f]));
  const nachId = new Map(liste.map(f => [f.id, f]));
  let neu = 0, verknuepft = 0, ergaenzt = 0;
  const raus = kontakte.map(k => {
    if (k.firmaId && nachId.has(k.firmaId)) return k;
    const name = (k.firma ?? '').trim();
    if (!name) return k;
    const d = domainVon(k);
    let f = nachSchluessel.get(firmenSchluessel(name)) ?? (d ? nachDomain.get(d) : undefined);
    if (!f) {
      f = { id: firmenId(name), name, ...(d ? { domain: d } : {}), rolle: 'offen', geaendert: jetzt };
      liste.push(f); nachSchluessel.set(firmenSchluessel(name), f); if (d) nachDomain.set(d, f); nachId.set(f.id, f); neu++;
    }
    verknuepft++;
    return { ...k, firmaId: f.id };
  });
  // Leere Firmenfelder aus den Personen füllen, Rolle nachziehen (nur solange „offen“ oder abgeleitet).
  const je = new Map<string, Kontakt[]>();
  for (const k of raus) if (k.firmaId) je.set(k.firmaId, [...(je.get(k.firmaId) ?? []), k]);
  for (const f of liste) {
    const personen = je.get(f.id) ?? [];
    let geaendert = false;
    for (const [ziel, quelle] of FELDER) {
      if ((f[ziel] ?? '') !== '') continue;
      const wert = personen.map(p => p[quelle]).find(v => typeof v === 'string' && v.trim()) as string | undefined;
      if (wert) { (f as unknown as Record<string, unknown>)[ziel] = wert.slice(0, ziel === 'marktinfo' ? 800 : 200); geaendert = true; }
    }
    if (!f.domain) { const d = personen.map(domainVon).find(Boolean); if (d) { f.domain = d; geaendert = true; } }
    if (!f.rolleVonHand) { const r = rolleAus(personen); if (r !== f.rolle) { f.rolle = r; geaendert = true; } }
    if (geaendert) { f.geaendert = jetzt; ergaenzt++; }
  }
  return { firmen: liste, kontakte: raus, neu, verknuepft, ergaenzt };
}

/** Firmen-Dubletten: gleicher Schlüssel oder gleiche Domain. */
export function firmenDubletten(firmen: Firma[]): [Firma, Firma][] {
  const paare: [Firma, Firma][] = [];
  for (let i = 0; i < firmen.length; i++) for (let j = i + 1; j < firmen.length; j++) {
    const a = firmen[i], b = firmen[j];
    if (firmenSchluessel(a.name) === firmenSchluessel(b.name) || (a.domain && a.domain === b.domain)) paare.push([a, b]);
  }
  return paare;
}
