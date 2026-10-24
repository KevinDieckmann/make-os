// ─── Öffentlicher Innovations-Check — die Strecke (24.10., Branch `innovations-check`) ──────────────────────────
// OHNE Sitzung erreichbar (middleware.ts `CHECK_OFFEN`: nur /check und POST /api/check). Handelt nie als Person.
// POST { aktion, … } — alle Aktionen außer `start` mit { sitzung, token } (Token nur im Browser, hier als SHA-256):
//   start { vorlage?, quelle?, webseite (Honigtopf, leer) } → { sitzung, token, katalog, zoe, hinweis, … }
//   stand                                  → Weitermachen nach dem Neuladen (gleiche Nutzlast ohne Token)
//   antwort { frage, optionIds | freitext, zusatz?, optionText? } · ueberspringen { frage }
//   kontakt { vorname, email, firma, rolle (A5-Option), telefon?, newsletter?, webseite } · ohne-kontakt
//   wahl { wahl: ergebnis | mehr } · ergebnis
// Reihenfolge und Regeln nur aus lib/check/ablauf.ts, Zahlen nur aus lib/check/auswertung.ts. Der Check kommt AUSGESCHALTET
// (Einstellungen, nur der Inhaber schaltet ein; ohne Verantwortlichen der Instanz bleibt er zu) — sonst 404 für jede Aktion.
// Schutz: Drossel je Netz (Start knapp, Antworten großzügig, falsche Tokens wie Fehlversuche), Honigtopf an Start und Kontakt,
// Mindestzeit bis zur Kontakt-Frage, Körper ≤ 16 KB (413), Freitexte nie gekürzt (413), nur Kennungen aus dem Katalog.

import { NextResponse } from 'next/server';
import { pruefe, fehlschlag, adresseNetz } from '@/lib/zugang/drossel';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { vorlageVon, STANDARD_VORLAGE } from '@/lib/check/katalog';
import { antwortPruefen, frageVon, kurzFertig, phaseVon, ueberspringbar } from '@/lib/check/ablauf';
import { auswerten, leadPunkte, profilAus } from '@/lib/check/auswertung';
import { ergebnisAnsicht } from '@/lib/check/ergebnis';
import { oeffentlicherKatalog } from '@/lib/check/oeffentlich';
import { begruessung, gespraechSatz, kontaktSatz, WAHL_SATZ } from '@/lib/check/zoe-texte';
import { HINWEIS_FASSUNG } from '@/lib/check/datenschutz';
import { ladeCheckEinstellungen, sitzungAnlegen, sitzungLesen, sitzungAendern, sitzungIntern, type CheckSitzung } from '@/lib/check/speicher';
import { zoeKontext, hinweisLaden, stromFuerBrowser, ablaufStand, leadAnlegen } from '@/lib/check/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 16 * 1024;
const KOPF = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
const antwort = (body: Record<string, unknown>, status = 200, extra: Record<string, string> = {}) => NextResponse.json(body, { status, headers: { ...KOPF, ...extra } });
const NICHT_DA = { ok: false, fehler: 'Den Check gibt es hier gerade nicht.' };
const SITZUNG_WEG = { ok: false, fehler: 'Diese Sitzung gibt es nicht (mehr). Starte den Check einfach neu.' };
/** Honigtopf und zu schnelle Kontakt-Frage: DERSELBE Text (wie bei der Buchung) — verrät nicht, was auffiel. */
const NICHT_ANGENOMMEN = { ok: false, fehler: 'Das hat leider nicht geklappt. Bitte lade die Seite neu und versuch es noch einmal.' };
/** Neue Sitzungen je Netz und Viertelstunde frei, danach wächst die Wartezeit. */
const START_FREI = 12;
/** Schritte je Netz und Viertelstunde frei (ein ganzer Check mit Vertiefung braucht ~70). */
const SCHRITT_FREI = 400;
/** Frühestens so viele Sekunden nach dem Start die Kontaktdaten (15 Klickfragen lesen braucht Zeit). */
const KONTAKT_NACH_MS = 20_000;

const EMAIL_OK = /^[^\s@<>"',;:]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/i;
const QUELLE_OK = /^[a-z0-9_-]{1,40}$/;
const text = (x: unknown, max: number): string | null => (typeof x === 'string' ? (x.trim().length <= max ? x.trim() : null) : '');

function gedrosselt(schluessel: string) {
  const p = pruefe(schluessel);
  return p.erlaubt ? null : antwort({ ok: false, fehler: `Zu viele Schritte auf einmal — bitte in ${Math.max(1, Math.ceil(p.warteSek / 60))} Min. noch einmal.` }, 429, { 'Retry-After': String(p.warteSek) });
}

export async function POST(req: Request) {
  const netz = adresseNetz(req);
  const e = await ladeCheckEinstellungen();
  if (!e.aktiv) return antwort(NICHT_DA, 404);
  const hinweis = await hinweisLaden();
  if (!hinweis) return antwort(NICHT_DA, 404);
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, MAX_BYTES); } catch (x) { return jsonZuGross(x) ?? antwort({ ok: false, fehler: 'Kein JSON.' }, 400); }
  const aktion = typeof b.aktion === 'string' ? b.aktion : '';

  // ── Start ──
  if (aktion === 'start') {
    const g = gedrosselt(`check-start:${netz}`); if (g) return g;
    fehlschlag(`check-start:${netz}`, Date.now(), START_FREI);
    if (typeof b.webseite === 'string' && b.webseite.trim()) return antwort(NICHT_ANGENOMMEN, 400);
    const v = vorlageVon(typeof b.vorlage === 'string' ? b.vorlage : STANDARD_VORLAGE);
    if (!v) return antwort(NICHT_DA, 404);
    const quelle = typeof b.quelle === 'string' && QUELLE_OK.test(b.quelle) ? b.quelle : undefined;
    const neu = await sitzungAnlegen(v.id, quelle);
    if (!neu) return antwort({ ok: false, fehler: 'Der Check ist gerade voll — bitte versuch es später noch einmal.' }, 503);
    return antwort({ ok: true, sitzung: neu.sitzung.id, token: neu.token, ...(await nutzlast(v, neu.sitzung, e, hinweis)) }, 201);
  }

  // ── alle übrigen: Sitzung + Token ──
  const g = gedrosselt(`check:${netz}`); if (g) return g;
  fehlschlag(`check:${netz}`, Date.now(), SCHRITT_FREI);
  const tokenSperre = gedrosselt(`check-token:${netz}`); if (tokenSperre) return tokenSperre;
  const s0 = await sitzungLesen(b.sitzung, b.token);
  if (!s0) { fehlschlag(`check-token:${netz}`); return antwort(SITZUNG_WEG, 404); }
  const v = vorlageVon(s0.vorlage);
  if (!v) return antwort(SITZUNG_WEG, 404);

  if (aktion === 'stand') return antwort({ ok: true, sitzung: s0.id, ...(await nutzlast(v, s0, e, hinweis)) });

  if (aktion === 'antwort' || aktion === 'ueberspringen') {
    const frageId = typeof b.frage === 'string' ? b.frage : '';
    const f = frageVon(v, frageId);
    if (!f) return antwort({ ok: false, fehler: 'Diese Frage gibt es nicht.' }, 400);
    const r = await sitzungAendern<{ text: string; status: 400 | 413 }>(b.sitzung, b.token, s => {
      const phase = phaseVon(v, ablaufStand(s), f.id);
      if (!phase) return { fehler: { text: 'Diese Frage ist gerade nicht dran.', status: 400 } };
      if (aktion === 'ueberspringen') {
        if (!ueberspringbar(f, phase)) return { fehler: { text: 'Diese Frage gehört zum Kurzcheck — bitte eine Antwort wählen.', status: 400 } };
        const rest = { ...s.antworten };
        delete rest[f.id];
        return { ...s, antworten: rest, uebersprungen: s.uebersprungen.includes(f.id) ? s.uebersprungen : [...s.uebersprungen, f.id] };
      }
      const p = antwortPruefen(f, b);
      if (!p.ok) return { fehler: { text: p.fehler, status: p.status } };
      // Eine Beleg-Bewertung gehört zum Text: ändert sich der Text, fällt sie weg (bewertet wird neu).
      const alt = s.antworten[f.id];
      const behalten = alt?.belegScore !== undefined && alt.freitext === p.antwort.freitext ? { belegScore: alt.belegScore, ...(alt.belegVon ? { belegVon: alt.belegVon } : {}) } : {};
      return { ...s, antworten: { ...s.antworten, [f.id]: { ...p.antwort, ...behalten, am: new Date().toISOString() } }, uebersprungen: s.uebersprungen.filter(x => x !== f.id) };
    });
    if (!r) return antwort(SITZUNG_WEG, 404);
    if ('fehler' in r) return antwort({ ok: false, fehler: r.fehler.text }, r.fehler.status);
    return antwort({ ok: true, ...stromFuerBrowser(v, r) });
  }

  if (aktion === 'kontakt') {
    if (typeof b.webseite === 'string' && b.webseite.trim()) return antwort(NICHT_ANGENOMMEN, 400);
    if (Date.now() - Date.parse(s0.gestartet) < KONTAKT_NACH_MS) return antwort(NICHT_ANGENOMMEN, 400);
    const vorname = text(b.vorname, 60), firma = text(b.firma, 120), telefon = text(b.telefon, 40);
    const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
    if (vorname === null || firma === null || telefon === null) return antwort({ ok: false, fehler: 'Eine Angabe ist zu lang.' }, 413);
    if (!vorname || !firma) return antwort({ ok: false, fehler: 'Bitte Vorname und Firma angeben.' }, 400);
    if (!EMAIL_OK.test(email)) return antwort({ ok: false, fehler: 'Bitte eine gültige E-Mail-Adresse angeben.' }, 400);
    if (telefon && !/^\+?[\d ()/-]{6,30}$/.test(telefon)) return antwort({ ok: false, fehler: 'Die Telefonnummer sieht nicht richtig aus.' }, 400);
    const a5 = frageVon(v, 'A5');
    const rolle = typeof b.rolle === 'string' && a5?.optionen?.some(o => o.id === b.rolle) ? b.rolle : null;
    if (!rolle) return antwort({ ok: false, fehler: 'Bitte deine Rolle wählen.' }, 400);
    const jetzt = new Date().toISOString();
    const r = await sitzungAendern<string>(b.sitzung, b.token, s => {
      if (!kurzFertig(v, ablaufStand(s))) return { fehler: 'Erst die Fragen des Kurzchecks, dann die Kontaktdaten.' };
      return {
        ...s, kontaktStand: 'erfasst',
        kontakt: { vorname, email, firma, ...(telefon ? { telefon } : {}), newsletterWunsch: b.newsletter === true, hinweisFassung: HINWEIS_FASSUNG, am: jetzt },
        antworten: { ...s.antworten, A5: { optionIds: [rolle], am: jetzt } },
      };
    });
    if (!r) return antwort(SITZUNG_WEG, 404);
    if ('fehler' in r) return antwort({ ok: false, fehler: r.fehler }, 400);
    // Lead ins CRM — ein Fehler dort hält die Person nie auf (intern sichtbar, „noch einmal versuchen“ im Haushalt).
    if (!r.crm || r.crm.status !== 'ok') {
      const profil = profilAus(v.katalog, r.antworten);
      const vorl = auswerten(v.katalog, v.regeln, profil, r.antworten);
      const crm = await leadAnlegen(r, e, `${v.name} auf der Website: Kurzcheck ausgefüllt, vorläufige Stufe ${vorl.stufe} (${vorl.stufe_name}, ${vorl.gesamt} von 100).`);
      await sitzungIntern(r.id, s => ({ ...s, crm }));
    }
    return antwort({ ok: true, ...stromFuerBrowser(v, r) });
  }

  if (aktion === 'ohne-kontakt') {
    const r = await sitzungAendern<string>(b.sitzung, b.token, s => (kurzFertig(v, ablaufStand(s)) ? { ...s, kontaktStand: s.kontaktStand === 'erfasst' ? 'erfasst' : 'uebersprungen' } : { fehler: 'Erst die Fragen des Kurzchecks.' }));
    if (!r) return antwort(SITZUNG_WEG, 404);
    if ('fehler' in r) return antwort({ ok: false, fehler: r.fehler }, 400);
    return antwort({ ok: true, ...stromFuerBrowser(v, r) });
  }

  if (aktion === 'wahl') {
    const wahl = b.wahl === 'mehr' ? 'mehr' : b.wahl === 'ergebnis' ? 'ergebnis' : null;
    if (!wahl) return antwort({ ok: false, fehler: 'wahl: ergebnis oder mehr.' }, 400);
    const r = await sitzungAendern<string>(b.sitzung, b.token, s => (kurzFertig(v, ablaufStand(s)) && s.kontaktStand !== 'offen' ? { ...s, wahl } : { fehler: 'Erst der Kurzcheck und die Kontakt-Frage.' }));
    if (!r) return antwort(SITZUNG_WEG, 404);
    if ('fehler' in r) return antwort({ ok: false, fehler: r.fehler }, 400);
    return antwort({ ok: true, ...stromFuerBrowser(v, r) });
  }

  if (aktion === 'ergebnis') {
    if (!kurzFertig(v, ablaufStand(s0)) || s0.kontaktStand === 'offen') return antwort({ ok: false, fehler: 'Erst der Kurzcheck und die Kontakt-Frage.' }, 400);
    const { ergebnis, profil, ansicht } = ergebnisAnsicht(v, s0.antworten);
    const lead = leadPunkte(v.leadScoring, profil, ergebnis, {});
    const jetzt = new Date().toISOString();
    const r = await sitzungAendern<string>(b.sitzung, b.token, s => ({
      ...s, wahl: 'ergebnis', abgeschlossen: s.abgeschlossen ?? jetzt,
      ergebnis: { am: jetzt, gesamt: ergebnis.gesamt, stufe: ergebnis.stufe, stufeName: ergebnis.stufe_name, genauigkeit: ergebnis.genauigkeit, dimensionen: ergebnis.dimensionen as Record<string, number>, lead },
    }));
    if (!r || 'fehler' in r) return antwort(SITZUNG_WEG, 404);
    const k = await zoeKontext(e);
    return antwort({ ok: true, ...stromFuerBrowser(v, r), ansicht, gespraech: { satz: gespraechSatz(k), ...(e.buchungSlug ? { pfad: `/buchen/${e.buchungSlug}` } : {}) } });
  }

  return antwort({ ok: false, fehler: 'Unbekannte Aktion.' }, 400);
}

/** Start und Weitermachen: Katalog (ohne Punkte), Zoes feste Sätze, Datenschutzhinweis, Stand. */
async function nutzlast(v: NonNullable<ReturnType<typeof vorlageVon>>, s: CheckSitzung, e: Awaited<ReturnType<typeof ladeCheckEinstellungen>>, hinweis: { zeilen: string[]; link: string | null }) {
  const k = await zoeKontext(e);
  return {
    katalog: oeffentlicherKatalog(v),
    zoe: { begruessung: begruessung(k), kontakt: kontaktSatz(k), wahl: WAHL_SATZ, gespraech: gespraechSatz(k) },
    hinweis: { zeilen: hinweis.zeilen, link: hinweis.link, fassung: HINWEIS_FASSUNG },
    ...stromFuerBrowser(v, s),
  };
}
