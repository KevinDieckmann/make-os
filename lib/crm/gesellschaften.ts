// ─── Markttraktion · Gesellschaften als Absender (rein, client-sicher, 28.09.) ─
// Kevin 28.09. (Angebots-Tool): je Gesellschaft — Selbstständigkeit · KD Ventures ·
// MAKE Innovation GmbH (kdc · kdv · ug, lib/einheiten.ts) — Firmierung, Anschrift, Kontakt,
// Steuernummer/USt-IdNr., Bank, Kleinunternehmer, Zahlungsziel, Gültigkeit von
// Angeboten, Nummernformat, Logo und Fußtext. Die Werte stehen NUR im Datenspeicher
// `gesellschaften--<haushalt>` (verschlüsselt wie jeder Bestand), nie im Code.
//
// IBAN wie bei den Kunden (lib/crm/zahlung.ts): an den Browser nur maskiert
// (+ `ibanGesetzt`); beim Speichern heißt maskiert/leer „unverändert“, nur eine neue
// gültige IBAN ersetzt, Entfernen nur mit `ibanEntfernen: true`. Das PDF trägt die
// volle IBAN (der Kunde soll zahlen können) — es entsteht nur auf dem Server.

import type { Gesellschaftskennung } from '@/lib/einheiten';
import { KERN_EINHEITEN, UG_NAME } from '@/lib/einheiten';
import { ibanGueltig, ibanGrundform, ibanMaskiert } from './zahlung';
import { GESELLSCHAFTEN, KURZ_VORGABE, NUMMER_VORGABE, GUELTIG_VORGABE_TAGE, ZAHLUNGSZIEL_VORGABE_TAGE, nummernformatOk, istGesellschaft } from './angebote';

export interface GesellschaftBank { inhaber?: string; bank?: string; iban?: string; bic?: string; /** Nur an den Browser: eine IBAN ist gespeichert (`iban` ist dann maskiert). */ ibanGesetzt?: boolean }
export interface Gesellschaft {
  id: Gesellschaftskennung;
  /** Genaue Firmierung, z. B. „KD Ventures UG (haftungsbeschränkt)“. */
  firmierung?: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  land?: string;
  email?: string;
  telefon?: string;
  web?: string;
  steuernummer?: string;
  ustId?: string;
  /** Pflichtangaben auf Geschäftsbriefen einer GmbH/UG (§ 35a GmbHG): Geschäftsführung, Registergericht + Nummer. */
  geschaeftsfuehrung?: string;
  register?: string;
  bank?: GesellschaftBank;
  /** Kleinunternehmer (§ 19 UStG) — dann ohne Umsatzsteuer, mit Hinweis im Angebot. */
  kleinunternehmer?: boolean;
  zahlungszielTage?: number;
  /** Standard-Gültigkeit von Angeboten in Tagen. */
  gueltigkeitTage?: number;
  /** Nummernformat für Angebote, Vorgabe `{KURZ}-A-{JAHR}-{NR4}`. */
  nummernformat?: string;
  /** Kürzel für die Nummer, Vorgabe KDC · KDV · MOS. */
  kurz?: string;
  /** Logo in der Dateiablage (nur PNG/JPG). */
  logoDateiId?: string;
  fusstext?: string;
  geaendert?: string;
  geaendertVon?: string;
}
export interface GesellschaftenDatei { gesellschaften: Gesellschaft[] }

export const gesellschaftenName = (haushalt: string) => `gesellschaften--${haushalt}`;

const zeile = (v: unknown, n: number) => { const t = String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); return t || undefined; };
const block = (v: unknown, n: number) => { const t = String(v ?? '').replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim().slice(0, n); return t || undefined; };
const ganz = (v: unknown, min: number, max: number) => { const n = Math.round(Number(v)); return v === '' || v == null || !Number.isFinite(n) ? undefined : Math.max(min, Math.min(max, n)); };
const mailOk = (v: unknown) => { const t = zeile(v, 160); return t && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? t : undefined; };
const webOk = (v: unknown) => { const t = zeile(v, 200); return t && /^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/[^\s]*)?$/i.test(t) ? t : undefined; };

/** Die leere Grundform einer Gesellschaft (nur Kennung) — Vorgaben gelten beim Lesen (`mitVorgaben`), nie gespeichert. */
export const leereGesellschaft = (id: Gesellschaftskennung): Gesellschaft => ({ id });

/** Alle drei — gespeicherte oder leere, in fester Reihenfolge. */
export function alleGesellschaften(d: GesellschaftenDatei | null | undefined): Gesellschaft[] {
  return GESELLSCHAFTEN.map(id => (d?.gesellschaften ?? []).find(g => g.id === id) ?? leereGesellschaft(id));
}

/** Werte zum Rechnen (Vorgaben, wo nichts steht). */
export function mitVorgaben(g: Gesellschaft): Gesellschaft & { name: string; kurz: string; nummernformat: string; zahlungszielTage: number; gueltigkeitTage: number } {
  return {
    ...g, name: g.firmierung || KERN_EINHEITEN.find(e => e.id === g.id)?.label || g.id, kurz: g.kurz || KURZ_VORGABE[g.id],
    nummernformat: g.nummernformat && nummernformatOk(g.nummernformat) ? g.nummernformat : NUMMER_VORGABE,
    zahlungszielTage: g.zahlungszielTage ?? ZAHLUNGSZIEL_VORGABE_TAGE, gueltigkeitTage: g.gueltigkeitTage ?? GUELTIG_VORGABE_TAGE,
  };
}

export interface GesellschaftFehler { feld: string; text: string }

/**
 * Eingehende Felder (Teil) auf die gespeicherte Gesellschaft legen und säubern. Ein ungültiges Nummernformat,
 * eine falsche IBAN oder E-Mail wird NICHT still verworfen, sondern als Fehler gemeldet (400).
 */
export function gesellschaftAnwenden(alt: Gesellschaft, roh: Record<string, unknown>, jetzt: string, person: string): { g: Gesellschaft; fehler: GesellschaftFehler[] } {
  const fehler: GesellschaftFehler[] = [];
  const n: Gesellschaft = { ...alt };
  const setze = <K extends keyof Gesellschaft>(k: K, v: Gesellschaft[K] | undefined) => { if (v === undefined || v === '') delete n[k]; else n[k] = v; };
  const hat = (k: string) => Object.prototype.hasOwnProperty.call(roh, k);
  const leerGewollt = (k: string) => roh[k] === null || roh[k] === '';
  for (const [k, max] of [['firmierung', 160], ['strasse', 120], ['plz', 12], ['ort', 80], ['land', 60], ['telefon', 40], ['steuernummer', 40], ['geschaeftsfuehrung', 160], ['register', 120], ['kurz', 12]] as const) {
    if (hat(k)) setze(k, zeile(roh[k], max));
  }
  if (hat('ustId')) { const u = zeile(roh.ustId, 20)?.replace(/\s/g, '').toUpperCase(); if (u && !/^[A-Z]{2}[A-Z0-9]{2,13}$/.test(u)) fehler.push({ feld: 'ustId', text: 'USt-IdNr. sieht nicht gültig aus (z. B. DE123456789).' }); else setze('ustId', u); }
  if (hat('email')) { const m = mailOk(roh.email); if (!m && !leerGewollt('email')) fehler.push({ feld: 'email', text: 'E-Mail-Adresse ungültig.' }); else setze('email', m); }
  if (hat('web')) { const w = webOk(roh.web); if (!w && !leerGewollt('web')) fehler.push({ feld: 'web', text: 'Webadresse ungültig.' }); else setze('web', w); }
  if (hat('kurz') && n.kurz && !/^[A-Za-z0-9]{1,12}$/.test(n.kurz)) { fehler.push({ feld: 'kurz', text: 'Kürzel nur Buchstaben und Ziffern (höchstens 12).' }); setze('kurz', alt.kurz); }
  if (hat('nummernformat')) {
    const f = zeile(roh.nummernformat, 60);
    if (f && !nummernformatOk(f)) fehler.push({ feld: 'nummernformat', text: 'Nummernformat braucht genau eine laufende Nummer ({NR} bzw. {NR3}–{NR6}); erlaubt sind {KURZ}, {JAHR}, {JJ}, Buchstaben, Ziffern und - _ . /' });
    else setze('nummernformat', f);
  }
  if (hat('kleinunternehmer')) setze('kleinunternehmer', roh.kleinunternehmer === true ? true : undefined);
  if (hat('zahlungszielTage')) setze('zahlungszielTage', ganz(roh.zahlungszielTage, 0, 180));
  if (hat('gueltigkeitTage')) setze('gueltigkeitTage', ganz(roh.gueltigkeitTage, 1, 365));
  if (hat('fusstext')) setze('fusstext', block(roh.fusstext, 600));
  if (hat('logoDateiId')) setze('logoDateiId', typeof roh.logoDateiId === 'string' && /^d-[a-z0-9-]{4,60}$/.test(roh.logoDateiId) ? roh.logoDateiId : undefined);
  if (hat('bank')) {
    const b = roh.bank && typeof roh.bank === 'object' ? roh.bank as Record<string, unknown> : {};
    const altIban = alt.bank?.iban;
    let iban = altIban;
    if (b.ibanEntfernen === true) iban = undefined;
    else if (b.iban !== undefined && b.iban !== '' && b.iban !== null && !String(b.iban).includes('•')) {
      if (ibanGueltig(b.iban)) iban = ibanGrundform(b.iban); else fehler.push({ feld: 'iban', text: 'IBAN ungültig (Prüfziffer) — nicht gespeichert.' });
    }
    const bic = zeile(b.bic, 11)?.replace(/\s/g, '').toUpperCase();
    if (bic && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic)) fehler.push({ feld: 'bic', text: 'BIC ungültig.' });
    const bank: GesellschaftBank = { ...(zeile(b.inhaber, 120) ? { inhaber: zeile(b.inhaber, 120) } : {}), ...(zeile(b.bank, 80) ? { bank: zeile(b.bank, 80) } : {}), ...(iban ? { iban } : {}), ...(bic && /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic) ? { bic } : {}) };
    setze('bank', Object.keys(bank).length ? bank : undefined);
  }
  n.geaendert = jetzt; n.geaendertVon = person;
  return { g: n, fehler };
}

/** Für den Browser: IBAN nur maskiert (+ ibanGesetzt). */
export function gesellschaftFuerAnzeige<G extends Gesellschaft>(g: G): G {
  if (!g.bank?.iban) return g;
  return { ...g, bank: { ...g.bank, iban: ibanMaskiert(g.bank.iban), ibanGesetzt: true } };
}

/** Was für Angebote fehlt (Hinweis im Tool und in den Stammdaten) — keine Rechtsberatung. */
export function gesellschaftLuecken(g: Gesellschaft): string[] {
  const f: string[] = [];
  if (!g.firmierung) f.push('Firmierung');
  if (!g.strasse || !g.plz || !g.ort) f.push('Anschrift');
  if (!g.steuernummer && !g.ustId) f.push('Steuernummer oder USt-IdNr.');
  if (!g.email) f.push('E-Mail');
  if (g.id === 'ug' || g.id === 'kdv') { if (!g.geschaeftsfuehrung) f.push('Geschäftsführung'); if (!g.register) f.push('Registergericht/HRB'); }
  return f;
}

export const istGesellschaftId = istGesellschaft;

// ── Umbenennung 30.09.: die MAKE-Gesellschaft heißt MAKE Innovation GmbH (Kennung `ug` bleibt) ──
// Der Vorschlag für die Firmierung kommt aus lib/einheiten.ts (UG_NAME) — `mitVorgaben` nimmt ihn, solange
// nichts gespeichert ist. Eine GESPEICHERTE Firmierung wird nie still überschrieben: nennt sie noch eine UG,
// zeigt die Stammdaten-Karte einen Hinweis mit Knopf (normaler Schreibweg mit Stand/409). Register (HRB),
// Geschäftsführung und alle Pflichtangaben pflegt Kevin — hier wird nichts erfunden.

/** Vorschlag für die Firmierung einer Gesellschaft, solange keine gespeichert ist — nur für `ug` (MAKE Innovation GmbH). */
export const firmierungVorschlag = (id: Gesellschaftskennung): string | undefined => (id === 'ug' ? UG_NAME : undefined);

/** Nennt die gespeicherte Firmierung der MAKE-Gesellschaft (`ug`) noch eine UG? Dann Hinweis „auf MAKE Innovation GmbH ändern?“. */
export function firmierungNochUG(g: Pick<Gesellschaft, 'id' | 'firmierung'>): boolean {
  return g.id === 'ug' && !!g.firmierung && /\bUG\b|unternehmergesellschaft|haftungsbeschränkt/i.test(g.firmierung);
}
