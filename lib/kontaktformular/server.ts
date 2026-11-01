// ─── Kontaktformular der Website — Server (31.10., Website-Anbau) ─────────────────────────────────────────────────────────────────────
// Einstellungen (nur der Schalter — alles Übrige teilt das Formular mit dem Auftritt der Checks: Name, Verantwortlicher bzw. Abweichung der
// Website, Gastgeber, Buchungsseite, Logo, Website-Adresse; lib/check/speicher.ts), Formular-Stempel, „bereit?“ und der Eingang über den EINEN
// Anfrage-Weg (lib/crm/anfrage-anlegen.ts). Keine Mail, kein eigener Bestand mit Personenbezug.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { sitzungsGeheimnis } from '@/lib/zugang/sitzung';
import { ANLASS_OK, EINSTELLUNGEN, anfrageText, anlassVon, datenschutzZeilen, type Anlass, type KontaktEingabe, type KontaktformularEinstellungen } from './regeln';

export async function ladeKontaktformularEinstellungen(): Promise<KontaktformularEinstellungen> {
  const e = await loadJson<KontaktformularEinstellungen>(EINSTELLUNGEN);
  return { aktiv: e?.aktiv === true, ...(e?.geaendert ? { geaendert: e.geaendert, ...(e.geaendertVon ? { geaendertVon: e.geaendertVon } : {}) } : {}) };
}

export async function kontaktformularSchalten(aktiv: boolean, von: string): Promise<KontaktformularEinstellungen> {
  const neu: KontaktformularEinstellungen = { aktiv, geaendert: new Date().toISOString(), geaendertVon: von };
  await updateJson<KontaktformularEinstellungen>(EINSTELLUNGEN, () => neu);
  return neu;
}

// ── Formular-Stempel (Mindestzeit wie Buchung, Check, Newsletter — eigener Zweck) ─────────────────────────────────────────────────────

const stempelSig = (ms: number) => createHmac('sha256', `${sitzungsGeheimnis()}|kontaktformular`).update(String(ms)).digest('base64url');
/** „<ms>.<signatur>“ — beim Laden der Seite ausgegeben; zu schnell (< 3 s) oder zu alt (> 2 h) zählt nicht (`ausfuellZeitOk`). */
export const kontaktformularStempel = (ms = Date.now()): string => `${ms}.${stempelSig(ms)}`;
/** Zeit aus einem Stempel — null, wenn gefälscht oder kaputt. */
export function stempelZeit(stempel: unknown): number | null {
  if (typeof stempel !== 'string' || stempel.length > 80) return null;
  const [ms, sig] = stempel.split('.');
  const n = Number(ms);
  if (!Number.isInteger(n) || !sig) return null;
  const soll = Buffer.from(stempelSig(n)), ist = Buffer.from(sig);
  return soll.length === ist.length && timingSafeEqual(soll, ist) ? n : null;
}

// ── Bereit? ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface KontaktformularBereit {
  marke: string; gastgeber: string;
  hinweis: { zeilen: string[]; link: string | null };
  /** Pfad der Buchungsseite für das Erstgespräch (Check-Einstellungen) — ohne: kein Termin-Weg. */
  erstgespraech: string | null;
  logo: string | null; website: string | null;
}

/** Läuft das Formular? Eingeschaltet UND ein Verantwortlicher (Einrichtung bzw. Abweichung der Website) — sonst null (Seite neutral, 404). */
export async function kontaktformularBereit(): Promise<KontaktformularBereit | null> {
  const e = await ladeKontaktformularEinstellungen();
  if (!e.aktiv) return null;
  const { ladeCheckEinstellungen } = await import('@/lib/check/speicher');
  const { hinweisLaden, zoeKontext } = await import('@/lib/check/server');
  const c = await ladeCheckEinstellungen();
  const h = await hinweisLaden(c);
  if (!h) return null;
  const k = await zoeKontext(c);
  return {
    marke: k.marke, gastgeber: k.gastgeber,
    hinweis: { zeilen: datenschutzZeilen(c.verantwortlich?.trim() || (await verantwortlicherText()) || '', h.link), link: h.link },
    erstgespraech: c.buchungSlug ? `/buchen/${c.buchungSlug}` : null,
    logo: c.logo ?? null, website: c.website ?? null,
  };
}

async function verantwortlicherText(): Promise<string> {
  const { datenschutzOeffentlichLaden } = await import('@/lib/datenschutz/einrichtung-server');
  return ((await datenschutzOeffentlichLaden()).verantwortlich ?? '').trim();
}

/** Für das Verzeichnis (Art. 30): eingeschaltet — dann findet die Verarbeitung statt. Wirft nie. */
export async function kontaktformularEingerichtet(): Promise<boolean> {
  try { return (await ladeKontaktformularEinstellungen()).aktiv; } catch { return false; }
}

// ── Eingang ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type EingangErgebnis = { ok: true; kontaktId: string; followUpId: string; unbestaetigt: boolean } | { ok: false; grund: string };

/**
 * Eine Nachricht aus dem Formular in die Markttraktion — über den EINEN Anfrage-Weg, als Gastgeber (bzw. Inhaber) erfasst, Systemlauf im
 * Protokoll. Öffentlich: trifft die Adresse eine vorhandene Person, nur „Adresse unbestätigt“ (nichts ausgelöst). Lehnt der Weg ab (Art. 18 …),
 * entsteht nichts — der Grund geht nie an den Gast.
 */
/** Anlass aus der Adresse bzw. dem Formular — Titel von Baustein/Vorlage aus den eigenen Katalogen. Wirft nie (Katalog kaputt → Anlass ohne Titel). */
export async function anlassAufloesen(roh: unknown): Promise<Anlass | null> {
  if (typeof roh !== 'string' || !ANLASS_OK.test(roh)) return null;
  const katalog: { baustein?: string | null; vorlage?: string | null } = {};
  try {
    if (roh.startsWith('baustein-')) katalog.baustein = (await (await import('@/lib/bausteine/server')).bausteinVon(roh.slice('baustein-'.length)))?.titel ?? null;
    if (roh.startsWith('vorlage-')) katalog.vorlage = (await (await import('@/lib/unterlagen/server')).unterlageVon(roh.slice('vorlage-'.length)))?.titel ?? null;
  } catch { /* Katalog nicht lesbar: Anlass ohne Titel */ }
  return anlassVon(roh, katalog);
}

export async function eingangVerarbeiten(e: KontaktEingabe): Promise<EingangErgebnis> {
  const { ladeCheckEinstellungen } = await import('@/lib/check/speicher');
  const { gastgeberVon } = await import('@/lib/check/server');
  const person = (await gastgeberVon(await ladeCheckEinstellungen())) ?? 'system';
  const { anfrageAnlegen } = await import('@/lib/crm/anfrage-anlegen');
  const text = anfrageText(e, await anlassAufloesen(e.anlass));
  const r = await anfrageAnlegen(
    { neu: { vorname: e.vorname, ...(e.nachname ? { nachname: e.nachname } : {}), email: e.email, ...(e.firma ? { firma: e.firma } : {}), ...(e.telefon ? { telefon: e.telefon } : {}) }, kanal: 'website', text },
    { person, wer: { art: 'system' }, oeffentlich: true, webseite: 'formular' },
  );
  if (r.ok) return { ok: true, kontaktId: r.bau.kontakt.id, followUpId: r.bau.followUp.id, unbestaetigt: !!r.bau.unbestaetigt };
  // Art. 18 (02.11., Prüfung A Fund 5): die Nachricht verschwand bisher im Log — jetzt als Betroffenenantrag (Stammdaten › Datenschutz) mit neutraler
  // Glocke an den Inhaber; die Person selbst wird im CRM nicht verarbeitet. Der Gast sieht dieselbe Antwort wie immer.
  if (r.eingeschraenkt) {
    const { eingeschraenktMelden } = await import('@/lib/oeffentlich/eingang-server');
    await eingeschraenktMelden({ ...r.eingeschraenkt, email: e.email, weg: 'Kontaktformular', text });
  }
  return { ok: false, grund: r.fehler.slice(0, 200) };
}
