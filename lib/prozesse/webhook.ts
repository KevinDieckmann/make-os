// ─── Prozesse — der abgesicherte Webhook von außen: reine Regeln (Etappe B1, 21.10.; Entscheidung 21.10.: „Ja, abgesichert“; ANALYSE_100.md Punkt 32) ─────
// Je Prozess eine eigene Adresse `/api/prozesse/webhook/pw-<24 hex>` (96 Bit) mit eigenem Schlüssel:
//   · der Schlüssel (32 Byte, base64url) wird beim Anlegen bzw. Erneuern GENAU EINMAL angezeigt; gespeichert wird nur sein SHA-256 (Fingerabdruck) im
//     Bestand `prozesse-webhook--<haushalt>` (nie in der Definition, nie in einer Version, nie im Protokoll);
//   · erst nach Klick „scharf“ nimmt die Adresse etwas an — und nur, solange die jüngste veröffentlichte Version einen Webhook-Auslöser hat;
//   · angenommen werden NUR die Felder des Schemas am Auslöser (`koerperFiltern`), der Rest wird verworfen (nur gezählt); Körper ≤ 64 KB; alles ist
//     fremder Text (`fremd: true` am Eingang — wer ihn an ein Modell gibt, kapselt ihn mit `fremd()`);
//   · der Webhook schreibt NUR einen Eingang und ein Ereignis `webhook` (Kennungen: Prozess, Eingang) ins Ereignis-System — gestartet wird ein Lauf erst
//     vom Motor (Etappe C). Für jede Fehlerart (unbekannt, nicht scharf, falscher Schlüssel) dieselbe Antwort 404 — die Adresse verrät nichts.
// Server: lib/prozesse/webhook-server.ts; Route: app/api/prozesse/webhook/[kennung]/route.ts (offen, Middleware `PROZESS_WEBHOOK`). Rein; Tests:
// tests/prozesse-webhook.test.ts.

import {
  PROZESS_GRENZEN, PROZESS_TEXT, WEBHOOK_KENNUNG,
  type Ausloeser, type ProzessDefinition, type ProzessEintrag, type WebhookDatei, type WebhookEingang, type WebhookEintrag, type WebhookFeld,
} from './definition';
import { startKnoten } from './fluss';
import type { ProzessRechte } from './rollen';

/** Pfad der öffentlichen Adresse — dieselbe Form wie die Middleware (`PROZESS_WEBHOOK` in middleware.ts; Wächter im Test). */
export const WEBHOOK_PFAD = /^\/api\/prozesse\/webhook\/pw-[a-f0-9]{24}$/;
export const webhookAdresse = (kennung: string): string => `/api/prozesse/webhook/${kennung}`;
/** Form des Schlüssels: 32 Byte base64url (43 Zeichen). */
export const SCHLUESSEL_FORM = /^[A-Za-z0-9_-]{43}$/;
/** Kopf mit dem Schlüssel: `Authorization: Bearer <schlüssel>` oder `X-Make-Webhook-Schluessel: <schlüssel>`. */
export function schluesselAusKopf(h: { get(n: string): string | null }): string | null {
  const a = h.get('authorization');
  const roh = a && /^Bearer\s+/i.test(a) ? a.replace(/^Bearer\s+/i, '').trim() : (h.get('x-make-webhook-schluessel') ?? '').trim();
  return SCHLUESSEL_FORM.test(roh) ? roh : null;
}
/** Die eine Antwort für jede abgelehnte Art (unbekannt, nicht scharf, falscher Schlüssel) — die Adresse verrät nichts. */
export const WEBHOOK_UNBEKANNT = 'Nicht gefunden.';

/** Der Webhook-Auslöser einer Definition (höchstens einer je Prozess) — oder null. */
export function webhookAusloeserVon(d: Pick<ProzessDefinition, 'knoten'>): Extract<Ausloeser, { art: 'webhook' }> | null {
  for (const s of startKnoten(d)) if (s.ausloeser?.art === 'webhook') return s.ausloeser;
  return null;
}

const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[^\s@<>()[\]\\,;:"]{1,253}\.[A-Za-z]{2,24}$/;
const TAG = /^\d{4}-\d{2}-\d{2}$/;
const KENNUNG = /^[A-Za-z0-9][A-Za-z0-9_:.~-]{0,119}$/;
const STEUER = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/**
 * Den Körper gegen das Schema filtern (rein): nur oberste Felder des Schemas, je Art geprüft (Text ohne Steuerzeichen und ≤ max — sonst abgelehnt, nie
 * gekürzt; E-Mail, Zahl, ja/nein, Tag, Kennung, Auswahl aus den Optionen); Pflichtfelder müssen da sein. Unbekannte Felder werden verworfen und nur gezählt.
 * Fehler nennen nur Feld-Kennungen, nie Werte.
 */
export function koerperFiltern(schema: readonly WebhookFeld[], koerper: unknown):
  { ok: true; felder: Record<string, string | number | boolean>; verworfen: number } | { ok: false; fehler: string[] } {
  if (!koerper || typeof koerper !== 'object' || Array.isArray(koerper)) return { ok: false, fehler: ['Der Körper ist kein JSON-Objekt.'] };
  const o = koerper as Record<string, unknown>;
  const bekannt = new Set(schema.map(f => f.id));
  const verworfen = Object.keys(o).filter(k => !bekannt.has(k)).length;
  const felder: Record<string, string | number | boolean> = {};
  const fehler: string[] = [];
  for (const f of schema) {
    const v = o[f.id];
    if (v === undefined || v === null || v === '') { if (f.pflicht) fehler.push(`„${f.id}“ fehlt.`); continue; }
    switch (f.art) {
      case 'text': {
        if (typeof v !== 'string') { fehler.push(`„${f.id}“: Text erwartet.`); break; }
        const t = v.replace(STEUER, '').trim();
        const max = f.max ?? PROZESS_TEXT.webhookText;
        if (t.length > max) { fehler.push(`„${f.id}“: höchstens ${max} Zeichen.`); break; }
        if (t) felder[f.id] = t; else if (f.pflicht) fehler.push(`„${f.id}“ fehlt.`);
        break;
      }
      case 'email': if (typeof v === 'string' && v.length <= 254 && EMAIL.test(v.trim())) felder[f.id] = v.trim().toLowerCase(); else fehler.push(`„${f.id}“: keine E-Mail-Adresse.`); break;
      case 'zahl': {
        const z = typeof v === 'number' ? v : typeof v === 'string' && /^-?\d+([.,]\d+)?$/.test(v.trim()) ? Number(v.trim().replace(',', '.')) : NaN;
        if (Number.isFinite(z) && Math.abs(z) <= 1e12) felder[f.id] = z; else fehler.push(`„${f.id}“: Zahl erwartet.`);
        break;
      }
      case 'ja-nein': {
        const j = v === true || v === 'true' || v === 'ja' ? true : v === false || v === 'false' || v === 'nein' ? false : null;
        if (j === null) fehler.push(`„${f.id}“: ja oder nein.`); else felder[f.id] = j;
        break;
      }
      case 'datum': if (typeof v === 'string' && TAG.test(v) && new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v) felder[f.id] = v; else fehler.push(`„${f.id}“: Tag als JJJJ-MM-TT.`); break;
      case 'kennung': if (typeof v === 'string' && KENNUNG.test(v)) felder[f.id] = v; else fehler.push(`„${f.id}“: Kennung erwartet.`); break;
      case 'auswahl': if (typeof v === 'string' && (f.optionen ?? []).includes(v)) felder[f.id] = v; else fehler.push(`„${f.id}“: keine der Optionen.`); break;
    }
  }
  return fehler.length ? { ok: false, fehler } : { ok: true, felder, verworfen };
}

// ── Verwaltung (Werkstatt): Schlüssel, scharf, entfernen ──────────────────────────────────────────────────────────────────────────────────────────

export interface WebhookKontext {
  person: string; jetzt: string; rechte: ProzessRechte;
  /** Der Prozess (aus `prozesse--<haushalt>`). */
  prozess: ProzessEintrag | null;
  /** Nur bei `webhook-schluessel`: neue Adresse (falls noch keine) und der neue Schlüssel samt Fingerabdruck — erzeugt vom Server. */
  neu?: { kennung: string; schluessel: string; hash: string };
}
export type WebhookErgebnis =
  | { ok: true; datei: WebhookDatei; eintrag: WebhookEintrag | null; geheim?: { adresse: string; schluessel: string } }
  | { ok: false; status: 400 | 403 | 404 | 409; fehler: string };
const nein = (status: 400 | 403 | 404 | 409, fehler: string): WebhookErgebnis => ({ ok: false, status, fehler });

/** Wie der Webhook ohne Geheimnisse aussieht (Antworten, Werkstatt): Adresse, scharf, Zähler. */
export const webhookKurz = (w: WebhookEintrag) => ({
  prozessId: w.prozessId, adresse: webhookAdresse(w.kennung), scharf: w.scharf, angelegtAm: w.angelegtAm,
  ...(w.erneuertAm ? { erneuertAm: w.erneuertAm } : {}), ...(w.scharfAm ? { scharfAm: w.scharfAm } : {}), anzahl: w.anzahl ?? 0, ...(w.zuletztAm ? { zuletztAm: w.zuletztAm } : {}),
});

/**
 * Webhook verwalten (rein). `aktion`: webhook-schluessel { id } (anlegen bzw. erneuern — der neue Schlüssel steht genau einmal in `geheim`, der alte gilt
 * sofort nicht mehr; ein neuer Webhook kommt NICHT scharf) · webhook-scharf { id, an } (an nur mit veröffentlichter Version mit Webhook-Auslöser) ·
 * webhook-entfernen { id } (Adresse und Eingänge des Prozesses fallen weg). Nur volle Mitglieder (403).
 */
export function webhookAnwenden(datei: WebhookDatei, eingabe: unknown, kx: WebhookKontext): WebhookErgebnis {
  const o = eingabe && typeof eingabe === 'object' && !Array.isArray(eingabe) ? eingabe as Record<string, unknown> : null;
  if (!o) return nein(400, 'Eingabe fehlt.');
  if (!kx.rechte.webhook) return nein(403, 'Veröffentlichen, aktiv schalten und Webhooks gibt es nur für volle Mitglieder — Entwürfe kannst du bauen.');
  const p = kx.prozess;
  if (!p || p.id !== o.id) return nein(404, 'Diesen Prozess gibt es nicht (mehr).');
  const alt = datei.webhooks.find(w => w.prozessId === p.id) ?? null;
  switch (o.aktion) {
    case 'webhook-schluessel': {
      if (p.status === 'archiviert') return nein(409, 'Ein archivierter Prozess bekommt keinen Webhook.');
      if (!webhookAusloeserVon(p.entwurf) && !p.versionen.some(v => webhookAusloeserVon(v.definition))) return nein(409, 'Erst einen Auslöser „Webhook von außen“ anlegen.');
      const neu = kx.neu;
      if (!neu || !WEBHOOK_KENNUNG.test(neu.kennung) || !/^[a-f0-9]{64}$/.test(neu.hash)) return nein(400, 'Kein neuer Schlüssel.');
      if (!alt && datei.webhooks.some(w => w.kennung === neu.kennung)) return nein(409, 'Diese Adresse gibt es schon — bitte noch einmal.');
      const eintrag: WebhookEintrag = alt
        ? { ...alt, schluesselHash: neu.hash, erneuertAm: kx.jetzt, erneuertVon: kx.person }
        : { prozessId: p.id, kennung: neu.kennung, schluesselHash: neu.hash, scharf: false, angelegtAm: kx.jetzt, angelegtVon: kx.person };
      return {
        ok: true, eintrag, geheim: { adresse: webhookAdresse(eintrag.kennung), schluessel: neu.schluessel },
        datei: { ...datei, webhooks: alt ? datei.webhooks.map(w => (w.prozessId === p.id ? eintrag : w)) : [...datei.webhooks, eintrag] },
      };
    }
    case 'webhook-scharf': {
      if (!alt) return nein(404, 'Erst den Webhook anlegen (Schlüssel).');
      const an = o.an === true;
      if (an) {
        if (p.status === 'archiviert') return nein(409, 'Ein archivierter Prozess nimmt nichts an.');
        const v = p.versionen.at(-1);
        if (!v || !webhookAusloeserVon(v.definition)) return nein(409, 'Scharf nur mit einer veröffentlichten Version mit Auslöser „Webhook von außen“.');
      }
      if (alt.scharf === an) return { ok: true, datei, eintrag: alt };
      const eintrag: WebhookEintrag = { ...alt, scharf: an, scharfAm: kx.jetzt, scharfVon: kx.person };
      return { ok: true, eintrag, datei: { ...datei, webhooks: datei.webhooks.map(w => (w.prozessId === p.id ? eintrag : w)) } };
    }
    case 'webhook-entfernen': {
      if (!alt) return { ok: true, datei, eintrag: null };
      return { ok: true, eintrag: null, datei: { ...datei, webhooks: datei.webhooks.filter(w => w.prozessId !== p.id), eingaenge: datei.eingaenge.filter(e => e.prozessId !== p.id) } };
    }
    default: return nein(400, 'Unbekannte Aktion.');
  }
}

// ── Annehmen (offene Route) ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Die angenommene Lage: Prozess, jüngste Version und ihr Webhook-Auslöser — oder null (dann 404). Rein. */
export function annahmeLage(datei: WebhookDatei, kennung: string, prozesse: readonly ProzessEintrag[]):
  { webhook: WebhookEintrag; prozess: ProzessEintrag; version: number; ausloeser: Extract<Ausloeser, { art: 'webhook' }> } | null {
  const w = WEBHOOK_KENNUNG.test(kennung) ? datei.webhooks.find(x => x.kennung === kennung) : undefined;
  if (!w?.scharf) return null;
  const p = prozesse.find(x => x.id === w.prozessId);
  if (!p || p.status === 'archiviert') return null;
  const v = p.versionen.at(-1);
  const a = v ? webhookAusloeserVon(v.definition) : null;
  return v && a ? { webhook: w, prozess: p, version: v.nr, ausloeser: a } : null;
}

/**
 * Einen Eingang ablegen (rein): ältere als `ab` (Frist „ereignisse“) fallen weg; über `PROZESS_GRENZEN.eingaenge` wird der neue ABGELEHNT (`voll`), nie
 * ein vorhandener gekürzt; Zähler am Webhook (Anzahl, zuletzt).
 */
export function eingangAblegen(datei: WebhookDatei, e: WebhookEingang, ab: string): { ok: true; datei: WebhookDatei } | { ok: false; voll: true } {
  const bleibt = datei.eingaenge.filter(x => x.am >= ab);
  if (bleibt.length >= PROZESS_GRENZEN.eingaenge) return { ok: false, voll: true };
  return {
    ok: true,
    datei: {
      ...datei, eingaenge: [...bleibt, e],
      webhooks: datei.webhooks.map(w => (w.prozessId === e.prozessId ? { ...w, anzahl: (w.anzahl ?? 0) + 1, zuletztAm: e.am } : w)),
    },
  };
}

/** Eingänge vor der Frist entfernen (rein, Löschfristen-Lauf). */
export function eingaengeFrist(datei: WebhookDatei, ab: string): { datei: WebhookDatei; n: number } {
  const bleibt = datei.eingaenge.filter(x => x.am >= ab);
  const n = datei.eingaenge.length - bleibt.length;
  return { datei: n ? { ...datei, eingaenge: bleibt } : datei, n };
}
