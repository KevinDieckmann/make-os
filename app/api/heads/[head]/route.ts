// ─── Die Heads: Sales, Marketing, Event ─────────────────────────────────────
// GET  → Freigabe-Liste, letzte Berichte, Modi
// POST { aktion: 'lauf', modus, frage? } → ein Lauf (Hand oder ZOE)
// POST { aktion: 'daten', modus } → das Datenpaket, das der Head sähe (ohne Modell)
// POST { aktion: 'merken', text } / { aktion: 'vergessen', id } → Gedächtnis des Heads
// POST { aktion: 'autonomie', an } → interne Kleinigkeiten selbst erledigen an/aus
// POST { aktion: 'rueckgaengig', id } → selbst Übernommenes zurücknehmen (zählt als „passt nicht“)
// POST { aktion: 'entscheiden', id, status, grund?, entwurf? } → abgelehnt mit
//      Grund (daraus lernt der Head), angenommen mit dem übernommenen Entwurf;
//      art „merken“ angenommen → Merksatz ins Gedächtnis. Sonst: mit Person und
//      Frist wird es deren nächster Schritt (erscheint dann in der Power
//      Hour), sonst eine Aufgabe. Nichts wird versendet.

import { resolveAgent, disabledResponse } from '@/lib/agent-config';
import { WEG } from '@/lib/wege';
import { markttraktion, mandateLink } from '@/lib/crm/adresse';
import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { systemAufgabenAendern } from '@/lib/aufgaben/system-schreiben';
import { aendereKontakte } from '@/lib/crm/kartei-schreiben';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { imHaushaltDesInhabers, KARTEI_GESPERRT } from '@/lib/zugang/haushalt-inhaber';
import type { Kontakt } from '@/lib/make-one/crm';
import { HEADS, HEAD_NAME, MODI, AGENT_ID, type HeadId } from '@/lib/heads/prompt';
import { headLauf } from '@/lib/heads/lauf';
import { vollesPaket } from '@/lib/heads/paket';
import { lernstand, merksatzNeu, ABLEHNGRUENDE } from '@/lib/heads/lernen';
import { ruecknehmbar } from '@/lib/heads/autonomie';
import { uebersicht } from '@/lib/zoe/verbrauch';
import { ladeCrm, aendereCrm } from '@/lib/crm/speicher';
import { PLAYBOOKS, planen } from '@/lib/crm/kampagnen';
import { localDay, tagVon } from '@/lib/zeit';
import { wer, verantwortlich, haeltBeziehung, nameVon, BEIDE } from '@/lib/crm/team';
import { leererStand, standName, type HeadStand, type HeadVorschlag, type Status } from '@/lib/heads/stand';
import { einheitAusBezug } from '@/lib/aufgaben/einheit';
import { ausgenommen } from '@/lib/crm/einschraenkung';
import { neueKennung } from '@/lib/kennung';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 400;

const headAus = (p: { head: string }) => (HEADS.includes(p.head as HeadId) ? (p.head as HeadId) : null);

// Zugang (28.09., Integritätsprüfung K1): Die Heads lesen Kartei und CRM-Bestand — nur für eine Person im Haushalt
// des Inhabers (Sitzung oder Dienstweg MIT Person, `imHaushaltDesInhabers`); vorher reichte „angemeldet“.
export async function GET(req: Request, props: { params: Promise<{ head: string }> }) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json(KARTEI_GESPERRT, { status: 403 });
  const params = await props.params;
  const h = headAus(params);
  if (!h) return NextResponse.json({ ok: false, fehler: 'Unbekannter Head.' }, { status: 404 });
  const s = { ...leererStand(), ...((await loadJson<HeadStand>(standName(h))) ?? {}) };
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  const l = lernstand(s.vorschlaege, kontakte, localDay(), undefined, await ladeCrm());
  // Qualität auf einen Blick: Annahmequote, Wirkung, Läufe mit/ohne KI (30 Tage).
  const vor30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const laeufe = s.berichte.filter(x => x.zeit >= vor30);
  const an = l.je_art.reduce((a, x) => a + x.angenommen, 0), ab = l.je_art.reduce((a, x) => a + x.abgelehnt, 0);
  const qualitaet = { laeufe: laeufe.length, mitKi: laeufe.filter(x => x.quelle !== 'regelwerk').length, regelwerk: laeufe.filter(x => x.quelle === 'regelwerk').length,
    annahmequote: an + ab >= 3 ? Math.round((an / (an + ab)) * 100) : null, entschieden: an + ab,
    wirkung: l.wirkung.ausgewertet ? `${l.wirkung.gewirkt} von ${l.wirkung.ausgewertet}${l.wirkung.termin || l.wirkung.chance ? ` · ${l.wirkung.termin} Termin, ${l.wirkung.chance} Chance` : ''}` : null, aenderungsgrad: l.aenderungsgrad,
    gestrichen: laeufe.reduce((a, x) => a + x.pruefung.gestrichen.length, 0), korrigiert: laeufe.filter(x => x.pruefung.korrigiert).length,
    // Kosten dieses Heads in 30 Tagen (US-Cent aus der Verbrauchs-Mitschrift, inkl. Cache).
    cent: Math.round((await uebersicht(30)).jeZweck.filter(z => z.zweck.startsWith(`${AGENT_ID[h]}-`)).reduce((a, z) => a + z.cent, 0)),
    cacheQuote: (() => { const v = laeufe.map(x => x.verbrauch).filter(Boolean); const ein = v.reduce((a, x) => a + x!.ein + x!.cacheLesen + x!.cacheSchreiben, 0); return ein ? Math.round((v.reduce((a, x) => a + x!.cacheLesen, 0) / ein) * 100) : null; })() };
  const vor7 = new Date(Date.now() - 7 * 864e5).toISOString();
  const auto = s.vorschlaege.filter(v => v.auto && v.auto.am >= vor7).sort((a, b) => b.auto!.am.localeCompare(a.auto!.am)).slice(0, 12);
  return NextResponse.json({ ok: true, head: h, name: HEAD_NAME[h], modi: MODI[h], vorschlaege: s.vorschlaege, berichte: s.berichte.slice(-5).reverse(), letzte: s.letzte, ruhig: s.ruhig ?? null,
    gedaechtnis: s.gedaechtnis ?? [], hinweise: l.hinweise, ablehngruende: ABLEHNGRUENDE, qualitaet, autonomie: s.autonomie ?? 'intern', auto });
}

/** Wo der Vorschlag hingehört — als Pfad in der Aufgabe, dort wird er ein Link (components/os/TextMitLinks.tsx). */
function ort(t: { art?: string; kontakt_id?: string | null; chance_id?: string | null; mandat_id?: string | null; event_id?: string | null }): string | null {
  if (t.art === 'vernetzen_runde') return markttraktion('kontakte', 'runde-vernetzen');
  if (t.chance_id) return WEG.deal(t.chance_id);
  if (t.mandat_id) return mandateLink('mandate', t.mandat_id);
  if (t.event_id) return markttraktion('event', undefined, t.event_id);
  if (t.kontakt_id) return markttraktion('kontakte', 'akte', t.kontakt_id);
  return null;
}

export async function POST(req: Request, props: { params: Promise<{ head: string }> }) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return NextResponse.json(KARTEI_GESPERRT, { status: 403 });
  const params = await props.params;
  const h = headAus(params);
  if (!h) return NextResponse.json({ ok: false, fehler: 'Unbekannter Head.' }, { status: 404 });
  // Der Schalter unter /os/agenten gilt auch für den direkten Aufruf (27.09.) — vorher nur für ZOE und den Takt.
  const agentCfg = await resolveAgent(AGENT_ID[h]); if (!agentCfg.enabled) return NextResponse.json({ ok: false, fehler: disabledResponse(agentCfg).error, disabled: true }, { status: 409 });
  let b: { aktion?: string; modus?: string; frage?: string; ausgeloest?: string; id?: string; status?: string; grund?: string; entwurf?: string; text?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const person = zugang.person;

  if (b.aktion === 'lauf') {
    const r = await headLauf({ head: h, modus: String(b.modus ?? 'frage'), person, frage: b.frage ? String(b.frage) : undefined, ausgeloest: b.ausgeloest === 'takt' ? 'takt' : b.ausgeloest === 'zoe' ? 'zoe' : 'hand' });
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }

  if (b.aktion === 'daten') {
    const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
    const st = { ...leererStand(), ...((await loadJson<HeadStand>(standName(h))) ?? {}) };
    const { kontakteMitTerminZeitenLesen } = await import('@/lib/crm/termin-zeiten-server'); // K6a: Meeting-Zeit aus dem Termin
    const d = vollesPaket(h, String(b.modus ?? MODI[h][0].id), await kontakteMitTerminZeitenLesen(kontakte, person), await ladeCrm(), localDay(), person, st);
    return NextResponse.json({ ok: true, daten: d, zeichen: JSON.stringify(d).length });
  }

  if (b.aktion === 'merken' || b.aktion === 'vergessen') {
    const jetzt = new Date().toISOString();
    const st = await updateJson<HeadStand>(standName(h), s => {
      const x = { ...leererStand(), ...(s ?? {}) };
      const g = x.gedaechtnis ?? [];
      return { ...x, gedaechtnis: b.aktion === 'merken' ? merksatzNeu(g, String(b.text ?? ''), person, jetzt, 'hand') : g.filter(m => m.id !== b.id) };
    });
    return NextResponse.json({ ok: true, gedaechtnis: st.gedaechtnis ?? [] });
  }

  if (b.aktion === 'autonomie') {
    const st = await updateJson<HeadStand>(standName(h), s => ({ ...leererStand(), ...(s ?? {}), autonomie: (b as { an?: boolean }).an === false ? 'aus' : 'intern' }));
    return NextResponse.json({ ok: true, autonomie: st.autonomie });
  }

  if (b.aktion === 'rueckgaengig') {
    const jetzt = new Date().toISOString();
    const st0 = { ...leererStand(), ...((await loadJson<HeadStand>(standName(h))) ?? {}) };
    const v = st0.vorschlaege.find(x => x.id === b.id && x.auto);
    if (!v) return NextResponse.json({ ok: false, fehler: 'Nichts selbst Übernommenes mit dieser Kennung.' }, { status: 404 });
    const r = v.auto!.rueckgaengig!;
    const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
    const tasks = (await loadJson<{ tasks: Record<string, unknown>[] }>('tasks'))?.tasks ?? [];
    const aufgabe = r.aufgabeId ? tasks.find(t => t.id === r.aufgabeId) as { status?: string; createdAt?: string; updatedAt?: string } | undefined : undefined;
    if (!ruecknehmbar(v, kontakte.find(k => k.id === r.kontaktId), aufgabe)) return NextResponse.json({ ok: false, fehler: 'Inzwischen von Hand geändert — bitte dort anpassen.' }, { status: 409 });
    if (r.art === 'schritt' && r.kontaktId) await aendereKontakte<{ kontakte: Kontakt[] }>(cur => ({ ...(cur ?? { kontakte: [] }), kontakte: (cur?.kontakte ?? []).map(k => (k.id === r.kontaktId ? { ...k, naechsterSchritt: r.vorher ?? undefined, geaendertAm: tagVon(jetzt) } : k)) }), werAus(req));
    if (r.art === 'aufgabe' && r.aufgabeId) await updateJson<{ tasks: Record<string, unknown>[] }>('tasks', cur => ({ ...(cur ?? { tasks: [] }), tasks: (cur?.tasks ?? []).filter(t => t.id !== r.aufgabeId) }));
    await updateJson<HeadStand>(standName(h), s => { const x = { ...leererStand(), ...(s ?? {}) }; return { ...x, vorschlaege: x.vorschlaege.map(y => (y.id === v.id ? { ...y, status: 'abgelehnt' as const, grund: 'unpassend', entschieden: jetzt, aktualisiert: jetzt, von: person } : y)) }; });
    return NextResponse.json({ ok: true, text: `Zurückgenommen: ${v.auto!.wirkung}.` });
  }

  if (b.aktion === 'entscheiden') {
    const status = (['angenommen', 'abgelehnt', 'erledigt', 'offen'] as Status[]).includes(b.status as Status) ? (b.status as Status) : null;
    if (!status || !b.id) return NextResponse.json({ ok: false, fehler: 'id und status nötig.' }, { status: 400 });
    const jetzt = new Date().toISOString();
    let v: HeadVorschlag | null = null;
    await updateJson<HeadStand>(standName(h), s => {
      const st = { ...leererStand(), ...(s ?? {}) };
      const grund = status === 'abgelehnt' && ABLEHNGRUENDE.some(g => g.id === b.grund) ? b.grund : undefined;
      const entwurfFinal = status === 'angenommen' && typeof b.entwurf === 'string' && b.entwurf.trim() ? b.entwurf.trim().slice(0, 1500) : undefined;
      st.vorschlaege = st.vorschlaege.map(x => (x.id === b.id ? (v = { ...x, status, entschieden: jetzt, aktualisiert: jetzt, von: person, ...(grund ? { grund } : {}), ...(entwurfFinal ? { entwurfFinal } : {}) }) : x));
      // Ein angenommener Merksatz geht ins Gedächtnis des Heads — keine Aufgabe.
      const merk = v as HeadVorschlag | null;
      if (merk && merk.art === 'merken' && status === 'angenommen') st.gedaechtnis = merksatzNeu(st.gedaechtnis ?? [], merk.titel, person, jetzt, 'vorschlag');
      return st;
    });
    const t = v as HeadVorschlag | null;
    if (!t) return NextResponse.json({ ok: false, fehler: 'Vorschlag nicht gefunden.' }, { status: 404 });
    let wohin = '';
    if (status === 'angenommen' && t.art === 'merken') wohin = 'Gedächtnis des Heads';
    else if (status === 'angenommen' && t.kampagne) {
      // Kampagnen-Vorschlag → Entwurf im Marketing › Kampagnen (Personen aus dem Vorschlag, sonst Zielgruppe des Playbooks).
      const pb = PLAYBOOKS.find(x => x.id === t.kampagne!.playbook);
      const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
      const crm = await ladeCrm();
      const basis = pb ?? { ...PLAYBOOKS[0], id: 'eigen', name: t.kampagne.name, schritte: [{ text: 'Anlass und Botschaft festlegen', tag: 0 }, { text: 'Personen ansprechen', tag: 2 }, { text: 'Nachfassen', tag: 9 }] };
      const plan = planen(basis, kontakte, crm, localDay(), neueKennung('kp'), h === 'sales' ? 'head-sales' : 'head-marketing');
      const ids = t.kampagne.kontakt_ids.filter(id => kontakte.some(k => k.id === id && !ausgenommen(k)));
      // Zuständig: wer angenommen hat — die Kampagne gehört der Person, die sie führen will.
      await aendereCrm(c => ({ ...c, kampagnen: [...c.kampagnen, { ...plan, name: t.kampagne!.name || plan.name, ziel: t.kampagne!.ziel || plan.ziel, kontaktIds: ids.length ? ids : plan.kontaktIds, notiz: t.begruendung.slice(0, 1000), zustaendig: wer(person) ?? verantwortlich(h), geaendertVon: person }] }));
      wohin = `Kampagnen-Entwurf (${h === 'sales' ? 'Sales' : 'Marketing'} › Kampagnen)`;
    } else if (status === 'angenommen' && t.kontakt_id && t.frist) {
      // Nie still überschreiben (Prüfbericht 27.09., Punkt 17): steht schon ein nächster Schritt, bleibt er — und jede Head-Wirkung
      // steht als Aktivität im Verlauf der Person, damit in der Akte erkennbar ist, dass ein Agent gehandelt hat.
      const lage = { stand: 'nicht-gefunden' as 'gesetzt' | 'schon-da' | 'nicht-gefunden' };
      await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
        const f = cur ?? { kontakte: [] };
        return { ...f, kontakte: f.kontakte.map(k => {
          if (k.id !== t.kontakt_id || ausgenommen(k)) return k;
          if (k.naechsterSchritt && k.naechsterSchritt.datum >= tagVon(jetzt)) { lage.stand = 'schon-da'; return k; }
          lage.stand = 'gesetzt';
          const eintrag = { am: jetzt, art: 'system' as const, von: person, text: `${HEAD_NAME[h]}: nächster Schritt „${t.titel.slice(0, 120)}“ bis ${t.frist} (angenommen)` };
          return { ...k, naechsterSchritt: { text: t.titel.slice(0, 300), datum: t.frist! }, aktivitaeten: [...(k.aktivitaeten ?? []), eintrag], geaendertAm: tagVon(jetzt) };
        }) };
      }, werAus(req));
      wohin = lage.stand === 'gesetzt' ? 'nächster Schritt an der Person' : lage.stand === 'schon-da' ? 'nicht gesetzt — an der Person steht schon ein nächster Schritt (erst erledigen oder unter „Kontakt öffnen“ ändern)' : 'Person nicht gefunden';
    } else if (status === 'angenommen' || status === 'erledigt') {
      // Die Aufgabe bekommt, wer die Beziehung hält — sonst die/der Verantwortliche der Welt (Sales: Kevin, Marketing/Event: Malin).
      const k = t.kontakt_id ? ((await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? []).find(x => x.id === t.kontakt_id) : undefined;
      const fuer = t.fuer ?? (k ? haeltBeziehung(k) : verantwortlich(h));
      const bearbeiter = fuer === BEIDE ? person : fuer;
      // Business-Einheit aus dem Deal/Mandat dahinter (27.09.) — ohne Bezug keine.
      const einheit = status === 'angenommen' && (t.chance_id || t.mandat_id) ? einheitAusBezug(await ladeCrm().catch(() => null), { chanceId: t.chance_id, mandatId: t.mandat_id }) : undefined;
      // Über den Schreibweg (29.09., Paket T1): Zeitstempel, Anlegerin, Verlauf „durch System“ im Auftrag der Person, Serien.
      await systemAufgabenAendern(stand => {
        const da = stand.tasks.find(x => x.id === `hd-${t.id}`);
        if (status === 'erledigt') return da && da.status !== 'done' ? { teile: [{ id: da.id, felder: { status: 'done' } }] } : {};
        if (da) return {};
        return { neu: [{ id: `hd-${t.id}`, title: t.titel.slice(0, 200), description: `Vorschlag des ${HEAD_NAME[h]}: ${t.begruendung}${t.entwurf ? `\n\nEntwurf (${t.entwurf.kanal}):\n${t.entwurf.text}` : ''}${ort(t) ? `\n\n${ort(t)}` : ''}`, status: 'todo', priority: t.prioritaet === 'hoch' ? 'high' : t.prioritaet === 'niedrig' ? 'low' : 'medium', assignee: bearbeiter, tags: [AGENT_ID[h], 'markttraktion'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetzt, updatedAt: jetzt, ...(t.frist ? { dueDate: t.frist } : {}), ...(einheit ? { space: 'business', einheit } : {}) }] };
      }, { person, wer: { art: 'system', person }, jetzt });
      wohin = bearbeiter === person ? 'Aufgabe' : `Aufgabe für ${nameVon(bearbeiter)}`;
    }
    return NextResponse.json({ ok: true, vorschlag: t, wohin });
  }
  return NextResponse.json({ ok: false, fehler: 'aktion: lauf oder entscheiden.' }, { status: 400 });
}
