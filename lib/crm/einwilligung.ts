// ─── Einwilligung mit vollem Nachweis (28.09., U2 #55, rein, getestet) ───────
// Art. 7 Abs. 1 DSGVO: wer sich auf eine Einwilligung stützt, muss sie NACHWEISEN
// können — wann genau, wer sie aufgenommen hat, welcher Wortlaut galt und wo der
// Beleg liegt. Bis U2 hielt die Kartei nur Tag + ein Freitextfeld („nachweis“).
//
//   zeitpunkt        ISO mit Uhrzeit — stempelt der Server beim ersten Speichern
//   erfasstVon       Person aus der Sitzung — stempelt der Server (nie aus dem Body)
//   wortlaut         Text der Einwilligung (Frage + Antwort, Formulartext)
//   wortlautVersion  Fassung eines festen Textes („Formular v2“, „DOI-Text 2026-03“)
//   belegRef         wo der Beleg liegt: Dateiablage-Eintrag (d-…), Formular, Mail, Gespräch
//   widerrufenAm/Von Tag + Person des Widerrufs — stempelt der Server
//
// Einmal erfasst, ist eine Einwilligung unveränderlich: der Server nimmt Wortlaut,
// Beleg und Stempel immer aus dem gespeicherten Stand, nie aus dem Browser; nur der
// Widerruf kommt dazu (und geht nie zurück). Die Liste wächst nur (Nachweis).
//
// Altbestand (vor U2) bleibt gültig: fehlende Felder heißen „unvollständiger
// Nachweis“ — die Kanal-Ampel zeigt für werbliche Mail dann gelb statt grün
// (lib/crm/recht.ts). Keine Rechtsberatung — einmal anwaltlich gegenlesen.

import type { Einwilligung, EinwilligungKanal, Grundlage } from '@/lib/make-one/crm';

export const EW_KANAELE: readonly EinwilligungKanal[] = ['mail', 'telefon', 'social', 'newsletter', 'einladung'];
export const EW_GRUNDLAGEN: readonly Grundlage[] = ['einwilligung', 'bestandskunde_7_3', 'mutmasslich_b2b_tel', 'anfrage', 'vertrag', 'intro_akzeptiert'];

/** Mindestlängen für eine NEUE Einwilligung (Grundlage „einwilligung“): Wortlaut und Beleg sind Pflicht. */
export const WORTLAUT_MIN = 3;
export const BELEG_MIN = 2;
export const WORTLAUT_MAX = 1500;

const TAG = /^\d{4}-\d{2}-\d{2}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/;
const PERSON = /^[a-z0-9-]{1,40}$/;
const txt = (v: unknown, n: number) => { const t = String(v ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, n); return t || undefined; };

/** Eine Einwilligung aus dem Netz prüfen — Unbekanntes fällt weg, ungültige Einträge werden null. */
export function einwilligungSaeubern(e: unknown): Einwilligung | null {
  if (!e || typeof e !== 'object') return null;
  const x = e as Record<string, unknown>;
  if (!EW_KANAELE.includes(x.kanal as EinwilligungKanal) || !EW_GRUNDLAGEN.includes(x.grundlage as Grundlage) || typeof x.erteiltAm !== 'string' || !TAG.test(x.erteiltAm)) return null;
  const zeitpunkt = typeof x.zeitpunkt === 'string' && ISO.test(x.zeitpunkt) ? x.zeitpunkt : undefined;
  const erfasstVon = typeof x.erfasstVon === 'string' && PERSON.test(x.erfasstVon) ? x.erfasstVon : undefined;
  const widerrufenVon = typeof x.widerrufenVon === 'string' && PERSON.test(x.widerrufenVon) ? x.widerrufenVon : undefined;
  const wortlaut = txt(x.wortlaut, WORTLAUT_MAX), wortlautVersion = txt(x.wortlautVersion, 80), belegRef = txt(x.belegRef, 200);
  return {
    kanal: x.kanal as EinwilligungKanal, grundlage: x.grundlage as Grundlage, erteiltAm: x.erteiltAm, nachweis: txt(x.nachweis, 400) ?? '',
    ...(zeitpunkt ? { zeitpunkt } : {}), ...(erfasstVon ? { erfasstVon } : {}),
    ...(wortlaut ? { wortlaut } : {}), ...(wortlautVersion ? { wortlautVersion } : {}), ...(belegRef ? { belegRef } : {}),
    ...(typeof x.widerrufenAm === 'string' && TAG.test(x.widerrufenAm) ? { widerrufenAm: x.widerrufenAm } : {}),
    ...(widerrufenVon ? { widerrufenVon } : {}),
  };
}

/** Was am Nachweis fehlt (leer = vollständig). */
export function nachweisLuecken(e: Einwilligung): string[] {
  const f: string[] = [];
  if (!e.zeitpunkt) f.push('Zeitpunkt');
  if (!e.erfasstVon) f.push('erfasst von');
  if (!e.wortlaut && !e.wortlautVersion) f.push('Wortlaut');
  if (!e.belegRef) f.push('Beleg');
  return f;
}
/** Voller Nachweis: Zeitpunkt, wer, Wortlaut (oder Fassung) und Beleg. */
export const nachweisVollstaendig = (e: Einwilligung) => nachweisLuecken(e).length === 0;

/** Identität einer Einwilligung über Speichern hinweg — Widerruf und Nachweis-Felder zählen nicht (die setzt der Server). */
const identitaet = (e: Einwilligung) => `${e.kanal}|${e.grundlage}|${e.erteiltAm}|${e.nachweis ?? ''}|${e.zeitpunkt ?? ''}`;
const identitaetOhneZeit = (e: Einwilligung) => `${e.kanal}|${e.grundlage}|${e.erteiltAm}|${e.nachweis ?? ''}`;

export interface StempelErgebnis { liste: Einwilligung[]; neu: Einwilligung[]; widerrufen: Einwilligung[]; fehler?: string }

/**
 * Einwilligungen beim Speichern serverseitig stempeln (Kartei-Route, alle Schreibwege):
 *  · bekannte Einträge: Wortlaut, Beleg, Zeitpunkt, erfasst von bleiben wie gespeichert (unveränderlich)
 *  · Widerruf: nur hinzu, nie zurück; Tag = heute (Server), Person = `person`
 *  · neue Einträge: `zeitpunkt` = jetzt, `erfasstVon` = `person`; Grundlage „einwilligung“ braucht
 *    Wortlaut (≥ 3 Zeichen) und Beleg (≥ 2) — sonst `fehler` (die Route antwortet 400)
 *  · gespeicherte Einträge, die im neuen Stand fehlen, bleiben (die Liste wächst nur — Nachweis)
 * `erteiltAm` in der Zukunft wird auf heute gesetzt.
 */
export function einwilligungenStempeln(alt: Einwilligung[] | undefined, neu: Einwilligung[] | undefined, person: string, jetztIso: string, heute: string): StempelErgebnis {
  const gespeichert = [...(alt ?? [])];
  const frei = gespeichert.map(() => true);
  const finde = (e: Einwilligung) => {
    let i = gespeichert.findIndex((g, j) => frei[j] && identitaet(g) === identitaet(e));
    // Ein Browser-Stand von vor dem Stempeln trägt noch keinen Zeitpunkt — dann ohne Zeit vergleichen.
    if (i < 0 && !e.zeitpunkt) i = gespeichert.findIndex((g, j) => frei[j] && identitaetOhneZeit(g) === identitaetOhneZeit(e));
    if (i >= 0) frei[i] = false;
    return i;
  };
  const wer = PERSON.test(person) ? person : 'system';
  const raus: Einwilligung[] = [], dazu: Einwilligung[] = [], widerrufen: Einwilligung[] = [];
  for (const e of neu ?? []) {
    const i = finde(e);
    if (i >= 0) {
      const g = gespeichert[i];
      if (!g.widerrufenAm && e.widerrufenAm) {
        const w: Einwilligung = { ...g, widerrufenAm: heute, widerrufenVon: wer };
        raus.push(w); widerrufen.push(w);
      } else raus.push(g);
      continue;
    }
    const ohneWortlaut = (e.wortlaut ?? '').trim().length < WORTLAUT_MIN && !(e.wortlautVersion ?? '').trim();
    const ohneBeleg = (e.belegRef ?? '').trim().length < BELEG_MIN;
    if (e.grundlage === 'einwilligung' && (ohneWortlaut || ohneBeleg)) {
      return { liste: alt ?? [], neu: [], widerrufen: [], fehler: 'Neue Einwilligung nur mit Wortlaut und Beleg (Art. 7 Abs. 1 DSGVO) — nichts gespeichert.' };
    }
    const { widerrufenAm: _w, widerrufenVon: _v, ...rest } = e;
    const n: Einwilligung = {
      ...rest, erteiltAm: e.erteiltAm > heute ? heute : e.erteiltAm, zeitpunkt: jetztIso, erfasstVon: wer,
      ...(e.widerrufenAm ? { widerrufenAm: heute, widerrufenVon: wer } : {}),
    };
    raus.push(n); dazu.push(n);
  }
  // Nie verlieren: was gespeichert war und im neuen Stand fehlt, bleibt (an seiner Stelle der Reihenfolge nach hinten).
  gespeichert.forEach((g, j) => { if (frei[j]) raus.push(g); });
  return { liste: raus, neu: dazu, widerrufen };
}

/** Für die Auskunft nach Art. 15 und die Anzeige: jede Einwilligung mit ihrem vollen Nachweis und was fehlt. */
export function nachweisAuskunft(liste: Einwilligung[] | undefined) {
  return (liste ?? []).map(e => ({
    kanal: e.kanal, grundlage: e.grundlage, erteiltAm: e.erteiltAm, zeitpunkt: e.zeitpunkt ?? null, erfasstVon: e.erfasstVon ?? null,
    wortlaut: e.wortlaut ?? null, wortlautVersion: e.wortlautVersion ?? null, belegRef: e.belegRef ?? null, nachweis: e.nachweis || null,
    widerrufenAm: e.widerrufenAm ?? null, widerrufenVon: e.widerrufenVon ?? null,
    vollstaendig: nachweisVollstaendig(e), fehlt: nachweisLuecken(e),
  }));
}

/** Kanäle, für die eine Einwilligung Grundlage einer Werbung ist (Anfrage erlaubt nur die Antwort — zählt nicht). */
const traegt = (e: Einwilligung) => !e.widerrufenAm && e.grundlage !== 'anfrage';

export interface NachweisOffen { id: string; kanaele: EinwilligungKanal[]; fehlt: string[] }

/**
 * Datenqualität (28.09., U2-Nachtrag): Personen mit gültiger Einwilligung, deren Nachweis unvollständig ist —
 * je Person die Kanäle und was fehlt, dazu die Anzahl je Kanal. Nur zum Nachtragen von Hand; nichts wird geändert.
 * Gesperrte/eingeschränkte Personen (`ausgenommen`) zählen nicht — sie werden ohnehin nicht angesprochen.
 */
export function nachweisOffen(kontakte: { id: string; einwilligungen?: Einwilligung[]; werbesperre?: unknown; eingeschraenkt?: unknown }[]): { liste: NachweisOffen[]; jeKanal: Record<EinwilligungKanal, number> } {
  const jeKanal = Object.fromEntries(EW_KANAELE.map(k => [k, 0])) as Record<EinwilligungKanal, number>;
  const liste: NachweisOffen[] = [];
  for (const k of kontakte) {
    if (k.werbesperre || k.eingeschraenkt) continue;
    const offen = (k.einwilligungen ?? []).filter(e => traegt(e) && nachweisLuecken(e).length);
    if (!offen.length) continue;
    const kanaele = Array.from(new Set(offen.map(e => e.kanal)));
    for (const c of kanaele) jeKanal[c]++;
    liste.push({ id: k.id, kanaele, fehlt: Array.from(new Set(offen.flatMap(nachweisLuecken))) });
  }
  return { liste, jeKanal };
}
