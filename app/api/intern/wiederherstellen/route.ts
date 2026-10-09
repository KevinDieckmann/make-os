// ─── Einzel-Restore aus einer Tageskopie (29.09., Paket D-A #63) — nur Inhaber ──
// GET  ?bestand=<name>                               → { tage: ['2026-09-28', …] } (neueste zuerst)
// GET  ?bestand=<name>&tag=<JJJJ-MM-TT>              → Vorschau je Liste (nur Kennungen, Stände, Feldnamen)
// GET  ?bestand&tag&liste=<feld>&ids=a,b             → die Einträge der Kopie zu diesen Kennungen (zum Ansehen)
// POST { bestand, tag, liste, auswahl: { id: stand|null } } → übernimmt einzeln, 409 bei inzwischen geändert
// Logik: lib/store/wiederherstellen.ts. Skript: scripts/einzel-wiederherstellen.mjs (Dienstweg = Systemlauf).
// Seit 09.10. (R9 — mehrere gleichwertige Inhaber): „Inhaber“ heißt Verwaltung, nicht Einsicht — persönliche Bestände einer ANDEREN
// Person (PERSON_BESTAENDE, z. B. Gesundheit, Zeit, eigene Ziele) liest und übernimmt kein Inhaber über diesen Weg (403); das bleibt
// dem Skript am Server (Systemlauf) mit dem Einverständnis der Person.
// Nahtstellen-Prüfung 09.10.: auch GEMEINSAME Bestände tragen Persönliches und Geheimnisse — „nur ich“-Aufgaben und -Familienthemen,
// ungeteilte Reflexionen, private Kontakt-Notizen, ZOE-Gespräche je Person, Routinen der anderen, und `konten` (Passwort-Hash, Geheimnis
// des zweiten Faktors). Die Tageskopie kennt keine Sicht. Darum per SITZUNG: Tage und Vorschau (nur Kennungen, Stände, Feldnamen) für
// jeden nicht fremden Bestand; Inhalte (`liste`) und Übernahme NUR für die eigenen persönlichen Bestände (ohne Zugangsschlüssel). Alles
// andere holt das Skript am Server (Systemlauf, scripts/einzel-wiederherstellen.mjs) — eine Oberfläche dafür gibt es nicht.

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { nurInhaber } from '@/lib/zugang/haushalt-inhaber';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { tageskopien, vorschau, kopieZeilen, uebernehmen, RestoreFehler } from '@/lib/store/wiederherstellen';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { ladeKonten } from '@/lib/zugang/konten';
import { personBestandNamen } from '@/lib/datenschutz/konto-daten';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fehler = (e: unknown) => e instanceof RestoreFehler
  ? NextResponse.json({ ok: false, fehler: e.message }, { status: e.status })
  : NextResponse.json({ ok: false, fehler: e instanceof Error ? e.message.slice(0, 200) : 'Fehler' }, { status: 500 });

/** Gehört der Bestand persönlich einer ANDEREN Person als der anfragenden? Systemlauf (ohne Person) = nein. */
async function fremderPersonenBestand(req: Request, bestand: string): Promise<boolean> {
  const ich = personStreng(req);
  if (!ich) return false;
  return (await ladeKonten()).konten.some(k => k.speicher !== ich && personBestandNamen(k.speicher, [bestand]).length > 0);
}
const FREMD = () => NextResponse.json({ ok: false, fehler: 'Persönlicher Bestand einer anderen Person — den holt nur das Skript am Server zurück, mit ihrem Einverständnis.' }, { status: 403 });

/**
 * Inhalte einer Tageskopie und Übernahme per Sitzung nur für EIGENE persönliche Bestände ohne Zugangsschlüssel (`export !== false`).
 * Systemlauf (Skript am Server, ohne Person) = immer.
 */
async function inhaltErlaubt(req: Request, bestand: string): Promise<boolean> {
  const ich = personStreng(req);
  if (!ich) return true;
  const eigen = personBestandNamen(ich, [bestand]);
  return eigen.length > 0 && eigen.every(b => b.export);
}
const NUR_SKRIPT = () => NextResponse.json({ ok: false, fehler: 'Inhalte und Übernahme gemeinsamer Bestände nur über das Skript am Server (scripts/einzel-wiederherstellen.mjs) — eine Tageskopie trägt auch Persönliches der anderen Person und Zugangsgeheimnisse.' }, { status: 403 });

export async function GET(req: Request) {
  if (!(await nurInhaber(req))) return NextResponse.json({ ok: false, fehler: 'Nur der Inhaber.' }, { status: 403 });
  const u = new URL(req.url);
  const bestand = u.searchParams.get('bestand') ?? '';
  if (await fremderPersonenBestand(req, bestand)) return FREMD();
  const tag = u.searchParams.get('tag');
  const liste = u.searchParams.get('liste');
  try {
    if (!tag) return NextResponse.json({ ok: true, bestand, tage: await tageskopien(bestand) });
    if (liste !== null) {
      if (!(await inhaltErlaubt(req, bestand))) return NUR_SKRIPT();
      return NextResponse.json({ ok: true, zeilen: await kopieZeilen(bestand, tag, liste, (u.searchParams.get('ids') ?? '').split(',').filter(Boolean)) });
    }
    return NextResponse.json({ ok: true, ...(await vorschau(bestand, tag)) });
  } catch (e) { return fehler(e); }
}

export async function POST(req: Request) {
  if (!(await nurInhaber(req))) return NextResponse.json({ ok: false, fehler: 'Nur der Inhaber.' }, { status: 403 });
  let b: { bestand?: unknown; tag?: unknown; liste?: unknown; auswahl?: unknown };
  try { b = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (await fremderPersonenBestand(req, String(b.bestand ?? ''))) return FREMD();
  if (!(await inhaltErlaubt(req, String(b.bestand ?? '')))) return NUR_SKRIPT();
  const auswahl = b.auswahl && typeof b.auswahl === 'object' && !Array.isArray(b.auswahl) ? b.auswahl as Record<string, unknown> : null;
  if (!auswahl || Object.values(auswahl).some(v => v !== null && typeof v !== 'string')) return NextResponse.json({ ok: false, fehler: 'auswahl = { id: stand | null }' }, { status: 400 });
  try {
    const r = await uebernehmen(String(b.bestand ?? ''), String(b.tag ?? ''), String(b.liste ?? ''), auswahl as Record<string, string | null>, werAus(req));
    if (!r.ok) return NextResponse.json(r, { status: r.status });
    // Nach JEDEM Zurückholen die Grabsteine anwenden (29.09., Paket D-B #70): eine Tageskopie von vor einer Löschung
    // (Art. 17) darf die Person nicht zurückbringen. Scheitert das, sagt die Antwort es laut.
    try {
      const { grabsteineAnwenden } = await import('@/lib/datenschutz/grabsteine');
      const g = await grabsteineAnwenden({ erzwingen: true });
      return NextResponse.json({ ...r, grabsteine: { entfernt: g.entfernt } });
    } catch (e) {
      return NextResponse.json({ ...r, warnung: `Grabsteine NICHT angewendet (${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}) — gelöschte Personen könnten zurück sein.` });
    }
  } catch (e) { return fehler(e); }
}
