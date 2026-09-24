// ─── MAKE OS — Whoop-Export einlesen ────────────────────────────────────────
// Die Whoop-Mail meldet nur, dass ein Export bereitsteht; die Zahlen stecken
// im ZIP dahinter. Drei Wege hinein (24.09.):
//   POST { csv }              die Zyklen-Tabelle als Text (wie bisher)
//   POST FormData „datei"     das ZIP oder die CSV aus der Dateiauswahl
//   POST { ausDownloads }     der neueste my_whoop_data_*.zip im Downloads-
//                             Ordner dieses Rechners — ein Klick nach dem Download
// Die Regeln stehen in lib/whoop-export.ts. Bestehende Tage werden ergänzt,
// eigene Notizen bleiben stehen. Geschrieben wird in den Bestand der
// angemeldeten Person.

import { NextResponse } from 'next/server';
import { readdir, readFile, stat } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { updateJson } from '@/lib/store/local-db';
import { personAus, speicherFuer } from '@/lib/jarvis/raum';
import { zipEintrag, zyklenLesen, einmischen, istZyklenDatei, type WhoopLog } from '@/lib/whoop-export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DOWNLOADS = join(homedir(), 'Downloads');

/** ZIP oder CSV → Tabellentext. */
function tabelleAus(buf: Buffer, name: string): string | null {
  if (/\.zip$/i.test(name) || buf.readUInt32LE(0) === 0x04034b50) return zipEintrag(buf, istZyklenDatei);
  return buf.toString('utf8');
}

async function neuesterExport(): Promise<{ pfad: string; name: string; zeit: Date } | null> {
  const namen = (await readdir(DOWNLOADS).catch(() => [] as string[])).filter(n => /^my_whoop_data.*\.zip$/i.test(n));
  const mit = await Promise.all(namen.map(async n => ({ pfad: join(DOWNLOADS, n), name: n, zeit: (await stat(join(DOWNLOADS, n))).mtime })));
  return mit.sort((a, b) => b.zeit.getTime() - a.zeit.getTime())[0] ?? null;
}

/** GET → welcher Export läge im Downloads-Ordner bereit (für den Knopf). */
export async function GET() {
  const n = await neuesterExport();
  return NextResponse.json({ ok: true, downloads: n ? { name: n.name, zeit: n.zeit.toISOString() } : null });
}

export async function POST(req: Request) {
  let csv: string | null = null, quelle = '';
  const typ = req.headers.get('content-type') ?? '';
  try {
    if (typ.includes('multipart/form-data')) {
      const f = (await req.formData()).get('datei');
      if (!f || typeof f === 'string') return NextResponse.json({ ok: false, error: 'Keine Datei erhalten.' }, { status: 400 });
      csv = tabelleAus(Buffer.from(await f.arrayBuffer()), f.name); quelle = f.name;
    } else {
      const body = await req.json() as { csv?: string; ausDownloads?: boolean };
      if (body.ausDownloads) {
        const n = await neuesterExport();
        if (!n) return NextResponse.json({ ok: false, error: 'Im Downloads-Ordner liegt kein Whoop-Export (my_whoop_data_….zip). Erst in der Whoop-Mail auf „Daten herunterladen" klicken.' }, { status: 404 });
        csv = tabelleAus(await readFile(n.pfad), n.name); quelle = n.name;
      } else { csv = String(body.csv ?? ''); quelle = 'Text'; }
    }
  } catch { return NextResponse.json({ ok: false, error: 'Die Anfrage war nicht lesbar.' }, { status: 400 }); }
  if (!csv) return NextResponse.json({ ok: false, error: 'Im ZIP fehlt „physiologische_zyklen.csv".' }, { status: 400 });

  const r = zyklenLesen(csv);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.fehler }, { status: 400 });

  let zahlen = { neu: 0, aktualisiert: 0 };
  // Je Person eigener Bestand — Malins Export landet bei Malin, nicht bei Kevin (24.09.).
  await updateJson<WhoopLog>(speicherFuer('vitals', personAus(req)), current => {
    const bestand = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
    const m = einmischen(bestand, r.tage); zahlen = { neu: m.neu, aktualisiert: m.aktualisiert };
    return m.log;
  });
  const tage = Object.keys(r.tage).sort();
  const bis = tage[tage.length - 1];
  return NextResponse.json({ ok: true, quelle, tage: tage.length, ...zahlen, uebersprungen: r.ohneWerte, von: tage[0], bis, letzter: r.tage[bis] });
}
