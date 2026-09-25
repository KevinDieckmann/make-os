// ─── Grundlauf der Heads — Vorschläge aus Regeln, ohne Modell (rein, getestet) ─
// Kevin (25.09.): „Das muss wirklich sehr smart laufen.“ Die besten Agenten
// verlassen sich nicht allein auf das Modell: deterministische Regeln liefern
// das Gerüst, das Modell prüft, ergänzt, priorisiert und formuliert
// (Evaluator-Optimizer-Muster). Deshalb:
//   1. Ohne Modell (kein Schlüssel, Guthaben leer, Ausfall) liefert der Head
//      trotzdem belegte Vorschläge — gekennzeichnet als „Regelwerk“.
//   2. Mit Modell gehen dieselben Vorschläge als <grundlauf> ins Datenpaket:
//      das Modell übernimmt, verwirft (mit Grund) oder ergänzt sie.
// Jeder Vorschlag trägt Quelle (Pfad im Datenpaket), Frist und dedup_schluessel
// wie ein Modell-Vorschlag — der Prüfer behandelt beide gleich.

import type { Antwort, Vorschlag } from './pruefer';
import type { HeadId } from './prompt';

type P = { id: string; name: string; firma?: string; kanal_erlaubt: string[]; anrede?: string; letzter_kontakt?: string; naechster_schritt?: { text: string; datum: string } | null; verlauf?: { am: string; art: string; bedarf?: string; zusage?: string }[] };
type Karte = P & { kategorie: string; gruende: string[] };
type ChanceD = { id: string; titel: string; firma?: string; stufe?: string; wert_gesamt: number; ampel: { ampel: string; gruende: string[] }; naechster_schritt: { text: string; datum: string } | null; qualifizierung: Record<string, string>; entscheidung_bis: string | null; personen: P[]; signale?: { luecken: string[]; positiv: string[]; negativ: string[] } };
type MandatD = { id: string; kunde: string; titel?: string; status: string; lage: { kuendigungIn: number | null; ampel: string | null; gruende: string[]; fristBis: string | null; endeAm: string | null }; offene_punkte: (string | undefined)[]; ansprechpartner: P[] };
type EventD = { id: string; titel: string; datum: string; status: string; ziel_hinweis: string | null; mischung: { ampel: string | null; fehlen: { zielkunden: number; kunden: number }; hinweis: string }; checkliste: { ueberfaellig: number; naechste: { text: string; faelligAm: string; ueberfaellig: boolean }[] }; nachfassen_bis: string; nachfassen_rest_stunden: number; gaeste: (P & { status: string; nachgefasst: string | null; notiz_vom_abend?: string })[] };

const tagPlus = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const kurz = (t: string | undefined, n: number) => { const s = (t ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const wer = (p: Pick<P, 'name' | 'firma'>) => `${p.name}${p.firma ? ` (${kurz(p.firma, 40)})` : ''}`;
const bester = (p: P) => (['telefon', 'persoenlich', 'mail', 'linkedin', 'vernetzen'].find(k => p.kanal_erlaubt.includes(k)) ?? 'persoenlich');
const KANAL_TEXT: Record<string, string> = { telefon: 'anrufen', mail: 'per Mail', linkedin: 'über LinkedIn', vernetzen: 'vernetzen (ohne Werbung)', persoenlich: 'persönlich', newsletter: 'Newsletter', einladung: 'Einladung' };

function v(x: Partial<Vorschlag> & Pick<Vorschlag, 'art' | 'titel' | 'begruendung' | 'dedup_schluessel' | 'quelle'>): Vorschlag {
  return { kontakt_id: null, chance_id: null, mandat_id: null, event_id: null, frist: null, prioritaet: 'mittel', entwurf: null, kampagne: null, ...x };
}

export interface Grundlauf { antwort: Antwort; regeln: number }

/** Der Grundlauf eines Heads für einen Modus — aus dem Datenpaket, das auch das Modell sieht. */
export function grundlauf(head: HeadId, modus: string, daten: Record<string, unknown>): Grundlauf {
  const heute = String((daten.meta as { heute?: string } | undefined)?.heute ?? new Date().toISOString().slice(0, 10));
  const vs: Vorschlag[] = [];
  const befunde: Antwort['befunde'] = [];
  const luecken: string[] = [];

  if (head === 'sales' && modus === 'power_hour') {
    const karten = (daten.karten as Karte[] | undefined) ?? [];
    const ART: Record<string, string> = { versprechen: 'nachfassen', signale: 'nachfassen', chancen: 'angebot_nachfassen', kunden: 'review_ansetzen', pflege: 'anrufen', neu: 'intro_erbitten' };
    const VERB: Record<string, string> = { versprechen: 'Zusage einlösen', signale: 'Antworten', chancen: 'Chance bewegen', kunden: 'Kunde', pflege: 'Melden', neu: 'Erstkontakt' };
    const signal = (c: Karte): Vorschlag['signal'] => {
      const antwort = [...(c.verlauf ?? [])].reverse().find(x => x.art === 'antwort');
      if (c.kategorie === 'versprechen') return { typ: 'zusage', datum: c.naechster_schritt?.datum ?? heute, text: kurz(c.gruende[0], 90) };
      if (c.kategorie === 'signale') return { typ: 'antwort', datum: antwort?.am ?? heute, text: 'wartet auf Antwort' };
      if (c.kategorie === 'chancen') return { typ: 'chance', datum: null, text: kurz(c.gruende[0], 90) };
      if (c.kategorie === 'kunden') return { typ: 'kunde', datum: null, text: kurz(c.gruende[0], 90) };
      if (c.kategorie === 'pflege') return { typ: 'pflege', datum: c.letzter_kontakt ?? null, text: kurz(c.gruende[0], 90) };
      return { typ: 'sonstiges', datum: null, text: kurz(c.gruende[0], 90) };
    };
    karten.slice(0, 5).forEach((c, i) => {
      const kanal = bester(c);
      const art = c.kategorie === 'neu' && kanal === 'telefon' ? 'anrufen' : ART[c.kategorie] ?? 'anrufen';
      vs.push(v({ art, titel: `${VERB[c.kategorie] ?? 'Melden'}: ${wer(c)}`, kontakt_id: c.id, frist: heute, signal: signal(c),
        prioritaet: c.kategorie === 'versprechen' || c.kategorie === 'signale' ? 'hoch' : c.kategorie === 'neu' || c.kategorie === 'pflege' ? 'niedrig' : 'mittel',
        begruendung: `${c.gruende.slice(0, 2).join('; ')}. Weg: ${KANAL_TEXT[kanal] ?? kanal}.`, dedup_schluessel: `${art}:${c.id}`, quelle: [`karten[${i}]`] }));
    });
    const zahl = (k: string) => karten.filter(c => c.kategorie === k).length;
    if (karten.length) befunde.push({ titel: 'Schwerpunkt heute', text: zahl('versprechen') ? `${zahl('versprechen')} Zusage(n) zuerst — eine gebrochene Zusage kostet mehr als ein neuer Kontakt bringt.` : zahl('signale') ? `${zahl('signale')} Person(en) warten auf Antwort.` : `Pflege und neue Kontakte — ${karten.length} Karten.`, quelle: ['karten'] });
  }

  if (head === 'sales' && modus === 'deal_review') {
    const chancen = (daten.chancen as ChanceD[] | undefined) ?? [];
    chancen.forEach((c, i) => {
      if (vs.length >= 5) return;
      const p = c.personen[0];
      const fehlend = Object.entries(c.qualifizierung ?? {}).filter(([, w]) => w === 'unklar').map(([k]) => k);
      if (!c.naechster_schritt) vs.push(v({ art: 'qualifizierung_klaeren', titel: `Nächsten Schritt mit Datum festlegen: ${kurz(c.titel, 60)}`, chance_id: c.id, kontakt_id: p?.id ?? null, frist: tagPlus(heute, 2), prioritaet: c.wert_gesamt >= 10000 ? 'hoch' : 'mittel', signal: { typ: 'chance', datum: null, text: 'kein nächster Schritt mit Datum' },
        begruendung: `Ohne nächsten Schritt mit Datum verliert sich die Chance (${c.stufe ?? '—'}, ${c.wert_gesamt} € gesamt).${fehlend.length ? ` Offen in der Qualifizierung: ${fehlend.slice(0, 3).join(', ')}.` : ''}${c.signale?.negativ.length ? ` Signale: ${c.signale.negativ.slice(0, 2).join('; ')}.` : ''}`, dedup_schluessel: `schritt:${c.id}`, quelle: [`chancen[${i}].naechster_schritt`] }));
      else if (c.ampel?.ampel === 'rot') vs.push(v({ art: c.stufe === 'Angebot' ? 'angebot_nachfassen' : 'qualifizierung_klaeren', titel: `Hängt: ${kurz(c.titel, 70)}`, chance_id: c.id, kontakt_id: p?.id ?? null, frist: tagPlus(heute, 1), prioritaet: 'hoch', signal: { typ: c.naechster_schritt.datum < heute ? 'zusage' : 'chance', datum: c.naechster_schritt.datum, text: kurz(c.ampel.gruende[0], 90) },
        begruendung: `${c.ampel.gruende.slice(0, 2).join('; ')}. Nächster Schritt war: ${kurz(c.naechster_schritt.text, 80)}.`, dedup_schluessel: `haengt:${c.id}`, quelle: [`chancen[${i}].ampel`] }));
      else if (c.entscheidung_bis && c.entscheidung_bis <= tagPlus(heute, 7)) vs.push(v({ art: 'angebot_nachfassen', titel: `Entscheidung bis ${c.entscheidung_bis} absichern: ${kurz(c.titel, 50)}`, chance_id: c.id, kontakt_id: p?.id ?? null, frist: tagPlus(heute, 1), prioritaet: 'hoch', signal: { typ: 'frist', datum: c.entscheidung_bis, text: 'Entscheidung erwartet' },
        begruendung: `Die Entscheidung ist für ${c.entscheidung_bis} erwartet — offene Einwände und den Entscheider jetzt klären.${fehlend.length ? ` Unklar: ${fehlend.slice(0, 3).join(', ')}.` : ''}`, dedup_schluessel: `entscheidung:${c.id}`, quelle: [`chancen[${i}].entscheidung_bis`] }));
    });
    if (!chancen.length) luecken.push('Keine offene Chance — Gespräche mit Bedarf als Chance anlegen, sonst fehlen sie in der Prognose.');
  }

  if (head === 'sales' && modus === 'kundenreview') {
    const mandate = (daten.mandate as MandatD[] | undefined) ?? [];
    mandate.forEach((m, i) => {
      if (vs.length >= 5 || m.status !== 'aktiv') return;
      const p = m.ansprechpartner[0];
      if (m.lage.kuendigungIn !== null && m.lage.kuendigungIn <= 90) vs.push(v({ art: 'verlaengerung_ansprechen', titel: `Verlängerung ansprechen: ${kurz(m.kunde, 60)}`, mandat_id: m.id, kontakt_id: p?.id ?? null, frist: m.lage.fristBis && m.lage.fristBis > heute ? m.lage.fristBis : tagPlus(heute, 3), prioritaet: m.lage.kuendigungIn < 30 ? 'hoch' : 'mittel', signal: { typ: 'frist', datum: m.lage.endeAm, text: 'Laufzeitende' },
        begruendung: m.lage.kuendigungIn < 0 ? `Laufzeit seit ${-m.lage.kuendigungIn} Tagen vorbei — verlängern oder sauber abschließen.` : `Laufzeit endet in ${m.lage.kuendigungIn} Tagen — Wirkung zeigen, dann Verlängerung besprechen.`, dedup_schluessel: `verlaengerung:${m.id}`, quelle: [`mandate[${i}].lage`] }));
      else if (m.lage.ampel === 'rot' || m.lage.ampel === 'gelb') vs.push(v({ art: 'review_ansetzen', titel: `Review ansetzen: ${kurz(m.kunde, 60)}`, mandat_id: m.id, kontakt_id: p?.id ?? null, frist: tagPlus(heute, 7), prioritaet: m.lage.ampel === 'rot' ? 'hoch' : 'mittel', signal: { typ: 'kunde', datum: null, text: `Health ${m.lage.ampel}` },
        begruendung: `Health ${m.lage.ampel}: ${m.lage.gruende.slice(0, 2).join('; ') || 'Bewertung fehlt'}.`, dedup_schluessel: `review:${m.id}`, quelle: [`mandate[${i}].lage`] }));
      const offen = m.offene_punkte.filter(Boolean);
      if (offen.length) befunde.push({ titel: `${m.kunde}: ${offen.length} offene Punkte`, text: kurz(offen[0], 160), quelle: [`mandate[${i}].offene_punkte`] });
    });
    const kz = daten.konzentration as { kunde: string; anteil: number } | null | undefined;
    if (kz && kz.anteil > 50) befunde.push({ titel: 'Kundenkonzentration', text: `${kz.kunde} trägt ${kz.anteil} % des wiederkehrenden Umsatzes — Neugeschäft hat Vorrang.`, quelle: ['konzentration'] });
  }

  if (head === 'sales' && modus === 'wochenreview') {
    const ph = (daten.power_hours_4_wochen as { datum: string; gespraeche: number }[] | undefined) ?? [];
    const woche = ph.filter(x => x.datum >= tagPlus(heute, -6));
    befunde.push({ titel: 'Power Hours diese Woche', text: `${woche.length} Power Hour(s), ${woche.reduce((a, x) => a + x.gespraeche, 0)} Gespräche. Ziel: 4 je Woche, 8 echte Gespräche.`, quelle: ['power_hours_4_wochen'] });
    if (woche.length < 4) vs.push(v({ art: 'anrufen', titel: 'Power Hours für nächste Woche blocken', frist: tagPlus(heute, 3), prioritaet: 'mittel', begruendung: `Nur ${woche.length} von 4 Power Hours diese Woche — Rhythmus schlägt Motivation: feste Blöcke Mo–Do im Kalender.`, dedup_schluessel: 'rhythmus:power_hour', quelle: ['power_hours_4_wochen'] }));
  }

  if ((head === 'sales' || head === 'marketing') && modus === 'kampagne') {
    const pbs = (daten.playbooks as { id: string; name: string; warum: string; zielgruppe_anzahl: number; zielgruppe: P[] }[] | undefined) ?? [];
    const bestes = [...pbs].filter(p => p.zielgruppe_anzahl > 0).sort((a, b) => b.zielgruppe_anzahl - a.zielgruppe_anzahl)[0];
    if (bestes) {
      const i = pbs.indexOf(bestes);
      vs.push(v({ art: 'kampagne_planen', titel: `Kampagne „${bestes.name}“ planen`, prioritaet: 'mittel', frist: tagPlus(heute, 7),
        begruendung: `${kurz(bestes.warum, 200)} Heute passen ${bestes.zielgruppe_anzahl} Personen.`, dedup_schluessel: `kampagne:${bestes.id}`, quelle: [`playbooks[${i}]`],
        kampagne: { playbook: bestes.id, name: bestes.name, ziel: 'Gespräche aus bestehenden Beziehungen', kontakt_ids: bestes.zielgruppe.slice(0, 15).map(p => p.id) } }));
    } else luecken.push('Für kein bewährtes Vorgehen gibt es heute eine Zielgruppe — Kreise und Lebensphasen in der Kartei pflegen.');
  }

  if (head === 'marketing' && (modus === 'wochenplan' || modus === 'monatsreview')) {
    const stimmen = (daten.stimme_der_kunden as { kontakt_id: string; am: string; bedarf?: string }[] | undefined) ?? [];
    const gesehen = new Set<string>();
    stimmen.forEach((s, i) => {
      if (vs.length >= 3 || !s.bedarf) return;
      const schluessel = s.bedarf.toLowerCase().slice(0, 40);
      if (gesehen.has(schluessel)) return; gesehen.add(schluessel);
      vs.push(v({ art: 'beitrag_entwurf', titel: `Beitrag aus Kundenstimme: ${kurz(s.bedarf, 60)}`, frist: tagPlus(heute, 5), prioritaet: 'mittel', signal: { typ: 'stimme', datum: s.am, text: 'Bedarf aus einem Kundengespräch' },
        begruendung: `Aus einem Gespräch vom ${s.am}: „${kurz(s.bedarf, 120)}“ — echte Kundenprobleme mit eigener Einsicht beantworten; die Person bleibt ungenannt.`, dedup_schluessel: `beitrag:${schluessel}`, quelle: [`stimme_der_kunden[${i}]`] }));
    });
    const a14 = (daten.art14_faellig as (P & { tage: number })[] | undefined) ?? [];
    a14.slice(0, 2).forEach((p, i) => vs.push(v({ art: 'info_art14_nachholen', titel: `Art. 14 nachholen: ${wer(p)}`, kontakt_id: p.id, frist: heute, prioritaet: 'hoch', signal: { typ: 'pflicht', datum: null, text: 'Art.-14-Frist' }, begruendung: `Daten stammen nicht von der Person, seit ${p.tage} Tagen nicht informiert — die Frist ist ein Monat.`, dedup_schluessel: `art14:${p.id}`, quelle: [`art14_faellig[${i}]`] })));
    const kz = (daten.kennzahlen as { label: string; wert: string; ampel: string; ziel: string }[] | undefined) ?? [];
    for (const k of kz.filter(x => x.ampel === 'rot')) befunde.push({ titel: k.label, text: `${k.wert} — Ziel ${k.ziel}.`, quelle: ['kennzahlen'] });
    if (!stimmen.length) luecken.push('Keine Kundenstimme in den Gesprächsnotizen — nach Gesprächen „Bedarf / Schmerz“ ausfüllen, daraus entstehen die Themen.');
  }

  if (head === 'event') {
    const events = (daten.events as EventD[] | undefined) ?? [];
    events.forEach((e, i) => {
      const kommend = e.datum >= heute;
      if (modus === 'planung' && kommend) {
        if (e.ziel_hinweis) vs.push(v({ art: 'ziel_schaerfen', titel: `Ziel schärfen: ${kurz(e.titel, 60)}`, event_id: e.id, frist: tagPlus(heute, 2), prioritaet: 'mittel', signal: { typ: 'frist', datum: e.datum, text: 'Event-Termin' }, begruendung: e.ziel_hinweis, dedup_schluessel: `ziel:${e.id}`, quelle: [`events[${i}].ziel_hinweis`] }));
        if (e.mischung.ampel === 'rot' || e.mischung.ampel === 'gelb') vs.push(v({ art: 'einladen', titel: `Gästemischung auffüllen: ${kurz(e.titel, 50)}`, event_id: e.id, frist: tagPlus(heute, 3), prioritaet: e.mischung.ampel === 'rot' ? 'hoch' : 'mittel', signal: { typ: 'frist', datum: e.datum, text: 'Event-Termin' }, begruendung: `${e.mischung.hinweis} Es fehlen ${e.mischung.fehlen.zielkunden} Zielkunden und ${e.mischung.fehlen.kunden} Kunden/Multiplikatoren.`, dedup_schluessel: `mischung:${e.id}`, quelle: [`events[${i}].mischung`] }));
        if (e.checkliste.ueberfaellig) befunde.push({ titel: `${e.titel}: ${e.checkliste.ueberfaellig} Punkt(e) überfällig`, text: e.checkliste.naechste.filter(n => n.ueberfaellig).map(n => n.text).join(' · '), quelle: [`events[${i}].checkliste`] });
      }
      if (modus === 'nachfassen' && !kommend) {
        e.gaeste.forEach((g, j) => {
          if (vs.length >= 5 || g.status !== 'da' || g.nachgefasst) return;
          vs.push(v({ art: 'nachfassen', titel: `Nachfassen: ${wer(g)}`, kontakt_id: g.id, event_id: e.id, frist: e.nachfassen_bis >= heute ? e.nachfassen_bis : heute, prioritaet: e.nachfassen_rest_stunden <= 24 ? 'hoch' : 'mittel', signal: { typ: 'event', datum: e.datum, text: `war bei „${kurz(e.titel, 40)}“` },
            begruendung: `War bei „${kurz(e.titel, 40)}“.${g.notiz_vom_abend ? ` Notiz vom Abend: ${kurz(g.notiz_vom_abend, 120)}` : ' Ohne Notiz vom Abend — kurz nachfragen, was hängen blieb.'} Weg: ${KANAL_TEXT[bester(g)] ?? bester(g)}.`, dedup_schluessel: `nachfassen:${e.id}:${g.id}`, quelle: [`events[${i}].gaeste[${j}]`] }));
        });
      }
    });
    if (modus === 'einladung') {
      const kand = (daten.kandidaten as (P & { gruende?: string[]; einladungsweg?: string })[] | undefined) ?? [];
      const ev = String(daten.naechstes_event ?? '') || null;
      kand.slice(0, 5).forEach((p, i) => vs.push(v({ art: 'einladen', titel: `Einladen: ${wer(p)}`, kontakt_id: p.id, event_id: ev, frist: tagPlus(heute, 3), prioritaet: 'mittel', begruendung: `${(p.gruende ?? []).slice(0, 2).join('; ') || 'passt zur Zielgruppe'}. Weg: ${KANAL_TEXT[p.einladungsweg ?? bester(p)] ?? p.einladungsweg}.`, dedup_schluessel: `einladen:${ev}:${p.id}`, quelle: [`kandidaten[${i}]`] })));
    }
    if (!events.length) luecken.push('Kein Event angelegt.');
  }

  const status: Antwort['status'] = vs.some(x => x.prioritaet === 'hoch') ? 'handeln' : vs.length ? 'beobachten' : 'ruhig';
  const zusammenfassung = vs.length
    ? `Regelwerk: ${vs.length === 1 ? 'ein Vorschlag' : `${vs.length} Vorschläge`} — zuerst „${vs[0].titel}“.`
    : 'Regelwerk: nichts Dringendes.';
  return { antwort: { status, zusammenfassung, befunde: befunde.slice(0, 6), vorschlaege: vs.slice(0, 5), fragen: [], datenluecken: luecken, antwort: '' }, regeln: vs.length };
}
