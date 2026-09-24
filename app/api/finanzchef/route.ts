// ─── Head of Finance — Schnittstelle ────────────────────────────────────────
// GET  → Berichte, Freigabe-Liste, Einstellung und die aktuelle Lage (ohne KI)
// POST → aktion: lauf | vorschlag | einstellung
// Umfang: Haushaltsmitglieder sehen Business + Haushalt (eigener Speicher je
// Haushalt), alle anderen nur Business. Die Prüfung ist streng (haushaltVon,
// ohne Rückfall auf eine Person).

import { NextResponse } from 'next/server';
import { loadJson, updateJson, saveJson } from '@/lib/store/local-db';
import { haushaltVon } from '@/lib/finanzen/haushalt/zugriff';
import { istEchterHaushalt } from '@/lib/finanzen/haushalt/aufgaben';
import { monatPlus, heuteBerlin } from '@/lib/finanzen/haushalt/monat';
import { chefLauf, ladeFinanzbild, ladeEinstellung } from '@/lib/finanzen/chef/lauf';
import { MODI, type Modus } from '@/lib/finanzen/chef/prompt';
import { leererStand, standName, EINSTELLUNG_NAME, type ChefStand, type ChefVorschlag, type VorschlagStatus, type ChefEinstellung } from '@/lib/finanzen/chef/stand';
import type { UstRhythmus } from '@/lib/finanzen/chef/steuertermine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 400;

async function umfangVon(req: Request, wunsch: string | null): Promise<{ haushalt: string | null; person: string | null; zugang: boolean }> {
  const z = await haushaltVon(req);
  if (!z || wunsch === 'business') return { haushalt: null, person: z?.person ?? null, zugang: !!z };
  return { haushalt: z.haushalt, person: z.person, zugang: true };
}

export async function GET(req: Request) {
  const u = await umfangVon(req, new URL(req.url).searchParams.get('umfang'));
  const [stand, { bild, einstellung }] = await Promise.all([
    loadJson<ChefStand>(standName(u.haushalt)),
    ladeFinanzbild(u.haushalt),
  ]);
  const s = { ...leererStand(), ...(stand ?? {}) };
  return NextResponse.json({
    ok: true, umfang: u.haushalt ? 'business+haushalt' : 'business', haushaltZugang: u.zugang,
    berichte: s.berichte.slice(-10).reverse(), vorschlaege: s.vorschlaege.slice().reverse(), letzte: s.letzte, ruhig: s.ruhig ?? null,
    einstellung,
    lage: {
      hinweise: bild.hinweise, termine: bild.steuern.termine_60_tage,
      kasse: bild.business.kasse, runway: bild.business.controlling?.runway_monate ?? null,
      liquiditaet: bild.business.liquiditaet_12_wochen,
      haushalt: bild.haushalt ? { luft: bild.haushalt.luft_pro_monat, sparquote: bild.haushalt.sparquote_prozent, tage_seit_letzter_buchung: bild.haushalt.tage_seit_letzter_buchung } : null,
      deckung: bild.gesamt?.deckung_prozent ?? null,
    },
  });
}

const dienst = (req: Request) => !!process.env.MAKE_OS_KEY && req.headers.get('x-make-key') === process.env.MAKE_OS_KEY;
const ohneBetraege = (t: string) => t.replace(/[+−-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?\s?(?:€|EUR)/g, '…').replace(/\s{2,}/g, ' ').trim();

export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const u = await umfangVon(req, typeof b.umfang === 'string' ? b.umfang : null);
  if (u.haushalt && !istEchterHaushalt(u.haushalt) && b.aktion === 'lauf' && b.ausgeloest === 'takt') return NextResponse.json({ ok: false, fehler: 'Kein Takt für Test-Haushalte.' }, { status: 400 });

  if (b.aktion === 'lauf') {
    const modus = (MODI as readonly string[]).includes(String(b.modus)) ? b.modus as Modus : 'wochenreview';
    const frage = modus === 'frage' ? String(b.frage ?? '').trim().slice(0, 800) : undefined;
    if (modus === 'frage' && !frage) return NextResponse.json({ ok: false, fehler: 'Frage fehlt.' }, { status: 400 });
    const ausgeloest = dienst(req) && ['takt', 'jarvis'].includes(String(b.ausgeloest)) ? b.ausgeloest as 'takt' | 'jarvis' : 'person';
    const monat = modus === 'monatsabschluss' ? (/^\d{4}-\d{2}$/.test(String(b.monat ?? '')) ? String(b.monat) : monatPlus(heuteBerlin().slice(0, 7), -1)) : undefined;
    const r = await chefLauf({ modus, haushalt: u.haushalt, person: u.person ?? undefined, frage, monat, ausgeloest });
    return NextResponse.json(r, { status: r.ok ? 200 : 502 });
  }

  if (b.aktion === 'vorschlag') {
    const id = String(b.id ?? '');
    const status = ['offen', 'angenommen', 'abgelehnt', 'erledigt'].includes(String(b.status)) ? b.status as VorschlagStatus : null;
    if (!id || !status) return NextResponse.json({ ok: false, fehler: 'id und status nötig.' }, { status: 400 });
    const jetzt = new Date().toISOString();
    let treffer: ChefVorschlag | null = null;
    await updateJson<ChefStand>(standName(u.haushalt), s => {
      const st = { ...leererStand(), ...(s ?? {}) };
      st.vorschlaege = st.vorschlaege.map(v => {
        if (v.id !== id) return v;
        treffer = { ...v, status, entschieden: jetzt, aktualisiert: jetzt, ...(u.person ? { von: u.person } : {}), ...(b.grund ? { grund: String(b.grund).slice(0, 300) } : {}), ...(status === 'angenommen' ? { aufgabeId: `hof-${v.id}` } : {}) };
        return treffer;
      });
      return st;
    });
    const v = treffer as ChefVorschlag | null;
    if (!v) return NextResponse.json({ ok: false, fehler: 'Vorschlag nicht gefunden.' }, { status: 404 });
    // Angenommen → Aufgabe. Die Aufgabenliste teilen sich alle Konten: private
    // Vorschläge ohne Beträge und mit Stichwort „haushalt“ (OKR lässt sie aus).
    const privat = !!u.haushalt && (v.bereich === 'haushalt' || v.bereich === 'gesamt');
    if ((status === 'angenommen' || status === 'erledigt') && (!u.haushalt || istEchterHaushalt(u.haushalt))) {
      await updateJson<{ tasks: Record<string, unknown>[] }>('tasks', cur => {
        const f = cur ?? { tasks: [] };
        const tasks = [...(f.tasks ?? [])];
        const i = tasks.findIndex(t => t.id === `hof-${v.id}`);
        if (status === 'erledigt') { if (i >= 0) tasks[i] = { ...tasks[i], status: 'done', updatedAt: jetzt }; return { ...f, tasks }; }
        if (i >= 0) return f;
        const wer = v.verantwortlich === 'malin' ? 'malin' : 'kevin';
        tasks.push({
          id: `hof-${v.id}`, title: (privat ? ohneBetraege(v.titel) : v.titel).slice(0, 200),
          description: privat ? 'Vorschlag des Head of Finance (Haushalt) — Details und Beträge unter Zahlen › Head of Finance.' : `Vorschlag des Head of Finance: ${v.begruendung}`,
          status: 'todo', priority: v.prioritaet === 'hoch' ? 'high' : v.prioritaet === 'niedrig' ? 'low' : 'medium', assignee: wer,
          tags: privat ? ['haushalt', 'finanzchef'] : ['finanzchef'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetzt, updatedAt: jetzt,
          ...(v.frist ? { dueDate: v.frist } : {}),
        });
        return { ...f, tasks };
      });
    }
    return NextResponse.json({ ok: true, vorschlag: v });
  }

  if (b.aktion === 'einstellung') {
    const alt = await ladeEinstellung();
    const e = (b.einstellung ?? {}) as Partial<ChefEinstellung>;
    const st = (e.steuer ?? {}) as Partial<ChefEinstellung['steuer']>;
    const neu: ChefEinstellung = {
      steuer: {
        ust: ['monatlich', 'quartal', 'keine'].includes(String(st.ust)) ? st.ust as UstRhythmus : alt.steuer.ust,
        dauerfrist: typeof st.dauerfrist === 'boolean' ? st.dauerfrist : alt.steuer.dauerfrist,
        estVorauszahlung: typeof st.estVorauszahlung === 'boolean' ? st.estVorauszahlung : alt.steuer.estVorauszahlung,
        gewstVorauszahlung: typeof st.gewstVorauszahlung === 'boolean' ? st.gewstVorauszahlung : alt.steuer.gewstVorauszahlung,
        kstVorauszahlung: typeof st.kstVorauszahlung === 'boolean' ? st.kstVorauszahlung : alt.steuer.kstVorauszahlung ?? false,
      },
      ruecklageQuote: e.ruecklageQuote === null ? null : typeof e.ruecklageQuote === 'number' && e.ruecklageQuote >= 0 && e.ruecklageQuote <= 70 ? Math.round(e.ruecklageQuote) : alt.ruecklageQuote,
      rechtsform: {
        kdv: e.rechtsform && 'kdv' in e.rechtsform ? (e.rechtsform.kdv ? String(e.rechtsform.kdv).slice(0, 40) : null) : alt.rechtsform.kdv,
        kdc: e.rechtsform && 'kdc' in e.rechtsform ? (e.rechtsform.kdc ? String(e.rechtsform.kdc).slice(0, 40) : null) : alt.rechtsform.kdc,
      },
      geaendert: new Date().toISOString(),
    };
    await saveJson(EINSTELLUNG_NAME, neu);
    return NextResponse.json({ ok: true, einstellung: neu });
  }
  return NextResponse.json({ ok: false, fehler: 'Unbekannte Aktion.' }, { status: 400 });
}
