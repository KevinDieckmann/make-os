'use client';

// ─── CRM — Daten auf der Seite ──────────────────────────────────────────────
// Zwei Quellen: die Kartei (Personen, /api/state/kontakte) und der CRM-Bestand
// (Chancen, Mandate, Leistungen, Events, /api/crm/bestand). Jede Handlung
// schickt eine Einzeländerung; der Abgleich holt alle 20 Sekunden den Stand,
// damit Kevin und Malin gleichzeitig arbeiten können.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAbgleich } from '@/hooks/useAbgleich';
import type { Kontakt } from '@/lib/make-one/crm';
import type { KontaktFelder } from '@/lib/crm/stationen';
import { CRM_LISTEN, type CrmBestand, type CrmListe, type ChancenStufe } from '@/lib/crm/typen';
import type { Prognose, Ampel } from '@/lib/crm/pipeline';
import type { MandatLage } from '@/lib/crm/kunden';
import type { EventZahlen } from '@/lib/crm/events';
import { deltaAnwenden } from '@/lib/kontakte/delta';
import { localDay } from '@/lib/zeit';
import { KontaktStaende, kontaktSchreiben, nacheinanderKette, KONTAKT_KONFLIKT, type KontaktAntwort, type KontaktOp } from '@/lib/crm/kontakt-schreiben';
import { neueKennung } from '@/lib/kennung';
import { NEU_LADEN_TEXT } from '@/lib/bau/kennung';

export interface CrmAntwort {
  ok: boolean; heute: string; stand: CrmBestand;
  /** Wer hier angemeldet ist (Team-Kürzel) — für „Meins“, Übergaben und Freigaben. */
  ich: string;
  stufen: { id: ChancenStufe; label: string; p: number; weiterWenn: string; offen: boolean }[];
  prognose: Prognose; gewinnquote: { gewonnen: number; verloren: number; quote: number | null };
  ampel: Record<string, { ampel: Ampel; gruende: string[] }>;
  mandate: Record<string, MandatLage>;
  /** Faktor Zahlung aus den Rechnungen im Finanzplan (null = keine passende Rechnung). */
  zahlung: Record<string, { wert: number; text: string } | null>;
  mrr: number; konzentration: { kunde: string; anteil: number } | null;
  events: Record<string, EventZahlen>;
  /** Nächster Termin je Person (aus dem Geschäftskalender). */
  termine: Record<string, { titel: string; start: string }>;
}

/**
 * Große Abfrage mit Stand (ETag, lib/http/json-antwort.ts): Der Browser sagt,
 * welchen Stand er hat; unverändert kommt 304 und hier null — dann bleibt alles,
 * wie es ist, und nichts wird neu gezeichnet. `staende` merkt sich je Adresse
 * den letzten Stand.
 */
export async function holeMitStand<T>(url: string, staende: Map<string, string>): Promise<T | null> {
  const alt = staende.get(url);
  const r = await fetch(url, { cache: 'no-store', headers: alt ? { 'If-None-Match': alt } : {} });
  if (r.status === 304) return null;
  const e = r.headers.get('etag');
  if (e && r.ok) staende.set(url, e); else staende.delete(url);
  return (await r.json()) as T;
}

/**
 * Kontakt-Teiländerung: `undefined` (Feld leeren) → `null`, das der Server als „Feld entfernen“ liest
 * (lib/make-one/crm.ts `teilAnwenden`). Ohne das verwirft JSON.stringify den Schlüssel, und das alte Feld bleibt.
 */
export const leerAlsNull = (t: Record<string, unknown>) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v === undefined ? null : v]));
/**
 * CRM-Bestand (`api.teil`): `undefined` → `''` — die Säuberer der Listen (lib/crm/speicher.ts) lassen leere Texte weg.
 * Ohne das verwirft JSON.stringify den Schlüssel, und das alte Feld bleibt.
 */
export const nurFelder = (t: Record<string, unknown>) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v === undefined ? '' : v]));

export const neueId = (p: string) => neueKennung(p);

/**
 * Hinweis bei 409 (28.09., K4; Klartext seit Ablaufprüfung K1): jemand anders hat denselben Eintrag inzwischen geändert.
 * Die Meldung bleibt stehen (Toast, `FehlerHinweis`), bis sie weggeklickt wird, ~8 s vergehen oder neu geschrieben wird —
 * das Neuladen danach löscht sie nicht mehr.
 */
export const KONFLIKT_HINWEIS = 'Nicht gespeichert — dieser Eintrag wurde inzwischen geändert. Die Anzeige zeigt jetzt den aktuellen Stand. Bitte erneut eingeben.';
/** Meldung, wenn der Server nicht antwortet — die einzige, die ein erfolgreiches Laden wieder wegnimmt. */
const NICHT_ERREICHBAR = 'Nicht erreichbar.';

/**
 * Stand je CRM-Eintrag (28.09., K4): `<liste>:<id>` → Fingerabdruck, wie ihn der Server zuletzt schickte.
 * Nur aus Server-Antworten gefüllt, nie aus der optimistischen Anzeige — sonst schickten wir einen Stand, den es nie gab.
 */
export function crmStaende(stand: CrmBestand): Map<string, string> {
  const m = new Map<string, string>();
  for (const l of CRM_LISTEN) for (const e of (stand[l] ?? []) as unknown as { id: string; stand?: string }[]) if (e.stand) m.set(`${l}:${e.id}`, e.stand);
  return m;
}
/** Einen Eintrag ohne das Feld `stand` — der Stand geht am Op mit, nie im Eintrag. */
const ohneStand = <T extends Record<string, unknown>>(e: T): T => { const { stand: _s, ...rest } = e; return rest as T; };

export function useCrm() {
  const [crm, setCrm] = useState<CrmAntwort | null>(null);
  const [kontakte, setKontakte] = useState<Kontakt[] | null>(null);
  const [fehler, setFehlerRoh] = useState<string | null>(null);
  // Ablaufprüfung K1 (28.09.): eine Meldung verschwindet nicht mehr beim nächsten Laden (der 409-Hinweis wurde vom
  // sofortigen `laden(true)` gelöscht, bevor ihn jemand sah) — nur beim nächsten Schreiben, Wegklicken oder nach ~8 s.
  const fehlerJetzt = useRef<string | null>(null);
  const setFehler = useCallback((t: string | null) => { fehlerJetzt.current = t; setFehlerRoh(t); }, []);
  // Ergebnis-Hinweis, der stehen bleibt, bis er weggeklickt wird (z. B. nach dem Löschen: was jetzt zu prüfen ist).
  const [hinweis, setHinweis] = useState<string | null>(null);
  const unterwegs = useRef(0);
  // Letzter Stand je Abfrage — der Abgleich holt nur, was sich geändert hat (25.09.).
  const staende = useRef(new Map<string, string>());
  /** Schreiben ging schief: beim nächsten Abgleich alles frisch holen, damit nichts Ungespeichertes stehen bleibt. */
  const fehlschlag = (text: string) => { staende.current.clear(); setFehler(text); };
  /** Ein neuer Schreibvorgang beginnt: die alte Meldung hat ihren Zweck erfüllt. */
  const neuerVersuch = () => { if (fehlerJetzt.current) setFehler(null); };
  // Stand je Eintrag (28.09., K4) und eine Kette für die Schreibvorgänge: nacheinander gesendet, liest jeder den Stand,
  // den die Antwort des vorigen brachte — zwei schnelle Änderungen am selben Eintrag stoßen so nicht aneinander (409).
  const zeilen = useRef(new Map<string, string>());
  // Dasselbe für Kontakte (Ablaufprüfung K2): Stand je Kontakt aus Server-Antworten — gelesen erst beim Absenden.
  const kontaktStaende = useRef(new KontaktStaende());
  // Eine Kette für CRM-Bestand UND Kontakte (lib/crm/kontakt-schreiben.ts `nacheinanderKette`, getestet).
  const kette = useRef(nacheinanderKette());
  const nacheinander = useCallback(<T,>(f: () => Promise<T>): Promise<T> => kette.current(f), []);
  const uebernehmen = useCallback((a: CrmAntwort) => { zeilen.current = crmStaende(a.stand); setCrm(a); }, []);

  /** `erzwingen` (nach einem 409): auch laden, wenn gerade noch andere Schreibvorgänge unterwegs sind. */
  const laden = useCallback(async (erzwingen?: boolean) => {
    if (unterwegs.current && erzwingen !== true) return;
    try {
      const [a, b] = await Promise.all([holeMitStand<CrmAntwort>('/api/crm/bestand', staende.current), holeMitStand<{ kontakte?: Kontakt[]; delta?: boolean; geloescht?: string[] }>('/api/state/kontakte', staende.current)]);
      if (a?.ok) uebernehmen(a);
      // Delta (Stufe 2): der Server kannte unseren Stand und schickt nur, was anders ist.
      if (b?.delta) { kontaktStaende.current.uebernehmen(b.kontakte ?? [], b.geloescht ?? []); setKontakte(alt => (alt ? deltaAnwenden(alt, { geaendert: b.kontakte ?? [], geloescht: b.geloescht ?? [] }) : alt)); }
      else if (b) { kontaktStaende.current.alle(b.kontakte ?? []); setKontakte(b.kontakte ?? []); }
      // Nur „nicht erreichbar“ erledigt sich durch ein gelungenes Laden — jede andere Meldung bleibt stehen (K1).
      if (fehlerJetzt.current === NICHT_ERREICHBAR) setFehler(null);
    } catch { staende.current.clear(); setFehler(NICHT_ERREICHBAR); }
  }, [uebernehmen, setFehler]);
  useEffect(() => { void laden(); }, [laden]);
  // Signale aus Mail und Kalender (höchstens alle 5 Minuten, der Server entscheidet) — danach neu laden, wenn etwas dazukam.
  useEffect(() => { fetch('/api/crm/signale', { method: 'POST' }).then(r => r.json()).then(d => { if (d?.neu) void laden(); }).catch(() => {}); }, [laden]);
  useAbgleich(laden, { alle: 20_000, pausiert: () => unterwegs.current > 0 });

  /**
   * Antwort eines Schreibvorgangs auf /api/crm/bestand auswerten (28.09., K4): ok → Stand übernehmen (und abgelehnte
   * Deal-Regeln als Fehler zeigen); 409 mit `konflikte` → Hinweis und neu laden; 409 mit `sperren` (Löschen trotz
   * Verweisen) oder 413 → nur der Text. Gibt zurück, ob neu geladen werden muss.
   */
  const schreibAntwort = useCallback((r: { ok?: boolean; fehler?: string | string[]; konflikte?: unknown[]; neuLaden?: boolean } & Partial<CrmAntwort>, sonst: string): boolean => {
    if (r.ok) { uebernehmen(r as CrmAntwort); if (Array.isArray(r.fehler) && r.fehler.length) setFehler(r.fehler.join(' · ')); return false; }
    // Alter Tab nach dem Hochladen (29.09., A2, lib/bau): nicht neu laden (die Eingabe bleibt sichtbar), Hinweis stehen lassen.
    if (r.neuLaden) { fehlschlag(`${sonst.replace(/\.$/, '')} — ${NEU_LADEN_TEXT}`); return false; }
    if (r.konflikte?.length) { fehlschlag(KONFLIKT_HINWEIS); return true; }
    fehlschlag(typeof r.fehler === 'string' ? r.fehler : sonst);
    return false;
  }, [uebernehmen]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Ein Op an /api/crm/bestand — in der Kette, mit dem zuletzt bekannten Stand des Eintrags. */
  const schreibe = useCallback((op: { liste: CrmListe; op: 'upsert' | 'teil' | 'delete'; id: string; eintrag?: Record<string, unknown>; felder?: Record<string, unknown> }, sonst: string) => {
    unterwegs.current++;
    neuerVersuch();
    let neuLaden = false;
    return nacheinander(async () => {
      try {
        const stand = zeilen.current.get(`${op.liste}:${op.id}`);
        const senden = op.op === 'upsert' ? { liste: op.liste, op: 'upsert', eintrag: ohneStand(op.eintrag ?? {}) } : op.op === 'teil' ? { liste: op.liste, op: 'teil', id: op.id, felder: op.felder } : { liste: op.liste, op: 'delete', id: op.id };
        const r = await fetch('/api/crm/bestand', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ops: [{ ...senden, ...(stand ? { stand } : {}) }] }) }).then(x => x.json());
        neuLaden = schreibAntwort(r, sonst);
      } catch { fehlschlag(`${sonst.replace(/\.$/, '')} — keine Verbindung.`); }
      finally { unterwegs.current--; }
      if (neuLaden) await laden(true);
    });
  }, [nacheinander, schreibAntwort, laden]); // eslint-disable-line react-hooks/exhaustive-deps

  /** CRM-Eintrag anlegen/ändern (ganzer Eintrag) — ein bestehender nur mit Stand (sonst 409, dann neu geladen). */
  const setze = useCallback(async (liste: CrmListe, eintrag: { id: string } & Record<string, unknown>) => {
    setCrm(alt => {
      if (!alt) return alt;
      const l = alt.stand[liste] as unknown as { id: string }[];
      const neu = l.some(x => x.id === eintrag.id) ? l.map(x => (x.id === eintrag.id ? eintrag : x)) : [...l, eintrag];
      return { ...alt, stand: { ...alt.stand, [liste]: neu } };
    });
    await schreibe({ liste, op: 'upsert', id: eintrag.id, eintrag }, 'Nicht gespeichert.');
  }, [schreibe]);

  /**
   * Nur diese Felder ändern (Server vereint mit dem aktuellen Stand) — so
   * überschreiben Kevin und Malin am selben Eintrag nie die Felder der/des anderen.
   * Mit Stand (28.09., K4): hat inzwischen jemand anders denselben Eintrag geändert, kommt 409 → Hinweis, neu geladen.
   */
  const teil = useCallback(async (liste: CrmListe, id: string, felder: Record<string, unknown>) => {
    setCrm(alt => (alt ? { ...alt, stand: { ...alt.stand, [liste]: (alt.stand[liste] as unknown as { id: string }[]).map(x => (x.id === id ? { ...x, ...felder } : x)) } } : alt));
    // Der Server wendet die Regeln an (27.09.): ein abgelehnter Stufenwechsel kommt als Fehlertext, der Stand ist der aktuelle.
    await schreibe({ liste, op: 'teil', id, felder }, 'Nicht gespeichert.');
  }, [schreibe]);

  /** An Kevin oder Malin übergeben (/api/crm/uebergabe) — danach neu laden. */
  const uebergeben = useCallback(async (body: { art: string; id?: string; ids?: string[]; an: string; notiz?: string; frist?: string }) => {
    unterwegs.current++;
    neuerVersuch();
    try {
      const r = await fetch('/api/crm/uebergabe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'keine Verbindung' }));
      if (!r.ok) setFehler(r.fehler ?? 'Nicht übergeben.');
      return r as { ok: boolean; text?: string; fehler?: string };
    } finally { unterwegs.current--; void laden(); }
  }, [laden]);

  /** Löschen — der Server lehnt Firmen/Mandate mit Verweisen ab (409, Text mit Anzahlen) und Deals mit Geschichte. */
  const weg = useCallback(async (liste: CrmListe, id: string) => {
    await schreibe({ liste, op: 'delete', id }, 'Nicht gelöscht.');
  }, [schreibe]);

  /**
   * Antwort einer Kontakt-Änderung auswerten: neue Stände in die Anzeige; 409 = jemand war schneller → den aktuellen
   * Eintrag aus `konflikte[].aktuell` zeigen, Klartext-Hinweis, danach frisch laden. Gibt zurück, ob neu geladen werden muss.
   */
  const kontaktAntwort = useCallback((r: KontaktAntwort): boolean => {
    if (r.ok) {
      const z = new Map((r.zeilen ?? []).map(x => [x.id, x.stand])); if (z.size) setKontakte(alt => (alt ? alt.map(k => (z.has(k.id) ? { ...k, stand: z.get(k.id) } : k)) : alt));
      // Neuanlage auf der Sperrliste (28.09.): angelegt mit Werbesperre — der Hinweis bleibt stehen, bis er weggeklickt wird.
      if (r.hinweis) setHinweis(r.hinweis);
      return false;
    }
    if (r.neuLaden) { fehlschlag(`Nicht gespeichert — ${NEU_LADEN_TEXT}`); return false; }
    const aktuell = new Map((r.konflikte ?? []).flatMap(k => (k.aktuell?.id ? [[k.aktuell.id, k.aktuell as unknown as Kontakt] as const] : [])));
    if (aktuell.size) setKontakte(alt => (alt ? alt.map(k => aktuell.get(k.id) ?? k) : alt));
    fehlschlag(r.konflikte?.length ? KONTAKT_KONFLIKT : r.error ?? 'Nicht gespeichert.');
    return !!r.konflikte?.length;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Ein Kontakt-Op (Ablaufprüfung K2): in der Kette nacheinander, Stand erst beim Absenden aus dem zuletzt bekannten
   * Serverstand (`kontaktStaende`, auch aus der Antwort des vorigen Schreibens). Bei 409 danach `laden(true)` — ein
   * einfaches `laden()` kehrte zurück, solange noch etwas unterwegs war, und die Anzeige blieb veraltet.
   */
  const kontaktSchreibe = useCallback((o: KontaktOp): Promise<boolean> => {
    unterwegs.current++;
    neuerVersuch();
    let neuLaden = false, ok = false;
    return nacheinander(async () => {
      try {
        const r = await kontaktSchreiben(op => fetch('/api/state/kontakte', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ops: [op] }) }).then(x => x.json() as Promise<KontaktAntwort>), o, kontaktStaende.current);
        neuLaden = kontaktAntwort(r);
        ok = !!r.ok;
      } catch { fehlschlag('Nicht gespeichert — keine Verbindung.'); }
      finally { unterwegs.current--; }
      if (neuLaden) await laden(true);
      return ok;
    });
  }, [nacheinander, kontaktAntwort, laden]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Kartei: einen Kontakt ändern (ganzer Eintrag) — mit dem zuletzt bekannten Serverstand (409, wenn inzwischen jemand anders schrieb).
   * Für bestehende Kontakte lieber `kontaktTeil`. Liefert, ob der Server es gespeichert hat.
   */
  const kontaktSetzen = useCallback(async (k: Kontakt): Promise<boolean> => {
    setKontakte(alt => (alt ? (alt.some(x => x.id === k.id) ? alt.map(x => (x.id === k.id ? k : x)) : [...alt, k]) : alt));
    return kontaktSchreibe({ op: 'upsert', eintrag: { ...k, geaendertAm: localDay() } });
  }, [kontaktSchreibe]);

  /**
   * Kartei: nur diese Felder ändern (Stufe 2) — der Server legt sie auf den aktuellen Stand; so überschreiben Kevin und Malin einander nicht.
   * Ein Feld mit `undefined` heißt „leeren“ und geht als `null` hinaus (`leerAlsNull`) — JSON würde den Schlüssel sonst verwerfen.
   */
  // `firmaWechsel` (28.09.): die Absicht einer Firmenänderung — geht an den Server, nie in den lokalen Stand.
  // Liefert, ob der Server es gespeichert hat.
  const kontaktTeil = useCallback(async (id: string, felder: KontaktFelder): Promise<boolean> => {
    const { firmaWechsel: _absicht, ...lokal } = felder;
    setKontakte(alt => (alt ? alt.map(x => (x.id === id ? { ...x, ...lokal } : x)) : alt));
    return kontaktSchreibe({ op: 'teil', id, felder: { ...leerAlsNull(felder), geaendertAm: localDay() } });
  }, [kontaktSchreibe]);

  /**
   * Aktivität am Kontakt (Ergebnis, Notiz, nächster Schritt) — Regeln laufen auf dem Server. In derselben Kette wie die
   * Kontakt-Änderungen: eine Aktivität ändert den Stand, eine danach wartende Änderung trägt schon den neuen.
   */
  const aktivitaet = useCallback(async (body: Record<string, unknown>) => {
    unterwegs.current++;
    neuerVersuch();
    return nacheinander(async () => {
      try {
        // Notiz ändern/löschen braucht den Stand — den zuletzt vom Server gemeldeten, nicht den der Anzeige.
        const id = typeof body.id === 'string' ? body.id : '';
        const stand = (body.aktion === 'aendern' || body.aktion === 'loeschen') && id ? kontaktStaende.current.get(id) : undefined;
        const r = await fetch('/api/crm/aktivitaet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(stand ? { ...body, stand } : body) }).then(x => x.json());
        // Die Antwort trägt den Kontakt mit Stand (28.09.) — auch bei 409 (Notiz ändern/löschen): dann der aktuelle.
        if (r.kontakt) { kontaktStaende.current.setzen(r.kontakt.id, r.kontakt.stand); setKontakte(alt => (alt ? alt.map(x => (x.id === r.kontakt.id ? r.kontakt : x)) : alt)); }
        // 409 beim Notiz-Ändern zeigt der Aufrufer neben der Eingabe (aktivitaeten-teile.tsx) — hier nur ohne Kontakt eine Meldung.
        if (!r.kontakt) fehlschlag(r.error ?? r.fehler ?? 'Nicht gespeichert.');
        return r as { ok?: boolean; kontakt?: Kontakt; hinweis?: string; error?: string; fehler?: string; konflikt?: boolean; text?: string };
      } catch { fehlschlag('Nicht gespeichert — keine Verbindung.'); return { ok: false, fehler: 'keine Verbindung' } as { ok?: boolean; kontakt?: Kontakt; hinweis?: string; error?: string; fehler?: string; konflikt?: boolean; text?: string }; }
      finally { unterwegs.current--; }
    });
  }, [nacheinander]); // eslint-disable-line react-hooks/exhaustive-deps

  /** LinkedIn-Netzwerk (/api/crm/netzwerk): ein Schritt an einer Person — die Antwort ersetzt die Person im Stand. */
  const netzwerk = useCallback(async (body: Record<string, unknown>) => {
    unterwegs.current++;
    neuerVersuch();
    return nacheinander(async () => {
      try {
        const r = await fetch('/api/crm/netzwerk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'keine Verbindung' }));
        if (r.kontakt) { kontaktStaende.current.setzen(r.kontakt.id, r.kontakt.stand); setKontakte(alt => (alt ? alt.map(x => (x.id === r.kontakt.id ? r.kontakt : x)) : alt)); }
        else if (!r.ok) fehlschlag(r.fehler ?? 'Nicht gespeichert.');
        return r as { ok: boolean; fehler?: string; kontakt?: Kontakt; vorschau?: Record<string, unknown>; text?: string };
      } finally { unterwegs.current--; }
    });
  }, [nacheinander]); // eslint-disable-line react-hooks/exhaustive-deps

  return { crm, kontakte, fehler, setFehler, hinweis, setHinweis, laden, setze, teil, uebergeben, weg, kontaktSetzen, kontaktTeil, aktivitaet, netzwerk, ich: crm?.ich ?? null };
}
export type CrmApi = ReturnType<typeof useCrm>;

export const euro = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
export const kurzEuro = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} T€` : `${Math.round(n)} €`);
const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export function datum(iso?: string | null, heute?: string): string {
  if (!iso) return '—';
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  const kurz = `${WT[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}.${heute && iso.slice(0, 4) !== heute.slice(0, 4) ? iso.slice(2, 4) : ''}`;
  if (!heute) return kurz;
  const n = Math.round((Date.parse(`${iso.slice(0, 10)}T12:00:00Z`) - Date.parse(`${heute}T12:00:00Z`)) / 864e5);
  return n === 0 ? 'heute' : n === 1 ? 'morgen' : n === -1 ? 'gestern' : kurz;
}
export const plusTage = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
