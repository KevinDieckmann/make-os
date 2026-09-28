// ─── Markttraktion · mehrere E-Mail-Adressen je Person (rein, getestet, 28.09.) ─
// Kevins Entscheidung 28.09. (#11): Menschen haben eine geschäftliche, eine private
// und alte Adressen. Bisher gab es ein Feld `email`; eine zweite Adresse landete
// beim Zusammenführen als Text in der Notiz, beim Import wurde sie überschrieben
// oder legte die Person doppelt an.
//
//   Kontakt.emails  { adresse, art?, haupt? }[]
//
// Rückwärtskompatibel: `email` bleibt die Haupt-Adresse (abgeleitet, synchron) — jeder
// bestehende Leser (Kanal-Ampel, Export, Entwurf) liest weiter `email`. Altbestand ohne
// `emails` gilt als eine Haupt-Adresse (`emailsVon`), geschrieben wird erst, wenn eine
// zweite Adresse dazukommt oder schon Adressen gespeichert waren (`emailsSynchron`).
// Schlüssel, Import-Abgleich, Dubletten, Sperrliste und Suche fragen ALLE Adressen
// (`alleAdressen`). Diese Datei lädt zur Laufzeit nichts aus lib/make-one/crm.ts.

import type { Kontakt } from '@/lib/make-one/crm';

export const EMAIL_ARTEN = ['geschaeftlich', 'privat', 'alt', 'sonstig'] as const;
export type EmailArt = typeof EMAIL_ARTEN[number];
export const EMAIL_ART_LABEL: Record<EmailArt, string> = { geschaeftlich: 'geschäftlich', privat: 'privat', alt: 'alt', sonstig: 'sonstig' };
export const EMAIL_ART_WAHL: { id: EmailArt; label: string }[] = EMAIL_ARTEN.map(id => ({ id, label: EMAIL_ART_LABEL[id] }));

export interface EmailAdresse { adresse: string; art?: EmailArt; haupt?: boolean }

/** Obergrenze je Person — darüber wird abgelehnt (413), nie gekürzt. */
export const EMAILS_MAX = 100;

/** Adresse als Vergleichswert: NFC, trim, klein — wie `mailSchluessel` (lib/make-one/crm.ts). Leer ohne @. */
export function adresseNorm(email?: string): string {
  const m = (email ?? '').normalize('NFC').trim().toLowerCase();
  return m.includes('@') ? m : '';
}

const gleich = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Adressen aus dem Netz prüfen. Kein Array → `undefined`; ein leeres Array bleibt leer (ausdrücklich
 * „keine Adresse“). Gleiche Adressen (NFC/klein) nur einmal — die erste gewinnt, `haupt` wandert mit.
 * Höchstens eine Haupt-Adresse.
 */
export function emailsSaeubern(v: unknown): EmailAdresse[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const raus: EmailAdresse[] = [];
  const nachAdresse = new Map<string, number>();
  for (const x of v) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const adresse = adresseNorm(String(o.adresse ?? ''));
    if (!adresse || adresse.length > 160 || /\s/.test(adresse)) continue;
    const art = (EMAIL_ARTEN as readonly string[]).includes(String(o.art)) ? o.art as EmailArt : undefined;
    const i = nachAdresse.get(adresse);
    if (i !== undefined) { if (o.haupt === true) raus[i] = { ...raus[i], haupt: true }; if (!raus[i].art && art) raus[i] = { ...raus[i], art }; continue; }
    nachAdresse.set(adresse, raus.length);
    raus.push({ adresse, ...(art ? { art } : {}), ...(o.haupt === true ? { haupt: true } : {}) });
  }
  return hauptEindeutig(raus);
}

function hauptEindeutig(l: EmailAdresse[]): EmailAdresse[] {
  let schon = false;
  return l.map(a => { if (!a.haupt) return a; if (schon) { const { haupt: _h, ...r } = a; return r; } schon = true; return a; });
}

type MitEmails = Pick<Kontakt, 'email' | 'emails'>;

/**
 * Die Adressen einer Person — gespeichert oder (Altbestand) aus `email` abgeleitet. Steht `email` nicht
 * in der Liste (ein alter Schreiber hat nur das Feld gesetzt), gilt es als Haupt-Adresse vorn.
 */
export function emailsVon(k: MitEmails): EmailAdresse[] {
  const haupt = adresseNorm(k.email);
  if (!Array.isArray(k.emails)) return haupt ? [{ adresse: haupt, haupt: true }] : [];
  if (haupt && !k.emails.some(a => adresseNorm(a.adresse) === haupt)) return [{ adresse: haupt, haupt: true }, ...k.emails.map(a => (a.haupt ? { ...a, haupt: false } : a))];
  return k.emails;
}

/** Die Haupt-Adresse: die markierte, sonst die erste, die nicht „alt“ ist, sonst die erste. */
export function hauptAdresse(l: readonly EmailAdresse[]): EmailAdresse | undefined {
  return l.find(a => a.haupt) ?? l.find(a => a.art !== 'alt') ?? l[0];
}

/** Alle Adressen einer Person (normiert, ohne Doppelte) — für Schlüssel, Abgleich, Dubletten, Sperrliste, Suche. */
export function alleAdressen(k: MitEmails): string[] {
  return Array.from(new Set(emailsVon(k).map(a => adresseNorm(a.adresse)).filter(Boolean)));
}

/** Kennt die Person diese Adresse schon? */
export const hatAdresse = (k: MitEmails, adresse?: string) => { const n = adresseNorm(adresse); return !!n && alleAdressen(k).includes(n); };

/** Eine Adresse als weitere anhängen (Import): nie überschreiben, die Haupt-Adresse bleibt. Kennt sie die Person, bleibt alles. */
export function adresseAnhaengen<K extends MitEmails>(k: K, adresse: string, art?: EmailArt): K {
  const n = adresseNorm(adresse);
  if (!n || hatAdresse(k, n)) return k;
  const liste = emailsVon(k);
  if (!liste.length) return { ...k, email: n };
  return { ...k, emails: [...liste.map(a => (a === hauptAdresse(liste) ? { ...a, haupt: true } : a)), { adresse: n, ...(art ? { art } : {}) }] };
}

/** Eine einzige Haupt-Adresse ohne Art = genau das, was `email` schon sagt. */
const trivial = (l: readonly EmailAdresse[]) => l.length === 1 && !!l[0].haupt && !l[0].art;

/**
 * `email` und `emails` synchron halten — für jeden Schreibweg (Kartei-Route, Import, Zusammenführen).
 *   1. `neu.emails` weicht von den gespeicherten ab → die Liste ist die Wahrheit, `email` = Haupt-Adresse.
 *   2. sonst hat ein alter Schreiber `email` geändert → die neue Adresse wird Haupt-Adresse, die bisherige
 *      bleibt als weitere (kein Datenverlust); `email` geleert → die Haupt-Adresse fällt aus der Liste.
 * Ein Eintrag ohne `emails` (älteres Fenster) verliert die gespeicherten nie.
 */
export function emailsSynchron<K extends Kontakt>(neu: K, alt: Kontakt | undefined): K {
  const altGespeichert = alt?.emails;
  const explizit = neu.emails !== undefined && !gleich(neu.emails, altGespeichert);
  const mailGeaendert = adresseNorm(neu.email) !== adresseNorm(alt?.email);
  if (!explizit && !mailGeaendert) {
    if (altGespeichert && neu.emails === undefined) return { ...neu, emails: altGespeichert };
    return neu;
  }
  let liste: EmailAdresse[];
  if (explizit) liste = [...(neu.emails ?? [])];
  else {
    const basis = alt ? emailsVon(alt) : [];
    const n = adresseNorm(neu.email);
    if (n) {
      const da = basis.some(a => adresseNorm(a.adresse) === n);
      liste = da ? basis.map(a => (adresseNorm(a.adresse) === n ? { ...a, haupt: true } : a.haupt ? { ...a, haupt: false } : a))
        : [{ adresse: n, haupt: true }, ...basis.map(a => (a.haupt ? { ...a, haupt: false } : a))];
    } else {
      const weg = hauptAdresse(basis);
      liste = basis.filter(a => a !== weg);
    }
  }
  liste = hauptEindeutig(liste.map(a => (a.haupt === false ? (({ haupt: _h, ...r }) => r)(a) : a)));
  const h = hauptAdresse(liste);
  if (h && !h.haupt) liste = liste.map(a => (a === h ? { ...a, haupt: true } : a));
  const out = { ...neu } as unknown as Record<string, unknown>;
  const haupt = liste.find(a => a.haupt);
  if (haupt) out.email = haupt.adresse; else delete out.email;
  if (explizit || altGespeichert || !(trivial(liste) || !liste.length)) out.emails = liste;
  else delete out.emails;
  return out as unknown as K;
}

/** Adressen zweier Einträge derselben Person vereinen (Dubletten): `a` gewinnt die Haupt-Adresse, keine doppelt. */
export function emailsVereinen(a: MitEmails, b: MitEmails): EmailAdresse[] | undefined {
  const la = emailsVon(a), lb = emailsVon(b);
  if (!lb.length) return a.emails;
  const raus = [...la];
  for (const x of lb) {
    const i = raus.findIndex(y => adresseNorm(y.adresse) === adresseNorm(x.adresse));
    if (i >= 0) { if (!raus[i].art && x.art) raus[i] = { ...raus[i], art: x.art }; continue; }
    const { haupt: _h, ...ohne } = x;
    raus.push(ohne);
  }
  if (raus.length <= 1 && !a.emails && !b.emails) return undefined;
  return hauptEindeutig(raus.some(x => x.haupt) ? raus : raus.map((x, i) => (i === 0 ? { ...x, haupt: true } : x)));
}

/** Prüfbefund (Verbindungsprüfung): gespeicherte Liste, deren Haupt-Adresse nicht genau eine ist oder nicht `email` entspricht. */
export function emailsBefund(k: MitEmails): boolean {
  if (!Array.isArray(k.emails) || !k.emails.length) return false;
  const haupt = k.emails.filter(a => a.haupt);
  return haupt.length !== 1 || adresseNorm(haupt[0].adresse) !== adresseNorm(k.email);
}

/** Die Felder für `kontaktTeil` zu einer neuen Adressliste: `emails` plus die Haupt-Adresse `email` (wie der Server rechnet). */
export function emailsFelder(k: Kontakt, liste: EmailAdresse[]): Pick<Kontakt, 'emails' | 'email'> {
  const r = emailsSynchron({ ...k, emails: liste }, k);
  return { emails: r.emails ?? liste, email: r.email };
}
