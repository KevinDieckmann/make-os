// ─── MAKE OS — Eine Aktivität am Kontakt ────────────────────────────────────
// „Ich habe X angeschrieben" — ein Aufruf, und der Kontakt weiß es: Aktivität
// protokolliert, letzter Kontakt gesetzt, Stufe vorwärts (nie zurück),
// Wiedervorlage angelegt. Wer es war, kommt aus dem Raum (Kevin oder Malin),
// nicht aus dem Body — sonst könnte ein Fenster im falschen Namen schreiben.

import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { NextResponse } from 'next/server';
import { updateJson } from '@/lib/store/local-db';
import { personAus } from '@/lib/zoe/raum';
import { fuerPerson, wendeAktivitaetAn, wannSaeubern, wannInZukunft, ortSaeubern, STUFEN, AKTIVITAET_ARTEN, ERGEBNISSE, NOTIZ_FELDER, type Kontakt, type AktivitaetArt, type Stufe, type Ergebnis, type NotizVorlage } from '@/lib/make-one/crm';
import { notizAnwenden, istAktAnker, type NotizAktion } from '@/lib/crm/aktivitaeten';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { folgeAus } from '@/lib/crm/heute';
import { localDay, tagePlus } from '@/lib/zeit';
import { sperren } from '@/lib/crm/sperrliste';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ARTEN: readonly AktivitaetArt[] = AKTIVITAET_ARTEN.filter(a => a !== 'system');

// Seit 24.09. auch mit Ergebnis (Power Hour), Notizvorlage und nächstem Schritt:
// das Ergebnis setzt per Regel Wiedervorlage und Stufe (lib/crm/heute.ts),
// „Sperre“ setzt die Werbesperre — sofort und dauerhaft (Art. 21 DSGVO).
//
// 28.09. (H4):
//  · Meetings tragen `wann` (Tag bzw. Tag + Uhrzeit) und `ort` als Felder — der Text ist nur die Notiz.
//  · Eigene Notizen ändern/löschen: { aktion: 'aendern' | 'loeschen', id, anker, stand, text? } —
//    nur Art „notiz“, nur `von` = angemeldete Person (sonst 403), veralteter Stand → 409 mit dem
//    aktuellen Kontakt. Die alte Fassung bekommt eine Löschmarke (lib/crm/aktivitaet-marke.ts), damit
//    ein Speichern ohne Stand (ZOE, Import, altes Fenster) sie nicht zurückholt.
//  · Jede Antwort trägt den Kontakt mit `stand` (Fingerabdruck) und maskierter IBAN.
//  · Geplantes Meeting (wann in der Zukunft, Prüfbericht F1): kein „letzter Kontakt“, keine Stufe und
//    Wiedervorlage nach Regel — es zählt ab seinem Tag (Kadenz: `letzterKontaktVon`).

type Antwort = Record<string, unknown>;
const mitStandFuer = (k: Kontakt, person: string) => ({ ...fuerPerson(k, person), stand: fingerabdruck(k as unknown as Record<string, unknown>) });

async function notizAktion(req: Request, b: { aktion: NotizAktion; id?: string; anker?: string; stand?: string; text?: string }): Promise<NextResponse> {
  // Nur eine benannte Person — der Dienstweg ohne Person darf keine „eigenen“ Notizen ändern.
  const ich = personStreng(req);
  if (!ich) return NextResponse.json({ ok: false, fehler: 'Ohne angemeldete Person keine Änderung an Notizen.' }, { status: 403 });
  const id = String(b.id ?? '').trim();
  const anker = String(b.anker ?? '').trim();
  const stand = typeof b.stand === 'string' ? b.stand : '';
  if (!/^c-[a-z0-9-]{4,60}$/.test(id) || !istAktAnker(anker)) return NextResponse.json({ ok: false, fehler: 'id und anker nötig.' }, { status: 400 });
  if (!stand) return NextResponse.json({ ok: false, fehler: 'stand fehlt — ohne Stand wird nichts geändert.' }, { status: 400 });
  const heute = localDay();
  let raus: { status: number; body: Antwort } = { status: 404, body: { ok: false, fehler: `Kein Kontakt mit id ${id}.` } };
  await updateJson<{ kontakte: Kontakt[] }>('kontakte', current => {
    const f = current ?? { kontakte: [] };
    const i = f.kontakte.findIndex(x => x.id === id);
    if (i < 0) return f;
    const alt = f.kontakte[i];
    if (fingerabdruck(alt as unknown as Record<string, unknown>) !== stand) {
      raus = { status: 409, body: { ok: false, konflikt: true, fehler: 'Jemand hat diesen Kontakt inzwischen geändert — Stand neu geladen, bitte noch einmal.', kontakt: mitStandFuer(alt, ich) } };
      return f;
    }
    const r = notizAnwenden(alt, { aktion: b.aktion, anker, text: b.text }, ich, heute, new Date().toISOString());
    if (!r.ok) { raus = { status: r.status, body: { ok: false, fehler: r.fehler } }; return f; }
    raus = { status: 200, body: { ok: true, kontakt: mitStandFuer(r.kontakt, ich), text: b.aktion === 'loeschen' ? 'Notiz gelöscht.' : r.unveraendert ? 'Unverändert.' : 'Notiz geändert.' } };
    if (r.unveraendert) return f;
    f.kontakte[i] = r.kontakt;
    return f;
  });
  return NextResponse.json(raus.body, { status: raus.status });
}

export async function POST(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  let b: { id?: string; art?: string; text?: string; stufe?: string; wiedervorlage?: string; von?: 'zoe'; ergebnis?: string; notiz?: Record<string, unknown>; naechster?: { text?: string; datum?: string }; bezug?: string; wann?: string; ort?: string; aktion?: string; anker?: string; stand?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (b.aktion === 'aendern' || b.aktion === 'loeschen') return notizAktion(req, { ...b, aktion: b.aktion });
  if (b.aktion !== undefined) return NextResponse.json({ ok: false, fehler: 'aktion ist aendern oder loeschen.' }, { status: 400 });
  const id = String(b.id ?? '').trim();
  const art = String(b.art ?? '') as AktivitaetArt;
  if (!id || !ARTEN.includes(art)) return NextResponse.json({ error: `id und art (${ARTEN.join('|')}) nötig.` }, { status: 400 });
  const text = String(b.text ?? '').trim().slice(0, 3000);
  const erg = ERGEBNISSE.includes(b.ergebnis as Ergebnis) ? (b.ergebnis as Ergebnis) : undefined;
  const notiz = b.notiz && typeof b.notiz === 'object'
    ? Object.fromEntries(NOTIZ_FELDER.map(f => [f.id, String(b.notiz![f.id] ?? '').trim().slice(0, 1500)]).filter(([, v]) => v)) as NotizVorlage : undefined;
  const naechster = b.naechster && String(b.naechster.text ?? '').trim() && /^\d{4}-\d{2}-\d{2}$/.test(String(b.naechster.datum ?? ''))
    ? { text: String(b.naechster.text).trim().slice(0, 300), datum: String(b.naechster.datum) } : undefined;
  const bezug = /^[a-z0-9][a-z0-9-]{1,63}$/.test(String(b.bezug ?? '')) ? String(b.bezug) : undefined;
  const wunschStufe = b.stufe && STUFEN.includes(b.stufe as Stufe) ? (b.stufe as Stufe) : undefined;
  const wunschWv = b.wiedervorlage && /^\d{4}-\d{2}-\d{2}$/.test(b.wiedervorlage) ? b.wiedervorlage : undefined;
  const von = b.von === 'zoe' ? 'zoe' : personAus(req);
  const heute = localDay();

  let ergebnis: Kontakt | null = null;
  await updateJson<{ kontakte: Kontakt[] }>('kontakte', current => {
    const f = current ?? { kontakte: [] };
    const i = f.kontakte.findIndex(x => x.id === id);
    if (i < 0) return f;
    const alt = f.kontakte[i];
    const folge = erg ? folgeAus(erg, heute, alt.stufe) : null;
    const jetzt = new Date().toISOString();
    // Geplantes Meeting (wann in der Zukunft, 28.09., F1): noch kein Kontakt — keine Folge-Regeln, nur Ausdrückliches.
    const wann = art === 'termin' ? wannSaeubern(b.wann) : undefined;
    const geplant = wannInZukunft(wann, jetzt);
    let neu = wendeAktivitaetAn(alt, {
      art, text: text || undefined, von, ergebnis: erg, notiz: notiz && Object.keys(notiz).length ? notiz : undefined, bezug,
      ...(art === 'termin' ? { wann, ort: ortSaeubern(b.ort) } : {}),
      stufe: wunschStufe ?? (geplant ? undefined : folge?.stufe), wiedervorlage: wunschWv ?? naechster?.datum ?? (geplant ? undefined : folge?.wiedervorlage),
    }, heute, jetzt, tagePlus);
    if (naechster) neu = { ...neu, naechsterSchritt: naechster };
    else if (!geplant && erg && alt.naechsterSchritt && alt.naechsterSchritt.datum <= heute && (erg === 'gespraech' || erg === 'termin')) neu = { ...neu, naechsterSchritt: undefined };
    if (folge?.werbesperre) neu = { ...neu, werbesperre: { seit: heute, grund: text || 'Widerspruch im Gespräch' }, wiedervorlage: undefined, naechsterSchritt: undefined };
    ergebnis = neu;
    f.kontakte[i] = neu;
    return f;
  });
  if (!ergebnis) return NextResponse.json({ error: `Kein Kontakt mit id ${id}.` }, { status: 404 });
  // Werbesperre (Ergebnis „Sperre“): auch auf die gehashte Sperrliste (K2 #60) — ein Import legt die Person nie neu an.
  const gespeichert = ergebnis as Kontakt | null;
  if (gespeichert?.werbesperre) await sperren([gespeichert], 'werbesperre', heute);
  // Karte aus einer Kampagne: das Ergebnis zählt auch dort (Power Hour ↔ Kampagne).
  if (bezug?.startsWith('kp-') && erg) {
    const kErg = erg === 'gespraech' || erg === 'termin' ? 'gespraech' : erg === 'kein_bedarf' || erg === 'sperre' ? 'kein_interesse' : 'angesprochen';
    const { aendereCrm } = await import('@/lib/crm/speicher');
    await aendereCrm(c => ({ ...c, kampagnen: c.kampagnen.map(k => (k.id === bezug && k.kontaktIds.includes(id) ? { ...k, ergebnisse: [...k.ergebnisse, { kontaktId: id, ergebnis: kErg, am: heute, ...(von !== 'zoe' ? { von } : {}) }], geaendert: new Date().toISOString(), geaendertVon: von } : k)) }));
  }
  // Private Notizen sieht nur, wer sie schrieb — auch in dieser Antwort; ohne ausdrückliche Person keine (Regel 5).
  return NextResponse.json({ ok: true, kontakt: ergebnis ? mitStandFuer(ergebnis, personStreng(req) ?? '') : ergebnis, hinweis: erg ? folgeAus(erg, heute, 'neu').hinweis : undefined });
}
