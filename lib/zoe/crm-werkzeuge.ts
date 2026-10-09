// ─── ZOE sieht die ganze Markttraktion — lesende Werkzeuge (28.09., Paket C7) ─────────────────
// Vorgabe 28.09. ~22:50: „Mache ZOE auch für das CRM-System klar. ZOE soll nachher alles sehen und unterstützen
// können.“ — und kurz darauf: die KOMPLETTE Markttraktion (alle Reiter der LEISTE in lib/crm/adresse.ts).
// Das hebt die alte Regel „CRM-Dateiablage nie an ZOE“ auf, mit drei festen Leitplanken (lib/zoe/crm-sicht.ts):
// Art. 18 ausgeblendet · private Notizen nur der handelnden Person · IBAN maskiert. Fremder Text steht nur im
// `fremd()`-Block, lange Antworten kommen in Teilen (≤ 30.000 Zeichen), nie still gekürzt.
//
// Diese Datei enthält nur LESEN. Unterstützen (Vorschläge in den Freigabe-Stapel) liegt in crm-vorschlag.ts.
// Registriert werden die Werkzeuge in lib/zoe/werkzeuge.ts (Wirkung, `nurImHaushalt`), register.ts (Stufe „frei“),
// fremd.ts (selbst gekapselt), gespraech-schutz.ts (lesend) und app/api/kimmi (Angebot nur im Haushalt).
// Kein Werkzeug hier ruft ein Modell; die Kosten trägt das laufende Gespräch.

import { suchPasst } from '@/lib/text/such-norm';
import { loadJson } from '@/lib/store/local-db';
import { anzeigename, STUFE_LABEL, STAMMDATEN_FELDER, ereignisMs, type Kontakt, type Aktivitaet } from '@/lib/make-one/crm';
import type { Chance, Firma, Mandat, Angebot, Kampagne, Event, CrmBestand } from '@/lib/crm/typen';
import { hatTerminVerweise, kontakteMitTerminZeit } from '@/lib/crm/aktivitaeten';
import { crmSicht, crmAntwort, ausgeblendetText, eindeutig, NICHT_IM_HINTERGRUND, ABLAGE_QUELLE, EINGESCHRAENKT_NAME, type CrmSicht } from './crm-sicht';

type Eingabe = Record<string, unknown>;
type Lauf = (input: Eingabe, origin: string, person?: string) => Promise<string>;

const eur = (n: number | null | undefined) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0));
const zeile = (...teile: (string | false | null | undefined | 0)[]) => teile.filter(Boolean).join(' · ');
const text = (v: unknown, n = 200) => String(v ?? '').trim().slice(0, n);
const tag = (iso?: string) => (iso ? iso.slice(0, 10) : '');
const anzahl = (v: unknown, std: number, max: number) => Math.min(max, Math.max(1, Math.round(Number(v) || std)));
const block = (titel: string, zeilen: string[], leer = 'keine') => `${titel} (${zeilen.length}):\n${zeilen.length ? zeilen.join('\n') : `- ${leer}`}`;

/** Ablage/Bestand nicht lesbar → ein Satz statt eines abgebrochenen Gesprächs; ohne Sicht → Ablehnung. */
function sicher(f: (input: Eingabe, s: CrmSicht) => Promise<string> | string): Lauf {
  return async (input, _origin, person) => {
    try {
      const s = await crmSicht(person);
      if (!s) return NICHT_IM_HINTERGRUND;
      return await f(input, await mitTerminZeiten(s));
    } catch (e) {
      console.error('[zoe/crm]', e instanceof Error ? e.message : e);
      return 'Fehlgeschlagen: Die Markttraktion ist gerade nicht lesbar.';
    }
  };
}

/**
 * Meetings mit Termin-Verweis zeigen die Zeit ihres TERMINS (K6a, 29.09. — nie `am`, den Zeitpunkt des Festhaltens):
 * gelesen über lib/crm/termin-zeiten-server.ts (ohne Abgleich, fremd-private Termine der anderen Person fallen heraus).
 * Nur für die Antwort — die Sicht wird nie gespeichert.
 */
async function mitTerminZeiten(s: CrmSicht): Promise<CrmSicht> {
  if (!hatTerminVerweise(s.kontakte)) return s;
  const { terminZeitenLesen } = await import('@/lib/crm/termin-zeiten-server');
  const kontakte = kontakteMitTerminZeit(s.kontakte, await terminZeitenLesen(s.person, s.heute));
  const nachId = new Map(kontakte.map(k => [k.id, k]));
  return { ...s, kontakte, kontakt: id => (id ? nachId.get(id) : undefined) };
}

// ── Kleine Bausteine ──────────────────────────────────────────────────────

async function ladePipeline() { return import('@/lib/crm/pipeline'); }

function kontaktKurz(s: CrmSicht, k: Kontakt): string {
  return zeile(`${k.id} ${anzeigename(k)}`, k.position, k.firma, STUFE_LABEL[k.stufe], k.werbesperre && 'WERBESPERRE');
}

function kontaktFinden(s: CrmSicht, suche: string): Kontakt | Kontakt[] | string {
  const hinweis = suche.trim();
  if (!hinweis) return 'Fehlgeschlagen: kontakt fehlt (Kennung c-… oder Name).';
  if (s.eingeschraenkt.has(hinweis)) return `Kontakt ${hinweis}: Verarbeitung eingeschränkt (Art. 18) — ZOE zeigt und verarbeitet ihn nicht.`;
  const r = eindeutig(s.kontakte, hinweis, k => [anzeigename(k), k.firma, k.email, ...(k.emails ?? []).map(e => e.adresse)], suchPasst);
  if (!r) return `Kein Kontakt zu dieser Angabe gefunden (${s.kontakte.length} durchsucht${ausgeblendetText(s.eingeschraenkt.size)}).`;
  return r;
}

function firmaFinden(s: CrmSicht, suche: string): Firma | Firma[] | string {
  if (!suche.trim()) return 'Fehlgeschlagen: firma fehlt (Kennung f-… oder Name).';
  const r = eindeutig(s.crm.firmen, suche, f => [f.name, f.domain, f.stadt], suchPasst);
  return r ?? 'Keine Firma zu dieser Angabe gefunden.';
}

const mehrdeutig = <T extends { id: string }>(liste: T[], name: (x: T) => string) =>
  `Nicht eindeutig — bitte mit Kennung erneut:\n${liste.map(x => `- ${x.id} · ${name(x)}`).join('\n')}`;

function aktivitaetZeile(s: CrmSicht, a: Aktivitaet): string {
  const n = a.notiz ? Object.entries(a.notiz).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' | ') : '';
  // Ereigniszeit: `wann` (bei Meetings mit Termin aus dem Termin, s. `mitTerminZeiten`) mit Uhrzeit, sonst der Tag von `am`.
  return `- ${a.wann ? a.wann.replace('T', ' ') : tag(a.am)}${a.terminUid ? ' (Termin im Kalender)' : ''} · ${a.art}${a.ergebnis ? ` (${a.ergebnis})` : ''} · von ${a.von}${a.bezug ? ` · Bezug ${a.bezug}` : ''}${a.ort ? ` · Ort ${a.ort}` : ''}${a.anlass ? ` · Anlass ${a.anlass}` : ''}${a.text ? `\n  ${a.text}` : ''}${n ? `\n  ${n}` : ''}`;
}

function dealZeile(s: CrmSicht, c: Chance, heute: string, gesundheit?: (c: Chance, h: string) => { ampel: string; gruende: string[] }): string {
  const g = gesundheit?.(c, heute);
  return `- ${c.id} · ${c.titel} · Stufe ${c.stufe} · ${eur(c.wert.betrag)} ${c.wert.basis}${c.firma ? ` · ${c.firma}` : ''} · zuständig ${c.besitzer}`
    + `${c.naechsterSchritt ? ` · nächster Schritt ${c.naechsterSchritt.datum}: ${c.naechsterSchritt.text}` : ' · ohne nächsten Schritt'}`
    + `${c.erwartetAm ? ` · Entscheidung bis ${c.erwartetAm}` : ''}${g ? ` · Ampel ${g.ampel}${g.gruende.length ? ` (${g.gruende.join('; ')})` : ''}` : ''}`
    + `${c.kontaktIds.length ? ` · Personen: ${c.kontaktIds.map(id => s.name(id)).join(', ')}` : ''}${c.grund ? ` · Grund ${c.grund}` : ''}`;
}

function mandatZeile(s: CrmSicht, m: Mandat): string {
  return `- ${m.id} · ${m.titel} · ${m.kunde} · ${m.status} · ${eur(m.honorar.betrag)} je ${m.honorar.basis}${m.start ? ` · seit ${m.start}` : ''}${m.ende ? ` · bis ${m.ende}` : ''}`
    + `${m.naechstesReview ? ` · Review ${m.naechstesReview}` : ''}${m.phase ? ` · Phase ${m.phase}` : ''} · ${m.gesellschaft}${m.zustaendig ? ` · zuständig ${m.zustaendig}` : ''}`
    + `${m.kontaktIds.length ? ` · Personen: ${m.kontaktIds.map(id => s.name(id)).join(', ')}` : ''}${m.offen.length ? `\n  offen: ${m.offen.join(' | ')}` : ''}`;
}

async function angebotZeile(a: Angebot, s: CrmSicht): Promise<string> {
  const { angebotSummen, euroCent } = await import('@/lib/crm/angebote');
  const sum = angebotSummen(a);
  return `- ${a.id}${a.nummer ? ` (${a.nummer})` : ''} · ${a.titel} · ${a.status} · v${a.version} · ${a.gesellschaft} · netto ${euroCent(sum.gesamt.netto)} · gültig bis ${a.gueltigBis}`
    + `${a.kontaktId ? ` · an ${s.name(a.kontaktId)}` : ''}${a.firmaId ? ` · Firma ${s.crm.firmen.find(f => f.id === a.firmaId)?.name ?? a.firmaId}` : ''}${a.dealId ? ` · Deal ${a.dealId}` : ''}${a.grund ? ` · Grund ${a.grund}` : ''}`;
}

async function dateienFuer(s: CrmSicht, f: { kontaktId?: string; firmaId?: string; mandatIds?: string[]; dealIds?: string[] }): Promise<string[]> {
  if (!s.haushalt) return ['- (kein Haushalt gesetzt — Dateiablage nicht erreichbar)'];
  const { ablageListe } = await import('@/lib/dateien/ablage');
  const { eintraegeFuer, nurCrm, groesseText } = await import('@/lib/dateien/regeln');
  const { einwilligungenMitBeleg } = await import('@/lib/dateien/einwilligung-beleg');
  const liste = eintraegeFuer(nurCrm(await ablageListe(s.haushalt)), f);
  return liste.map(d => {
    const beleg = einwilligungenMitBeleg(s.kontakte, d.id).anzahl > 0;
    return `- ${d.id} · ${d.art}${d.titel ? ` · ${d.titel}` : ''}${d.datei ? ` · ${d.datei.name} · ${groesseText(d.datei.groesse)}` : ' · ohne Datei'} · ${tag(d.hochgeladenAm)} von ${d.hochgeladenVon}`
      + `${d.angebot ? ` · Angebot ${d.angebot.status}${d.angebot.nummer ? ` ${d.angebot.nummer}` : ''}${d.angebot.betrag ? ` ${eur(d.angebot.betrag)}` : ''}` : ''}${d.vertrag ? ` · Vertrag ${d.vertrag.vertragsart}${d.vertrag.bis ? ` bis ${d.vertrag.bis}` : ''}` : ''}`
      + `${beleg ? ' · Einwilligungs-Beleg (nur Angaben)' : ''}${d.dateiFehlt ? ' · Datei fehlt' : ''}${d.notiz ? ` · Notiz: ${d.notiz}` : ''}`;
  });
}

async function aufgabenFuerBezug(s: CrmSicht, wer: { kontaktId?: string; firmaId?: string; mandatIds?: string[]; dealIds?: string[] }): Promise<string[]> {
  const { ladeAufgabenSicht: ladeAufgaben } = await import('@/lib/aufgaben/speicher'); // ohne Papierkorb (29.09.)
  const [{ aufgabenFuer }, { aufgabeImPrivat }] = await Promise.all([import('@/lib/aufgaben/crm-verweise'), import('@/lib/aufgaben/bereich-sicht')]);
  const state = await ladeAufgaben(s.person); // Sichtfilter „nur ich“ (29.09.) und Konto-Sicht (09.10., E4)
  // Privates hat in der Markttraktion nichts zu suchen — nur Business-Spaces (eigene Firmen, Mandanten). EINE Regel (09.10., E4):
  // `aufgabeImPrivat` (Bereich des Space) — vorher `spaceId !== 'privat'`, damit zählte die Selbstständigkeit (Privat-Einheit) als Business.
  const nachId = new Map(state.tasks.map(t => [t.id, t]));
  return aufgabenFuer(state.tasks, wer).filter(t => !aufgabeImPrivat(t, nachId) && t.space !== 'privat')
    .map(t => `- ${t.id} · ${t.title} · ${t.status}${t.dueDate ? ` · fällig ${t.dueDate}` : ''} · ${t.assignee}`);
}

async function followupsFuer(s: CrmSicht, passt: (f: { kontaktId?: string; bezug: { art: string; id: string } }) => boolean): Promise<string[]> {
  const { faellige } = await import('@/lib/crm/followup');
  return faellige(s.kontakte, s.crm, s.heute, { horizont: 400, wertelisten: s.crm.wertelisten })
    .filter(f => !(f.kontaktId && s.eingeschraenkt.has(f.kontaktId)) && passt(f))
    .map(f => `- ${f.id} · ${f.faellig}${f.uhrzeit ? ` ${f.uhrzeit}` : ''} · ${f.art} · ${f.text} · ${f.gruppe}${f.tageUeber > 0 ? ` (${f.tageUeber} Tage über)` : ''} · zuständig ${f.zustaendig}${f.verschoben ? ` · ${f.verschoben}× verschoben` : ''}`);
}

// ── crm_suche ─────────────────────────────────────────────────────────────

const ARTEN = ['kontakte', 'firmen', 'deals', 'mandate', 'angebote', 'kampagnen', 'events'] as const;
type SuchArt = typeof ARTEN[number];

async function crmSuche(i: Eingabe, s: CrmSicht): Promise<string> {
  const frage = text(i.frage, 200);
  const arten = (Array.isArray(i.arten) ? i.arten.map(String) : typeof i.arten === 'string' ? [i.arten] : []).filter((a): a is SuchArt => (ARTEN as readonly string[]).includes(a));
  const nur = arten.length ? new Set<SuchArt>(arten) : new Set<SuchArt>(ARTEN);
  const n = anzahl(i.anzahl, 10, 30);
  const f = {
    phase: text(i.phase, 20) || undefined, bean: text(i.bean, 1).toUpperCase() || undefined, temperatur: text(i.temperatur, 10) || undefined,
    scoreMin: Number.isFinite(Number(i.score_min)) && i.score_min !== undefined ? Number(i.score_min) : undefined,
    segment: text(i.segment, 80) || undefined, zustaendig: text(i.zustaendig, 40) || undefined,
    stadt: text(i.stadt, 80) || undefined, branche: text(i.branche, 80) || undefined,
    offen: i.offen === true, faellig: i.faellig === true,
  };
  const { heute, crm } = s;
  const teile: string[] = [];
  let treffer = 0;

  if (nur.has('kontakte')) {
    const { lifecycleVon } = await import('@/lib/crm/vorschlaege');
    const { beanVon } = await import('@/lib/crm/bean');
    const { leads } = await import('@/lib/crm/leads');
    const { typenVon, kategorienVon, labelsVon } = await import('@/lib/crm/mehrfach');
    const { alleAdressen } = await import('@/lib/crm/emails');
    const zeilen = leads(s.kontakte, crm, heute);
    const scoreJe = new Map<string, { punkte: number; temperatur: string }>();
    for (const z of zeilen) for (const p of z.personen) scoreJe.set(p.id, { punkte: z.score.punkte, temperatur: z.score.temperatur });
    let segmentPasst: ((k: Kontakt) => boolean) | null = null;
    if (f.segment) {
      const seg = crm.segmente.find(x => x.id === f.segment || suchPasst([x.name], f.segment!));
      if (!seg) teile.push(`Segment „${f.segment}“ nicht gefunden.`);
      else {
        const { imSegment, kontextAus } = await import('@/lib/crm/segmente');
        const ctx = kontextAus(crm, heute);
        segmentPasst = k => imSegment(k, seg.kriterien, ctx);
      }
    }
    const offenerSchritt = (k: Kontakt) => !!(k.naechsterSchritt && k.naechsterSchritt.datum <= heute) || !!(k.wiedervorlage && k.wiedervorlage <= heute);
    const l = s.kontakte.filter(k => {
      if (frage && !suchPasst([anzeigename(k), k.firma, ...alleAdressen(k), k.position, k.firmaStadt, k.firmaBranche, ...typenVon(k), ...kategorienVon(k), ...labelsVon(k)], frage)) return false;
      if (f.phase && lifecycleVon(k, crm, heute).phase !== f.phase) return false;
      if (f.bean && beanVon(k, crm).bean !== f.bean) return false;
      const sc = scoreJe.get(k.id);
      if (f.temperatur && sc?.temperatur !== f.temperatur) return false;
      if (f.scoreMin !== undefined && (sc?.punkte ?? 0) < f.scoreMin) return false;
      if (f.zustaendig && (k.besitzer ?? '') !== f.zustaendig) return false;
      if (f.stadt && !suchPasst([k.firmaStadt], f.stadt)) return false;
      if (f.branche && !suchPasst([k.firmaBranche], f.branche)) return false;
      if (f.faellig && !offenerSchritt(k)) return false;
      if (f.offen && ['verloren', 'ruht'].includes(k.stufe)) return false;
      if (segmentPasst && !segmentPasst(k)) return false;
      return true;
    });
    treffer += l.length;
    teile.push(block(`Kontakte — ${l.length} Treffer${l.length > n ? `, die ersten ${n}` : ''}`, l.slice(0, n).map(k => {
      const sc = scoreJe.get(k.id);
      return `- ${kontaktKurz(s, k)} · Phase ${lifecycleVon(k, crm, heute).phase} · BEAN ${beanVon(k, crm).bean}${sc ? ` · Score ${sc.punkte} ${sc.temperatur}` : ''}${k.besitzer ? ` · zuständig ${k.besitzer}` : ''}${k.naechsterSchritt ? ` · nächster Schritt ${k.naechsterSchritt.datum}: ${k.naechsterSchritt.text}` : ''}`;
    })));
  }
  if (nur.has('firmen')) {
    const { beanFirma } = await import('@/lib/crm/bean');
    const l = crm.firmen.filter(x => (!frage || suchPasst([x.name, x.domain, x.stadt, x.branche, ...(x.branchen ?? [])], frage))
      && (!f.stadt || suchPasst([x.stadt], f.stadt)) && (!f.branche || suchPasst([x.branche, ...(x.branchen ?? [])], f.branche))
      && (!f.bean || beanFirma(x, crm, s.kontakte).bean === f.bean));
    treffer += l.length;
    teile.push(block(`Firmen — ${l.length} Treffer${l.length > n ? `, die ersten ${n}` : ''}`, l.slice(0, n).map(x => `- ${x.id} · ${x.name} · ${x.rolle}${x.branche ? ` · ${x.branche}` : ''}${x.stadt ? ` · ${x.stadt}` : ''} · BEAN ${beanFirma(x, crm, s.kontakte).bean}${x.lead ? ` · Lead ${x.lead.status}` : ''}`)));
  }
  if (nur.has('deals')) {
    const { OFFENE_STUFEN, gesundheit } = await ladePipeline();
    const l = crm.chancen.filter(c => (!frage || suchPasst([c.titel, c.firma, ...c.kontaktIds.map(id => s.name(id))], frage))
      && (!f.offen || OFFENE_STUFEN.includes(c.stufe)) && (!f.zustaendig || c.besitzer === f.zustaendig)
      && (!f.faellig || !!(c.naechsterSchritt && c.naechsterSchritt.datum <= heute)));
    treffer += l.length;
    teile.push(block(`Deals — ${l.length} Treffer${l.length > n ? `, die ersten ${n}` : ''}`, l.slice(0, n).map(c => dealZeile(s, c, heute, gesundheit))));
  }
  if (nur.has('mandate')) {
    const l = crm.mandate.filter(m => (!frage || suchPasst([m.titel, m.kunde], frage)) && (!f.offen || ['aktiv', 'angebot', 'verhandlung'].includes(m.status)) && (!f.zustaendig || m.zustaendig === f.zustaendig));
    treffer += l.length;
    teile.push(block(`Mandate — ${l.length} Treffer`, l.slice(0, n).map(m => mandatZeile(s, m))));
  }
  if (nur.has('angebote')) {
    const l = (crm.angebote ?? []).filter(a => (!frage || suchPasst([a.titel, a.nummer, s.name(a.kontaktId)], frage)) && (!f.offen || a.status === 'gestellt' || a.status === 'entwurf'));
    treffer += l.length;
    teile.push(block(`Angebote — ${l.length} Treffer`, await Promise.all(l.slice(0, n).map(a => angebotZeile(a, s)))));
  }
  if (nur.has('kampagnen')) {
    const l = crm.kampagnen.filter(k => (!frage || suchPasst([k.name, k.ziel, k.playbook], frage)) && (!f.offen || k.status === 'aktiv' || k.status === 'entwurf'));
    treffer += l.length;
    teile.push(block(`Kampagnen — ${l.length} Treffer`, l.slice(0, n).map(k => `- ${k.id} · ${k.name} · ${k.status} · ${k.playbook} · ${k.kontaktIds.length} Personen`)));
  }
  if (nur.has('events')) {
    const l = crm.events.filter(e => (!frage || suchPasst([e.titel, e.ort, e.ziel], frage)) && (!f.offen || e.datum >= heute));
    treffer += l.length;
    // Kennzeichnung (M4): „Make.One“ = unser eigener Abend (events_lage), „besucht“ = fremde Veranstaltung aus dem Reiter „Events“ (besuche_lage).
    const { istNetzwerkenEvent } = await import('@/lib/crm/marke');
    teile.push(block(`Events — ${l.length} Treffer`, l.slice(0, n).map(e => `- ${e.id} · ${istNetzwerkenEvent(e) ? 'besucht (besuche_lage)' : 'Make.One (events_lage)'} · ${e.titel} · ${e.datum} · ${e.status}${e.ort ? ` · ${e.ort}` : ''}`)));
  }
  const kopf = `MARKTTRAKTION-SUCHE ${frage ? `„${frage.length > 40 ? `${frage.slice(0, 40)}…` : frage}“` : '(ohne Suchwort)'} · ${treffer} Treffer in ${[...nur].join(', ')}${ausgeblendetText(s.eingeschraenkt.size)} · Einzelnes: kontakt_akte, firma_akte, pipeline mit deal`;
  return crmAntwort(kopf, teile.join('\n\n'), i.teil, t => `crm_suche mit denselben Angaben und teil: ${t}`);
}

// ── kontakt_akte ──────────────────────────────────────────────────────────

async function kontaktAkte(i: Eingabe, s: CrmSicht): Promise<string> {
  const r = kontaktFinden(s, text(i.kontakt, 160));
  if (typeof r === 'string') return r;
  if (Array.isArray(r)) return mehrdeutig(r, k => `${anzeigename(k)}${k.firma ? ` (${k.firma})` : ''}`);
  const k = r;
  const { crm, heute } = s;
  const { lifecycleVon } = await import('@/lib/crm/vorschlaege');
  const { beanVon } = await import('@/lib/crm/bean');
  const { leads } = await import('@/lib/crm/leads');
  const { ampel } = await import('@/lib/crm/recht');
  const { nachweisLuecken } = await import('@/lib/crm/einwilligung');
  const { stationenVon } = await import('@/lib/crm/stationen');
  const { emailsVon } = await import('@/lib/crm/emails');
  const { typenVon, kategorienVon, labelsVon } = await import('@/lib/crm/mehrfach');
  const { zahlungFuerAnzeige } = await import('@/lib/crm/zahlung');
  const { gesundheit, OFFENE_STUFEN } = await ladePipeline();
  const { angeboteZu } = await import('@/lib/crm/angebote');
  const firmaName = (id: string) => crm.firmen.find(f => f.id === id)?.name ?? id;

  const lz = leads(s.kontakte, crm, heute).find(z => z.personen.some(p => p.id === k.id));
  const lc = lifecycleVon(k, crm, heute);
  const bean = beanVon(k, crm);
  const ctx = { hatMandat: crm.mandate.some(m => m.status === 'aktiv' && m.kontaktIds.includes(k.id)), hatChance: crm.chancen.some(c => OFFENE_STUFEN.includes(c.stufe) && c.kontaktIds.includes(k.id)) };
  const deals = crm.chancen.filter(c => c.kontaktIds.includes(k.id));
  const mandate = crm.mandate.filter(m => m.kontaktIds.includes(k.id));
  const angebote = angeboteZu(crm.angebote, { kontaktId: k.id });
  const zahlung = zahlungFuerAnzeige(k.zahlung);
  const aktivitaeten = [...(k.aktivitaeten ?? [])].sort((a, b) => ereignisMs(b) - ereignisMs(a));

  const stamm = STAMMDATEN_FELDER.filter(f => !['vorname', 'nachname', 'typ', 'kategorie'].includes(f) && k[f] !== undefined && String(k[f]).trim())
    .map(f => `- ${f}: ${String(k[f])}`);
  const koerper = [
    `Kontakt ${k.id} — ${anzeigename(k)}${k.anrede ? ` (${k.anrede})` : ''}`,
    zeile(k.position && `Position ${k.position}`, k.firma && `Firma ${k.firma}`, k.firmaId && `(${k.firmaId})`),
    `E-Mails: ${emailsVon(k).map(e => `${e.adresse}${e.art ? ` (${e.art})` : ''}${e.haupt ? ' · Haupt' : ''}`).join(', ') || '—'}`,
    zeile(k.telefon && `Telefon ${k.telefon}`, k.linkedin && `LinkedIn ${k.linkedin}`),
    `Stationen: ${stationenVon(k).map(x => `${firmaName(x.firmaId)} (${x.firmaId})${x.rolle ? ` ${x.rolle}` : ''}${x.art ? ` · ${x.art}` : ''}${x.von ? ` ab ${x.von}` : ''}${x.bis ? ` bis ${x.bis}` : ''} · ${x.aktiv ? 'aktiv' : 'beendet'}${x.haupt ? ' · Haupt' : ''}`).join(' | ') || '—'}`,
    `Einordnung: Typen ${typenVon(k).join(', ') || '—'} · Kategorien ${kategorienVon(k).join(', ') || '—'} · Labels ${labelsVon(k).join(', ') || '—'}`,
    zeile(`Zuständig (hält die Beziehung) ${k.besitzer ?? 'nicht gesetzt'}`, `Stufe ${STUFE_LABEL[k.stufe]}`, `Prio ${k.prio || '—'}`, `Eignung ${k.eignung || '—'}`, k.kreis && `Kreis ${k.kreis}`, k.taktTage && `Takt ${k.taktTage} Tage`, k.lebensphase && `Lebensphase ${k.lebensphase}`, k.rollen?.length && `Rollen ${k.rollen.join(', ')}`),
    `Lifecycle: ${lc.phase} (${lc.grund})`,
    `BEAN: ${bean.bean} (${bean.grund})`,
    lz ? `Lead (${lz.art === 'firma' ? `an Firma ${lz.id}` : 'an der Person'}): Status ${lz.status} · Score ${lz.score.punkte} ${lz.score.temperatur} (${lz.score.teile.map(t => `${t.label} ${t.punkte}/${t.max}: ${t.grund}`).join('; ')}) · Kernfragen ${Object.entries(lz.kriterien).map(([a, b]) => `${a} ${b}`).join(', ')}${lz.antworten ? ` · Antworten: ${Object.entries(lz.antworten).filter(([, v]) => v).map(([a, b]) => `${a}: ${b}`).join(' | ')}` : ''}${lz.qualifiziertAm ? ` · qualifiziert ${lz.qualifiziertAm}` : ''}` : 'Lead: keine Zeile (z. B. Dienstleister/Investor)',
    zeile(k.naechsterSchritt && `Nächster Schritt ${k.naechsterSchritt.datum}: ${k.naechsterSchritt.text}`, k.wiedervorlage && `Wiedervorlage ${k.wiedervorlage}`, k.letzterKontakt && `letzter Kontakt ${k.letzterKontakt}`) || 'Kein nächster Schritt.',
    k.werbesperre ? `WERBESPERRE seit ${k.werbesperre.seit} — nicht ansprechen, keine Werbung, keine Entwürfe.` : '',
    zeile(k.herkunft && `Herkunft ${k.herkunft}`, k.rechtsgrundlage && `Rechtsgrundlage ${k.rechtsgrundlage}`, k.fremddaten && 'Daten nicht von der Person (Art. 14)', k.art14InformiertAm && `Art. 14 informiert ${k.art14InformiertAm}`, k.hinweisBeiErhebung && `Widerspruchshinweis bei Erhebung ${k.hinweisBeiErhebung.am}`, k.geprueftAm && `Stammdaten geprüft ${k.geprueftAm}`),
    `Einwilligungen: ${(k.einwilligungen ?? []).map(e => `${e.kanal} · ${e.grundlage} · ${e.erteiltAm}${e.widerrufenAm ? ` · WIDERRUFEN ${e.widerrufenAm}` : ''} · Nachweis ${nachweisLuecken(e).length ? `unvollständig (fehlt ${nachweisLuecken(e).join(', ')})` : 'vollständig'}`).join(' | ') || 'keine'}`,
    `Kanal-Ampel (§ 7 UWG, keine Rechtsberatung): ${ampel(k, ctx).map(c => `${c.kanal} ${c.farbe} (${c.grund})`).join(' | ') || 'keine Kanäle'}`,
    zahlung ? `Zahlung: ${zeile(zahlung.weg && `Weg ${zahlung.weg}`, zahlung.zielTage && `Ziel ${zahlung.zielTage} Tage`, zahlung.ibanMaskiert && `IBAN ${zahlung.ibanMaskiert}`, zahlung.ustId && `USt-Id ${zahlung.ustId}`, zahlung.referenz && `Referenz ${zahlung.referenz}`)}` : '',
    stamm.length ? `Stammdaten aus der Liste:\n${stamm.join('\n')}` : '',
    k.privatNotiz ? `Deine private Notiz (nur du siehst sie):\n${k.privatNotiz}` : '',
    block('Aktivitäten, neueste zuerst', aktivitaeten.map(a => aktivitaetZeile(s, a))),
    block('Deals', deals.map(c => dealZeile(s, c, heute, gesundheit))),
    block('Mandate', mandate.map(m => mandatZeile(s, m))),
    block('Angebote', await Promise.all(angebote.map(a => angebotZeile(a, s)))),
    block('Follow-ups (offen)', await followupsFuer(s, f => f.kontaktId === k.id || (f.bezug.art === 'kontakt' && f.bezug.id === k.id))),
    block('Aufgaben mit Bezug', await aufgabenFuerBezug(s, { kontaktId: k.id })),
    block('Dateien (CRM-Ablage, Inhalt mit crm_datei_lesen)', await dateienFuer(s, { kontaktId: k.id, dealIds: deals.map(c => c.id), mandatIds: mandate.map(m => m.id) })),
  ].filter(Boolean).join('\n\n');
  const kopf = `KONTAKT ${k.id} · ${aktivitaeten.length} Aktivitäten · ${deals.length} Deals · ${mandate.length} Mandate · ${angebote.length} Angebote${k.werbesperre ? ' · WERBESPERRE' : ''}`;
  return crmAntwort(kopf, koerper, i.teil, t => `kontakt_akte mit kontakt: ${k.id}, teil: ${t}`);
}

// ── firma_akte ────────────────────────────────────────────────────────────

async function firmaAkte(i: Eingabe, s: CrmSicht): Promise<string> {
  const r = firmaFinden(s, text(i.firma, 160));
  if (typeof r === 'string') return r;
  if (Array.isArray(r)) return mehrdeutig(r, f => `${f.name}${f.stadt ? ` (${f.stadt})` : ''}`);
  const f = r;
  const { crm, heute } = s;
  const { personenAufteilen } = await import('@/lib/crm/stationen');
  const { toechter } = await import('@/lib/crm/konzern');
  const { dealZuFirma, mandatZuFirma } = await import('@/lib/crm/firmen-bezug');
  const { beanFirma } = await import('@/lib/crm/bean');
  const { zahlungFuerAnzeige } = await import('@/lib/crm/zahlung');
  const { gesundheit } = await ladePipeline();
  const { angeboteZu } = await import('@/lib/crm/angebote');
  const { umsatzBezug, umsatzKennzahlen } = await import('@/lib/crm/umsatz');
  const { leads } = await import('@/lib/crm/leads');

  // Personen: die Aufteilung rechnet über alle (auch eingeschränkte) — gezeigt werden nur die sichtbaren.
  const { aktuell, ehemalig } = personenAufteilen(s.kontakte, f.id);
  const deals = crm.chancen.filter(c => dealZuFirma(c, f));
  const mandate = crm.mandate.filter(m => mandatZuFirma(m, f));
  const angebote = angeboteZu(crm.angebote, { firmaId: f.id });
  const mutter = f.mutterId ? crm.firmen.find(x => x.id === f.mutterId) : undefined;
  const rechnungen = (await loadJson<{ rechnungen?: import('@/lib/crm/umsatz').UmsatzRechnung[] }>('finanzplan'))?.rechnungen ?? [];
  const ub = umsatzBezug({ id: `firma:${f.id}`, firmaId: f.id, firma: f.name }, crm, rechnungen, heute);
  const uk = umsatzKennzahlen(ub);
  const lz = leads(s.kontakte, crm, heute).find(z => z.id === f.id);
  const zahlung = zahlungFuerAnzeige(f.zahlung);
  const koerper = [
    `Firma ${f.id} — ${f.name}${f.rechtsform ? ` ${f.rechtsform}` : ''}`,
    zeile(`Rolle ${f.rolle}`, f.branche && `Branche ${f.branche}`, f.stadt && `Stadt ${f.stadt}`, f.mitarbeiter && `${f.mitarbeiter} Mitarbeiter`, f.umsatz && `Umsatz ${f.umsatz}`, f.gegruendet && `gegründet ${f.gegruendet}`),
    zeile(f.webseite && `Web ${f.webseite}`, f.domain && `Domain ${f.domain}`, f.telefon && `Telefon ${f.telefon}`, f.email && `Mail ${f.email}`, f.linkedin && `LinkedIn ${f.linkedin}`),
    `BEAN: ${beanFirma(f, crm, s.kontakte).bean} (${beanFirma(f, crm, s.kontakte).grund})`,
    lz ? `Lead: ${lz.status} · Score ${lz.score.punkte} ${lz.score.temperatur} · Kernfragen ${Object.entries(lz.kriterien).map(([a, b]) => `${a} ${b}`).join(', ')}${lz.antworten ? ` · Antworten: ${Object.entries(lz.antworten).filter(([, v]) => v).map(([a, b]) => `${a}: ${b}`).join(' | ')}` : ''}` : '',
    zeile(mutter && `Mutter ${mutter.id} ${mutter.name}`, toechter(crm.firmen, f.id).length && `Töchter ${toechter(crm.firmen, f.id).map(t => `${t.id} ${t.name}`).join(', ')}`),
    f.marktinfo ? `Marktinfo: ${f.marktinfo}` : '', f.notiz ? `Notiz: ${f.notiz}` : '',
    zahlung ? `Zahlung: ${zeile(zahlung.weg && `Weg ${zahlung.weg}`, zahlung.zielTage && `Ziel ${zahlung.zielTage} Tage`, zahlung.ibanMaskiert && `IBAN ${zahlung.ibanMaskiert}`, zahlung.ustId && `USt-Id ${zahlung.ustId}`)}` : '',
    `Umsatz: bezahlt ${eur(uk.bezahlt)} · offen ${eur(uk.offen)} (überfällig ${eur(uk.ueberfaellig)}) · geplant ${eur(uk.geplant)} · Monatswert ${eur(uk.monatswert)} · ${uk.aktiveMandate} aktive Mandate · ${uk.gewonneneDeals} gewonnene Deals`,
    block('Personen aktuell', aktuell.map(k => `- ${kontaktKurz(s, k)}`)),
    block('Personen ehemalig', ehemalig.map(k => `- ${kontaktKurz(s, k)}`)),
    block('Deals', deals.map(c => dealZeile(s, c, heute, gesundheit))),
    block('Mandate', mandate.map(m => mandatZeile(s, m))),
    block('Angebote', await Promise.all(angebote.map(a => angebotZeile(a, s)))),
    block('Follow-ups (offen)', await followupsFuer(s, x => (x.bezug.art === 'firma' && x.bezug.id === f.id) || aktuell.some(k => k.id === x.kontaktId))),
    block('Aufgaben mit Bezug', await aufgabenFuerBezug(s, { firmaId: f.id, mandatIds: mandate.map(m => m.id), dealIds: deals.map(c => c.id) })),
    block('Dateien (CRM-Ablage, Inhalt mit crm_datei_lesen)', await dateienFuer(s, { firmaId: f.id, mandatIds: mandate.map(m => m.id), dealIds: deals.map(c => c.id) })),
  ].filter(Boolean).join('\n\n');
  const kopf = `FIRMA ${f.id} · ${aktuell.length} Personen aktuell · ${deals.length} Deals · ${mandate.length} Mandate · ${angebote.length} Angebote${ausgeblendetText(s.eingeschraenkt.size)}`;
  return crmAntwort(kopf, koerper, i.teil, t => `firma_akte mit firma: ${f.id}, teil: ${t}`);
}

// ── pipeline (inkl. Deal-Akte) ────────────────────────────────────────────

async function pipeline(i: Eingabe, s: CrmSicht): Promise<string> {
  const { crm, heute } = s;
  const p = await ladePipeline();
  const dealSuche = text(i.deal, 120);
  if (dealSuche) {
    const r = eindeutig(crm.chancen, dealSuche, c => [c.titel, c.firma], suchPasst);
    if (!r) return 'Kein Deal zu dieser Angabe gefunden.';
    if (Array.isArray(r)) return mehrdeutig(r, c => `${c.titel} (${c.stufe})`);
    const c = r;
    const { angeboteZu } = await import('@/lib/crm/angebote');
    const g = p.gesundheit(c, heute);
    const akt = s.kontakte.flatMap(k => (k.aktivitaeten ?? []).filter(a => a.bezug === c.id).map(a => ({ k, a }))).sort((x, y) => ereignisMs(y.a) - ereignisMs(x.a));
    const koerper = [
      dealZeile(s, c, heute, p.gesundheit).slice(2),
      zeile(`Art ${c.art}`, c.leistungId && `Produkt ${c.leistungId}`, c.quelle && `Quelle ${c.quelle}`, `Gesellschaft ${c.gesellschaft}`, `angelegt ${tag(c.angelegt)}`, c.wiedervorlage && `Wiedervorlage ${c.wiedervorlage}`, c.erwartetVerschoben && `${c.erwartetVerschoben}× verschoben (ursprünglich ${c.erwartetUrsprung})`),
      `Qualifizierung: ${Object.entries(c.qualifizierung).map(([a, b]) => `${a} ${b}`).join(', ')}`,
      c.personenRollen ? `Rollen: ${Object.entries(c.personenRollen).map(([id, r2]) => `${s.name(id)} ${r2}`).join(', ')}` : '',
      `Ampel ${g.ampel}${g.gruende.length ? `: ${g.gruende.join('; ')}` : ''} · Wahrscheinlichkeit ${p.wahrscheinlichkeit(c.stufe, crm.wahrscheinlichkeiten)} % · Gesamtwert ${eur(p.gesamtwert(c))}`,
      c.selbstauskunft ? `Selbstauskunft: ${c.selbstauskunft}` : '', c.notiz ? `Notiz: ${c.notiz}` : '',
      `Historie: ${c.historie.map(h => `${tag(h.am)} ${h.stufe} (${h.von})`).join(' → ')}`,
      block('Aktivitäten zum Deal', akt.map(x => `${aktivitaetZeile(s, x.a)} · an ${anzeigename(x.k)}`)),
      block('Angebote', await Promise.all(angeboteZu(crm.angebote, { dealId: c.id }).map(a => angebotZeile(a, s)))),
      block('Follow-ups (offen)', await followupsFuer(s, f => f.bezug.art === 'chance' && f.bezug.id === c.id)),
      block('Aufgaben mit Bezug', await aufgabenFuerBezug(s, { firmaId: c.firmaId ?? '-', dealIds: [c.id] })),
      block('Dateien', await dateienFuer(s, { dealIds: [c.id] })),
    ].filter(Boolean).join('\n\n');
    return crmAntwort(`DEAL ${c.id} · Stufe ${c.stufe} · Ampel ${g.ampel}`, koerper, i.teil, t => `pipeline mit deal: ${c.id}, teil: ${t}`);
  }
  const offen = crm.chancen.filter(c => p.OFFENE_STUFEN.includes(c.stufe) && (!i.zustaendig || c.besitzer === text(i.zustaendig, 40)));
  const pr = p.prognose(offen, heute, crm.wahrscheinlichkeiten);
  const wr = p.winRate(crm.chancen, heute);
  const rot = offen.filter(c => p.gesundheit(c, heute).ampel === 'rot');
  const naechste = offen.filter(c => c.naechsterSchritt).sort((a, b) => a.naechsterSchritt!.datum.localeCompare(b.naechsterSchritt!.datum));
  const koerper = [
    `Offen ${eur(pr.offen)} · gewichtet ${eur(pr.gewichtet)} (ohne hängende ${eur(pr.gewichtetOhneHaengende)}) · Commit ${eur(pr.commit)} · Best Case ${eur(pr.bestCase)} · ohne nächsten Schritt ${pr.ohneSchritt}`,
    `Win Rate (${wr.fenster} Tage): ${wr.quote === null ? 'noch zu wenige Abschlüsse' : `${Math.round(wr.quote * 100)} %`} (${wr.gewonnen} gewonnen / ${wr.verloren} verloren)`,
    block('Je Stufe', pr.jeStufe.map(x => `- ${x.label}: ${x.anzahl} Deals · ${eur(x.wert)} · gewichtet ${eur(x.gewichtet)}${x.haengt ? ` · ${x.haengt} hängen` : ''}`)),
    block('Je Person', p.prognoseJePerson(offen, heute, crm.wahrscheinlichkeiten).map(x => `- ${x.person}: ${x.anzahl} Deals · gewichtet ${eur(x.gewichtet)} · Commit ${eur(x.commit)} · ${x.haengt} hängen · ${x.ohneSchritt} ohne Schritt`)),
    block('Hängende Deals (Ampel rot)', rot.map(c => dealZeile(s, c, heute, p.gesundheit))),
    block('Nächste Schritte', naechste.slice(0, 40).map(c => `- ${c.naechsterSchritt!.datum} · ${c.id} ${c.titel}: ${c.naechsterSchritt!.text} (${c.besitzer})`)),
    block('Alle offenen Deals', offen.map(c => dealZeile(s, c, heute, p.gesundheit))),
  ].join('\n\n');
  return crmAntwort(`PIPELINE ${heute} · ${offen.length} offene Deals · ${rot.length} hängen · Einzelner Deal: pipeline mit deal`, koerper, i.teil, t => `pipeline mit teil: ${t}`);
}

// ── mandate_lage ──────────────────────────────────────────────────────────

async function mandateLage(i: Eingabe, s: CrmSicht): Promise<string> {
  const { mandatLage, mrr, konzentration } = await import('@/lib/crm/kunden');
  const rechnungen = (await loadJson<{ rechnungen?: import('@/lib/crm/kunden').RechnungKurz[] }>('finanzplan'))?.rechnungen ?? [];
  const alle = s.crm.mandate.filter(m => !i.mandat || m.id === text(i.mandat, 80) || suchPasst([m.titel, m.kunde], text(i.mandat, 80)));
  const k = konzentration(s.crm.mandate.filter(m => m.status === 'aktiv'));
  // Zeit je Mandat diese Woche (29.09., B4) — bewusste Business-Blöcke des Haushalts (wie Fokus › Zeit je Mandat).
  const zeit = await (async () => {
    try { const { zeitJeMandatFuer } = await import('@/lib/zeitmessung/mandate-server'); return await zeitJeMandatFuer(s.person, 'woche'); } catch { return null; }
  })();
  const { stundenText } = await import('@/lib/zeitmessung/mandate-server');
  const zeitVon = new Map((zeit?.gesamt.zeilen ?? []).map(z => [z.id, z]));
  const zeilen = alle.map(m => {
    const l = mandatLage(m, s.heute, rechnungen);
    const z = zeitVon.get(m.id);
    return `${mandatZeile(s, m)}\n  Zeit diese Woche: ${z ? `${stundenText(z.sek)} (${z.bloecke} Blöcke)${z.euroJeStunde ? ` · ≈ ${eur(z.euroJeStunde)}/h (grober Hinweis)` : ''}` : '—'}\n  Lage: ${l.ampel ?? 'grau'}${l.health !== null ? ` · Health ${l.health}` : ''}${l.endeAm ? ` · Ende ${l.endeAm}` : ''}${l.fristBis ? ` · kündbar bis ${l.fristBis}` : ''}${l.gruende.length ? ` · ${l.gruende.join('; ')}` : ''}`
      + `${m.ziele.length ? `\n  Ziele: ${m.ziele.map(z => `${z.text}${z.ziel ? ` (Ziel ${z.ziel}` : ''}${z.ist ? `, ist ${z.ist})` : z.ziel ? ')' : ''}`).join(' | ')}` : ''}${m.notiz ? `\n  Notiz: ${m.notiz}` : ''}`;
  });
  const zeitKopf = zeit ? `Zeit ${zeit.label} (${zeit.von} bis ${zeit.bis}): ${stundenText(zeit.gesamt.mitMandatSek)} mit Mandat · ${stundenText(zeit.gesamt.sek - zeit.gesamt.mitMandatSek)} ohne Mandat` : 'Zeit je Mandat: nicht lesbar';
  const koerper = [`MRR ${eur(mrr(s.crm.mandate))}${k ? ` · größter Kunde ${k.kunde} mit ${Math.round(k.anteil * 100)} %` : ''}`, zeitKopf, block('Mandate', zeilen)].join('\n\n');
  return crmAntwort(`MANDATE · ${alle.length} von ${s.crm.mandate.length} · aktiv ${s.crm.mandate.filter(m => m.status === 'aktiv').length}`, koerper, i.teil, t => `mandate_lage mit teil: ${t}`);
}

// ── angebote_lage ─────────────────────────────────────────────────────────

async function angeboteLage(i: Eingabe, s: CrmSicht): Promise<string> {
  const A = await import('@/lib/crm/angebote');
  const alle = s.crm.angebote ?? [];
  const suche = text(i.angebot, 80);
  if (suche) {
    const r = eindeutig(alle, suche, a => [a.titel, a.nummer], suchPasst);
    if (!r) return 'Kein Angebot zu dieser Angabe gefunden.';
    if (Array.isArray(r)) return mehrdeutig(r, a => `${a.titel} (${a.status})`);
    const a = r;
    const sum = A.angebotSummen(a);
    const koerper = [
      (await angebotZeile(a, s)).slice(2),
      `Summen: netto ${A.euroCent(sum.gesamt.netto)} · USt ${A.euroCent(sum.gesamt.ust)} · brutto ${A.euroCent(sum.gesamt.brutto)} · Zahlungsziel ${a.zahlungszielTage} Tage`,
      block('Positionen', a.positionen.map(x => `- ${x.titel} · ${x.menge} ${x.einheit} × ${A.euroCent(x.einzelpreisCent)}${x.rabattProzent ? ` − ${x.rabattProzent} %` : ''} · USt ${x.ustSatz} % · ${A.BASIS_LABEL[x.basis]}${x.laufzeitMonate ? ` · ${x.laufzeitMonate} Monate` : ''}\n  ${x.text}`)),
      `Einleitung:\n${a.einleitung}`, `Schluss:\n${a.schluss}`,
      a.status === 'entwurf' ? `Noch offen bis zum Stellen: ${A.stellenFehlt(a, s.heute).join(', ') || 'nichts'} — stellen macht nur ein Mensch im Angebots-Tool.` : '',
    ].filter(Boolean).join('\n\n');
    return crmAntwort(`ANGEBOT ${a.id} · ${a.status}`, koerper, i.teil, t => `angebote_lage mit angebot: ${a.id}, teil: ${t}`);
  }
  const bald = A.plusTage(s.heute, 7);
  const offen = alle.filter(a => a.status === 'gestellt');
  const auslaufend = offen.filter(a => a.gueltigBis <= bald);
  const koerper = [
    `Nach Status: ${A.ANGEBOT_STATUS.map(x => `${x.label} ${alle.filter(a => a.status === x.id).length}`).join(' · ')}`,
    block('Laufen in 7 Tagen aus (nachfassen)', await Promise.all(auslaufend.map(a => angebotZeile(a, s)))),
    block('Offen (gestellt)', await Promise.all(offen.map(a => angebotZeile(a, s)))),
    block('Entwürfe', await Promise.all(alle.filter(a => a.status === 'entwurf').map(a => angebotZeile(a, s)))),
    block('Abgelaufen', await Promise.all(alle.filter(a => a.status === 'abgelaufen').map(a => angebotZeile(a, s)))),
    block('Produkte ohne Angebotstext', s.crm.leistungen.filter(l => A.produktAngebotFehlt(l).length).map(l => `- ${l.id} · ${l.name} · ${l.status}`)),
  ].join('\n\n');
  return crmAntwort(`ANGEBOTE · ${alle.length} · offen ${offen.length} · laufen bald aus ${auslaufend.length}`, koerper, i.teil, t => `angebote_lage mit teil: ${t}`);
}

// ── kampagnen_lage / events_lage / marketing_lage ─────────────────────────

async function kampagnenLage(i: Eingabe, s: CrmSicht): Promise<string> {
  const { kampagnenZahlen, PLAYBOOKS } = await import('@/lib/crm/kampagnen');
  const l = s.crm.kampagnen.filter((k: Kampagne) => !i.kampagne || k.id === text(i.kampagne, 80) || suchPasst([k.name], text(i.kampagne, 80)));
  const zeilen = l.map(k => {
    const z = kampagnenZahlen(k, s.heute);
    const sichtbar = k.kontaktIds.filter(id => !s.eingeschraenkt.has(id));
    return `- ${k.id} · ${k.name} · ${k.status} · Playbook ${k.playbook} · Kanal ${k.kanal}${k.start ? ` · ${k.start}–${k.ende ?? ''}` : ''} · Ziel ${k.ziel}`
      + `\n  ${z.personen} Personen · angesprochen ${z.angesprochen} · reagiert ${z.reagiert} · Gespräche ${z.gespraeche} · Deals ${z.chancen} · kein Interesse ${z.keinInteresse} · offen ${z.offen} · Schritte offen ${z.schritteOffen} (fällig ${z.schritteFaellig})`
      + `${l.length === 1 ? `\n  Schritte: ${k.schritte.map(x => `Tag ${x.tag} ${x.text}${x.erledigt ? ' ✓' : ''}`).join(' | ')}\n  Personen: ${sichtbar.map(id => `${id} ${s.name(id)}`).join(', ')}` : ''}`;
  });
  const koerper = [block('Kampagnen', zeilen), `Playbooks: ${PLAYBOOKS.map(p => `${p.id} (${p.name})`).join(', ')}`].join('\n\n');
  return crmAntwort(`KAMPAGNEN · ${l.length}${ausgeblendetText(s.eingeschraenkt.size)} · versendet wird nichts`, koerper, i.teil, t => `kampagnen_lage mit teil: ${t}`);
}

async function eventsLage(i: Eingabe, s: CrmSicht): Promise<string> {
  const { eventZahlen, nachfassenRest } = await import('@/lib/crm/events');
  const { eventName, istNetzwerkenEvent, reiheVon } = await import('@/lib/crm/marke');
  // Fremde Veranstaltungen aus „Netzwerken“ sind keine Make.One-Events — hier nicht listen.
  // Reihe (03.10.): „Fokus Innovation“ findet alle Abende der Reihe; eventName nennt sie in jeder Zeile.
  const l = s.crm.events.filter((e: Event) => !istNetzwerkenEvent(e) && (!i.event || e.id === text(i.event, 80) || suchPasst([e.titel, reiheVon(e)?.name ?? ''], text(i.event, 80))));
  const zeilen = l.map(e => {
    const z = eventZahlen(e, s.crm.teilnahmen, s.kontakte, s.crm.chancen);
    const gaeste = s.crm.teilnahmen.filter(t => t.eventId === e.id);
    const ausgeblendet = gaeste.filter(t => s.eingeschraenkt.has(t.kontaktId)).length;
    const rest = nachfassenRest(e, Date.now());
    return `- ${e.id} · ${eventName(e)} · ${e.datum}${e.uhrzeit ? ` ${e.uhrzeit}` : ''} · ${e.status} · ${e.format}${e.ort ? ` · ${e.ort}` : ''}${e.kapazitaet ? ` · ${e.kapazitaet} Plätze` : ''} · Ziel ${e.ziel}`
      + `\n  eingeladen ${z.eingeladen} · zugesagt ${z.zugesagt} · da ${z.da} · no show ${z.noShow} · nachgefasst ${z.nachgefasst} (offen ${z.nachfassenOffen}${rest > 0 ? `, noch ${Math.ceil(rest / 36e5)} h` : ''}) · Folgegespräche ${z.folgegespraeche} · Kosten ${eur(z.kosten)}${z.noteSchnitt !== null ? ` · Note ${z.noteSchnitt}` : ''}`
      + `${l.length <= 3 ? `\n  Gäste: ${gaeste.filter(t => !s.eingeschraenkt.has(t.kontaktId)).map(t => `${t.kontaktId} ${s.name(t.kontaktId)} (${t.status}${t.einladenDurch ? `, lädt ${t.einladenDurch}` : ''}${t.followUpAm ? `, nachfassen ${t.followUpAm}` : ''}${t.feedback?.note ? `, Note ${t.feedback.note}` : ''})`).join(', ') || 'keine'}${ausgeblendet ? ` · ${ausgeblendet} eingeschränkte ausgeblendet` : ''}`
      + `${e.checkliste?.length ? `\n  Checkliste: ${e.checkliste.map(c => `${c.text}${c.erledigt ? ' ✓' : ` (−${c.tageVorher} T)`}`).join(' | ')}` : ''}${e.notiz ? `\n  Notiz: ${e.notiz}` : ''}` : ''}`;
  });
  return crmAntwort(`EVENTS (Make.One) · ${l.length} · kommend ${l.filter(e => e.datum >= s.heute).length}`, block('Events', zeilen), i.teil, t => `events_lage mit teil: ${t}`);
}

/**
 * Besuchte Events (Reiter „Events“): fremde Veranstaltungen, Messen, Kunden-Events — getrennt von unseren Make.One-Abenden (`events_lage`).
 * Wirkung und Urteil kommen aus derselben Rechnung wie die Akte (`besuchUebersicht`); die erfassten Personen aus dem Abendbericht (`berichtAus`,
 * ohne eingeschränkte Personen — die fehlen in `s.kontakte` ohnehin). Sprachnotizen ohne Abschrift stehen als offener Punkt, nie als Inhalt.
 */
async function besucheLage(i: Eingabe, s: CrmSicht): Promise<string> {
  const { besuchUebersicht, besuchWirkung, besuchUrteil } = await import('@/lib/crm/besuche');
  const { berichtAus, schrittLabel } = await import('@/lib/crm/netzwerken');
  const { istBesuch, anmeldungVon, anmeldungLabel, fuerVon } = await import('@/lib/crm/besuche-form');
  const gefragt = text(i.event, 80);
  const l = s.crm.events.filter((e: Event) => istBesuch(e) && (!gefragt || e.id === gefragt || suchPasst([e.titel], gefragt)))
    .sort((a, b) => b.datum.localeCompare(a.datum));
  const ctx = { teilnahmen: s.crm.teilnahmen, kontakte: s.kontakte, chancen: s.crm.chancen, heute: s.heute };
  const summe = besuchUebersicht(l, ctx).summe;
  const firmaName = (id: string) => s.crm.firmen.find(f => f.id === id)?.name ?? id;
  const zeilen = l.map(e => {
    const w = besuchWirkung(e, ctx), u = besuchUrteil(e, w, s.heute), f = fuerVon(e);
    const bericht = berichtAus({ event: e, teilnahmen: s.crm.teilnahmen, kontakte: s.kontakte, followups: s.crm.followups, heute: s.heute });
    const ausgeblendet = s.crm.teilnahmen.filter(t => t.eventId === e.id && t.netzwerken && s.eingeschraenkt.has(t.kontaktId)).length;
    const kopf = `- ${e.id} · ${e.titel} · ${e.datum}${e.ort ? ` · ${e.ort}` : ''} · ${anmeldungLabel(anmeldungVon(e))} · ${f.art === 'kunde' ? `für Kunde ${firmaName(f.firmaId)}` : 'für MAKE selbst'}`
      + `\n  ${w.kontakte} erfasst · nachgefasst ${w.nachgefasst} (offen ${w.nachfassenOffen}) · Termine ${w.termine} · Deals ${w.deals} (Pipeline ${eur(w.pipeline)}, gewonnen ${eur(w.umsatz)}) · Kosten ${eur(w.kosten)}${w.kostenJeKontakt !== null ? ` (${eur(w.kostenJeKontakt)} je Kontakt)` : ''} · Urteil: ${u.label}${w.zielGesamt ? ` · Ziele ${w.zielGetroffen}/${w.zielGesamt}` : ''}`;
    const personen = l.length <= 3 ? bericht.zeilen.map(z => `\n  - ${z.kontaktId} ${z.name}${z.firma ? ` (${z.firma})` : ''} · ${schrittLabel(z.schritt)} · zuständig ${z.zustaendig}${z.offen.length ? ` · offen: ${z.offen.join('; ')}` : ''}`).join('') + (ausgeblendet ? `\n  ${ausgeblendet} eingeschränkte ausgeblendet` : '') : '';
    return kopf + personen;
  });
  return crmAntwort(`BESUCHTE EVENTS · ${l.length} · erfasst ${summe.kontakte} · Deals ${summe.deals} · Pipeline ${eur(summe.pipeline)}${ausgeblendetText(s.eingeschraenkt.size)}`, block('Besuchte Events', zeilen), i.teil, t => `besuche_lage mit teil: ${t}`);
}

async function marketingLage(i: Eingabe, s: CrmSicht): Promise<string> {
  const M = await import('@/lib/crm/marketing');
  const { segmentAuswerten, kontextAus } = await import('@/lib/crm/segmente');
  const { crm, heute } = s;
  const ctx = kontextAus(crm, heute);
  const einst = M.einstellungAus(crm);
  const empfaenger = M.newsletterEmpfaenger(s.kontakte);
  const koerper = [
    `Positionierung: ${einst.positionierung || '—'}\nKundenprofil (ICP): ${einst.icp || '—'}\nTon: ${einst.ton || '—'}\nSäulen: ${einst.saeulen.map(x => x.name).join(', ') || '—'}`,
    `Kennzahlen: ${M.marketingKennzahlen(s.kontakte, crm, heute).map(k => `${k.label} ${k.anzeige}${k.ampel !== 'grau' ? ` (${k.ampel})` : ''}`).join(' · ')}`,
    block('Beiträge', crm.beitraege.map(b => `- ${b.id} · ${b.titel} · ${b.kanal} · ${b.status}${b.datum ? ` · ${b.datum}` : ''}${b.stimme ? ` · Stimme ${b.stimme}` : ''}${b.freigabe ? ` · Freigabe ${b.freigabe.status}` : ''} · Wirkung ${M.wirkungZahlen(b).reaktionen}/${M.wirkungZahlen(b).gespraeche}/${M.wirkungZahlen(b).anfragen}`)),
    block('Newsletter-Ausgaben', crm.newsletter.map(a => `- ${a.id} · ${a.titel} · ${a.status}${a.datum ? ` · ${a.datum}` : ''}${a.empfaenger ? ` · ${a.empfaenger} Empfänger` : ''}`)),
    `Newsletter-Empfänger mit Double-Opt-in: ${empfaenger.length}`,
    block('Segmente', crm.segmente.map(g => { const a = segmentAuswerten(s.kontakte, g.kriterien, ctx); return `- ${g.id} · ${g.name} · ${a.anzahl} Personen (Mail grün ${a.kanaele.mail}, Newsletter ${a.kanaele.newsletter}, nur persönlich ${a.kanaele.nurPersoenlich}) · ${M.kriterienText(g.kriterien)}`; })),
    block('Offene Freigaben', M.freigabeLage(crm).map(p => `- ${p.art} ${p.id} · ${p.titel} · bei ${p.bei}`)),
  ].join('\n\n');
  return crmAntwort(`MARKETING · ${crm.beitraege.length} Beiträge · ${crm.newsletter.length} Newsletter · ${crm.segmente.length} Segmente${ausgeblendetText(s.eingeschraenkt.size)}`, koerper, i.teil, t => `marketing_lage mit teil: ${t}`);
}

// ── kennzahlen / sales_lage / qualifizierung_lage ─────────────────────────

async function kennzahlenLesen(i: Eingabe, s: CrmSicht): Promise<string> {
  const { kennzahlen } = await import('@/lib/crm/kennzahlen');
  const { marketingKennzahlen } = await import('@/lib/crm/marketing');
  const { eventKennzahlen, traktion, uebergaben } = await import('@/lib/crm/traktion');
  const { traktionsIndex, ersterLauf } = await import('@/lib/crm/traktion-index');
  const { ladeIndexDatei } = await import('@/lib/kennzahlen/speicher');
  const { befunde } = await import('@/lib/crm/befunde');
  const { kontakte, crm, heute } = s;
  const sales = kennzahlen(kontakte, crm, heute), marketing = marketingKennzahlen(kontakte, crm, heute), event = eventKennzahlen(kontakte, crm, heute);
  const datei = await ladeIndexDatei('traktion-index');
  const idx = traktionsIndex({ kontakte, crm, heute, schwellen: datei.schwellen, kpis: [...sales, ...marketing, ...event], ersterLauf: ersterLauf(datei, heute) });
  const t = traktion({ sales, marketing, event });
  const kz = (l: typeof sales) => l.map(k => `- ${k.label}: ${k.anzeige} (${k.ampel}) · Ziel ${k.ziel}`);
  const koerper = [
    `Traktions-Index ${idx.index ?? '—'} (${idx.label}) · Abdeckung ${Math.round(idx.abdeckung * 100)} %${idx.hebel ? ` · größter Hebel ${idx.hebel.label}` : ''}`,
    idx.saeulen.map(x => `${x.label} (${x.gewicht} %): ${x.score ?? '—'}${x.zuDuenn ? ' — zu dünn gemessen' : ''}\n${x.kennzahlen.map(k => `- ${k.label}: ${k.anzeige ?? 'Lücke'} (${k.ampel})`).join('\n')}`).join('\n\n'),
    `Traction-Score ${t.score ?? '—'} (${t.hinweis})`,
    block('Sales-Kennzahlen', kz(sales)), block('Marketing-Kennzahlen', kz(marketing)), block('Event-Kennzahlen', kz(event)),
    block('Übergaben zwischen den Welten', uebergaben(kontakte, crm, heute).map(u => `- ${u.titel} ${u.anzahl} (${u.von}→${u.an}): ${u.text}`)),
    block('Befunde (was zu tun ist)', befunde(kontakte, crm, heute).map(b => `- P${b.prio} ${b.titel}: ${b.grund} (${b.bereich})`)),
  ].join('\n\n');
  return crmAntwort(`KENNZAHLEN ${heute} · Index ${idx.index ?? '—'} · ${sales.length + marketing.length + event.length} Kennzahlen${ausgeblendetText(s.eingeschraenkt.size)}`, koerper, i.teil, x => `kennzahlen mit teil: ${x}`);
}

async function salesLage(i: Eingabe, s: CrmSicht): Promise<string> {
  const { werIstDran } = await import('@/lib/crm/heute');
  const { fuerDich, teamFeed, nameVon } = await import('@/lib/crm/team');
  const { teamZahlen } = await import('@/lib/crm/pipeline');
  const { winLoss, verweildauerJeStufe, zyklus } = await import('@/lib/crm/deal-auswertung');
  const { kampagnenZahlen } = await import('@/lib/crm/kampagnen');
  const { kontakte, crm, heute, person } = s;
  const wer = text(i.fuer, 40) || person;
  const a = werIstDran(kontakte, crm, heute, wer, anzahl(i.anzahl, 12, 30));
  const wl = winLoss(crm.chancen, heute);
  const zy = zyklus(crm.chancen);
  const koerper = [
    block(`Power Hour — wer heute dran ist (für ${nameVon(wer)})`, a.karten.map(c => `- ${c.kontakt.id} ${c.name}${c.kontakt.firma ? ` · ${c.kontakt.firma}` : ''} · ${c.kategorie} · ${c.gruende.join('; ')}${c.kanal ? ` · Kanal ${c.kanal.kanal} ${c.kanal.farbe} (${c.kanal.grund})` : ' · kein zulässiger Kanal'}${c.chance ? ` · Deal ${c.chance.id}` : ''}`)),
    `Ausgefiltert: Sperre ${a.ausgefiltert.sperre} · ohne Kanal ${a.ausgefiltert.ohneKanal} · kürzlich ${a.ausgefiltert.kuerzlich} · bei anderen ${a.ausgefiltert.beiAnderen}`,
    block(`Für ${nameVon(person)}`, fuerDich(person, kontakte, crm, heute).map(f => `- ${f.titel} ${f.anzahl}: ${f.text}`)),
    block('Team heute/Woche', teamZahlen(kontakte, crm.sitzungen, heute).map(t => `- ${t.person}: Power Hours ${t.powerHours.heute}/${t.powerHours.woche} · Gespräche ${t.gespraeche.heute}/${t.gespraeche.woche}`)),
    block('Zuletzt im Team', teamFeed(kontakte, crm, new Date(Date.now() - 7 * 864e5).toISOString(), 12).map(e => `- ${nameVon(e.person)}: ${e.text}`)),
    `Auswertung: Win/Loss 180 Tage ${wl.gewonnen}/${wl.verloren}${wl.quote !== null ? ` (${Math.round(wl.quote * 100)} %)` : ''} · Zyklus Median ${zy.median ?? '—'} Tage · Ø Deal ${zy.dealGroesse !== null ? eur(zy.dealGroesse) : '—'}`,
    block('Verweildauer je Stufe', verweildauerJeStufe(crm.chancen, heute).map(v => `- ${v.label}: Ø ${v.schnitt ?? '—'} Tage (n ${v.n}, längste ${v.laengste})`)),
    block('Aktive Kampagnen', crm.kampagnen.filter(k => k.status === 'aktiv').map(k => { const z = kampagnenZahlen(k, heute); return `- ${k.id} · ${k.name} · offen ${z.offen} · Gespräche ${z.gespraeche} · fällige Schritte ${z.schritteFaellig}`; })),
  ].join('\n\n');
  return crmAntwort(`SALES ${heute} · ${a.karten.length} Karten für die Power Hour${ausgeblendetText(s.eingeschraenkt.size)} · Vorschläge (Reihenfolge, Leitfaden, Entwurf) über crm_vorschlag`, koerper, i.teil, t => `sales_lage mit teil: ${t}`);
}

async function qualifizierungLage(i: Eingabe, s: CrmSicht): Promise<string> {
  const { leads, zuQualifizieren, trichter, fehltBisSqlZeile } = await import('@/lib/crm/leads');
  const { gespraechsFragen, standardScoring } = await import('@/lib/crm/scoring');
  const { temperaturVerteilung } = await import('@/lib/crm/score');
  const { kreisKandidaten } = await import('@/lib/crm/runden');
  const { netzRunde } = await import('@/lib/crm/netzwerk');
  const { lifecycleVerteilung } = await import('@/lib/crm/vorschlaege');
  const { kontakte, crm, heute, person } = s;
  const zeilen = leads(kontakte, crm, heute);
  const runde = zuQualifizieren(zeilen, { wer: text(i.wer, 40) || person, auchKalt: i.auch_kalt === true, heute });
  const tr = trichter(zeilen, crm);
  const tv = temperaturVerteilung(zeilen);
  const lv = lifecycleVerteilung(kontakte, crm, heute);
  const kreis = kreisKandidaten(kontakte, crm, heute);
  const netz = netzRunde(kontakte, person, heute);
  const koerper = [
    `Trichter: ${Object.entries(tr).map(([a, b]) => `${a} ${typeof b === 'number' ? b : JSON.stringify(b)}`).join(' · ')}`,
    `Temperatur: ${Object.entries(tv).map(([a, b]) => `${a} ${b}`).join(' · ')} · Lifecycle: ${Object.entries(lv.je).map(([a, b]) => `${a} ${b}`).join(' · ')} (${lv.gesetzt} von Hand) · vorgeschlagen: MQL ${lv.vorgeschlagen.mql} (nur Leads aus dem Marketing), SQL ${lv.vorgeschlagen.sql}`,
    `Fragen im Gespräch (Sales-Scoring; SQL ab ${(crm.scoring ?? standardScoring()).sales.schwelle} Punkten und erfüllten Muss-Kriterien, MQL nur für Leads aus dem Marketing (Kampagne, Newsletter, Anfrage, Inhalte, eigenes Event) ab ${(crm.scoring ?? standardScoring()).marketing.schwelle} Marketing-Punkten; Leads von Events, Empfehlungen und Direktansprache bleiben Lead, bis die Qualifizierung durch ist): ${gespraechsFragen(crm.scoring ?? standardScoring()).map(f => `${f.kriterium.id} = ${f.kriterium.hinweis ?? f.kriterium.name}`).join(' · ')}`,
    block('Qualifizierungsrunde (dran)', runde.slice(0, anzahl(i.anzahl, 15, 40)).map(z => `- ${z.id} · ${z.name} (${z.art}) · ${z.status} · Score ${z.score.punkte} ${z.score.temperatur} · ${z.score.scoring?.marketingLead ? `Marketing-Lead (${z.score.scoring.marketingHerkunft.map(g => g.text).join(', ')})` : 'Lead, noch zu qualifizieren'} · BEAN ${z.bean} · Kanal ${z.kanal} · fehlt bis SQL: ${fehltBisSqlZeile(z).join(', ') || 'nichts'}${z.antworten ? ` · Antworten: ${Object.entries(z.antworten).filter(([, v]) => v).map(([a, b]) => `${a}: ${b}`).join(' | ')}` : ''}${z.ohneBesitzer ? ' · ohne Zuständig' : ''}`)),
    block('Kreis-Runde (ohne Kreis)', kreis.slice(0, 20).map(x => `- ${x.kontakt.id} ${anzeigename(x.kontakt)} · ${x.grund}${x.wichtig ? ' · wichtig' : ''}`)),
    block(`Vernetzen-Runde (${person})`, netz.karten.slice(0, 20).map(x => `- ${x.kontakt.id} ${anzeigename(x.kontakt)} · ${x.stufe}: ${x.grund}`)),
  ].join('\n\n');
  return crmAntwort(`QUALIFIZIERUNG · ${runde.length} Leads dran · ${kreis.length} ohne Kreis · ${netz.karten.length} zum Vernetzen${ausgeblendetText(s.eingeschraenkt.size)}`, koerper, i.teil, t => `qualifizierung_lage mit teil: ${t}`);
}

// ── stammdaten_lage / datenqualitaet ──────────────────────────────────────

async function stammdatenLage(i: Eingabe, s: CrmSicht): Promise<string> {
  const { gesellschaftenLaden } = await import('@/lib/crm/angebot-server');
  const { gesellschaftFuerAnzeige, mitVorgaben } = await import('@/lib/crm/gesellschaften');
  const { produktAngebotFehlt } = await import('@/lib/crm/angebote');
  const { KONFLIKT_SPEICHER } = await import('@/lib/crm/import-konflikte');
  const g = (await gesellschaftenLaden(s.haushalt)).map(x => mitVorgaben(gesellschaftFuerAnzeige(x)));
  const konflikte = (await loadJson<import('@/lib/crm/import-konflikte').KonfliktStand>(KONFLIKT_SPEICHER))?.konflikte ?? [];
  const sichtbar = konflikte.filter(k => !s.eingeschraenkt.has(k.kontaktId));
  const w = s.crm.wertelisten ?? {};
  const koerper = [
    block('Gesellschaften (IBAN maskiert)', g.map(x => `- ${x.id} · ${x.name} (${x.kurz}) · Nummern ${x.nummernformat} · Zahlungsziel ${x.zahlungszielTage} T · Gültigkeit ${x.gueltigkeitTage} T${x.bank?.iban ? ` · IBAN ${x.bank.iban}` : ''}`)),
    block('Produkte & Leistungen', s.crm.leistungen.map(l => `- ${l.id} · ${l.name} · ${l.typ} · ${l.status} · ${eur(l.preis.betrag)}${l.preis.bis ? `–${eur(l.preis.bis)}` : ''} ${l.preis.einheit} · ${l.gesellschaft}${produktAngebotFehlt(l).length ? ' · OHNE Angebotstext' : ''}${l.angebot?.leistungstext ? `\n  Leistungstext: ${l.angebot.leistungstext}` : ''}${l.beschreibung ? `\n  Beschreibung: ${l.beschreibung}` : ''}`)),
    `Wertelisten: Verlustgründe ${(w.verlustgruende ?? []).join(', ') || 'Standard'} · Branchen ${(w.branchen ?? []).join(', ') || '—'} · Typen ${(w.typen ?? []).join(', ') || '—'} · Kategorien ${(w.kategorien ?? []).join(', ') || '—'} · Labels ${(w.labels ?? []).join(', ') || '—'}`,
    block('Import-Konflikte (Entscheidung je Konflikt)', sichtbar.map(k => `- ${k.kontaktId} ${s.name(k.kontaktId)} · Feld ${k.feld}: online „${String(k.online ?? '')}“ ↔ Liste „${String(k.liste ?? '')}“${k.hinweis ? ` · ${k.hinweis}` : ''}`)),
    `Datenschutz: ${s.crm.antraege.filter(a => a.status === 'offen').length} offene Betroffenenanträge · ${s.crm.verarbeitungen.length} Verarbeitungen im Verzeichnis (Art. 30)`,
  ].join('\n\n');
  return crmAntwort(`STAMMDATEN · ${g.length} Gesellschaften · ${s.crm.leistungen.length} Produkte · ${sichtbar.length} Import-Konflikte`, koerper, i.teil, t => `stammdaten_lage mit teil: ${t}`);
}

async function datenqualitaet(i: Eingabe, s: CrmSicht): Promise<string> {
  const { ladeVerbindungsBestaende } = await import('@/lib/crm/verbindungen-laden');
  const { verbindungenPruefen, verbindungsAmpel } = await import('@/lib/crm/verbindungen');
  const { dubletten, wasWandert, wanderungText } = await import('@/lib/crm/dubletten');
  const { nachweisOffen } = await import('@/lib/crm/einwilligung');
  const { nichtGeprueft } = await import('@/lib/crm/geprueft');
  const { vollstaendigkeit } = await import('@/lib/crm/kennzahlen');
  const befunde = verbindungenPruefen(await ladeVerbindungsBestaende(s.heute, s.person));
  const paare = dubletten(s.kontakte);
  const nw = nachweisOffen(s.kontakte);
  const ng = nichtGeprueft(s.kontakte, s.crm, s.heute);
  const koerper = [
    block(`Verbindungsprüfung (Ampel ${verbindungsAmpel(befunde)})`, befunde.map(b => `- ${b.id} · ${b.schwere} · ${b.text} · ${b.anzahl}× · Beispiele ${b.beispiele.join(', ') || '—'}${b.reparierbar ? ' · reparierbar' : ''}`)),
    block('Dubletten-Kandidaten', paare.slice(0, 40).map(([a, b]) => `- ${a.id} ${anzeigename(a)} ↔ ${b.id} ${anzeigename(b)} · bei Zusammenführen wandert von ${b.id}: ${wanderungText(wasWandert(s.crm, b))}`)),
    `Einwilligung ohne vollständigen Nachweis: ${nw.liste.length} (nur von Hand ergänzen)`,
    `Stammdaten länger nicht geprüft: ${ng.length}`,
    block('Vollständigkeit', vollstaendigkeit(s.kontakte).map(v => `- ${v.label}: ${v.anzahl} (${Math.round(v.anteil * 100)} %)`)),
  ].join('\n\n');
  return crmAntwort(`DATENQUALITÄT · ${befunde.length} Befunde · ${paare.length} Dubletten-Kandidaten${ausgeblendetText(s.eingeschraenkt.size)} · Reparieren/Zusammenführen nur als crm_vorschlag`, koerper, i.teil, t => `datenqualitaet mit teil: ${t}`);
}

// ── heads_lage — die Heads (Sales, Marketing, Event) in derselben Freigabe-Logik ──

async function headsLage(i: Eingabe, s: CrmSicht): Promise<string> {
  const { HEADS, HEAD_NAME } = await import('@/lib/heads/prompt');
  const { standName, leererStand } = await import('@/lib/heads/stand');
  const nur = HEADS.filter(h => !i.head || h === i.head);
  let offen = 0, ausgeblendet = 0;
  const teile: string[] = [];
  for (const h of nur) {
    const st = { ...leererStand(), ...((await loadJson<import('@/lib/heads/stand').HeadStand>(standName(h))) ?? {}) };
    const b = st.berichte[st.berichte.length - 1];
    const l = st.vorschlaege.filter(v => v.status === 'offen');
    const sichtbar = l.filter(v => !(v.kontakt_id && s.eingeschraenkt.has(v.kontakt_id)));
    ausgeblendet += l.length - sichtbar.length; offen += sichtbar.length;
    teile.push([
      `${HEAD_NAME[h]} (${h})${b ? ` · letzter Lauf ${tag(b.zeit)} · ${b.antwort.status}: ${b.antwort.zusammenfassung}` : ' · noch kein Lauf'} · Autonomie ${st.autonomie ?? 'intern'}`,
      block('Offene Vorschläge (Freigabe: crm_vorschlag art head_entscheiden)', sichtbar.map(v => `- ${v.id} · ${v.art} · ${v.titel} · Priorität ${v.prioritaet}${v.frist ? ` · Frist ${v.frist}` : ''}${v.fuer ? ` · für ${v.fuer}` : ''}${v.kontakt_id ? ` · ${s.name(v.kontakt_id)} (${v.kontakt_id})` : ''}${v.chance_id ? ` · Deal ${v.chance_id}` : ''}`
        + `
  Warum: ${v.begruendung}${v.signal ? `
  Signal: ${v.signal.typ}${v.signal.datum ? ` ${v.signal.datum}` : ''} — ${v.signal.text}` : ''}${v.entwurf ? `
  Entwurf (${v.entwurf.kanal}): ${v.entwurf.text}` : ''}${v.kampagne ? `
  Kampagne: ${v.kampagne.name} (${v.kampagne.playbook}), ${v.kampagne.kontakt_ids.length} Personen` : ''}`)),
    ].join('\n'));
  }
  return crmAntwort(`HEADS · ${offen} offene Vorschläge${ausgeblendet ? ` · ${ausgeblendet} zu eingeschränkten Kontakten ausgeblendet (Art. 18)` : ''} · Läufe startet run_agent (head-sales, head-marketing, head-event)`, teile.join('\n\n'), i.teil, t => `heads_lage mit teil: ${t}`);
}

// ── crm_datei_lesen ───────────────────────────────────────────────────────

async function crmDateiLesen(i: Eingabe, s: CrmSicht): Promise<string> {
  const { DATEI_ID, nurCrm, groesseText } = await import('@/lib/dateien/regeln');
  const id = text(i.datei, 80);
  if (!DATEI_ID.test(id)) return 'Fehlgeschlagen: datei braucht die Kennung (d-…) aus kontakt_akte, firma_akte oder pipeline.';
  if (!s.haushalt) return 'Fehlgeschlagen: Für diese Person ist kein Haushalt gesetzt — die Dateiablage ist nicht erreichbar.';
  const { lesen, ablageListe } = await import('@/lib/dateien/ablage');
  const eintrag = nurCrm(await ablageListe(s.haushalt)).find(d => d.id === id);
  if (!eintrag) return 'Fehlgeschlagen: Diese Kennung gibt es in der CRM-Ablage nicht (Projekt-/Aufgaben-Dateien liest datei_lesen).';
  // Art. 18: Unterlagen einer eingeschränkten Person liest ZOE nicht.
  if (eintrag.kontaktId && s.eingeschraenkt.has(eintrag.kontaktId)) return `DATEI ${id} · gehört zu einem eingeschränkten Kontakt (Art. 18) — ZOE liest sie nicht.`;
  const { einwilligungenMitBeleg } = await import('@/lib/dateien/einwilligung-beleg');
  const meta = [
    `Datei: ${eintrag.datei?.name ?? '(ohne Datei)'}${eintrag.titel ? ` · ${eintrag.titel}` : ''}`,
    `Art ${eintrag.art}${eintrag.datei ? ` · ${eintrag.datei.typ} · ${groesseText(eintrag.datei.groesse)}` : ''} · ${tag(eintrag.hochgeladenAm)} von ${eintrag.hochgeladenVon}`,
    zeile(eintrag.kontaktId && `Kontakt ${eintrag.kontaktId} ${s.name(eintrag.kontaktId)}`, eintrag.firmaId && `Firma ${eintrag.firmaId}`, eintrag.dealId && `Deal ${eintrag.dealId}`, eintrag.mandatId && `Mandat ${eintrag.mandatId}`, eintrag.angebotId && `Angebot ${eintrag.angebotId}`, eintrag.rechnungId && `Rechnung ${eintrag.rechnungId}`),
    eintrag.notiz ? `Notiz: ${eintrag.notiz}` : '',
  ].filter(Boolean).join('\n');
  // Einwilligungs-Belege: nur die Angaben — der Nachweis bleibt, wo er ist.
  if (einwilligungenMitBeleg(s.kontakte, id).anzahl > 0) return crmAntwort(`DATEI ${id} · Einwilligungs-Beleg — nur die Angaben, kein Inhalt`, meta, 1, () => '', ABLAGE_QUELLE);
  if (eintrag.gesellschaft) return crmAntwort(`DATEI ${id} · Logo einer Gesellschaft — nur die Angaben`, meta, 1, () => '', ABLAGE_QUELLE);
  if (!eintrag.datei) return crmAntwort(`DATEI ${id} · Eintrag ohne Datei — nur die Angaben`, meta, 1, () => '', ABLAGE_QUELLE);
  // Sprachnotizen (Netzwerken, 02.10.): kein Text lesbar — die Abschrift folgt (KI), bis dahin nur die Angaben.
  if (eintrag.datei.typ.startsWith('audio/')) return crmAntwort(`DATEI ${id} · Sprachnotiz — kein Text lesbar (Abschrift folgt), nur die Angaben`, meta, 1, () => '', ABLAGE_QUELLE);
  const d = await lesen(s.haushalt, id);
  if (!d) return `Fehlgeschlagen: Die Datei ${id} liegt nicht (mehr) auf der Platte.`;
  const { textAuslesen, NichtLesbar } = await import('@/lib/dateien/text-auslesen');
  let inhalt: Awaited<ReturnType<typeof textAuslesen>>;
  try { inhalt = await textAuslesen(d.bytes, eintrag.datei.typ); } catch (e) {
    if (e instanceof NichtLesbar) return crmAntwort(`DATEI ${id} · Text nicht lesbar: ${e.message}`, meta, 1, () => '', ABLAGE_QUELLE);
    throw e;
  }
  if (!inhalt) return crmAntwort(`DATEI ${id} · Bild — kein Text lesbar, nur die Angaben`, meta, 1, () => '', ABLAGE_QUELLE);
  const kopf = `DATEI ${id} · ${inhalt.umfang ?? eintrag.datei.typ} · ${inhalt.text.length} Zeichen${inhalt.hinweis ? ` · Hinweis: ${inhalt.hinweis}` : ''}`;
  return crmAntwort(kopf, `${meta}\n\n${inhalt.text || '(kein Text)'}`, i.teil, t => `crm_datei_lesen mit datei: ${id}, teil: ${t}`, ABLAGE_QUELLE);
}

// ── Alte Namen, neue Wege (nicht doppeln, nichts brechen) ─────────────────

/** suche_kontakt (seit 18.09.) läuft jetzt über crm_suche — nur Kontakte, dieselben Leitplanken. */
async function sucheKontaktNeu(i: Eingabe, s: CrmSicht): Promise<string> {
  if (!text(i.frage)) return 'Fehlgeschlagen: frage fehlt.';
  if (!s.kontakte.length && !s.eingeschraenkt.size) return 'Die Kartei ist leer — die Masterliste wurde noch nicht importiert (Markttraktion › Stammdaten › Import).';
  return crmSuche({ frage: i.frage, arten: ['kontakte'], anzahl: Math.min(8, Math.max(1, Number(i.anzahl) || 5)), teil: i.teil }, s);
}

/** crm_lage (seit 24.09.) bleibt der schnelle Überblick — jetzt ohne eingeschränkte Kontakte und gekapselt. */
async function crmLage(i: Eingabe, s: CrmSicht): Promise<string> {
  const { werIstDran } = await import('@/lib/crm/heute');
  const { kennzahlen } = await import('@/lib/crm/kennzahlen');
  const { befunde } = await import('@/lib/crm/befunde');
  const { marketingKennzahlen } = await import('@/lib/crm/marketing');
  const { eventKennzahlen, traktion, uebergaben } = await import('@/lib/crm/traktion');
  const { fuerDich, teamFeed, nameVon } = await import('@/lib/crm/team');
  const { kontakte, crm, heute, person } = s;
  const a = werIstDran(kontakte, crm, heute, person, 8);
  const t = traktion({ sales: kennzahlen(kontakte, crm, heute), marketing: marketingKennzahlen(kontakte, crm, heute), event: eventKennzahlen(kontakte, crm, heute) });
  const kz = (l: import('@/lib/crm/kennzahlen').Kpi[]) => l.map(k => `${k.label} ${k.anzeige}${k.ampel !== 'grau' ? ` (${k.ampel})` : ''}`).join(' · ');
  const koerper = [
    ...t.welten.map(w => `${w.label} (${w.gewicht} %): ${w.score ?? '—'} · ${kz(w.kpis)}`),
    `Übergaben: ${uebergaben(kontakte, crm, heute).map(u => `${u.titel} ${u.anzahl} (${u.von}→${u.an})`).join(' · ') || 'nichts offen'}`,
    `Für ${nameVon(person)}: ${fuerDich(person, kontakte, crm, heute).map(f => `${f.titel} ${f.anzahl}`).join(' · ') || 'nichts Fälliges'}`,
    `Zuletzt im Team: ${teamFeed(kontakte, crm, new Date(Date.now() - 7 * 864e5).toISOString(), 6).map(e => `${nameVon(e.person)}: ${e.text}`).join(' · ') || 'nichts'}`,
    `Wer heute dran ist (${a.karten.length}):`,
    ...a.karten.map(c => `- ${c.name}${c.kontakt.firma ? ` · ${c.kontakt.firma}` : ''} [${c.kontakt.id}] — ${c.kategorie}: ${c.gruende[0]}${c.kanal ? ` · Kanal ${c.kanal.kanal} (${c.kanal.farbe})` : ''}`),
    `Was zu tun ist: ${befunde(kontakte, crm, heute).slice(0, 6).map(b => b.titel).join(' · ') || 'nichts Rotes'}`,
  ].join('\n');
  return crmAntwort(`MARKTTRAKTION ${heute} — Traction-Score ${t.score ?? '—'} (${t.hinweis})${ausgeblendetText(s.eingeschraenkt.size)} · Tiefer: kennzahlen, sales_lage, pipeline, crm_suche`, koerper, i.teil, x => `crm_lage mit teil: ${x}`);
}

// ── Register der Wirkung ──────────────────────────────────────────────────

/** Die lesenden Werkzeuge der Markttraktion — Wirkung (werkzeuge.ts wickelt sie in `nurImHaushalt`). */
export const CRM_LESE_LAEUFE: Record<string, Lauf> = {
  crm_suche: sicher(crmSuche),
  kontakt_akte: sicher(kontaktAkte),
  firma_akte: sicher(firmaAkte),
  pipeline: sicher(pipeline),
  mandate_lage: sicher(mandateLage),
  angebote_lage: sicher(angeboteLage),
  kampagnen_lage: sicher(kampagnenLage),
  events_lage: sicher(eventsLage),
  besuche_lage: sicher(besucheLage),
  marketing_lage: sicher(marketingLage),
  kennzahlen: sicher(kennzahlenLesen),
  sales_lage: sicher(salesLage),
  qualifizierung_lage: sicher(qualifizierungLage),
  stammdaten_lage: sicher(stammdatenLage),
  datenqualitaet: sicher(datenqualitaet),
  crm_datei_lesen: sicher(crmDateiLesen),
  heads_lage: sicher(headsLage),
};
/** Die umgeleiteten alten Werkzeuge (Namen bleiben, Aufrufe brechen nicht). */
export const suche_kontakt = sicher(sucheKontaktNeu);
export const crm_lage = sicher(crmLage);

/** Alle Namen, die ihre Antwort selbst kapseln (fremd.ts) und nur lesen (gespraech-schutz.ts). */
export const CRM_LESE_WERKZEUGE = [...Object.keys(CRM_LESE_LAEUFE), 'suche_kontakt', 'crm_lage'] as const;

/** Für den Test der Leitplanken: der Platzhalter, der statt eines eingeschränkten Namens steht. */
export { EINGESCHRAENKT_NAME };
/** Typ-Anker, damit ungenutzte Importe in strengem TS nicht meckern, wenn sich Module ändern. */
export type { CrmBestand, Firma };
