// ─── CRM — Stammdaten ───────────────────────────────────────────────────────
// GET  → Datenqualität (Vollständigkeit je Feld, Dubletten, Firmen ohne
//        Verknüpfung, Art. 14, Speicherbegrenzung, Werbesperren), Kennzahlen,
//        Wertelisten (Stufen mit Wahrscheinlichkeit, Verlustgründe), letzter Import
//        + Selbstprüfung, Pflichtangaben-Vorschlag, Löschkonzept, Anträge,
//        Verarbeitungsverzeichnis (beim ersten Aufruf mit Startbestand), Befunde
// POST { aktion: 'firmen-abgleich' }                        → Firmen anlegen/verknüpfen
// POST { aktion: 'pflichtangaben' }                          → Vorschläge übernehmen (nur leere Felder)
// POST { aktion: 'wahrscheinlichkeit', stufe, p | null }     → von Hand setzen / zurücksetzen

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { ladeKonten } from '@/lib/zugang/konten';
import { anzeigename } from '@/lib/make-one/crm';
import { pflichtangaben, selbstpruefung, verarbeitungenStart, LOESCHREGELN } from '@/lib/crm/datenschutz';
import { befunde } from '@/lib/crm/befunde';
import { localDay } from '@/lib/zeit';
import type { Kontakt } from '@/lib/make-one/crm';
import { ladeCrm, aendereCrm } from '@/lib/crm/speicher';
import { firmenAbgleichen } from '@/lib/crm/abgleich';
import { firmenDubletten } from '@/lib/crm/firmen';
import { dubletten } from '@/lib/crm/dubletten';
import { kennzahlen, vollstaendigkeit, speicherbegrenzung } from '@/lib/crm/kennzahlen';
import { art14 } from '@/lib/crm/recht';
import { STUFEN, VERLUSTGRUENDE, wahrscheinlichkeit } from '@/lib/crm/pipeline';
import type { ChancenStufe } from '@/lib/crm/typen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const heute = localDay();
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  let crm = await ladeCrm();
  if (!crm.verarbeitungen.length) crm = await aendereCrm(c => (c.verarbeitungen.length ? c : { ...c, verarbeitungen: verarbeitungenStart(new Date().toISOString()) }));
  const konten = (await ladeKonten()).konten;
  const vorschlag = pflichtangaben(kontakte, crm);
  const zaehl = (f: (v: (typeof vorschlag)[number]) => string | undefined) => vorschlag.reduce((a, v) => { const x = f(v); if (x) a[x] = (a[x] ?? 0) + 1; return a; }, {} as Record<string, number>);
  const nachId = new Map(kontakte.map(k => [k.id, k]));
  const log = (await loadJson<{ entries: { ts: string; agent: string; title?: string }[] }>('agent-log'))?.entries ?? [];
  const letzterImport = [...log].reverse().find(e => e.agent === 'crm' && (e.title ?? '').startsWith('Import'));
  const verlust: Record<string, number> = {};
  for (const c of crm.chancen.filter(c => c.stufe === 'verloren' && c.grund)) verlust[c.grund!] = (verlust[c.grund!] ?? 0) + 1;
  return NextResponse.json({
    ok: true, heute,
    kennzahlen: kennzahlen(kontakte, crm, heute),
    qualitaet: {
      kontakte: kontakte.length, firmen: crm.firmen.length,
      vollstaendigkeit: vollstaendigkeit(kontakte),
      dublettenPersonen: dubletten(kontakte).length, dublettenFirmen: firmenDubletten(crm.firmen).length,
      ohneFirmenverweis: kontakte.filter(k => k.firma && !k.firmaId).length,
      art14: kontakte.filter(k => art14(k, heute)?.faellig).length,
      speicherbegrenzung: speicherbegrenzung(kontakte, heute).length,
      werbesperren: kontakte.filter(k => k.werbesperre).map(k => ({ id: k.id, seit: k.werbesperre!.seit })),
    },
    wertelisten: {
      stufen: STUFEN.map(s => ({ id: s.id, label: s.label, standard: s.p, p: wahrscheinlichkeit(s.id, crm.wahrscheinlichkeiten), vonHand: typeof crm.wahrscheinlichkeiten?.[s.id] === 'number', weiterWenn: s.weiterWenn, offen: s.offen })),
      verlustgruende: VERLUSTGRUENDE.map(g => ({ grund: g, anzahl: verlust[g] ?? 0 })),
    },
    letzterImport: letzterImport ? { zeit: letzterImport.ts, text: letzterImport.title ?? '' } : null,
    selbstpruefung: selbstpruefung(kontakte, crm, heute, { konten: konten.length, mitPasswort: konten.filter(k => !!k.hash).length }),
    pflichtangaben: {
      anzahl: vorschlag.length, herkunft: zaehl(v => v.herkunft), rechtsgrundlage: zaehl(v => v.rechtsgrundlage), fremddaten: vorschlag.filter(v => v.fremddaten).length,
      beispiele: vorschlag.slice(0, 8).map(v => ({ name: anzeigename(nachId.get(v.id)!), herkunft: v.herkunft, rechtsgrundlage: v.rechtsgrundlage, fremddaten: !!v.fremddaten, grund: v.grund })),
    },
    loeschregeln: LOESCHREGELN,
    speicherbegrenzung: speicherbegrenzung(kontakte, heute).slice(0, 20).map(k => ({ id: k.id, name: anzeigename(k), seit: k.letzterKontakt ?? k.importiertAm })),
    antraege: crm.antraege, verarbeitungen: crm.verarbeitungen,
    befunde: befunde(kontakte, crm, heute),
    loeschprotokoll: ((await loadJson<{ eintraege: { id: string; datum: string; grund: string; von: string }[] }>('crm-loeschprotokoll'))?.eintraege ?? []).slice(-20).reverse(),
  });
}

export async function POST(req: Request) {
  let b: { aktion?: string; stufe?: string; p?: number | null };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (b.aktion === 'firmen-abgleich') return NextResponse.json({ ok: true, ...(await firmenAbgleichen()) });
  if (b.aktion === 'pflichtangaben') {
    const crm = await ladeCrm();
    let gesetzt = 0;
    await updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => {
      const f = cur ?? { kontakte: [] };
      const v = new Map(pflichtangaben(f.kontakte, crm).map(x => [x.id, x]));
      return { ...f, kontakte: f.kontakte.map(k => {
        const x = v.get(k.id);
        if (!x) return k;
        gesetzt++;
        return { ...k, ...(x.herkunft && !k.herkunft ? { herkunft: x.herkunft } : {}), ...(x.rechtsgrundlage && !k.rechtsgrundlage ? { rechtsgrundlage: x.rechtsgrundlage } : {}), ...(x.fremddaten ? { fremddaten: true } : {}) };
      }) };
    });
    return NextResponse.json({ ok: true, gesetzt });
  }
  if (b.aktion === 'wahrscheinlichkeit') {
    const s = STUFEN.find(x => x.id === b.stufe && x.offen);
    if (!s) return NextResponse.json({ ok: false, fehler: 'Nur offene Stufen.' }, { status: 400 });
    const p = b.p === null ? null : Math.max(0, Math.min(100, Math.round(Number(b.p))));
    if (p !== null && !Number.isFinite(p)) return NextResponse.json({ ok: false, fehler: 'p 0–100 oder null.' }, { status: 400 });
    await aendereCrm(cur => {
      const w = { ...(cur.wahrscheinlichkeiten ?? {}) } as Record<ChancenStufe, number>;
      if (p === null) delete w[s.id]; else w[s.id] = p;
      return { ...cur, wahrscheinlichkeiten: w };
    });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, fehler: 'aktion unbekannt.' }, { status: 400 });
}
