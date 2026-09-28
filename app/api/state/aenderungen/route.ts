// ─── MAKE OS — Änderungsprotokoll (nur lesend) ──────────────────────────────
// Kevin und Malin arbeiten in einer Instanz. Wenn etwas anders aussieht als
// gestern, muss man sehen können, wer es geändert hat — sonst wird geraten.
//
// Seit 28.09. (K1 #44) schreibt NUR der Server: die Schreibwege selbst hängen an
// (lib/store/aenderungsprotokoll.ts — `listePatchen`, `aendereCrm`), in Monatsdateien
// `aenderungsprotokoll--<haushalt>--<JJJJ-MM>`, nie gekürzt. Vorher meldete der Browser
// (Protokollant) jede Änderung per POST — ohne Haushaltsprüfung, mit einer Person, die er
// selbst behauptete, gekürzt auf 400. Dieser POST ist abgeschaltet (405).
//
// Bewusst schmal: wann, wer (Person · ZOE im Auftrag · Import · System), welcher Bestand,
// welche Kennung, welche Felder. KEINE Inhalte, keine Werte.
//
// GET ?bestand=kontakte&monat=JJJJ-MM → { eintraege (neueste zuerst, höchstens 120), anzahl, monate }
// Ohne `monat`: dieser und der vorige Monat. Die alten Browser-Einträge (Speicher „aenderungen“)
// werden nur noch gelesen und hinten angestellt.

import { NextResponse } from 'next/server';
import { loadJson } from '@/lib/store/local-db';
import { karteiZugang, KARTEI_GESPERRT, haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { monatBerlin, vormonat, protokollMonat, protokollKennung, type ProtokollEintrag } from '@/lib/store/aenderungsprotokoll';
import { nameVon } from '@/lib/zoe/raum';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Was die Oberfläche zeigt (ZusammenarbeitView) — die alten Felder plus Kennung/Felder. */
interface Zeile { at: string; person: string; bestand: string; seite?: string; art: string; wer?: string; liste?: string; id?: string; op?: string; felder?: string[] }
interface AlteDatei { eintraege?: { at: string; person: string; bestand: string; seite?: string; art: string }[] }

const ANZEIGE = 120;

function wen(e: ProtokollEintrag): string {
  if (e.wer === 'person' && e.person) return nameVon(e.person);
  if (e.wer === 'zoe') return e.person ? `ZOE für ${nameVon(e.person)}` : 'ZOE';
  return e.wer === 'import' ? 'Import' : 'System';
}
const ART: Record<ProtokollEintrag['op'], string> = { neu: 'POST', geaendert: 'PATCH', geloescht: 'DELETE' };

export async function GET(req: Request) {
  if (!(await karteiZugang(req))) return NextResponse.json(KARTEI_GESPERRT, { status: 403 });
  const p = new URL(req.url).searchParams;
  const nur = p.get('bestand');
  const gewuenscht = p.get('monat');
  if (gewuenscht && !/^\d{4}-\d{2}$/.test(gewuenscht)) return NextResponse.json({ ok: false, fehler: 'monat: JJJJ-MM.' }, { status: 400 });
  const jetzt = monatBerlin();
  const monate = gewuenscht ? [gewuenscht] : [jetzt, vormonat(jetzt)];
  const haushalt = (await haushaltDesInhabers()) ?? 'ohne-haushalt';

  // Kontakt-Fingerabdrücke (c#…) zurück auf die Kennung — nur für Kontakte, die es noch gibt.
  const kontaktIds = ((await loadJson<{ kontakte?: { id: string }[] }>('kontakte'))?.kontakte ?? []).map(k => k.id);
  const aufloesen = new Map(kontaktIds.map(id => [protokollKennung(id), id]));
  const neu: Zeile[] = [];
  for (const m of [...monate].sort()) {
    for (const e of await protokollMonat(haushalt, m)) {
      neu.push({ at: e.at, person: wen(e), bestand: e.bestand, art: ART[e.op] ?? 'PATCH', wer: e.wer, ...(e.liste ? { liste: e.liste } : {}), id: aufloesen.get(e.id) ?? e.id, op: e.op, ...(e.felder ? { felder: e.felder } : {}) });
    }
  }
  // Alte Einträge aus der Browser-Zeit — nur lesend, nur ohne ausdrücklichen Monat.
  const alt: Zeile[] = gewuenscht ? [] : ((await loadJson<AlteDatei>('aenderungen'))?.eintraege ?? []).map(e => ({ at: e.at, person: e.person, bestand: e.bestand, ...(e.seite ? { seite: e.seite } : {}), art: e.art }));

  let eintraege = [...alt, ...neu].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  if (nur) eintraege = eintraege.filter(e => e.bestand === nur);
  return NextResponse.json({ eintraege: eintraege.slice(0, ANZEIGE), anzahl: eintraege.length, monate });
}

/** Abgeschaltet (28.09., K1 #44): protokolliert wird nur noch serverseitig in den Schreibwegen. */
export async function POST() {
  return NextResponse.json({ ok: false, fehler: 'Das Änderungsprotokoll schreibt der Server selbst — Einträge aus dem Browser werden nicht mehr angenommen.' }, { status: 405, headers: { Allow: 'GET' } });
}
