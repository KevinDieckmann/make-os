// ─── MAKE OS — Inhaber: eine Rolle, mehrere Konten (09.10., R9 „zweite gleichwertige Inhaberin“) ─────────────────────
// Kevin 08.10. (R9): „Malin wird gleichwertige zweite Inhaberin · Server-Zugang (SSH) auch für Malin.“ ONBOARDING_PLAN.md › L35
// („nur ein Inhaber, keine Vertretung“). Plattform-Regel: keine Namen — „zweite Person“ ist irgendein Konto der Instanz.
//
// Regel (EINE Stelle, rein — Server und Browser):
//   · `rolle: 'inhaber'` dürfen MEHRERE Konten tragen. Jede Rechte-Prüfung („nur der Inhaber“) gilt für JEDEN wirksamen Inhaber
//     (`istWirksamerInhaber`): Rolle Inhaber UND im Haushalt der Inhaber. Inhaber heißt Verwaltung (Konten, Haushalt, 2FA-Pflicht,
//     Datenschutz, Nachweise, Server) — nie Einsicht in Persönliches der anderen Person (Gesundheit, „nur ich“, private Notizen,
//     persönliche Bestände bleiben je Person; Wächter tests/messlatte-malin.test.ts › zweite Inhaberin).
//   · Was GENAU EINEN braucht, nimmt den Haupt-Inhaber (`hauptInhaber`) — nie einen Namen: Altbestand ohne Suffix
//     (`eigenerSpeicher`, Stammdaten-Altbestand, Altbestand-Übernahme), die Person eines Systemlaufs (`laufPerson`), die
//     Kalender-Haupt-Person (ohne `ICLOUD_PERSON`), der Haushalt der Inhaber, das Mac-Adressbuch.
//     Haupt-Inhaber = die ausdrückliche Einstellung `einstellungen.hauptInhaber` (wird bei der ersten Ernennung festgeschrieben),
//     sonst das älteste Inhaber-Konto: das erste in der Reihenfolge des Bestands (Konten werden nur hinten angehängt — Erstkonto
//     zuerst). Das ist dieselbe Wahl wie die des alten Stands (`find(k => k.rolle === 'inhaber')`) — der Rückweg sieht denselben.
//   · Haushalt der Inhaber = der Haushalt des Haupt-Inhabers. Mehrere Inhaber teilen ihn immer: ernennen nur im selben Haushalt
//     (sonst 400), solange es mehrere gibt, bleibt ihr Haushalt fest (Route `konto/haushalt`).
//   · Ernennen/Abgeben (`zumInhaberPruefen`/`abgebenPruefen`): Ziel im selben Haushalt mit zweitem Faktor, kein „nur Business“;
//     der letzte Inhaber gibt nie ab; der Haupt-Inhaber auch nicht (Altbestand, Systemläufe und Haushalts-Kalender hängen an ihm —
//     ein Wechsel wäre eine eigene, bewusste Entscheidung, nicht gebaut). Schreiben nur über `aendereKonten` (Route).
// Wächter: tests/zweite-inhaberin.test.ts.

import type { Konto, KontenStand, ZugangEinstellungen } from './konten';

/** Was die Regeln von einem Konto brauchen. */
export type InhaberKern = Pick<Konto, 'speicher' | 'rolle'> & Partial<Pick<Konto, 'haushalt' | 'zweiterFaktor' | 'finanzRecht' | 'name'>>;
/** Konten + (optional) die Einstellungen der Instanz — die ausdrückliche Wahl des Haupt-Inhabers steht dort. */
export interface InhaberStand<K extends InhaberKern = InhaberKern> { konten: readonly K[]; einstellungen?: Pick<ZugangEinstellungen, 'hauptInhaber'> | null }

const istInhaberRolle = (k: Pick<Konto, 'rolle'> | undefined | null): boolean => k?.rolle === 'inhaber';

/** Alle Konten mit Rolle Inhaber in der Reihenfolge des Bestands (ältestes zuerst). */
export function inhaberKonten<K extends InhaberKern>(st: InhaberStand<K>): K[] {
  return st.konten.filter(istInhaberRolle);
}

/** Der Haupt-Inhaber: ausdrückliche Einstellung (wenn das Konto noch Inhaber ist), sonst das älteste Inhaber-Konto. */
export function hauptInhaber<K extends InhaberKern>(st: InhaberStand<K>): K | undefined {
  const alle = inhaberKonten(st);
  const fest = st.einstellungen?.hauptInhaber;
  return (fest ? alle.find(k => k.speicher === fest) : undefined) ?? alle[0];
}

/** Der Haushalt der Inhaber (der des Haupt-Inhabers) — oder null. */
export function haushaltDerInhaber(st: InhaberStand): string | null {
  return hauptInhaber(st)?.haushalt ?? null;
}

/** Gehört das Konto zum Haushalt der Inhaber? Der Haupt-Inhaber selbst immer (auch ohne Haushalt). */
export function imHaushaltDerInhaber(st: InhaberStand, speicher: string | null | undefined): boolean {
  if (!speicher) return false;
  const haupt = hauptInhaber(st);
  const ich = st.konten.find(k => k.speicher === speicher);
  if (!haupt || !ich) return false;
  if (ich.speicher === haupt.speicher) return true;
  return !!haupt.haushalt && ich.haushalt === haupt.haushalt;
}

/** Die Konten im Haushalt der Inhaber, in der Reihenfolge des Bestands. */
export function kontenImHaushaltDerInhaber<K extends InhaberKern>(st: InhaberStand<K>): K[] {
  return st.konten.filter(k => imHaushaltDerInhaber(st, k.speicher));
}

/** Hat diese Person Inhaber-Rechte? Rolle Inhaber UND im Haushalt der Inhaber (ein verirrtes Inhaber-Konto anderswo zählt nicht). */
export function istWirksamerInhaber(st: InhaberStand, speicher: string | null | undefined): boolean {
  const ich = speicher ? st.konten.find(k => k.speicher === speicher) : undefined;
  return istInhaberRolle(ich) && imHaushaltDerInhaber(st, speicher);
}

/** Alle wirksamen Inhaber (Haupt-Inhaber zuerst) — Empfänger von Meldungen „an den Inhaber“. */
export function wirksameInhaber<K extends InhaberKern>(st: InhaberStand<K>): K[] {
  const haupt = hauptInhaber(st);
  const alle = inhaberKonten(st).filter(k => imHaushaltDerInhaber(st, k.speicher));
  return haupt ? [haupt, ...alle.filter(k => k.speicher !== haupt.speicher)] : alle;
}

/** Ist diese Person der Haupt-Inhaber? */
export function istHauptInhaber(st: InhaberStand, speicher: string | null | undefined): boolean {
  return !!speicher && hauptInhaber(st)?.speicher === speicher;
}

// ── Ernennen und Abgeben (rein) ─────────────────────────────────────────────────────────────────────────────────────

export type RollenPruefung = { ok: true } | { ok: false; status: 400 | 403 | 404 | 409; fehler: string };
const nein = (status: 400 | 403 | 404 | 409, fehler: string): RollenPruefung => ({ ok: false, status, fehler });

/** Darf `von` das Konto `ziel` zum Inhaber machen? */
export function zumInhaberPruefen(st: InhaberStand, von: string, ziel: string): RollenPruefung {
  if (!istWirksamerInhaber(st, von)) return nein(403, 'Nur ein Inhaber kann jemanden zum Inhaber machen.');
  const k = st.konten.find(x => x.speicher === ziel);
  if (!k) return nein(404, 'Konto nicht gefunden.');
  if (k.speicher === von) return nein(409, 'Du bist schon Inhaber.');
  if (istInhaberRolle(k)) return nein(409, 'Dieses Konto ist schon Inhaber.');
  const haushalt = haushaltDerInhaber(st);
  if (!haushalt) return nein(409, 'Erst dem Inhaber-Konto einen Haushalt zuordnen (Haushaltsfinanzen) — Inhaber teilen immer einen Haushalt.');
  if (k.haushalt !== haushalt) return nein(400, 'Inhaber kann nur werden, wer im selben Haushalt ist — erst den Haushalt zuordnen.');
  if (k.finanzRecht === 'business') return nein(409, 'Das Konto sieht nur die Business-Finanzen — erst den vollen Haushaltszugang geben, dann zum Inhaber machen.');
  if (!k.zweiterFaktor) return nein(409, 'Das Konto hat noch keinen zweiten Faktor — erst einrichten lassen (Konto › Zweiter Faktor), dann zum Inhaber machen.');
  return { ok: true };
}

/** Darf `wer` die eigene Inhaber-Rolle abgeben? */
export function abgebenPruefen(st: InhaberStand, wer: string): RollenPruefung {
  const k = st.konten.find(x => x.speicher === wer);
  if (!k) return nein(404, 'Konto nicht gefunden.');
  if (!istInhaberRolle(k)) return nein(409, 'Du bist kein Inhaber.');
  if (wirksameInhaber(st).filter(x => x.speicher !== wer).length === 0) return nein(409, 'Der letzte Inhaber kann die Rolle nicht abgeben — erst eine weitere Person zum Inhaber machen.');
  if (istHauptInhaber(st, wer)) return nein(409, 'Der Haupt-Inhaber kann die Rolle nicht abgeben: An ihm hängen der Altbestand, die Systemläufe und der Haushalts-Kalender.');
  return { ok: true };
}

/** Das Ziel zum Inhaber machen (nach `zumInhaberPruefen`). Schreibt beim ersten Mal den bisherigen Haupt-Inhaber fest. */
export function zumInhaberMachen(st: KontenStand, ziel: string): KontenStand {
  const haupt = hauptInhaber(st);
  const e = { ...(st.einstellungen ?? {}) };
  if (haupt && !e.hauptInhaber) e.hauptInhaber = haupt.speicher;
  return { ...st, konten: st.konten.map(k => (k.speicher === ziel ? { ...k, rolle: 'inhaber' as const } : k)), einstellungen: e };
}

/** Die eigene Inhaber-Rolle abgeben (nach `abgebenPruefen`). */
export function rolleAbgeben(st: KontenStand, wer: string): KontenStand {
  return { ...st, konten: st.konten.map(k => (k.speicher === wer ? { ...k, rolle: 'mitglied' as const } : k)) };
}
