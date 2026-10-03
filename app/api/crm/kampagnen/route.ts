// ─── CRM — Kampagnen ────────────────────────────────────────────────────────
// GET  → Playbooks (mit Größe der Zielgruppe heute), Kundenprofil, „Kunden wie
//        unsere besten“, Zahlen je Kampagne
// POST { aktion: 'planen', playbook, segmentId? }        → Kampagne als Entwurf
//        (zuständig: wer plant, sofern im Team)
// POST { aktion: 'aufgaben', id }                       → offene Schritte als Aufgaben
//        (für die/den Zuständige/n der Kampagne; bei „beide“ für wen fragt)
// POST { aktion: 'ergebnis', id, kontaktId, ergebnis, von? } → Ergebnis + Verlauf der Person
//        (von = wer angesprochen hat, Team-Kürzel, sonst die angemeldete Person;
//        „chance“ = Interesse: der Lead der Firma (ohne Firma: der Person) geht in die
//        Qualifizierung — ein Deal entsteht erst über Leads › SQL, nie hier)
// Werblicher Kanal (mail, linkedin, newsletter): bei „planen“ kommen Personen mit roter Ampel nicht in die Kampagne, gelbe mit Hinweis (03.10., netz-recht).
// Versendet wird nichts.

import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { NextResponse } from 'next/server';
import { jsonAntwort, unveraendert, etagAus } from '@/lib/http/json-antwort';
import { leereKriterien } from '@/lib/crm/leads';
import { loadJson, updateJson, speicherStand } from '@/lib/store/local-db';
import { aendereKontakte } from '@/lib/crm/kartei-schreiben';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { localDay, tagePlus } from '@/lib/zeit';
import { anzeigename, wendeAktivitaetAn, type Kontakt, type AktivitaetArt } from '@/lib/make-one/crm';
import { ladeCrm, aendereCrm, LISTEN_GRENZEN } from '@/lib/crm/speicher';
import { PLAYBOOKS, planen, zielgruppe, kundenprofil, aehnlicheFirmen, kampagnenZahlen } from '@/lib/crm/kampagnen';
import { kampagnenAmpel } from '@/lib/crm/personen-schranke';
import { bearbeiterFuer } from '@/lib/crm/pipeline';
import { wer, mitglied, nameVon, BEIDE } from '@/lib/crm/team';
import type { Kampagne, KampagnenErgebnis } from '@/lib/crm/typen';
import { personenJeFirma as personenJeFirmaVon } from '@/lib/crm/stationen';
import { ausgenommen } from '@/lib/crm/einschraenkung';
import { notizAnhaengen } from '@/lib/crm/notiz-anhaengen';
import { neueKennung } from '@/lib/kennung';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const kontakteLaden = async () => (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const heute = localDay();
  // ETag aus dem Stand beider Bestände (27.09.): der Abgleich alle 20 s bekommt 304 statt der ganzen Antwort.
  const etag = etagAus('kp', await speicherStand(['crm', 'kontakte', 'crm-scoring']), heute);
  const gleich = unveraendert(req, etag);
  if (gleich) return gleich;
  const kontakte = await kontakteLaden();
  const crm = await ladeCrm();
  const profil = kundenprofil(crm, heute);
  // Personen einer Firma nur über die Stationen (28.09.) — ohne Werbesperre.
  const personenJeFirma = personenJeFirmaVon(kontakte.filter(k => !ausgenommen(k)), { nurAktiv: true });
  return jsonAntwort(req, {
    ok: true, heute,
    playbooks: PLAYBOOKS.map(p => ({ ...p, anzahl: zielgruppe(kontakte, crm, p, heute).length })),
    profil: { kunden: profil.firmen.map(f => ({ id: f.id, name: f.name, branche: f.branche, stadt: f.stadt })), branchen: profil.branchen, staedte: profil.staedte, groesse: profil.groesse, mrrJeKunde: profil.mrrJeKunde },
    aehnliche: aehnlicheFirmen(crm, heute, 15).map(a => ({ id: a.firma.id, name: a.firma.name, branche: a.firma.branche, stadt: a.firma.stadt, punkte: a.punkte, gruende: a.gruende, personen: (personenJeFirma.get(a.firma.id) ?? []).map(k => ({ id: k.id, name: anzeigename(k) })) })),
    zahlen: Object.fromEntries(crm.kampagnen.map(k => [k.id, kampagnenZahlen(k, heute)])),
  }, etag);
}

export async function POST(req: Request) {
  // Person aus dem Zugang (28.09., Regel 5): Sitzung oder Dienstweg MIT Person im Haushalt — kein Rückfall auf „kevin“.
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  let b: { aktion?: string; playbook?: string; segmentId?: string; id?: string; kontaktId?: string; ergebnis?: string; von?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const heute = localDay();
  const person = zugang.person;

  if (b.aktion === 'planen') {
    const kontakte = await kontakteLaden();
    const crm = await ladeCrm();
    const seg = b.segmentId ? crm.segmente.find(s => s.id === b.segmentId) : undefined;
    const pb = PLAYBOOKS.find(p => p.id === b.playbook);
    const basis = pb ?? { id: 'eigen', name: seg ? `Kampagne: ${seg.name}` : 'Eigene Kampagne', kurz: '', warum: '', zielgruppe: seg?.kriterien ?? {}, kanal: 'persoenlich' as const, schritte: [{ text: 'Anlass und Botschaft festlegen', tag: 0 }, { text: 'Personen ansprechen', tag: 2 }, { text: 'Nachfassen', tag: 9 }], kennzahl: 'Gespräche', recht: '', fuer: [] };
    const plan = planen(seg ? { ...basis, zielgruppe: seg.kriterien, zusatz: undefined } : basis, kontakte, crm, heute, neueKennung('kp'), 'hand');
    // Wer plant, ist zuständig (Kevin oder Malin) — umstellen oder übergeben geht in der Kampagne.
    const zst = mitglied(person) ? { zustaendig: person } : {};
    const k0: Kampagne = { ...(seg ? { ...plan, segmentId: seg.id, name: pb ? `${pb.name} · ${seg.name}` : plan.name } : plan), ...zst, geaendertVon: person };
    // Werblicher Kanal (Mail, LinkedIn, Newsletter; 03.10., netz-recht): die Ampel zählt hart — Personen mit roter Ampel kommen nicht in die
    // Kampagne (abmahnfähig, § 7 UWG), Personen mit gelber nur mit Hinweis. Persönlich/Telefon/Event/Mix: unverändert.
    const ampel = kampagnenAmpel(k0.kanal, k0.kontaktIds, kontakte, crm, heute);
    const rot = new Set(ampel.rot.map(x => x.id));
    const k: Kampagne = rot.size ? { ...k0, kontaktIds: k0.kontaktIds.filter(id => !rot.has(id)) } : k0;
    const ampelText = [
      rot.size ? ` ${rot.size === 1 ? 'Eine Person' : `${rot.size} Personen`} mit roter Ampel für ${k.kanal === 'linkedin' ? 'LinkedIn' : 'Mail'} ${rot.size === 1 ? 'wurde' : 'wurden'} nicht aufgenommen (${Array.from(new Set(ampel.rot.map(x => x.grund))).slice(0, 2).join(' · ')}).` : '',
      ampel.gelb.length ? ` ${ampel.gelb.length === 1 ? 'Eine Person hat' : `${ampel.gelb.length} Personen haben`} eine gelbe Ampel — nur persönlich oder nach Klärung, keine Werbung ohne Einwilligung.` : '',
    ].join('');
    // Nie abschneiden (28.09.): die ganze Zielgruppe wird übernommen; über der Grenze → 413 mit Anzahl.
    const max = LISTEN_GRENZEN.kampagnen?.kontaktIds ?? 20000;
    if (k.kontaktIds.length > max) return NextResponse.json({ ok: false, fehler: `Die Zielgruppe hat ${k.kontaktIds.length} Personen — eine Kampagne fasst höchstens ${max}. Bitte das Segment enger fassen.` }, { status: 413 });
    await aendereCrm(c => ({ ...c, kampagnen: [...c.kampagnen, k] }));
    return NextResponse.json({ ok: true, kampagne: k, ...(rot.size ? { abgelehnt: rot.size } : {}), text: `Kampagne mit ${rot.size ? `${k.kontaktIds.length} Personen der Zielgruppe` : `allen ${k.kontaktIds.length} Personen der Zielgruppe`} angelegt — wer nicht dabei sein soll, in der Kampagne herausnehmen.${ampelText}` });
  }

  if (b.aktion === 'aufgaben') {
    const crm = await ladeCrm();
    const k = crm.kampagnen.find(x => x.id === b.id);
    if (!k) return NextResponse.json({ ok: false, fehler: 'Kampagne nicht gefunden.' }, { status: 404 });
    const start = k.start ?? heute;
    const neu = k.schritte.filter(s => !s.erledigt && !s.aufgabeId);
    const jetzt = new Date().toISOString();
    // Die Aufgaben gehen an die Zuständigkeit der Kampagne, nicht an wen gerade klickt.
    const an = bearbeiterFuer(k.zustaendig, 'sales', person);
    await updateJson<{ tasks: Record<string, unknown>[] }>('tasks', cur => {
      const f = cur ?? { tasks: [] };
      const tasks = [...(f.tasks ?? [])];
      for (const s of neu) {
        const id = `kp-${k.id}-${s.id}`;
        if (tasks.some(t => t.id === id)) continue;
        tasks.push({ id, title: `${s.text} — ${k.name}`.slice(0, 200), description: `Schritt der Kampagne „${k.name}“ (${k.kontaktIds.length} Personen).${an !== person ? ` Angelegt von ${nameVon(person)}.` : ''} Versand und Ansprache bleiben bei dir.`, status: 'todo', priority: 'medium', assignee: an, tags: ['crm', 'kampagne'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetzt, updatedAt: jetzt, dueDate: tagePlus(start, s.tag) });
      }
      return { ...f, tasks };
    });
    await aendereCrm(c => ({ ...c, kampagnen: c.kampagnen.map(x => (x.id === k.id ? { ...x, schritte: x.schritte.map(s => (neu.some(n => n.id === s.id) ? { ...s, aufgabeId: `kp-${k.id}-${s.id}` } : s)), geaendert: jetzt, geaendertVon: person } : x)) }));
    return NextResponse.json({ ok: true, angelegt: neu.length, an });
  }

  if (b.aktion === 'ergebnis') {
    const ERG: KampagnenErgebnis[] = ['angesprochen', 'reagiert', 'gespraech', 'chance', 'kein_interesse'];
    const erg = ERG.includes(b.ergebnis as KampagnenErgebnis) ? (b.ergebnis as KampagnenErgebnis) : null;
    const crm = await ladeCrm();
    const k = crm.kampagnen.find(x => x.id === b.id);
    if (!k || !erg || !b.kontaktId) return NextResponse.json({ ok: false, fehler: 'id, kontaktId und ergebnis nötig.' }, { status: 400 });
    // Wer angesprochen hat: ein Team-Kürzel (nicht „beide“), sonst die angemeldete Person.
    const gesagt = wer(b.von);
    const von = gesagt && gesagt !== BEIDE ? gesagt : person;
    const kanalArt: AktivitaetArt = k.kanal === 'telefon' ? 'anruf' : k.kanal === 'mail' ? 'mail' : k.kanal === 'linkedin' ? 'linkedin' : k.kanal === 'event' ? 'event' : 'notiz';
    const art: AktivitaetArt = erg === 'angesprochen' ? kanalArt : erg === 'reagiert' ? 'antwort' : erg === 'gespraech' || erg === 'chance' ? 'gespraech' : 'notiz';
    const text = `Kampagne „${k.name}“: ${({ angesprochen: 'angesprochen', reagiert: 'hat reagiert', gespraech: 'Gespräch', chance: 'Chance entstanden', kein_interesse: 'kein Interesse' } as const)[erg]}`;
    let kontakt: Kontakt | null = null;
    let eingeschraenkt = false;
    await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
      const f = cur ?? { kontakte: [] };
      const i = f.kontakte.findIndex(x => x.id === b.kontaktId);
      if (i < 0) return f;
      // Art. 18 (U2): an einer eingeschränkten Person wird nichts festgehalten.
      if (f.kontakte[i].eingeschraenkt) { eingeschraenkt = true; return f; }
      kontakt = wendeAktivitaetAn(f.kontakte[i], { art, text, von, bezug: k.id }, heute, new Date().toISOString(), tagePlus);
      f.kontakte[i] = kontakt;
      return f;
    }, werAus(req));
    const kt = kontakt as Kontakt | null;
    if (eingeschraenkt) return NextResponse.json({ ok: false, fehler: 'Verarbeitung der Person ist eingeschränkt (Art. 18) — kein Ergebnis festgehalten.' }, { status: 409 });
    if (!kt) return NextResponse.json({ ok: false, fehler: 'Person nicht gefunden.' }, { status: 404 });
    const jetzt = new Date().toISOString();
    const vermerk = `Interesse aus Kampagne „${k.name}“ (${heute})`;
    // Lead-Notiz nie still kürzen (28.09.): passt der Vermerk nicht mehr hinein, bleibt die Notiz, wie sie ist — mit Hinweis.
    let hinweis: string | undefined;
    await aendereCrm(c => {
      const neu = { ...c, kampagnen: c.kampagnen.map(x => (x.id === k.id ? { ...x, ergebnisse: [...x.ergebnisse, { kontaktId: kt.id, ergebnis: erg, am: heute, von }], status: x.status === 'entwurf' ? 'aktiv' as const : x.status, geaendert: jetzt, geaendertVon: person } : x)) };
      // Ebene 1 (25.09.): „Interesse“ aus einer Kampagne ist noch kein Deal — der Lead der Firma geht in die Qualifizierung.
      if (erg === 'chance' && kt.firmaId) neu.firmen = c.firmen.map(f => {
        if (f.id !== kt.firmaId || ['sql', 'kunde'].includes(f.lead?.status ?? '')) return f;
        const n = notizAnhaengen(f.lead?.notiz, vermerk);
        if (!n.ok) hinweis = n.hinweis;
        return { ...f, lead: { ...(f.lead ?? { kriterien: leereKriterien() }), status: 'qualifizierung' as const, ...(n.notiz ? { notiz: n.notiz } : {}), geaendert: jetzt, geaendertVon: person } };
      });
      return neu;
    });
    // Ohne Firma liegt der Lead an der Person — die vorhandene Notiz bleibt (vorher wurde sie ersetzt).
    if (erg === 'chance' && !kt.firmaId && !['sql', 'kunde'].includes(kt.lead?.status ?? '')) {
      await aendereKontakte<{ kontakte: Kontakt[] }>(cur => ({ ...(cur ?? { kontakte: [] }), kontakte: (cur?.kontakte ?? []).map(x => {
        if (x.id !== kt.id || x.eingeschraenkt) return x;
        const n = notizAnhaengen(x.lead?.notiz, vermerk);
        if (!n.ok) hinweis = n.hinweis;
        return { ...x, lead: { ...(x.lead ?? { kriterien: leereKriterien() }), status: 'qualifizierung' as const, ...(n.notiz ? { notiz: n.notiz } : {}), geaendert: jetzt, geaendertVon: person } };
      }) }), werAus(req));
    }
    return NextResponse.json({ ok: true, ...(hinweis ? { hinweis } : {}) });
  }
  return NextResponse.json({ ok: false, fehler: 'aktion unbekannt.' }, { status: 400 });
}
