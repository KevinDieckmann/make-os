// ─── Prozesse — Probelauf (Etappe C1, 21.10.; ANALYSE_100.md Punkt 48 — Vertrag mit der Werkstatt B2) ─────────────────────────────────────────────────
// POST { prozessId, quelle: 'entwurf' | 'version', fall?: { art, id } | 'beispiel' }
//   → { ok, schritte: [{ knotenId, status: 'wuerde' | 'uebersprungen' | 'wartet' | 'freigabe' | 'fehler', text, kostenCent? }], kostenSchaetzungCent, befunde }
// Derselbe Motor-Code wie der echte Lauf, nur im Schatten (lib/prozesse/lauf-server.ts `probelauf` → lib/prozesse/lauf-regeln.ts `voran`): spielt den
// Entwurf bzw. die jüngste Version mit einem echten Fall (Kennung) oder dem erfundenen Beispiel durch. Schreibt NICHTS — keinen Lauf, keine Aufgabe, keinen
// Vorschlag, keine Glocke, kein Modellaufruf (Agenten-Schritte nur „würde … fragen, ca. x ct“). Die Sätze nennen nur Titel der Schritte, nie Daten des Falls.
// Tor: `werkstattZugang` (Haushalt des Inhabers, Sicht Privat 403); nur eine angemeldete Person (Dienstweg 403).
// Werkstatt bau-fertig (22.10., Punkte 9–10): `annahmen` { <Knoten>: ja|nein|weiter|abgelaufen|eingetreten } („Weg annehmen“, ohne Angabe die gespeicherten
// Testdaten), `nur` (nur diesen Schritt testen), `bis` (bis hier testen), `ausgabe: true` (je Schritt die Ausgabe als Tabelle und JSON nur mit Kennungen). Auch damit
// wird NIE gesendet, angelegt oder ein Modell gefragt — „würde senden: … an …“. Mit einem echten Fall und Ausgabe: Lese-Protokoll (Bereich Kontakte, nur die Kennung).
// „Modell wirklich fragen“ (22.10.): `modell: 'schaetzen'` (ca. x ct und ob es geht — ruft nichts) bzw. `modell: 'fragen'` mit `nur` = ein Agenten-Schritt — NUR auf eigenen
// Klick, zuerst `modellSchranke`, dann derselbe Agenten-Weg wie der Lauf (askText/KI-Tor, Budget je Prozess); das Ergebnis geht nur an die Ansicht zurück, gebucht werden
// nur die Kosten (lib/prozesse/lauf-server.ts `modellTesten`).

import { NextResponse } from 'next/server';
import { werkstattZugang } from '@/lib/prozesse/werkstatt-zugang';
import { PROZESS_KENNUNG, FALL_ART_IDS } from '@/lib/prozesse/definition';
import { FALL_KENNUNG } from '@/lib/prozesse/lauf-typen';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { ANNAHME_AUSGAENGE, TESTDATEN_GRENZEN } from '@/lib/prozesse/testdaten';
import type { LaufAusgang } from '@/lib/prozesse/lauf-typen';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { modellSchranke } from '@/lib/zugang/umfang';

const KNOTEN = /^[A-Za-z0-9][A-Za-z0-9_:.~-]{0,119}$/;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const nein = (status: number, fehler: string) => NextResponse.json({ ok: false, fehler }, { status });

export async function POST(req: Request) {
  const z = await werkstattZugang(req);
  if (z instanceof Response) return z;
  if (z.dienst) return nein(403, 'Den Probelauf startet nur eine angemeldete Person.');
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 16 * 1024); } catch (e) { return jsonZuGross(e) ?? nein(400, 'Kein JSON.'); }
  const prozessId = typeof b.prozessId === 'string' && PROZESS_KENNUNG.test(b.prozessId) ? b.prozessId : null;
  if (!prozessId) return nein(400, 'Welcher Prozess? (prozessId pz-…)');
  const quelle = b.quelle === 'version' ? 'version' : b.quelle === 'entwurf' || b.quelle === undefined ? 'entwurf' : null;
  if (!quelle) return nein(400, 'quelle: entwurf oder version.');
  let fall: { art: string; id: string } | 'beispiel' | undefined;
  if (b.fall === 'beispiel' || b.fall === undefined || b.fall === null) fall = 'beispiel';
  else if (b.fall && typeof b.fall === 'object') {
    const f = b.fall as { art?: unknown; id?: unknown };
    if (typeof f.art !== 'string' || !(FALL_ART_IDS as readonly string[]).includes(f.art) || typeof f.id !== 'string' || !FALL_KENNUNG.test(f.id)) return nein(400, 'fall: { art, id } oder „beispiel“.');
    fall = { art: f.art, id: f.id };
  } else return nein(400, 'fall: { art, id } oder „beispiel“.');
  let annahmen: Record<string, LaufAusgang> | undefined;
  if (b.annahmen !== undefined && b.annahmen !== null) {
    if (typeof b.annahmen !== 'object' || Array.isArray(b.annahmen)) return nein(400, 'annahmen: { Knoten: Ausgang }.');
    const e = Object.entries(b.annahmen as Record<string, unknown>);
    if (e.length > TESTDATEN_GRENZEN.annahmen) return nein(413, `Höchstens ${TESTDATEN_GRENZEN.annahmen} angenommene Wege.`);
    annahmen = {};
    for (const [k, v] of e) { if (!KNOTEN.test(k) || !(ANNAHME_AUSGAENGE as readonly unknown[]).includes(v)) return nein(400, 'annahmen: Kennung eines Knotens → ja, nein, weiter, abgelaufen oder eingetreten.'); annahmen[k] = v as LaufAusgang; }
  }
  const knoten = (v: unknown): string | undefined | null => (v === undefined || v === null ? undefined : typeof v === 'string' && KNOTEN.test(v) ? v : null);
  const nur = knoten(b.nur), bis = knoten(b.bis);
  if (nur === null || bis === null) return nein(400, 'nur bzw. bis: die Kennung eines Schritts.');
  if (nur && bis) return nein(400, 'Entweder „nur diesen Schritt“ oder „bis hier“.');
  if (b.modell !== undefined) {
    if (b.modell !== 'schaetzen' && b.modell !== 'fragen') return nein(400, 'modell: schaetzen oder fragen.');
    if (!nur) return nein(400, 'Das Modell fragt nur „diesen Schritt“ (nur: Kennung eines Agenten-Schritts).');
    if (b.modell === 'fragen') { const sch = modellSchranke(req); if (sch) return sch; }
    const { modellTesten } = await import('@/lib/prozesse/lauf-server');
    const m = await modellTesten({ prozessId, quelle, fall, person: z.person, knoten: nur, fragen: b.modell === 'fragen' });
    if (!m.ok) return NextResponse.json({ ok: false, fehler: m.fehler, ...(m.kostenCent ? { kostenCent: m.kostenCent } : {}) }, { status: m.status });
    if (m.art === 'ergebnis' && fall !== 'beispiel') leseZugriff(req, 'kontakte', { anzahl: 1 });
    return NextResponse.json(m);
  }
  const { probelauf } = await import('@/lib/prozesse/lauf-server');
  const r = await probelauf({ prozessId, quelle, fall, person: z.person, ...(annahmen ? { annahmen } : {}), ...(nur ? { nur } : {}), ...(bis ? { bis } : {}), ...(b.ausgabe === true ? { ausgabe: true } : {}) });
  if (!r.ok) return nein(r.status, r.fehler);
  // Ein echter Fall mit Ausgabe zeigt Inhalte (Empfänger, gefüllte Texte) — live mit den Rechten der Person; protokolliert wird nur, dass gelesen wurde.
  if (b.ausgabe === true && r.echterFall && fall !== 'beispiel') leseZugriff(req, 'kontakte', { anzahl: 1 });
  return NextResponse.json({ ok: true, schritte: r.schritte, kostenSchaetzungCent: r.kostenSchaetzungCent, befunde: r.befunde, ...(r.hinweis ? { hinweis: r.hinweis } : {}) });
}
