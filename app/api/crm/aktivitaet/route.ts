// ─── MAKE OS — Eine Aktivität am Kontakt ────────────────────────────────────
// „Ich habe X angeschrieben" — ein Aufruf, und der Kontakt weiß es: Aktivität
// protokolliert, letzter Kontakt gesetzt, Stufe vorwärts (nie zurück),
// Wiedervorlage angelegt. Wer es war, kommt aus dem Raum (Kevin oder Malin),
// nicht aus dem Body — sonst könnte ein Fenster im falschen Namen schreiben.

import { NextResponse } from 'next/server';
import { updateJson } from '@/lib/store/local-db';
import { personAus } from '@/lib/jarvis/raum';
import { wendeAktivitaetAn, STUFEN, AKTIVITAET_ARTEN, ERGEBNISSE, NOTIZ_FELDER, type Kontakt, type AktivitaetArt, type Stufe, type Ergebnis, type NotizVorlage } from '@/lib/make-one/crm';
import { folgeAus } from '@/lib/crm/heute';
import { localDay, tagePlus } from '@/lib/zeit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ARTEN: readonly AktivitaetArt[] = AKTIVITAET_ARTEN.filter(a => a !== 'system');

// Seit 24.09. auch mit Ergebnis (Power Hour), Notizvorlage und nächstem Schritt:
// das Ergebnis setzt per Regel Wiedervorlage und Stufe (lib/crm/heute.ts),
// „Sperre“ setzt die Werbesperre — sofort und dauerhaft (Art. 21 DSGVO).

export async function POST(req: Request) {
  let b: { id?: string; art?: string; text?: string; stufe?: string; wiedervorlage?: string; von?: 'jarvis'; ergebnis?: string; notiz?: Record<string, unknown>; naechster?: { text?: string; datum?: string }; bezug?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
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
  const von = b.von === 'jarvis' ? 'jarvis' : personAus(req);
  const heute = localDay();

  let ergebnis: Kontakt | null = null;
  await updateJson<{ kontakte: Kontakt[] }>('kontakte', current => {
    const f = current ?? { kontakte: [] };
    const i = f.kontakte.findIndex(x => x.id === id);
    if (i < 0) return f;
    const alt = f.kontakte[i];
    const folge = erg ? folgeAus(erg, heute, alt.stufe) : null;
    let neu = wendeAktivitaetAn(alt, {
      art, text: text || undefined, von, ergebnis: erg, notiz: notiz && Object.keys(notiz).length ? notiz : undefined, bezug,
      stufe: wunschStufe ?? folge?.stufe, wiedervorlage: wunschWv ?? naechster?.datum ?? folge?.wiedervorlage,
    }, heute, new Date().toISOString(), tagePlus);
    if (naechster) neu = { ...neu, naechsterSchritt: naechster };
    else if (erg && alt.naechsterSchritt && alt.naechsterSchritt.datum <= heute && (erg === 'gespraech' || erg === 'termin')) neu = { ...neu, naechsterSchritt: undefined };
    if (folge?.werbesperre) neu = { ...neu, werbesperre: { seit: heute, grund: text || 'Widerspruch im Gespräch' }, wiedervorlage: undefined, naechsterSchritt: undefined };
    ergebnis = neu;
    f.kontakte[i] = neu;
    return f;
  });
  if (!ergebnis) return NextResponse.json({ error: `Kein Kontakt mit id ${id}.` }, { status: 404 });
  // Karte aus einer Kampagne: das Ergebnis zählt auch dort (Power Hour ↔ Kampagne).
  if (bezug?.startsWith('kp-') && erg) {
    const kErg = erg === 'gespraech' || erg === 'termin' ? 'gespraech' : erg === 'kein_bedarf' || erg === 'sperre' ? 'kein_interesse' : 'angesprochen';
    const { aendereCrm } = await import('@/lib/crm/speicher');
    await aendereCrm(c => ({ ...c, kampagnen: c.kampagnen.map(k => (k.id === bezug && k.kontaktIds.includes(id) ? { ...k, ergebnisse: [...k.ergebnisse, { kontaktId: id, ergebnis: kErg, am: heute }], geaendert: new Date().toISOString() } : k)) }));
  }
  return NextResponse.json({ ok: true, kontakt: ergebnis, hinweis: erg ? folgeAus(erg, heute, 'neu').hinweis : undefined });
}
