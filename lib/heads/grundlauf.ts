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

import { localDay } from '@/lib/zeit';
import { montagVon } from '@/lib/zeit/kalender-kern';
import { anzahl } from '@/lib/text/zahlwort';
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
  const heute = String((daten.meta as { heute?: string } | undefined)?.heute ?? localDay());
  const vs: Vorschlag[] = [];
  const befunde: Antwort['befunde'] = [];
  const luecken: string[] = [];

  if (head === 'sales' && modus === 'power_hour') {
    const karten = (daten.karten as Karte[] | undefined) ?? [];
    const ART: Record<string, string> = { versprechen: 'nachfassen', signale: 'nachfassen', chancen: 'angebot_nachfassen', kunden: 'review_ansetzen', pflege: 'anrufen', neu: 'intro_erbitten' };
    const VERB: Record<string, string> = { versprechen: 'Zusage einlösen', signale: 'Antworten', chancen: 'Deal bewegen', kunden: 'Kunde', pflege: 'Melden', neu: 'Erstkontakt' };
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

  if (head === 'sales' && modus === 'lead_review') {
    type LeadD = { lead_id: string; name: string; status: string; sql_bereit: boolean; sql_entscheidung_offen?: boolean; fehlt: string[]; geklaert: number; deal: { offen: boolean } | null; letzter_kontakt: string | null; hauptkontakt: P | null };
    const ls = (daten.leads_in_arbeit as LeadD[] | undefined) ?? [];
    const FRAGE: Record<string, string> = { Schmerz: 'Welches Problem kostet sie heute Geld oder Zeit?', Entscheider: 'Wer entscheidet und zahlt — sprechen wir mit ihr oder ihm?', 'Budget oder Zeitpunkt': 'Bis wann muss es gelöst sein, und gibt es einen Rahmen?' };
    ls.forEach((l, i) => {
      if (vs.length >= 5 || !l.hauptkontakt) return;
      // „Zum SQL machen“ nur, wenn die SQL-Entscheidung wirklich offen ist (17.10., L2 B5: `sqlEntscheidungOffen`, wie die Runde — ein Lead
      // mit entschiedenem Deal bekommt keinen zweiten). Ältere Datenpakete (Evals) ohne das Feld: wie bisher.
      if (l.sql_entscheidung_offen ?? (l.sql_bereit && !l.deal?.offen)) vs.push(v({ art: 'sql_anlegen', titel: `Zum SQL machen: ${kurz(l.name, 60)} — Deal anlegen`, kontakt_id: l.hauptkontakt.id, frist: heute, prioritaet: 'mittel',
        // 2.6 (08.10.): die SQL-Regel steht in den Scoring-Einstellungen (Muss-Kriterien + Sales-Schwelle), nicht fest im Text.
        signal: { typ: 'chance', datum: l.letzter_kontakt, text: 'Muss-Kriterien und Sales-Schwelle erreicht' }, begruendung: `Alle SQL-Kriterien sind geklärt, aber es gibt noch keinen Deal — ohne Deal fehlt er in Pipeline und Prognose.`, dedup_schluessel: `sql:${l.lead_id}`, quelle: [`leads_in_arbeit[${i}]`] }));
      else if (l.fehlt.length) vs.push(v({ art: 'qualifizierung_klaeren', titel: `${l.fehlt[0]} klären: ${kurz(l.name, 60)}`, kontakt_id: l.hauptkontakt.id, frist: tagPlus(heute, 3), prioritaet: l.status === 'qualifizierung' ? 'mittel' : 'niedrig',
        signal: { typ: 'pflege', datum: l.letzter_kontakt, text: `${l.geklaert} von 6 geklärt` }, begruendung: `Bis zum SQL fehlt: ${l.fehlt.join(', ')}. Frage im nächsten Gespräch: „${FRAGE[l.fehlt[0]] ?? l.fehlt[0]}“`, dedup_schluessel: `quali:${l.lead_id}:${l.fehlt[0]}`, quelle: [`leads_in_arbeit[${i}].fehlt`] }));
    });
    if (!ls.length) luecken.push('Keine Leads in Arbeit — neue kommen aus der Power Hour, aus Events und Kampagnen.');
  }

  if (head === 'sales' && modus === 'deal_review') {
    const chancen = (daten.chancen as ChanceD[] | undefined) ?? [];
    chancen.forEach((c, i) => {
      if (vs.length >= 5) return;
      const p = c.personen[0];
      const fehlend = Object.entries(c.qualifizierung ?? {}).filter(([, w]) => w === 'unklar').map(([k]) => k);
      if (!c.naechster_schritt) vs.push(v({ art: 'qualifizierung_klaeren', titel: `Nächsten Schritt mit Datum festlegen: ${kurz(c.titel, 60)}`, chance_id: c.id, kontakt_id: p?.id ?? null, frist: tagPlus(heute, 2), prioritaet: c.wert_gesamt >= 10000 ? 'hoch' : 'mittel', signal: { typ: 'chance', datum: null, text: 'kein nächster Schritt mit Datum' },
        begruendung: `Ohne nächsten Schritt mit Datum verliert sich der Deal (${c.stufe ?? '—'}, ${c.wert_gesamt} € gesamt).${fehlend.length ? ` Offen in der Qualifizierung: ${fehlend.slice(0, 3).join(', ')}.` : ''}${c.signale?.negativ.length ? ` Signale: ${c.signale.negativ.slice(0, 2).join('; ')}.` : ''}`, dedup_schluessel: `schritt:${c.id}`, quelle: [`chancen[${i}].naechster_schritt`] }));
      else if (c.ampel?.ampel === 'rot') vs.push(v({ art: c.stufe === 'Angebot' ? 'angebot_nachfassen' : 'qualifizierung_klaeren', titel: `Hängt: ${kurz(c.titel, 70)}`, chance_id: c.id, kontakt_id: p?.id ?? null, frist: tagPlus(heute, 1), prioritaet: 'hoch', signal: { typ: c.naechster_schritt.datum < heute ? 'zusage' : 'chance', datum: c.naechster_schritt.datum, text: kurz(c.ampel.gruende[0], 90) },
        begruendung: `${c.ampel.gruende.slice(0, 2).join('; ')}. Nächster Schritt war: ${kurz(c.naechster_schritt.text, 80)}.`, dedup_schluessel: `haengt:${c.id}`, quelle: [`chancen[${i}].ampel`] }));
      else if (c.entscheidung_bis && c.entscheidung_bis <= tagPlus(heute, 7)) vs.push(v({ art: 'angebot_nachfassen', titel: `Entscheidung bis ${c.entscheidung_bis} absichern: ${kurz(c.titel, 50)}`, chance_id: c.id, kontakt_id: p?.id ?? null, frist: tagPlus(heute, 1), prioritaet: 'hoch', signal: { typ: 'frist', datum: c.entscheidung_bis, text: 'Entscheidung erwartet' },
        begruendung: `Die Entscheidung ist für ${c.entscheidung_bis} erwartet — offene Einwände und den Entscheider jetzt klären.${fehlend.length ? ` Unklar: ${fehlend.slice(0, 3).join(', ')}.` : ''}`, dedup_schluessel: `entscheidung:${c.id}`, quelle: [`chancen[${i}].entscheidung_bis`] }));
    });
    if (!chancen.length) luecken.push('Kein offener Deal — Leads im Gespräch qualifizieren (Ebene 1), SQL-bereite als Deal anlegen, sonst fehlen sie in der Prognose.');
  }

  if (head === 'sales' && modus === 'kundenreview') {
    const mandate = (daten.mandate as MandatD[] | undefined) ?? [];
    mandate.forEach((m, i) => {
      if (vs.length >= 5 || m.status !== 'aktiv') return;
      const p = m.ansprechpartner[0];
      if (m.lage.kuendigungIn !== null && m.lage.kuendigungIn <= 90) vs.push(v({ art: 'verlaengerung_ansprechen', titel: `Verlängerung ansprechen: ${kurz(m.kunde, 60)}`, mandat_id: m.id, kontakt_id: p?.id ?? null, frist: m.lage.fristBis && m.lage.fristBis > heute ? m.lage.fristBis : tagPlus(heute, 3), prioritaet: m.lage.kuendigungIn < 30 ? 'hoch' : 'mittel', signal: { typ: 'frist', datum: m.lage.endeAm, text: 'Laufzeitende' },
        begruendung: m.lage.kuendigungIn < 0 ? `Laufzeit seit ${-m.lage.kuendigungIn} Tagen vorbei — verlängern oder sauber abschließen.` : `Laufzeit endet in ${m.lage.kuendigungIn} Tagen — Wirkung zeigen, dann Verlängerung besprechen.`, dedup_schluessel: `verlaengerung:${m.id}`, quelle: [`mandate[${i}].lage`] }));
      else if (m.lage.ampel === 'rot' || m.lage.ampel === 'gelb') vs.push(v({ art: 'review_ansetzen', titel: `Review ansetzen: ${kurz(m.kunde, 60)}`, mandat_id: m.id, kontakt_id: p?.id ?? null, frist: tagPlus(heute, 7), prioritaet: m.lage.ampel === 'rot' ? 'hoch' : 'mittel', signal: { typ: 'kunde', datum: null, text: `Gesundheit ${m.lage.ampel}` },
        begruendung: `Gesundheit ${m.lage.ampel}: ${m.lage.gruende.slice(0, 2).join('; ') || 'Bewertung fehlt'}.`, dedup_schluessel: `review:${m.id}`, quelle: [`mandate[${i}].lage`] }));
      const offen = m.offene_punkte.filter(Boolean);
      if (offen.length) befunde.push({ titel: `${m.kunde}: ${anzahl(offen.length, 'offener Punkt', 'offene Punkte')}`, text: kurz(offen[0], 160), quelle: [`mandate[${i}].offene_punkte`] });
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
    // 02.11. (M2 K3): das beste Playbook nach ZIELEN (Personen + Betriebe ohne Person; ältere Datenpakete ohne `ziele_anzahl`: die Personen) — und
    // nie eins, das schon eine laufende Kampagne hat (die wird weiterverwendet; Befund statt zweiter Kampagne).
    type PbD = { id: string; name: string; warum: string; zielgruppe_anzahl: number; ziele_anzahl?: number; firmen_anzahl?: number; laufend?: { id: string; name: string; status: string } | null; zielgruppe: P[] };
    const pbs = (daten.playbooks as PbD[] | undefined) ?? [];
    const ziele = (p: PbD) => p.ziele_anzahl ?? p.zielgruppe_anzahl;
    const kandidaten = [...pbs].filter(p => ziele(p) > 0).sort((a, b) => ziele(b) - ziele(a));
    const bestes = kandidaten.find(p => !p.laufend);
    const vorn = kandidaten[0];
    if (vorn?.laufend && vorn !== bestes) befunde.push({ titel: `„${vorn.name}“ läuft schon`, text: `Die Kampagne „${kurz(vorn.laufend.name, 60)}“ (${vorn.laufend.status === 'aktiv' ? 'aktiv' : 'Entwurf'}) nutzt dieses Vorgehen — dort weiterarbeiten statt eine zweite anzulegen.`, quelle: [`playbooks[${pbs.indexOf(vorn)}].laufend`] });
    if (bestes) {
      const i = pbs.indexOf(bestes);
      const firmen = bestes.firmen_anzahl ?? 0;
      vs.push(v({ art: 'kampagne_planen', titel: `Kampagne „${bestes.name}“ planen`, prioritaet: 'mittel', frist: tagPlus(heute, 7),
        begruendung: `${kurz(bestes.warum, 200)} Heute passen ${anzahl(bestes.zielgruppe_anzahl, 'Person', 'Personen')}${firmen ? ` und ${anzahl(firmen, 'Betrieb', 'Betriebe')} ohne Person` : ''}.`, dedup_schluessel: `kampagne:${bestes.id}`, quelle: [`playbooks[${i}]`],
        kampagne: { playbook: bestes.id, name: bestes.name, ziel: 'Gespräche aus bestehenden Beziehungen', kontakt_ids: bestes.zielgruppe.slice(0, 15).map(p => p.id) } }));
    } else if (!vorn) luecken.push('Für kein bewährtes Vorgehen gibt es heute eine Zielgruppe — Kreise und Lebensphasen in der Kartei pflegen.');
  }

  if (head === 'marketing' && (modus === 'wochenplan' || modus === 'monatsreview')) {
    // Reihenfolge (02.11., M2): Pflichten und Wartendes vor neuem Inhalt — Art. 14, offene Antworten, Mail-Stapel, Kommentare/DMs, Social-Plan,
    // Homepage-Funde; dann Themen aus der Kundenstimme. Wiederkehrende Hinweise tragen Tag bzw. Woche im dedup_schluessel (sonst kämen sie
    // nach einmal Annehmen nie wieder — lib/heads/stand.ts `mischen`).
    const woche = montagVon(heute);
    const a14 = (daten.art14_faellig as (P & { tage: number })[] | undefined) ?? [];
    a14.slice(0, 2).forEach((p, i) => vs.push(v({ art: 'info_art14_nachholen', titel: `Art. 14 nachholen: ${wer(p)}`, kontakt_id: p.id, frist: heute, prioritaet: 'hoch', signal: { typ: 'pflicht', datum: null, text: 'Art.-14-Frist' }, begruendung: `Daten stammen nicht von der Person, seit ${p.tage} Tagen nicht informiert — die Frist ist ein Monat.`, dedup_schluessel: `art14:${p.id}`, quelle: [`art14_faellig[${i}]`] })));

    type StapelD = { wartet_freigabe: number; freigegeben: number; fehler: number; antworten_offen: number; je_kampagne: { kampagne_id: string; name: string; wartet_freigabe: number; antworten_offen: number }[] };
    const st = daten.mail_stapel as StapelD | null | undefined;
    const kampagnenText = (f: (k: StapelD['je_kampagne'][number]) => number) => { const l = (st?.je_kampagne ?? []).filter(k => f(k) > 0); return l.length ? ` Kampagnen: ${l.slice(0, 3).map(k => kurz(k.name, 40)).join(', ')}.` : ''; };
    if (st?.antworten_offen) vs.push(v({ art: 'antworten_bearbeiten', titel: `${anzahl(st.antworten_offen, 'Antwort', 'Antworten')} auf Kampagnen-Mails bearbeiten`, frist: heute, prioritaet: 'hoch',
      signal: { typ: 'antwort', datum: heute, text: 'Antworten auf Kampagnen-Mails offen' },
      begruendung: `${anzahl(st.antworten_offen, 'Antwort', 'Antworten')} auf Kampagnen-Mails ${st.antworten_offen === 1 ? 'wartet' : 'warten'} — die Sequenz ist gestoppt, das Follow-up „Antwort bearbeiten“ steht an. Wer schnell antwortet, bekommt das Gespräch.${kampagnenText(k => k.antworten_offen)}`,
      dedup_schluessel: `antworten:${heute}`, quelle: ['mail_stapel.antworten_offen'] }));
    if (st?.wartet_freigabe) vs.push(v({ art: 'stapel_freigeben', titel: `Mail-Stapel prüfen: ${anzahl(st.wartet_freigabe, 'Entwurf wartet', 'Entwürfe warten')} auf Freigabe`, frist: heute, prioritaet: 'mittel',
      signal: { typ: 'kampagne', datum: heute, text: 'Entwürfe im Mail-Stapel' },
      begruendung: `Der Kampagnen-Motor hat ${anzahl(st.wartet_freigabe, 'Mail', 'Mails')} vorbereitet — gesendet wird erst nach eurer Freigabe, bis dahin steht die Sequenz.${kampagnenText(k => k.wartet_freigabe)}`,
      dedup_schluessel: `stapel:${woche}`, quelle: ['mail_stapel.wartet_freigabe'] }));
    if (st?.fehler) befunde.push({ titel: 'Mail-Stapel: Fehler beim Versand', text: `${anzahl(st.fehler, 'Mail ist', 'Mails sind')} mit Fehler oder ungeklärt — im Mail-Stapel ansehen, nie doppelt senden.`, quelle: ['mail_stapel.fehler'] });

    type SocialD = { kanaele: { id: string; name: string; aktiv: boolean; luecken_7_tage: number; geplant_7_tage: number; wartet_freigabe: number; offene_kommentare: number; offene_dms: number }[] };
    const kanaele = (daten.social as SocialD | null | undefined)?.kanaele ?? [];
    const offenKom = kanaele.reduce((a, k) => a + k.offene_kommentare, 0), offenDm = kanaele.reduce((a, k) => a + k.offene_dms, 0);
    if (offenKom + offenDm) vs.push(v({ art: 'community_beantworten', titel: `Social: ${[offenKom ? anzahl(offenKom, 'Kommentar', 'Kommentare') : '', offenDm ? anzahl(offenDm, 'Nachricht', 'Nachrichten') : ''].filter(Boolean).join(' und ')} beantworten`, frist: heute, prioritaet: 'mittel',
      signal: { typ: 'antwort', datum: heute, text: 'offene Kommentare/Nachrichten' },
      begruendung: `Auf ${kanaele.filter(k => k.offene_kommentare || k.offene_dms).map(k => kurz(k.name, 30)).slice(0, 3).join(', ')} warten Menschen auf eine Antwort — eine Antwort am selben Tag zählt mehr als ein neuer Beitrag.`,
      dedup_schluessel: `community:${heute}`, quelle: kanaele.map((k, i) => (k.offene_kommentare || k.offene_dms ? `social.kanaele[${i}]` : '')).filter(Boolean).slice(0, 3) }));
    kanaele.map((k, i) => ({ k, i })).filter(x => x.k.aktiv && x.k.luecken_7_tage > 0).slice(0, 2).forEach(({ k, i }) => vs.push(v({ art: 'social_planen', titel: `Social-Lücke diese Woche: ${kurz(k.name, 40)} — ${anzahl(k.luecken_7_tage, 'freier Platz', 'freie Plätze')}`, frist: tagPlus(heute, 1), prioritaet: 'mittel',
      signal: { typ: 'frist', datum: tagPlus(heute, 6), text: 'Redaktionsplan der nächsten 7 Tage' },
      begruendung: `Im Plan von ${kurz(k.name, 40)} ${k.luecken_7_tage === 1 ? 'ist ein Platz' : `sind ${k.luecken_7_tage} Plätze`} der nächsten sieben Tage frei${k.geplant_7_tage ? `, ${k.geplant_7_tage} geplant` : ', nichts geplant'}${k.wartet_freigabe ? `; ${anzahl(k.wartet_freigabe, 'Entwurf wartet', 'Entwürfe warten')} auf Freigabe` : ''}. Regelmäßigkeit trägt den Kanal.`,
      dedup_schluessel: `social:${k.id}:${woche}`, quelle: [`social.kanaele[${i}].luecken_7_tage`] })));

    const fu = daten.funde as { neu: number; vorbereitet: number } | null | undefined;
    if (fu?.vorbereitet) vs.push(v({ art: 'funde_pruefen', titel: `Homepage-Funde: ${anzahl(fu.vorbereitet, 'Betrieb', 'Betriebe')} vorbereitet — prüfen`, frist: tagPlus(heute, 2), prioritaet: 'mittel',
      begruendung: `Der Abendlauf hat ${anzahl(fu.vorbereitet, 'Betrieb', 'Betriebe')} mit Befund vorbereitet; erst nach eurer Prüfung gehen sie in den Mail-Stapel.${fu.neu ? ` Dazu ${fu.neu} neu gefunden.` : ''}`,
      dedup_schluessel: `funde:${woche}`, quelle: ['funde.vorbereitet'] }));

    const web = daten.website as { eingaenge_30_tage: { anfragen: number; davon_checks: number; termine: number }; wege_aus: string[] } | null | undefined;
    if (web?.wege_aus.length) befunde.push({ titel: 'Website: Wege nicht vollständig', text: web.wege_aus.slice(0, 4).join(' · '), quelle: ['website.wege_aus'] });
    if (web && (web.eingaenge_30_tage.anfragen || web.eingaenge_30_tage.termine)) befunde.push({ titel: 'Website · 30 Tage', text: `${anzahl(web.eingaenge_30_tage.anfragen, 'Anfrage', 'Anfragen')} (davon ${web.eingaenge_30_tage.davon_checks} aus Checks), ${anzahl(web.eingaenge_30_tage.termine, 'Termin', 'Termine')} gebucht.`, quelle: ['website.eingaenge_30_tage'] });

    // Kundenstimme → Idee (W2, 02.11.): was schon im Redaktionsplan steht (`uebernommen`), kommt nicht noch einmal; angenommen wird daraus eine
    // Idee in derselben Form wie „Als Idee übernehmen“ (`inhalt`: Titel, Text ohne Namen, Quelle = Kennung der Person).
    const stimmen = (daten.stimme_der_kunden as { kontakt_id: string; am: string; bedarf?: string; idee_titel?: string; uebernommen?: boolean }[] | undefined) ?? [];
    const gesehen = new Set<string>();
    let themen = 0;
    stimmen.forEach((s, i) => {
      if (themen >= 3 || !s.bedarf || s.uebernommen) return;
      const schluessel = s.bedarf.toLowerCase().slice(0, 40);
      if (gesehen.has(schluessel)) return; gesehen.add(schluessel);
      themen++;
      vs.push(v({ art: 'beitrag_entwurf', titel: `Beitrag aus Kundenstimme: ${kurz(s.bedarf, 60)}`, frist: tagPlus(heute, 5), prioritaet: 'mittel', signal: { typ: 'stimme', datum: s.am, text: 'Bedarf aus einem Kundengespräch' },
        begruendung: `Aus einem Gespräch vom ${s.am}: „${kurz(s.bedarf, 120)}“ — echte Kundenprobleme mit eigener Einsicht beantworten; die Person bleibt ungenannt.`, dedup_schluessel: `beitrag:${schluessel}`, quelle: [`stimme_der_kunden[${i}]`],
        inhalt: { titel: s.idee_titel ?? kurz(s.bedarf, 120), text: `Aus einem Kundengespräch (${s.am}): „${kurz(s.bedarf, 1500)}“`, quellen: [s.kontakt_id] } }));
    });
    const kz = (daten.kennzahlen as { label: string; wert: string; ampel: string; ziel: string }[] | undefined) ?? [];
    for (const k of kz.filter(x => x.ampel === 'rot')) befunde.push({ titel: k.label, text: `${k.wert} — Ziel ${k.ziel}.`, quelle: ['kennzahlen'] });
    if (!stimmen.length) luecken.push('Keine Kundenstimme in den Gesprächsnotizen — nach Gesprächen „Bedarf / Schmerz“ ausfüllen, daraus entstehen die Themen.');
    else if (!themen && stimmen.every(s => s.uebernommen)) befunde.push({ titel: 'Kundenstimmen schon im Plan', text: 'Alle jüngsten Kundenstimmen stehen schon als Idee im Redaktionsplan — dort weiterschreiben.', quelle: ['stimme_der_kunden'] });
  }

  // LinkedIn-Netzwerk (25.09.): je Profil der Tag in der Vernetzen-Runde — Annahmen zuerst, dann die Portion, dann anreichern.
  if (head === 'marketing' && modus === 'netzwerk') {
    type NetzD = { profil: string; name: string; zahlen: { schreiben: number; nachfassen: number; anfragen: number; restHeute: number; anreichern: number; zurueckziehen: number; warten: number; vernetzt: number }; als_naechstes: { name: string; stufe: string }[] };
    const nz = (daten.netzwerk as NetzD[] | undefined) ?? [];
    nz.forEach((n, i) => {
      const z = n.zahlen;
      const namen = (stufe: string) => n.als_naechstes.filter(x => x.stufe === stufe).slice(0, 3).map(x => x.name).join(', ');
      if (z.schreiben) vs.push(v({ art: 'vernetzen_runde', titel: `LinkedIn: ${z.schreiben} Annahme${z.schreiben === 1 ? '' : 'n'} — Nachricht schreiben (${n.name})`, frist: heute, prioritaet: 'mittel', fuer: n.profil,
        begruendung: `${z.schreiben} ${z.schreiben === 1 ? 'Person hat' : 'Personen haben'} die Vernetzung mit ${n.name} angenommen und ${z.schreiben === 1 ? 'wartet' : 'warten'} auf eine Nachricht${namen('schreiben') ? ` (${namen('schreiben')})` : ''} — solange die Annahme frisch ist, wird gelesen.`,
        dedup_schluessel: `netz:schreiben:${n.profil}:${heute}`, quelle: [`netzwerk[${i}].zahlen.schreiben`] }));
      if (z.nachfassen) vs.push(v({ art: 'vernetzen_runde', titel: `LinkedIn: ${z.nachfassen}× nachfassen (${n.name})`, frist: heute, prioritaet: 'mittel', fuer: n.profil,
        begruendung: `Nach der Nachricht kam bei ${z.nachfassen} ${z.nachfassen === 1 ? 'Person' : 'Personen'} keine Reaktion — Antwort festhalten oder anrufen.`, dedup_schluessel: `netz:nachfassen:${n.profil}:${heute}`, quelle: [`netzwerk[${i}].zahlen.nachfassen`] }));
      const portion = Math.min(z.restHeute, z.anfragen);
      if (portion) vs.push(v({ art: 'vernetzen_runde', titel: `Vernetzen heute: ${portion} Anfrage${portion === 1 ? '' : 'n'} (${n.name})`, frist: heute, prioritaet: 'mittel', fuer: n.profil,
        begruendung: `${z.anfragen} Personen mit Profil sind noch nicht mit ${n.name} vernetzt — die Tagesportion hält das LinkedIn-Wochenlimit ein${namen('anfragen') ? `; zuerst ${namen('anfragen')}` : ''}.`,
        dedup_schluessel: `netz:anfragen:${n.profil}:${heute}`, quelle: [`netzwerk[${i}].zahlen.restHeute`, `netzwerk[${i}].zahlen.anfragen`] }));
      if (z.anreichern >= 20) vs.push(v({ art: 'vernetzen_runde', titel: `Profile anreichern: ${z.anreichern} ohne LinkedIn (${n.name})`, frist: tagPlus(heute, 3), prioritaet: 'niedrig', fuer: n.profil,
        begruendung: `${z.anreichern} Personen haben kein LinkedIn-Profil — den eigenen LinkedIn-Export (Connections.csv) in der Vernetzen-Runde importieren, der Rest über den Suchlink.`,
        dedup_schluessel: `netz:anreichern:${n.profil}:${heute.slice(0, 7)}`, quelle: [`netzwerk[${i}].zahlen.anreichern`] }));
      if (z.zurueckziehen) vs.push(v({ art: 'vernetzen_runde', titel: `${z.zurueckziehen} alte Anfrage${z.zurueckziehen === 1 ? '' : 'n'} zurückziehen (${n.name})`, frist: tagPlus(heute, 7), prioritaet: 'niedrig', fuer: n.profil,
        begruendung: 'Offene Anfragen älter als 21 Tage zählen gegen das LinkedIn-Limit — zurückziehen und die Person auf anderem Weg ansprechen.', dedup_schluessel: `netz:zurueck:${n.profil}:${heute.slice(0, 7)}`, quelle: [`netzwerk[${i}].zahlen.zurueckziehen`] }));
    });
    if (!nz.some(n => n.zahlen.vernetzt || n.zahlen.warten)) luecken.push('Noch niemand als vernetzt erfasst — den LinkedIn-Export importieren, dann stimmt der Stand.');
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
