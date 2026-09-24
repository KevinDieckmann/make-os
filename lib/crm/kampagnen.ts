// ─── CRM — Kampagnen nach bewährtem Vorgehen (rein, getestet) ──────────────
// Kevin, 24.09.: „Wenn wir in das Thema Kampagnen gehen, müssen wir immer
// wieder auf Best Practice zurückgreifen und neue Kampagnen planen können auf
// Basis der Kunden, die wir haben — und das muss der Head of Marketing genauso
// wie der Head of Sales ausführen können.“
// Deshalb: Playbooks als Daten (warum es wirkt, Zielgruppe, Kanal, Schritte,
// Rechtshinweis), ein Kundenprofil aus den echten Mandaten und „Kunden wie
// unsere besten“ (ähnliche Firmen in der Kartei). Versendet wird nichts —
// Schritte werden Aufgaben, Ergebnisse landen im Verlauf der Person.

import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand, Firma, Kampagne, SegmentKriterien } from './typen';
import { mandatLage } from './kunden';
import { kontextAus, segmentAuswerten } from './segmente';
import { firmenSchluessel } from './firmen';

export interface Playbook {
  id: string; name: string; kurz: string;
  /** Warum es wirkt — die Begründung aus der Praxis. */
  warum: string;
  zielgruppe: SegmentKriterien;
  /** Zusätzlicher Filter, den Kriterien allein nicht ausdrücken (z. B. Health grün). */
  zusatz?: 'health_gruen' | 'laufzeit_90' | 'lookalike';
  kanal: Kampagne['kanal'];
  schritte: { text: string; tag: number }[];
  kennzahl: string;
  recht: string;
  fuer: ('head-sales' | 'head-marketing')[];
}

export const PLAYBOOKS: Playbook[] = [
  {
    id: 'empfehlung', name: 'Empfehlungen aus dem Bestand', kurz: 'Zufriedene Kunden und Multiplikatoren um ein Intro bitten',
    warum: 'Empfehlungen sind in der Beratung die Quelle mit der höchsten Abschlussquote; ein Intro mit doppelter Zustimmung (erst die Zielperson fragen) schützt beide Seiten.',
    zielgruppe: { lebensphase: ['kunde', 'multiplikator', 'partner'] }, zusatz: 'health_gruen', kanal: 'persoenlich',
    schritte: [{ text: 'Liste: wen kennt die Person, der zu unserem Zielbild passt?', tag: 0 }, { text: 'Im nächsten Termin konkret um ein Intro bitten (Name nennen)', tag: 3 }, { text: 'Intro-Text zum Weiterleiten schicken, erst nach Zusage der Zielperson', tag: 5 }, { text: 'Danke sagen, egal wie es ausgeht', tag: 14 }],
    kennzahl: 'Intros je angesprochener Person', recht: 'Keine „Empfehlungs-Mails“ an Dritte aus dem System (BGH I ZR 208/12) — der Vermittler fragt selbst.', fuer: ['head-sales', 'head-marketing'],
  },
  {
    id: 'reaktivierung', name: 'Reaktivierung', kurz: 'Kreis A/B und Ex-Kunden, die still geworden sind',
    warum: 'Menschen, die uns kennen, reagieren um ein Vielfaches häufiger als Kaltkontakte; ein konkreter Anlass (Neuigkeit, Artikel, Einladung) macht den Kontakt natürlich.',
    zielgruppe: { kreis: ['A', 'B'], ohneKontaktSeitTagen: 90 }, kanal: 'telefon',
    schritte: [{ text: 'Je Person einen echten Anlass notieren (Neuigkeit, Glückwunsch, Frage)', tag: 0 }, { text: 'Anrufen oder persönlich schreiben — ein Anliegen, kein Pitch', tag: 2 }, { text: 'Bei Interesse: Termin; sonst in 90 Tagen wieder', tag: 7 }],
    kennzahl: 'Gespräche je Versuch', recht: 'Anruf nur mit Anlass aus der Beziehung (mutmaßliche Einwilligung); Mail nur mit Einwilligung oder als Bestandskunde.', fuer: ['head-sales'],
  },
  {
    id: 'lookalike', name: 'Kunden wie unsere besten', kurz: 'Firmen, die unseren besten Mandanten ähneln',
    warum: 'Die ähnlichsten Firmen zu den besten Kunden haben den gleichen Schmerz; mit Referenz aus derselben Branche ist der Einstieg glaubwürdiger.',
    zielgruppe: { firmaRolle: ['zielkunde', 'offen'] }, zusatz: 'lookalike', kanal: 'linkedin',
    schritte: [{ text: 'Top 10 ähnliche Firmen prüfen, Entscheider benennen', tag: 0 }, { text: 'Warm-Intro über gemeinsame Kontakte suchen', tag: 2 }, { text: 'Sonst: Vernetzen ohne Werbebotschaft, dann Inhalt teilen', tag: 5 }, { text: 'Nach Reaktion: Gespräch anbieten mit Branchenreferenz', tag: 14 }],
    kennzahl: 'Erstgespräche aus der Liste', recht: 'LinkedIn-Nachrichten zählen als elektronische Post — ohne Einwilligung nur Vernetzen.', fuer: ['head-marketing', 'head-sales'],
  },
  {
    id: 'fallstudie', name: 'Fallstudie & Referenz', kurz: 'Erfolge sichtbar machen — mit Freigabe',
    warum: 'Ein konkretes Ergebnis mit Namen überzeugt stärker als jede Behauptung; die Anfrage stärkt zugleich die Kundenbeziehung.',
    zielgruppe: { lebensphase: ['kunde'] }, zusatz: 'health_gruen', kanal: 'persoenlich',
    schritte: [{ text: 'Ergebnis mit Zahlen aus dem Mandat festhalten', tag: 0 }, { text: 'Kunden persönlich um Freigabe bitten (schriftlich)', tag: 3 }, { text: 'Beitrag im Redaktionsplan anlegen', tag: 7 }, { text: 'Kunden die Endfassung zeigen, dann veröffentlichen', tag: 14 }],
    kennzahl: 'Freigaben und ausgelöste Gespräche', recht: 'Kundennamen nur mit ausdrücklicher Freigabe; keine erfundenen Zahlen.', fuer: ['head-marketing'],
  },
  {
    id: 'event', name: 'Einladung zum eigenen Format', kurz: 'Stammtisch/Dinner mit bewusster Gästemischung',
    warum: 'Kunden als sozialer Beweis neben Zielkunden: das Gespräch am Tisch verkauft besser als jede Präsentation.',
    zielgruppe: { lebensphase: ['kunde', 'interessent', 'multiplikator'] }, kanal: 'event',
    schritte: [{ text: 'Event anlegen (Ziel, Format, Datum)', tag: 0 }, { text: 'Persönlich einladen — Mail nur mit Grundlage', tag: 7 }, { text: 'Erinnern', tag: 21 }, { text: 'Nachfassen binnen 48 Stunden', tag: 30 }],
    kennzahl: 'Folgegespräche je Event (Ziel ≥ 3)', recht: 'Eine Einladung zum eigenen Event ist Werbung (§ 7 UWG); Teilnahme ist keine Einwilligung.', fuer: ['head-marketing', 'head-sales'],
  },
  {
    id: 'upsell', name: 'Nächste Stufe für Bestandskunden', kurz: 'Einstieg → Kern → Premium',
    warum: 'Bestehende Kunden kaufen die nächste Stufe deutlich leichter als Neukunden die erste; Voraussetzung ist sichtbare Wirkung.',
    zielgruppe: { lebensphase: ['kunde'] }, zusatz: 'health_gruen', kanal: 'persoenlich',
    schritte: [{ text: 'Wirkung des laufenden Mandats zusammenfassen', tag: 0 }, { text: 'Im Review den nächsten Engpass ansprechen', tag: 7 }, { text: 'Drei Optionen aus dem Leistungskatalog anbieten', tag: 14 }],
    kennzahl: 'Zusatzmandate', recht: 'Kommunikation im laufenden Mandat ist frei; Werbung per Mail mit Widerspruchshinweis.', fuer: ['head-sales'],
  },
  {
    id: 'verlaengerung', name: 'Verlängerung sichern', kurz: 'Mandate mit Laufzeitende in 90 Tagen',
    warum: 'Risiken zeigen sich früh — wer 90 Tage vorher über Ergebnisse spricht, verlängert öfter als wer auf die Kündigungsfrist wartet.',
    zielgruppe: { lebensphase: ['kunde'] }, zusatz: 'laufzeit_90', kanal: 'persoenlich',
    schritte: [{ text: 'Ergebnisse gegen die Ziele aufbereiten', tag: 0 }, { text: 'Review-Termin mit dem Entscheider', tag: 5 }, { text: 'Verlängerungsangebot mit Optionen', tag: 14 }],
    kennzahl: 'Verlängerungsquote', recht: 'Im laufenden Mandat frei.', fuer: ['head-sales'],
  },
  {
    id: 'newsletter', name: 'Einwilligungen aufbauen', kurz: 'Kreis A–C für den Newsletter gewinnen',
    warum: 'Ohne Double-Opt-in kein Newsletter; die Einwilligung holt man am besten im Gespräch — mit echtem Nutzen statt „Anmeldung“.',
    zielgruppe: { kreis: ['A', 'B', 'C'] }, kanal: 'persoenlich',
    schritte: [{ text: 'Nutzen des Newsletters in einem Satz festlegen', tag: 0 }, { text: 'Im nächsten Gespräch fragen und Wortlaut festhalten', tag: 3 }, { text: 'Double-Opt-in-Mail auslösen (Versandwerkzeug)', tag: 4 }],
    kennzahl: 'Neue Double-Opt-ins', recht: 'Nachweis mit Zeitpunkt und Wortlaut; eine Visitenkarte ist keine Einwilligung.', fuer: ['head-marketing'],
  },
];

// ── Kundenprofil und ähnliche Firmen ────────────────────────────────────────

const woerter = (t?: string) => new Set((t ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9äöüß]+/).filter(w => w.length > 3 && !['gmbh', 'und', 'dienstleistung', 'dienstleistungen', 'sonstige'].includes(w)));
function groesse(ma?: string): number | null { const n = Number(String(ma ?? '').replace(/[^0-9].*$/, '')); return Number.isFinite(n) && n > 0 ? n : null; }

export interface Kundenprofil { firmen: Firma[]; branchen: string[]; staedte: string[]; groesse: { min: number; max: number } | null; mrrJeKunde: { kunde: string; mrr: number; health: number | null }[] }

/** Wer sind unsere Kunden? Aus aktiven Mandaten und Firmen mit Rolle „Kunde“. */
export function kundenprofil(crm: CrmBestand, heute: string): Kundenprofil {
  const namen = new Set(crm.mandate.filter(m => m.status === 'aktiv').map(m => firmenSchluessel(m.kunde)));
  const firmen = crm.firmen.filter(f => f.rolle === 'kunde' || namen.has(firmenSchluessel(f.name)));
  const zaehl = (l: (string | undefined)[]) => Array.from(l.filter(Boolean).reduce((m, x) => m.set(x!, (m.get(x!) ?? 0) + 1), new Map<string, number>()).entries()).sort((a, b) => b[1] - a[1]).map(([x]) => x);
  const gr = firmen.map(f => groesse(f.mitarbeiter)).filter((x): x is number => x !== null);
  const mrrJeKunde = Array.from(crm.mandate.filter(m => m.status === 'aktiv').reduce((m, x) => m.set(x.kunde, (m.get(x.kunde) ?? 0) + (x.honorar.basis === 'monat' ? x.honorar.betrag : 0)), new Map<string, number>()).entries())
    .map(([kunde, mrr]) => ({ kunde, mrr, health: crm.mandate.filter(m => m.kunde === kunde).map(m => mandatLage(m, heute).health).find(h => h !== null) ?? null }))
    .sort((a, b) => b.mrr - a.mrr);
  return { firmen, branchen: zaehl(firmen.map(f => f.branche)).slice(0, 8), staedte: zaehl(firmen.map(f => f.stadt)).slice(0, 5), groesse: gr.length ? { min: Math.min(...gr), max: Math.max(...gr) } : null, mrrJeKunde };
}

export interface Aehnlich { firma: Firma; punkte: number; gruende: string[] }

/** „Kunden wie unsere besten“: Branche (Wortüberschneidung), Ort, Größe; nur Firmen, die noch keine Kunden sind. */
export function aehnlicheFirmen(crm: CrmBestand, heute: string, n = 25): Aehnlich[] {
  const p = kundenprofil(crm, heute);
  if (!p.firmen.length) return [];
  const kundenIds = new Set(p.firmen.map(f => f.id));
  const kundenWoerter = p.firmen.map(f => ({ f, w: woerter(f.branche), g: groesse(f.mitarbeiter) }));
  const raus: Aehnlich[] = [];
  for (const f of crm.firmen) {
    if (kundenIds.has(f.id) || ['kunde', 'ex_kunde', 'dienstleister', 'wettbewerb', 'investor'].includes(f.rolle)) continue;
    const w = woerter(f.branche), g = groesse(f.mitarbeiter);
    let best: Aehnlich | null = null;
    for (const k of kundenWoerter) {
      const gemeinsam = Array.from(w).filter(x => k.w.has(x));
      // Ohne gemeinsame Branche ist es keine Ähnlichkeit — Ort und Größe verfeinern nur.
      if (!gemeinsam.length) continue;
      let punkte = gemeinsam.length * 30;
      const gruende: string[] = [`Branche wie ${k.f.name} (${gemeinsam.slice(0, 2).join(', ')})`];
      if (f.stadt && k.f.stadt && f.stadt.toLowerCase() === k.f.stadt.toLowerCase()) { punkte += 8; gruende.push(`auch in ${f.stadt}`); }
      if (g && k.g && g >= k.g / 3 && g <= k.g * 3) { punkte += 7; gruende.push(`ähnliche Größe (${g} MA)`); }
      if (!best || punkte > best.punkte) best = { firma: f, punkte, gruende };
    }
    if (best) raus.push(best);
  }
  return raus.sort((a, b) => b.punkte - a.punkte).slice(0, n);
}

// ── Zielgruppe einer Kampagne ───────────────────────────────────────────────

export function zielgruppe(kontakte: Kontakt[], crm: CrmBestand, pb: Pick<Playbook, 'zielgruppe' | 'zusatz'>, heute: string): Kontakt[] {
  const ctx = kontextAus(crm, heute);
  let l = segmentAuswerten(kontakte, pb.zielgruppe, ctx).mitglieder;
  if (pb.zusatz === 'health_gruen') {
    const gruen = new Set(crm.mandate.filter(m => m.status === 'aktiv' && (mandatLage(m, heute).ampel ?? 'gruen') !== 'rot').flatMap(m => m.kontaktIds));
    l = l.filter(k => gruen.has(k.id) || k.lebensphase !== 'kunde');
  }
  if (pb.zusatz === 'laufzeit_90') {
    const bald = new Set(crm.mandate.filter(m => m.status === 'aktiv' && (mandatLage(m, heute).endeIn ?? 999) <= 90).flatMap(m => m.kontaktIds));
    l = l.filter(k => bald.has(k.id));
  }
  if (pb.zusatz === 'lookalike') {
    const ids = new Set(aehnlicheFirmen(crm, heute, 40).map(a => a.firma.id));
    l = l.filter(k => k.firmaId && ids.has(k.firmaId));
  }
  return l;
}

/** Eine Kampagne aus einem Playbook — mit der aktuellen Zielgruppe als Auswahl. */
export function planen(pb: Playbook, kontakte: Kontakt[], crm: CrmBestand, heute: string, id: string, von: Kampagne['von'] = 'hand', max = 40): Kampagne {
  const l = zielgruppe(kontakte, crm, pb, heute).slice(0, max);
  return {
    id, name: pb.name, playbook: pb.id, ziel: pb.kennzahl, zielgruppe: pb.zielgruppe, kanal: pb.kanal, status: 'entwurf', start: heute,
    schritte: pb.schritte.map((s, i) => ({ id: `s${i}`, text: s.text, tag: s.tag, erledigt: false })),
    kontaktIds: l.map(k => k.id), ergebnisse: [], von, geaendert: new Date().toISOString(),
  };
}

export interface KampagnenZahlen { personen: number; angesprochen: number; reagiert: number; gespraeche: number; chancen: number; keinInteresse: number; offen: number; schritteOffen: number; schritteFaellig: number }
export function kampagnenZahlen(k: Kampagne, heute: string): KampagnenZahlen {
  const letzte = new Map<string, string>();
  for (const e of [...k.ergebnisse].sort((a, b) => a.am.localeCompare(b.am))) letzte.set(e.kontaktId, e.ergebnis);
  const z = (x: string) => Array.from(letzte.values()).filter(v => v === x).length;
  const plus = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const offene = k.schritte.filter(s => !s.erledigt);
  return {
    personen: k.kontaktIds.length, angesprochen: letzte.size, reagiert: z('reagiert'), gespraeche: z('gespraech'), chancen: z('chance'), keinInteresse: z('kein_interesse'),
    offen: k.kontaktIds.filter(id => !letzte.has(id)).length,
    schritteOffen: offene.length, schritteFaellig: k.start ? offene.filter(s => plus(k.start!, s.tag) <= heute).length : 0,
  };
}
