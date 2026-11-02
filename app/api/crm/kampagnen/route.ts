// ─── CRM — Kampagnen ────────────────────────────────────────────────────────
// GET  → Playbooks (mit Größe der Zielgruppe heute), Kundenprofil, „Kunden wie
//        unsere besten“, Zahlen je Kampagne
// POST { aktion: 'planen', playbook, segmentId? }        → Kampagne als Entwurf
//        (zuständig: wer plant, sofern im Team)
// POST { aktion: 'aufgaben', id }                       → offene Schritte als Aufgaben
//        (für die/den Zuständige/n der Kampagne; bei „beide“ für wen fragt) — seit 08.10. (Woche 2 · 5.8) über den EINEN
//        Server-Schreibweg `systemAufgabenAendern` (Verlauf, Glocke, Protokoll), Welt der Kampagne aus dem Playbook (6.6)
// `playbook: 'eigen'` ohne Segment (5.6): eine leere eigene Kampagne — Personen kommen über die Suche dazu.
// POST { aktion: 'ergebnis', id, kontaktId | firmaId, ergebnis, von? } → Ergebnis + Verlauf der Person bzw. Ergebnis am Betrieb (M1, 01.11.;
//        eine Stelle: lib/crm/kampagnen-ergebnis.ts)
//        (von = wer angesprochen hat, Team-Kürzel, sonst die angemeldete Person;
//        „chance“ = Interesse: der Lead der Firma (ohne Firma: der Person) geht in die
//        Qualifizierung — ein Deal entsteht erst über Leads › SQL, nie hier)
// Werblicher Kanal (mail, linkedin, newsletter): bei „planen“ kommen Personen mit roter Ampel nicht in die Kampagne, gelbe mit Hinweis (03.10., netz-recht).
// Betriebe ohne Person (M1, 01.11.): „planen“ nimmt sie aus dem Segment mit (`zielgruppeFirmen` = `segmentFirmen`), mit der Firmen-Ampel
// (`kampagnenFirmenAmpel`) — rot nicht, gelb mit Hinweis.
// Versendet wird nichts.

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { NextResponse } from 'next/server';
import { jsonAntwort, unveraendert, etagAus } from '@/lib/http/json-antwort';
import { loadJson, speicherStand } from '@/lib/store/local-db';
import { systemAufgabenAendern } from '@/lib/aufgaben/system-schreiben';
import { BUSINESS_VORGABE_SPACE } from '@/lib/einheiten';
import { weltDerKampagne } from '@/lib/crm/kampagnen-welt';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { localDay, tagePlus } from '@/lib/zeit';
import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import { ladeCrm, aendereCrm, LISTEN_GRENZEN } from '@/lib/crm/speicher';
import { planen, zielgruppe, zielgruppeFirmen, kampagnenFirmenAmpel, kundenprofil, aehnlicheFirmen, kampagnenZahlen } from '@/lib/crm/kampagnen';
import { ergebnisFesthalten, KAMPAGNEN_ERGEBNISSE } from '@/lib/crm/kampagnen-ergebnis';
// Restpunkte (24.10.): die Playbooks des Haushalts (Vorgaben mit Abweichungen + eigene) — EINE Lesestelle, nie `PLAYBOOKS` direkt.
import { playbooksDesHaushalts, vorlagenBestandName, vorlagenHaushalt } from '@/lib/crm/vorlagen-anpassung-server';
import { playbookHinweise } from '@/lib/crm/vorlagen-regeln';
import { kampagnenAmpel } from '@/lib/crm/personen-schranke';
import { bearbeiterFuer } from '@/lib/crm/pipeline';
import { wer, mitglied, nameVon, BEIDE } from '@/lib/crm/team';
import type { Kampagne, KampagnenErgebnis } from '@/lib/crm/typen';
import { personenJeFirma as personenJeFirmaVon } from '@/lib/crm/stationen';
import { ausgenommen } from '@/lib/crm/einschraenkung';
import { neueKennung } from '@/lib/kennung';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const kontakteLaden = async () => (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const heute = localDay();
  // ETag aus dem Stand beider Bestände (27.09.): der Abgleich alle 20 s bekommt 304 statt der ganzen Antwort.
  const etag = etagAus('kp', await speicherStand(['crm', 'kontakte', 'crm-scoring', vorlagenBestandName('playbook', await vorlagenHaushalt())]), heute);
  const gleich = unveraendert(req, etag);
  if (gleich) return gleich;
  const kontakte = await kontakteLaden();
  const crm = await ladeCrm();
  const profil = kundenprofil(crm, heute);
  // Personen einer Firma nur über die Stationen (28.09.) — ohne Werbesperre.
  const personenJeFirma = personenJeFirmaVon(kontakte.filter(k => !ausgenommen(k)), { nurAktiv: true });
  return jsonAntwort(req, {
    ok: true, heute,
    playbooks: (await playbooksDesHaushalts()).map(p => {
      const h = playbookHinweise(p);
      return { ...p, anzahl: zielgruppe(kontakte, crm, p, heute).length, ...(h.length ? { hinweise: h } : {}) };
    }),
    profil: { kunden: profil.firmen.map(f => ({ id: f.id, name: f.name, branche: f.branche, stadt: f.stadt })), branchen: profil.branchen, staedte: profil.staedte, groesse: profil.groesse, mrrJeKunde: profil.mrrJeKunde },
    aehnliche: aehnlicheFirmen(crm, heute, 15).map(a => ({ id: a.firma.id, name: a.firma.name, branche: a.firma.branche, stadt: a.firma.stadt, punkte: a.punkte, gruende: a.gruende, personen: (personenJeFirma.get(a.firma.id) ?? []).map(k => ({ id: k.id, name: anzeigename(k) })) })),
    zahlen: Object.fromEntries(crm.kampagnen.map(k => [k.id, kampagnenZahlen(k, heute)])),
  }, etag);
}

export async function POST(req: Request) {
  // Person aus dem Zugang (28.09., Regel 5): Sitzung oder Dienstweg MIT Person im Haushalt — kein Rückfall auf „kevin“.
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  let b: { aktion?: string; playbook?: string; segmentId?: string; id?: string; kontaktId?: string; firmaId?: string; ergebnis?: string; von?: string };
  try { b = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const heute = localDay();
  const person = zugang.person;

  if (b.aktion === 'planen') {
    const kontakte = await kontakteLaden();
    const crm = await ladeCrm();
    const seg = b.segmentId ? crm.segmente.find(s => s.id === b.segmentId) : undefined;
    const pb = (await playbooksDesHaushalts()).find(p => p.id === b.playbook);
    const basis = pb ?? { id: 'eigen', name: seg ? `Kampagne: ${seg.name}` : 'Eigene Kampagne', kurz: '', warum: '', zielgruppe: seg?.kriterien ?? {}, kanal: 'persoenlich' as const, schritte: [{ text: 'Anlass und Botschaft festlegen', tag: 0 }, { text: 'Personen ansprechen', tag: 2 }, { text: 'Nachfassen', tag: 9 }], kennzahl: 'Gespräche', recht: '', fuer: [] };
    // Ein gewähltes Segment ersetzt auch den Segment-Vorschlag des Playbooks.
    const quelle = seg ? { ...basis, zielgruppe: seg.kriterien, zusatz: undefined, segmentId: undefined } : basis;
    const plan0 = planen(quelle, kontakte, crm, heute, neueKennung('kp'), 'hand');
    // 5.6 (08.10.): „Eigene Kampagne“ ohne Segment ist leer — nie die ganze Kartei (leere Kriterien träfen alle).
    const leer = !pb && !seg;
    // M1 (01.11.): die Betriebe ohne Person der Zielgruppe kommen mit — mit der Firmen-Ampel (rot nicht, gelb mit Hinweis).
    const betriebe = leer ? [] : zielgruppeFirmen(kontakte, crm, quelle, heute);
    const fAmpel = kampagnenFirmenAmpel(plan0.kanal, betriebe, crm);
    const fRot = new Set(fAmpel.rot.map(x => x.id));
    const firmaIds = betriebe.map(f => f.id).filter(id => !fRot.has(id));
    const plan = { ...(leer ? { ...plan0, kontaktIds: [] } : plan0), ...(firmaIds.length ? { firmaIds } : {}) };
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
      fRot.size ? ` ${fRot.size === 1 ? 'Ein Betrieb' : `${fRot.size} Betriebe`} mit roter Ampel für ${k.kanal === 'linkedin' ? 'LinkedIn' : 'Mail'} ${fRot.size === 1 ? 'wurde' : 'wurden'} nicht aufgenommen (${Array.from(new Set(fAmpel.rot.map(x => x.grund))).slice(0, 2).join(' · ')}) — Brief, Besuch oder eine Person der Firma.` : '',
      fAmpel.gelb.length ? ` ${fAmpel.gelb.length === 1 ? 'Ein Betrieb hat' : `${fAmpel.gelb.length} Betriebe haben`} eine gelbe Ampel — nur persönlich oder nach Klärung.` : '',
    ].join('');
    // Nie abschneiden (28.09.): die ganze Zielgruppe wird übernommen; über der Grenze → 413 mit Anzahl.
    const max = LISTEN_GRENZEN.kampagnen?.kontaktIds ?? 20000;
    if (k.kontaktIds.length > max) return NextResponse.json({ ok: false, fehler: `Die Zielgruppe hat ${k.kontaktIds.length} Personen — eine Kampagne fasst höchstens ${max}. Bitte das Segment enger fassen.` }, { status: 413 });
    if ((k.firmaIds ?? []).length > max) return NextResponse.json({ ok: false, fehler: `Die Zielgruppe hat ${(k.firmaIds ?? []).length} Betriebe — eine Kampagne fasst höchstens ${max}. Bitte das Segment enger fassen.` }, { status: 413 });
    await aendereCrm(c => ({ ...c, kampagnen: [...c.kampagnen, k] }));
    const nF = (k.firmaIds ?? []).length;
    const wen = `${rot.size ? `${k.kontaktIds.length} Personen der Zielgruppe` : `allen ${k.kontaktIds.length} Personen der Zielgruppe`}${nF ? ` und ${nF === 1 ? 'einem Betrieb' : `${nF} Betrieben`} ohne Person` : ''}`;
    // `hinweis` (08.10., 5.2): der Ampel-Teil allein — die Oberfläche zeigt ihn, statt ihn zu verschlucken.
    return NextResponse.json({ ok: true, kampagne: k, ...(rot.size || fRot.size ? { abgelehnt: rot.size + fRot.size } : {}), ...(ampelText.trim() ? { hinweis: ampelText.trim() } : {}), text: `Kampagne mit ${wen} angelegt — wer nicht dabei sein soll, in der Kampagne herausnehmen.${ampelText}` });
  }

  if (b.aktion === 'aufgaben') {
    const crm = await ladeCrm();
    const k = crm.kampagnen.find(x => x.id === b.id);
    if (!k) return NextResponse.json({ ok: false, fehler: 'Kampagne nicht gefunden.' }, { status: 404 });
    const start = k.start ?? heute;
    const neu = k.schritte.filter(s => !s.erledigt && !s.aufgabeId);
    const jetzt = new Date().toISOString();
    // Die Aufgaben gehen an die Zuständigkeit der Kampagne (Welt nach Playbook, 6.6), nicht an wen gerade klickt.
    const an = bearbeiterFuer(k.zustaendig, weltDerKampagne(k), person);
    // 5.8 (08.10.): über den EINEN Server-Schreibweg — Verlauf, Glocke an die Zuständige, Protokoll; vorher `updateJson('tasks')` direkt.
    const r = await systemAufgabenAendern(stand => {
      const da = new Set(stand.tasks.map(t => t.id));
      return { neu: neu.filter(s => !da.has(`kp-${k.id}-${s.id}`)).map(s => ({
        id: `kp-${k.id}-${s.id}`, title: `${s.text} — ${k.name}`.slice(0, 200), description: `Schritt der Kampagne „${k.name}“ (${k.kontaktIds.length} Personen).${an !== person ? ` Angelegt von ${nameVon(person)}.` : ''} Versand und Ansprache bleiben bei dir.`,
        status: 'todo', priority: 'medium', assignee: an, tags: ['crm', 'kampagne'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetzt, updatedAt: jetzt, dueDate: tagePlus(start, s.tag),
        space: 'business', spaceId: BUSINESS_VORGABE_SPACE,
      })) };
    }, { person, jetzt });
    if (!r.ok) return NextResponse.json({ ok: false, fehler: r.fehler ?? 'Aufgaben nicht angelegt.' }, { status: r.status });
    await aendereCrm(c => ({ ...c, kampagnen: c.kampagnen.map(x => (x.id === k.id ? { ...x, schritte: x.schritte.map(s => (neu.some(n => n.id === s.id) ? { ...s, aufgabeId: `kp-${k.id}-${s.id}` } : s)), geaendert: jetzt, geaendertVon: person } : x)) }));
    return NextResponse.json({ ok: true, angelegt: neu.length, an });
  }

  if (b.aktion === 'ergebnis') {
    const erg = KAMPAGNEN_ERGEBNISSE.includes(b.ergebnis as KampagnenErgebnis) ? (b.ergebnis as KampagnenErgebnis) : null;
    const ziel = typeof b.kontaktId === 'string' && b.kontaktId ? { art: 'kontakt' as const, id: b.kontaktId } : typeof b.firmaId === 'string' && b.firmaId ? { art: 'firma' as const, id: b.firmaId } : null;
    if (!b.id || !erg || !ziel) return NextResponse.json({ ok: false, fehler: 'id, kontaktId bzw. firmaId und ergebnis nötig.' }, { status: 400 });
    // Wer angesprochen hat: ein Team-Kürzel (nicht „beide“), sonst die angemeldete Person.
    const gesagt = wer(b.von);
    const von = gesagt && gesagt !== BEIDE ? gesagt : person;
    const r = await ergebnisFesthalten({ kampagneId: b.id, ziel, ergebnis: erg, von, person, wer: werAus(req), heute });
    return NextResponse.json(r.body, { status: r.status });
  }
  return NextResponse.json({ ok: false, fehler: 'aktion unbekannt.' }, { status: 400 });
}
