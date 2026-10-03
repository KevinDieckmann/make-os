// ─── Netzwerken · Kontakt aufs Handy (03.10., Kevin: „geht ans CRM UND die Daten ins Handy“) ──────────────────────────
// Aus den erfassten Feldern (oder aus einer Kontaktakte) eine vCard 3.0 bauen und teilen — alles im Browser, nichts geht an
// Dritte. Der vCard-Baustein ist derselbe wie bei den eigenen Visitenkarten (lib/netzwerken/karte.ts: Escaping, UTF-8, Falten).
//   · Teilen: Web Share API mit .vcf-Datei (iOS öffnet „Kontakt hinzufügen“), Rückfall Blob-Download (iOS Safari zeigt die
//     Kontaktvorschau). Muss direkt aus dem Tipp heraus laufen (Nutzer-Geste) — darum nie automatisch.
//   · Die NOTE trägt nur „Kennengelernt bei <Event>, <Datum> · MAKE OS“ — keine internen Angaben (Schritt, Zuständigkeit, Info).
//   · Eingeschränkte Personen (Art. 18) bekommen keine Handy-Karte: `handyKarteAusKontakt` liefert dann einen Grund statt Datei.
import { emailNormal, telefonNormal, linkedinNormal, webNormal } from '@/lib/crm/visitenkarte';
import type { KontaktFelder } from '@/lib/crm/netzwerken';
import type { Kontakt } from '@/lib/make-one/crm';
import { vcard, vcardDateiname, type Visitenkarte } from './karte';

export interface HandyKarte { inhalt: string; dateiname: string; titel: string }
export type HandyErgebnis = { ok: true; karte: HandyKarte } | { ok: false; grund: string };

export const HANDY_SPEICHER_KEY = 'make-os:netzwerken:handy';
export const ART18_GRUND = 'Verarbeitung eingeschränkt (Art. 18) — nicht ins Handy.';
const KENNUNG = 'v-00000000-0000-4000-8000-000000000000';

const ein = (v: unknown): string => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '');
/** „2026-10-03“ → „03.10.2026“ (alles andere unverändert). */
const datumDe = (iso: string): string => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso); return m ? `${m[3]}.${m[2]}.${m[1]}` : iso; };

/** „Kennengelernt bei <Event>, <Datum> · MAKE OS“ — ohne Event keine Notiz. */
export function kennengelernt(ort?: { event?: string; datum?: string }): string | undefined {
  const wo = ein(ort?.event), wann = ein(ort?.datum) ? datumDe(ein(ort?.datum)) : '';
  return wo ? `Kennengelernt bei ${wo}${wann ? `, ${wann}` : ''} · MAKE OS` : undefined;
}

/** „Straße Nr.\nPLZ Ort[\nLand]“ in Bestandteile — was sich nicht zuordnen lässt, bleibt als Ort stehen. */
export function anschriftTeile(roh: string | undefined): Pick<Visitenkarte, 'strasse' | 'plz' | 'ort' | 'land'> {
  const zeilen = (roh ?? '').split(/\r?\n/).map(ein).filter(Boolean);
  const aus: Pick<Visitenkarte, 'strasse' | 'plz' | 'ort' | 'land'> = {};
  if (!zeilen.length) return aus;
  const plzOrt = (z: string) => /^(?:[A-Z]{1,2}[- ])?(\d{4,5})\s+(.+)$/.exec(z);
  let i = 0;
  if (zeilen.length > 1 || !plzOrt(zeilen[0])) { aus.strasse = zeilen[0]; i = 1; } // eine einzelne „PLZ Ort“-Zeile ist keine Straße
  const r = zeilen[i] ? plzOrt(zeilen[i]) : null;
  if (r) { aus.plz = r[1]; aus.ort = r[2]; i++; } else if (zeilen[i]) { aus.ort = zeilen[i]; i++; }
  if (zeilen[i]) aus.land = zeilen[i];
  return aus;
}

function ausKarte(k: Visitenkarte, notiz: string | undefined): HandyKarte {
  return {
    inhalt: vcard(k, { falten: true, ...(notiz ? { notiz } : {}) }),
    dateiname: vcardDateiname(k),
    titel: [k.vorname, k.nachname].filter(Boolean).join(' ') || k.firma || 'Kontakt',
  };
}

/**
 * Die erfassten Felder der Erfassung → .vcf. Ohne Namen, Firma, Mail oder Telefon gibt es nichts zu speichern (Grund statt Datei).
 * `event`/`datum`: wo und wann die Person kennengelernt wurde (die Notiz im Handy-Kontakt).
 */
export function handyKarteAusErfassung(f: KontaktFelder, ort?: { event?: string; datum?: string }): HandyErgebnis {
  const mail = emailNormal(f.email);
  const rufnummer = (v: string | undefined) => (ein(v) ? (telefonNormal(v) ?? ein(v)) : '');
  const web = ein(f.webseite) ? webNormal(f.webseite) : undefined;
  const link = ein(f.linkedin) ? linkedinNormal(f.linkedin) : undefined;
  const k: Visitenkarte = {
    id: KENNUNG, rang: 0,
    ...(ein(f.vorname) ? { vorname: ein(f.vorname) } : {}), ...(ein(f.nachname) ? { nachname: ein(f.nachname) } : {}),
    ...(ein(f.firma) ? { firma: ein(f.firma) } : {}), ...(ein(f.position) ? { rolle: ein(f.position) } : {}),
    ...(mail ? { email: mail } : {}),
    ...(rufnummer(f.mobil) ? { handy: rufnummer(f.mobil) } : {}), ...(rufnummer(f.telefon) ? { telefon: rufnummer(f.telefon) } : {}),
    ...(web ? { web } : {}), ...(link ? { linkedin: link } : {}),
    ...anschriftTeile(f.anschrift),
  };
  if (!(k.vorname || k.nachname || k.firma || k.email || k.handy || k.telefon)) return { ok: false, grund: 'Es sind noch keine Daten zum Speichern da — Name, Firma oder Erreichbarkeit fehlt.' };
  return { ok: true, karte: ausKarte(k, kennengelernt(ort)) };
}

/** Eine bestehende Person (Kontaktakte) → .vcf. Art. 18: gesperrt. Notiz nur, wenn `ort` (Erfassung am Event) mitkommt — die Akte selbst trägt interne Angaben, die nicht ins Handy gehören. */
export function handyKarteAusKontakt(c: Kontakt, ort?: { event?: string; datum?: string }): HandyErgebnis {
  if (c.eingeschraenkt) return { ok: false, grund: ART18_GRUND };
  const mail = emailNormal(c.email);
  const k: Visitenkarte = {
    id: KENNUNG, rang: 0,
    ...(ein(c.vorname) ? { vorname: ein(c.vorname) } : {}), ...(ein(c.nachname) ? { nachname: ein(c.nachname) } : {}),
    ...(ein(c.firma) ? { firma: ein(c.firma) } : {}), ...(ein(c.position ?? c.jobtitel) ? { rolle: ein(c.position ?? c.jobtitel) } : {}),
    ...(mail ? { email: mail } : {}),
    ...(ein(c.sms) ? { handy: ein(c.sms) } : {}), ...(ein(c.telefon) ? { telefon: ein(c.telefon) } : {}),
    ...(ein(c.firmaWebseite) && webNormal(c.firmaWebseite) ? { web: webNormal(c.firmaWebseite) } : {}),
    ...(ein(c.linkedin) && linkedinNormal(c.linkedin) ? { linkedin: linkedinNormal(c.linkedin) } : {}),
    ...(ein(c.firmaStadt) ? { ort: ein(c.firmaStadt) } : {}),
  };
  if (!(k.vorname || k.nachname || k.firma || k.email || k.handy || k.telefon)) return { ok: false, grund: 'Im Kontakt steht noch nichts, was ins Handy passt.' };
  return { ok: true, karte: ausKarte(k, kennengelernt(ort)) };
}

/**
 * Teilen: Web Share API mit .vcf-Datei, sonst Download. Direkt aus dem Tipp aufrufen (Nutzer-Geste, iOS).
 * `abgebrochen`: die Person hat das Teilen-Blatt geschlossen — keine Fehlermeldung nötig.
 */
export async function handyTeilen(h: HandyKarte): Promise<'geteilt' | 'heruntergeladen' | 'abgebrochen'> {
  const datei = new File([h.inhalt], h.dateiname, { type: 'text/vcard' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  try {
    if (nav.share && nav.canShare?.({ files: [datei] })) { await nav.share({ files: [datei], title: h.titel }); return 'geteilt'; }
  } catch (e) { if ((e as Error)?.name === 'AbortError') return 'abgebrochen'; /* sonst: Download */ }
  const url = URL.createObjectURL(datei);
  const a = document.createElement('a');
  a.href = url; a.download = datei.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'heruntergeladen';
}

/** Der Schalter „Auch im Handy speichern“ wird je Gerät gemerkt (useGemerkt, localStorage nur als Komfort) — Schlüssel `HANDY_SPEICHER_KEY`. */
export const handyMeldung = (r: 'geteilt' | 'heruntergeladen' | 'abgebrochen'): string | null =>
  r === 'geteilt' ? 'Zum Speichern im Handy geteilt.' : r === 'heruntergeladen' ? 'Die Kontaktdatei wurde geladen — öffnen, um sie im Handy zu speichern.' : null;
