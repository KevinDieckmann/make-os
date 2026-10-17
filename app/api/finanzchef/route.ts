// ─── Head of Finance — Schnittstelle ────────────────────────────────────────
// GET  → Berichte, Freigabe-Liste, Einstellung und die aktuelle Lage (ohne KI)
// POST → aktion: lauf | vorschlag | einstellung
// Umfang: Haushaltsmitglieder sehen Business + Haushalt (eigener Speicher je
// Haushalt), alle anderen nur Business. Die Prüfung ist streng (haushaltVon,
// ohne Rückfall auf eine Person).

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers, nurHaushalt, imHaushaltOderSystemlauf } from '@/lib/zugang/tor';
import { resolveAgent, disabledResponse } from '@/lib/agent-config';
import { NextResponse } from 'next/server';
import { loadJson, updateJson, saveJson } from '@/lib/store/local-db';
import { systemAufgabenAendern } from '@/lib/aufgaben/system-schreiben';
import { haushaltVon } from '@/lib/finanzen/haushalt/zugriff';
import { istEchterHaushalt } from '@/lib/finanzen/haushalt/aufgaben';
import { monatPlus, heuteBerlin } from '@/lib/finanzen/haushalt/monat';
import { chefLauf, ladeFinanzbild, ladeEinstellung } from '@/lib/finanzen/chef/lauf';
import { einstellungFuerBusiness } from '@/lib/finanzen/chef/finanzbild';
import { MODI, type Modus } from '@/lib/finanzen/chef/prompt';
import { leererStand, standName, EINSTELLUNG_NAME, type ChefStand, type ChefVorschlag, type VorschlagStatus, type ChefEinstellung } from '@/lib/finanzen/chef/stand';
import type { UstRhythmus } from '@/lib/finanzen/chef/steuertermine';
import { istStand } from '@/lib/finanzen/chef/ist-stand';
import { ladeHaushalt } from '@/lib/finanzen/haushalt/speicher';
import { pruefliste, type Businessbestand } from '@/lib/finanzen/haushalt/entflechtung';
import { ladeKonten } from '@/lib/zugang/konten';
import { hauptInhaber } from '@/lib/zugang/inhaber';
import { haushaltsSpeicher } from '@/lib/aufgaben/sicht';
import { mitEroeffnung } from '@/lib/business/eroeffnung-server';
import { istBetreiberInstanz } from '@/lib/betrieb/betreiber-server';

/** Die Checkliste „Ist-Stand“ — jeder Punkt aus den Daten abgeleitet. */
async function checkliste(haushalt: string | null, bild: Awaited<ReturnType<typeof ladeFinanzbild>>['bild'], einstellung: ChefEinstellung, betreiber: boolean) {
  const [fp, bu, lp, st] = await Promise.all([
    loadJson<Omit<NonNullable<Businessbestand['finanzplan']>, 'firmen'> & { firmen?: { id: string; name: string; kontostand: number | null; stand?: string | null }[] }>('finanzplan'),
    loadJson<Businessbestand['buchungen']>('buchungen'),
    loadJson<{ posten?: { betrag: number; sicher?: boolean; notiz?: string; firmaId?: string }[] }>('liquiplan'),
    // Dieselbe Quelle wie die Steuern (17.10., Abnahme 3 · B2): eine dort gepflegte Rechtsform gilt auch hier als eingetragen.
    loadJson<{ einstellungen?: Partial<Record<'kdv' | 'kdc', { rechtsform?: string }>> }>('steuern'),
  ]);
  // 0-Punkt (05.10.): Konten, offene Rechnungen und Planposten ab der Eröffnung (lib/business/eroeffnung.ts) — ohne Eröffnung unverändert.
  const ab = await mitEroeffnung({ firmen: fp?.firmen ?? [], rechnungen: fp?.rechnungen ?? [], planposten: (lp?.posten ?? []) as { betrag: number; sicher?: boolean; notiz?: string; firmaId?: string; ab: string; rhythmus: string; bis?: string }[] });
  // Business-Umfang (09.10., Funde Abdeckung #2): Konten, Rechnungen und Planposten einer Privat-Einheit (Selbstständigkeit) kommen in der
  // Checkliste gar nicht erst an — wie im Business-Index (`ladeRoh`). Mit Haushaltszugang wie bisher alles.
  const imBereich = (firmaId: string | undefined) => !!haushalt || bereichVonFirma(firmaId) === 'business';
  const business = ab.planposten.filter(p => p.firmaId !== 'privat' && imBereich(p.firmaId));
  let hh = null as Parameters<typeof istStand>[0]['haushalt'];
  const kontenStand = await ladeKonten();
  if (haushalt && bild.haushalt) {
    const h = await ladeHaushalt(haushalt);
    const privat = h.buchungen.filter(b => b.einheit === 'privat');
    const konten = kontenStand.konten;
    hh = {
      umzug: !!h.meta.umzug, buchungen: privat.length,
      letzteBuchung: privat.map(b => b.datum).sort().pop() ?? null,
      ohneKategorie: privat.filter(b => !b.kategorie_id && !b.ist_umbuchung).length,
      pruefposten: istEchterHaushalt(haushalt) ? pruefliste({ finanzplan: fp, buchungen: bu, liquiplan: lp as Businessbestand['liquiplan'] }, h).length : 0,
      steuerquote: h.meta.steuerquote, mitglieder: konten.filter(k => k.haushalt === haushalt).map(k => k.speicher),
      // Plattform-Regel (09.10.): statt „<feste Person> hat Zugang“ — Konten ohne Haushalt und ohne „nur Business“ (nur die Zahl).
      ohneHaushalt: konten.filter(k => !k.haushalt && k.finanzRecht !== 'business').length,
    };
  }
  // Wer die Inhaber-Schritte macht: der Haupt-Inhaber aus den Konten (Speichername + Vorname) — nie ein fester Name.
  const haupt = hauptInhaber(kontenStand);
  return istStand({
    heute: bild.stichtag,
    firmen: ab.firmen.filter(f => imBereich(f.id)).map(f => ({ id: f.id, name: kontoName(f.id, f.name), kontostand: f.kontostand ?? null, stand: f.stand ?? null })),
    offeneRechnungen: ab.rechnungen.filter(r => r.status === 'gestellt' && r.firmaId !== 'privat' && imBereich(r.firmaId)).map(r => ({ kunde: r.kunde, faellig: r.faellig })),
    leereControllingMonate: bild.business.controlling ? bild.business.controlling.leere_monate : null,
    grundlageStand: bild.business.grundlage?.stand ?? null,
    planposten: business.length, zuKlaeren: business.filter(p => !p.sicher && (p.notiz ?? '').startsWith('Zu klären')).length,
    rechtsform: Object.fromEntries(Object.entries(einstellung.rechtsform).map(([g, v]) => [g, v || st?.einstellungen?.[g as 'kdv' | 'kdc']?.rechtsform || null])), haushalt: hh,
    inhaber: haupt ? { kennung: haupt.speicher, name: haupt.name.split(/\s+/)[0] || haupt.speicher } : null,
    betreiber,
  });
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 400;

/**
 * Umfang der Anfrage. Die Sicht Business (`umfang=business` ODER `space=business`, 18.10., A1 — vorher kannte die Route nur `umfang`, die
 * Business-Ansicht schickt aber `?space=business`) rechnet IMMER ohne Haushalt: Bestand `finanzchef` statt `haushalt-chef--<h>`, Finanzbild
 * ohne Haushalt (keine Haushalts-/Gesamt-Hinweise, keine Einkommensteuer, keine Grundlage einer Privat-Einheit) — serverseitig, nie nur
 * ausgeblendet. `zugang` sagt nur, ob die Person einen Haushalt HAT (Anzeige), nicht, dass er hier gelesen wird.
 */
function nurBusinessGewuenscht(umfang: unknown, space: unknown): boolean {
  return umfang === 'business' || space === 'business';
}

async function umfangVon(req: Request, businessSicht: boolean): Promise<{ haushalt: string | null; person: string | null; zugang: boolean }> {
  const z = await haushaltVon(req);
  if (!z || businessSicht) return { haushalt: null, person: z?.person ?? null, zugang: !!z };
  return { haushalt: z.haushalt, person: z.person, zugang: true };
}

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return nurHaushalt();
  const q = new URL(req.url).searchParams;
  const u = await umfangVon(req, nurBusinessGewuenscht(q.get('umfang'), q.get('space')));
  const [stand, { bild, einstellung }] = await Promise.all([
    loadJson<ChefStand>(standName(u.haushalt)),
    // Business-Sicht im Haushalt des Inhabers (die Tor-Zeile oben): mit den Hinweisen des Business-Index, wie /api/business.
    ladeFinanzbild(u.haushalt, undefined, { businessIndex: !u.haushalt }),
  ]);
  const s = { ...leererStand(), ...(stand ?? {}) };
  // Sicht Business (15.10., Abnahme 2 C13 — „Business zeigt nur Business“): die Checkliste und die Lage ohne Privat und ohne die Selbstständigkeit.
  // Seit 18.10. (A1) heißt Business-Sicht immer „ohne Haushalt“ (umfangVon) — Berichte, Vorschläge und Hinweise kommen dann aus dem Business-Stand.
  const nurBusinessSicht = !u.haushalt;
  const istStandListe = await checkliste(nurBusinessSicht ? null : u.haushalt, bild, nurBusinessSicht ? einstellungFuerBusiness(einstellung) : einstellung, await istBetreiberInstanz());
  return NextResponse.json({
    istStand: istStandListe,
    ok: true, umfang: u.haushalt ? 'business+haushalt' : 'business', haushaltZugang: u.zugang,
    berichte: s.berichte.slice(-10).reverse(), vorschlaege: s.vorschlaege.slice().reverse(), letzte: s.letzte, ruhig: s.ruhig ?? null,
    // Business-Umfang (09.10., Funde #2): ohne ESt-Vorauszahlung und ohne Rechtsform einer Privat-Einheit — serverseitig, nie nur ausgeblendet.
    einstellung: nurBusinessSicht ? einstellungFuerBusiness(einstellung) : einstellung,
    lage: {
      // Business-Sicht (17.10., Abnahme 3 · B2): nur Fristen der Business-Gesellschaften — nie die private Einkommensteuer.
      hinweise: bild.hinweise, termine: nurBusinessSicht ? bild.steuern.termine_60_tage.filter(t => !t.einheit || bereichVon(t.einheit) === 'business').filter(t => t.art !== 'est') : bild.steuern.termine_60_tage,
      // EINE Runway (B1): die Zahl des Cockpits — Anzeige „kein Verbrauch“ / „3,2 Monate“ / „—“.
      kasse: bild.business.kasse, runway: bild.business.controlling?.runway_monate ?? null, runwayAnzeige: bild.business.controlling?.runway_anzeige ?? null,
      liquiditaet: bild.business.liquiditaet_12_wochen,
      haushalt: bild.haushalt && !nurBusinessSicht ? { luft: bild.haushalt.luft_pro_monat, sparquote: bild.haushalt.sparquote_prozent, tage_seit_letzter_buchung: bild.haushalt.tage_seit_letzter_buchung } : null,
      deckung: nurBusinessSicht ? null : bild.gesamt?.deckung_prozent ?? null,
    },
  });
}

import { istDienst as dienst } from '@/lib/zugang/dienst';
import { kontoName, bereichVonFirma, bereichVon, istBusinessGesellschaft } from '@/lib/einheiten';
const ohneBetraege = (t: string) => t.replace(/[+−-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?\s?(?:€|EUR)/g, '…').replace(/\s{2,}/g, ' ').trim();

export async function POST(req: Request) {
  if (!(await imHaushaltOderSystemlauf(req))) return nurHaushalt();
  const agentCfg = await resolveAgent('finanzchef'); if (!agentCfg.enabled) return NextResponse.json(disabledResponse(agentCfg), { status: 409 });
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const u = await umfangVon(req, nurBusinessGewuenscht(b.umfang, b.space));
  if (u.haushalt && !istEchterHaushalt(u.haushalt) && b.aktion === 'lauf' && b.ausgeloest === 'takt') return NextResponse.json({ ok: false, fehler: 'Kein Takt für Test-Haushalte.' }, { status: 400 });

  if (b.aktion === 'lauf') {
    const modus = (MODI as readonly string[]).includes(String(b.modus)) ? b.modus as Modus : 'wochenreview';
    const frage = modus === 'frage' ? String(b.frage ?? '').trim().slice(0, 800) : undefined;
    if (modus === 'frage' && !frage) return NextResponse.json({ ok: false, fehler: 'Frage fehlt.' }, { status: 400 });
    const ausgeloest = dienst(req) && ['takt', 'zoe'].includes(String(b.ausgeloest)) ? b.ausgeloest as 'takt' | 'zoe' : 'person';
    const monat = modus === 'monatsabschluss' ? (/^\d{4}-\d{2}$/.test(String(b.monat ?? '')) ? String(b.monat) : monatPlus(heuteBerlin().slice(0, 7), -1)) : undefined;
    // Agenten-Datenschicht (09.10., D1): Not-Aus, „Head aus“ und Budget des Agenten-Bereichs gelten auch für den Lauf von Hand — vorher
    // prüfte die Route nur den alten Schalter (`agents-config`). Dieselbe Sperre wie Threads, Arbeiter und Takt (lib/agenten/einstellung.ts).
    const sperre = await (await import('@/lib/agenten/einstellung')).laufSperre(u.person ?? null, 'finanzen');
    if (sperre) return NextResponse.json({ ok: false, fehler: sperre.text, gesperrt: sperre.grund }, { status: 409 });
    // Business-Lauf (ohne Haushalt) mit den Hinweisen des Business-Index — die Tor-Zeile oben hat den Haushalt des Inhabers bzw. den Systemlauf geprüft.
    const r = await chefLauf({ modus, haushalt: u.haushalt, person: u.person ?? undefined, frage, monat, ausgeloest, businessIndex: !u.haushalt });
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
      const personen = await haushaltsSpeicher().catch(() => [] as string[]);
      // Über den Schreibweg (29.09., Paket T1): Zeitstempel, Verlauf „durch System“, Serien, Sichtfilter.
      await systemAufgabenAendern(stand => {
        const da = stand.tasks.find(t => t.id === `hof-${v.id}`);
        if (status === 'erledigt') return da && da.status !== 'done' ? { teile: [{ id: da.id, felder: { status: 'done' } }] } : {};
        if (da) return {};
        // Zuständig (09.10., Plattform-Regel — vorher fest eine von zwei Personen): die genannte Person, wenn sie zum Haushalt gehört, sonst
        // die Person, die angenommen hat, sonst die erste des Haushalts (Inhaber). „beide“/„steuerberater“ → die annehmende Person.
        const wer = personen.includes(v.verantwortlich) ? v.verantwortlich : u.person && personen.includes(u.person) ? u.person : personen[0];
        if (!wer) return {};
        return { neu: [{
          id: `hof-${v.id}`, title: (privat ? ohneBetraege(v.titel) : v.titel).slice(0, 200),
          description: privat ? 'Vorschlag des Head of Finance (Haushalt) — Details und Beträge unter Finanzen › Head of Finance.' : `Vorschlag des Head of Finance: ${v.begruendung}`,
          status: 'todo', priority: v.prioritaet === 'hoch' ? 'high' : v.prioritaet === 'niedrig' ? 'low' : 'medium', assignee: wer,
          tags: privat ? ['haushalt', 'finanzchef'] : ['finanzchef'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetzt, updatedAt: jetzt,
          ...(v.frist ? { dueDate: v.frist } : {}),
        }] };
      }, { person: u.person ?? null, jetzt });
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
        kdv: e.rechtsform && 'kdv' in e.rechtsform ? (e.rechtsform.kdv ? String(e.rechtsform.kdv).slice(0, 80) : null) : alt.rechtsform.kdv,
        kdc: e.rechtsform && 'kdc' in e.rechtsform ? (e.rechtsform.kdc ? String(e.rechtsform.kdc).slice(0, 80) : null) : alt.rechtsform.kdc,
      },
      geaendert: new Date().toISOString(),
    };
    // Sicht Business schreibt nichts Privates (18.10., A1): die Einkommensteuer-Vorauszahlung und die Rechtsform einer Privat-Einheit bleiben,
    // wie sie waren — die Business-Ansicht bekommt sie gar nicht (`einstellungFuerBusiness`) und schickte sonst „aus“ bzw. nichts zurück.
    if (!u.haushalt) {
      neu.steuer.estVorauszahlung = alt.steuer.estVorauszahlung;
      for (const g of ['kdv', 'kdc'] as const) if (!istBusinessGesellschaft(g)) neu.rechtsform[g] = alt.rechtsform[g];
    }
    await saveJson(EINSTELLUNG_NAME, neu);
    return NextResponse.json({ ok: true, einstellung: u.haushalt ? neu : einstellungFuerBusiness(neu) });
  }
  return NextResponse.json({ ok: false, fehler: 'Unbekannte Aktion.' }, { status: 400 });
}
