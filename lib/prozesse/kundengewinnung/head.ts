// ─── Prozesse · „Head fragen“ in der Werkstatt — die reinen Regeln (22.10.; VORLAGEN_KUNDENGEWINNUNG.md 7, ANALYSE_100.md Punkte 52, 99) ───────────────────
// Kevin 21.10.: „Heads setzen Prozesse mit auf.“ Ein Head schlägt vor — (a) einen ganzen Prozess-Entwurf aus Steckbrief/Ziel oder (b) Bausteine für den offenen
// Prozess. Das Ergebnis ist IMMER ein Vorschlag im ZOE-Stapel (Stapel-Art `prozess-entwurf`, lib/prozesse/kundengewinnung/head-server.ts); übernommen wird erst
// per Klick über `werkstattAnwenden` — nie überschrieben: ein ganzer Entwurf wird ein NEUER Prozess, Bausteine kommen nur DAZU (bestehende Schritte bleiben, wie
// sie sind; nur die Reihenfolge rückt um die neuen Schritte weiter).
// Hier (rein, client-sicher — kein Modell, kein Bestand):
//   · `headPrompt` — was an das Modell geht: NUR Struktur (Steckbrief, Titel und Formen der Schritte, die erlaubten Felder der Rauten) — nie Personen, nie
//     Kontaktdaten, nie Werte aus dem CRM (Kategorie „allgemein“).
//   · `headAntwortLesen` — die Antwort des Modells in einen Bau (./bau.ts) übersetzen: nur erlaubte Schritt-Arten, Rauten NUR als Feldregel auf ein bekanntes Feld
//     (keine Modell-Rauten, Punkt 53), Grenzen, Platzhalter nur bekannte; Unbekanntes fällt weg — mit Satz.
//   · `regelwerkVorschlag` — ohne KI bzw. ohne Guthaben: der Vorschlag aus der passenden Vorlage (ganzer Prozess) bzw. fehlende Schritte der passenden Vorlage
//     und ein fehlendes Ende (Bausteine).
//   · `bausteineEinfuegen`, `headDiff`, `headZusammenfassung` — die Übernahme und der sichtbare Unterschied zum Entwurf.

import { B, S, prozess, ZUSTAENDIG, type KgVorlage, type ProzessBau, type Schritt } from './bau';
import { KUNDENGEWINNUNG_VORLAGEN, vorlageVorschau, type VorschauPhase } from './bibliothek';
import { definitionPruefen, sperrtSpeichern } from '../definition-pruefen';
import { phasen, schloesser, schritteDer, seitenZiele } from '../fluss';
import { EREIGNIS_FELDER, FALL_FELDER } from '../ausloeser';
import { katalogEintrag, platzhalterFuer } from '../baustein-katalog';
import { anlegen, type Fassung } from '../werkstatt-aktionen';
import { BEREICH_IDS, FALL_ART_IDS, PROZESS_BEREICHE, PROZESS_TEXT, type Bedingung, type FallArt, type ProzessBereich, type ProzessDefinition, type ProzessForm, type ProzessKnoten, type SkillEreignis } from '../definition';
import { EREIGNIS_NAME, istEreignisArt } from '@/lib/ereignisse/arten';

type K = ProzessKnoten<ProzessForm>;

/** Was gefragt wird: ein ganzer Prozess (aus Ziel/Steckbrief) oder Bausteine für einen offenen Prozess. */
export type HeadArt = 'prozess' | 'baustein';
export interface HeadAnfrage {
  art: HeadArt;
  /** Ziel bzw. Wunsch in eigenen Worten (≤ 1.000 Zeichen) — die eigene Eingabe der Person, nie Text Dritter. */
  ziel: string;
  bereich: ProzessBereich;
  fallArt: FallArt;
  /** Nur Bausteine: der Prozess und (optional) die Phase, in die die Schritte kommen. */
  prozessId?: string;
  phaseId?: string;
}
export const HEAD_GRENZEN = { ziel: 1000, phasen: 6, schritteJePhase: 12, schritte: 40, bausteine: 6, titel: 80, text: 1500 } as const;

/** Anfrage aus dem Körper (rein): Satz bei Fehlern, nie still kürzen (413). */
export function headAnfrageAus(roh: unknown): { ok: true; anfrage: HeadAnfrage } | { ok: false; status: 400 | 413; fehler: string } {
  const o = roh && typeof roh === 'object' && !Array.isArray(roh) ? roh as Record<string, unknown> : null;
  if (!o) return { ok: false, status: 400, fehler: 'Eingabe fehlt.' };
  const art = o.art === 'prozess' || o.art === 'baustein' ? o.art : null;
  if (!art) return { ok: false, status: 400, fehler: 'art: „prozess“ (ganzer Entwurf) oder „baustein“ (für den offenen Prozess).' };
  const ziel = typeof o.ziel === 'string' ? o.ziel.trim() : '';
  if (ziel.length > HEAD_GRENZEN.ziel) return { ok: false, status: 413, fehler: `Ziel: höchstens ${HEAD_GRENZEN.ziel.toLocaleString('de-DE')} Zeichen — nichts gefragt.` };
  if (art === 'prozess' && ziel.length < 3) return { ok: false, status: 400, fehler: 'Wofür soll der Prozess da sein? Ein Satz genügt.' };
  const bereich = (BEREICH_IDS as readonly string[]).includes(String(o.bereich)) ? o.bereich as ProzessBereich : null;
  const fallArt = (FALL_ART_IDS as readonly string[]).includes(String(o.fallArt)) ? o.fallArt as FallArt : null;
  if (art === 'prozess' && (!bereich || !fallArt)) return { ok: false, status: 400, fehler: 'Bereich und „woran hängt ein Lauf“ angeben.' };
  const prozessId = typeof o.prozessId === 'string' && /^[a-z0-9:~-]{1,80}$/i.test(o.prozessId) ? o.prozessId : undefined;
  if (art === 'baustein' && !prozessId) return { ok: false, status: 400, fehler: 'Für welchen Prozess? (prozessId)' };
  const phaseId = typeof o.phaseId === 'string' && /^[a-z0-9:~-]{1,80}$/i.test(o.phaseId) ? o.phaseId : undefined;
  return { ok: true, anfrage: { art, ziel, bereich: bereich ?? 'sales', fallArt: fallArt ?? 'keiner', ...(prozessId ? { prozessId } : {}), ...(phaseId ? { phaseId } : {}) } };
}

// ── Was der Head bauen darf ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Die Schritt-Arten der Antwort — eine kleine, sichere Auswahl der Bausteine (Außenwirkung nur als Entwurf; das Schloss setzt die Regel beim Speichern). */
export const HEAD_SCHRITT_ARTEN = {
  aufgabe: 'Aufgabe für die zuständige Person (text = was zu tun ist, tage = Frist)',
  glocke: 'Hinweis in der Glocke an den Eigner (text)',
  followup: 'Follow-up am Kontakt (text, tage) — nur Fall-Art lead, deal oder mandat',
  mail: 'E-Mail-ENTWURF an den Kontakt des Falls (betreff, text) — gesendet erst nach Freigabe; nur lead, deal oder mandat',
  notiz: 'Notiz in der Kontaktakte (text) — nur lead, deal oder mandat',
  frage: 'Entscheidung eines Menschen (text = die Frage) — „nein“ endet mit „Nicht weiter“',
  regel: 'Entscheidung als Feldregel (feld, op, wert) — nur mit einem Feld aus der Liste; „nein“ endet mit „Nicht weiter“',
  warten: 'Warten (tage)',
  ziel: 'Ende: Ziel erreicht (nur als letzter Schritt)',
  abbruch: 'Ende: abgebrochen (nur als letzter Schritt)',
} as const;
export type HeadSchrittArt = keyof typeof HEAD_SCHRITT_ARTEN;
const OPS = ['gleich', 'ungleich', 'groesser', 'kleiner', 'gesetzt', 'leer'] as const;
const MIT_KONTAKT: readonly FallArt[] = ['lead', 'deal', 'mandat'];
const RHYTHMEN = ['taeglich', 'werktags', 'woechentlich', 'monatlich'] as const;

/** Felder, auf die eine Feldregel zeigen darf (Fall-Art + bei einem Ereignis-Auslöser die Felder des Ereignisses). */
export const regelFelder = (fall: FallArt, mitEreignis: boolean): string[] => [...FALL_FELDER[fall].map(f => f.id), ...(mitEreignis ? EREIGNIS_FELDER.map(f => f.id) : [])];

/** Die Struktur eines Entwurfs als Text für das Modell — nur Phasen, Titel und Formen (und die Kennung des Bausteins), nie Werte der Masken. */
export function strukturText(d: Pick<ProzessDefinition, 'knoten'>): string {
  const z: string[] = [];
  for (const p of phasen(d)) {
    z.push(`Phase „${p.titel}“ (${p.id})`);
    for (const s of schritteDer(d, p.id)) if (s.form !== 'freigabe') z.push(`  - ${s.titel} [${s.form ?? 'schritt'}${s.katalog?.id ? ` · ${s.katalog.id}` : ''}]`);
  }
  return z.join('\n');
}

/** Der stabile System-Text (Cache) und der Auftrag. Nur Struktur — die Kategorie des KI-Tors ist „allgemein“. */
export const HEAD_SYSTEM = [
  'Du bist ein Head (Prozessberater) in MAKE OS, einer Software für Kundengewinnung. Du entwirfst Abläufe aus wenigen klaren Schritten.',
  'Regeln: keine Namen von Personen oder Firmen, keine Beträge, keine Telefonnummern oder Adressen. Nichts geht automatisch nach außen —',
  'E-Mails sind Entwürfe, die ein Mensch freigibt. Entscheidungen sind entweder eine Frage an einen Menschen („frage“) oder eine Feldregel',
  '(„regel“) auf ein Feld aus der gegebenen Liste — nie eine Entscheidung durch ein Modell. Jede Entscheidung endet bei „nein“ von selbst mit',
  '„Nicht weiter“. Wenige, sinnvolle Schritte (lieber 6 gute als 20). Antworte NUR mit JSON nach dem Schema.',
  '',
  'Schritt-Arten (Feld „art“):',
  ...Object.entries(HEAD_SCHRITT_ARTEN).map(([a, t]) => `- ${a}: ${t}`),
  '',
  `Operatoren einer Feldregel: ${OPS.join(', ')}. Auslöser („ausloeser.art“): hand · ereignis (mit „ereignis“ aus der Liste) · zeitplan (rhythmus ${RHYTHMEN.join('/')}, uhrzeit HH:MM).`,
].join('\n');

/** Der Auftrag an das Modell (rein). */
export function headPrompt(a: HeadAnfrage, offen?: Pick<ProzessDefinition, 'knoten' | 'titel' | 'beschreibung' | 'startKriterium' | 'endKriterium' | 'fallArt' | 'bereich'> | null): { system: string; user: string } {
  const bereich = PROZESS_BEREICHE.find(b => b.id === (offen?.bereich ?? a.bereich))?.titel ?? a.bereich;
  const fall = offen?.fallArt ?? a.fallArt;
  const ereignisse = (Object.keys(EREIGNIS_NAME) as SkillEreignis[]).map(e => `${e} (${EREIGNIS_NAME[e]})`).join(', ');
  const kopf = [
    `Bereich: ${bereich}. Ein Lauf hängt an: ${fall}.`,
    `Felder für Feldregeln: ${regelFelder(fall, true).join(', ')}.`,
    `Ereignisse für den Auslöser: ${ereignisse}.`,
  ];
  if (a.art === 'prozess') {
    return {
      system: HEAD_SYSTEM,
      user: [...kopf, '', `Ziel des Prozesses (in eigenen Worten der Person): ${a.ziel}`, '',
        'Entwirf einen ganzen Prozess: {"titel","beschreibung","startKriterium","endKriterium","ausloeser":{…},"phasen":[{"titel","schritte":[{"art","titel","text","betreff","tage","feld","op","wert"}]}],"hinweis"}.'].join('\n'),
    };
  }
  return {
    system: HEAD_SYSTEM,
    user: [...kopf, '', `Offener Prozess „${offen?.titel ?? ''}“${offen?.beschreibung ? ` — ${offen.beschreibung}` : ''}.`,
      ...(offen?.startKriterium ? [`Startkriterium: ${offen.startKriterium}`] : []), ...(offen?.endKriterium ? [`Endkriterium: ${offen.endKriterium}`] : []),
      'Bisheriger Aufbau:', offen ? strukturText(offen) : '(leer)', '',
      `Wunsch: ${a.ziel || 'Was fehlt diesem Ablauf? Schlage bis zu drei Schritte vor.'}`, '',
      `Schlage höchstens ${HEAD_GRENZEN.bausteine} neue Schritte vor (kein Auslöser, kein Ende): {"phase": "<Titel oder Kennung der Phase>", "schritte":[…], "hinweis"}.`].join('\n'),
  };
}

/** Das JSON-Schema der Antwort (für das Feld `schema` des Modellaufrufs — lehnt die API es ab, liest `extractJson` die Antwort trotzdem). */
export function headSchema(art: HeadArt): Record<string, unknown> {
  const schritt = {
    type: 'object', additionalProperties: false, required: ['art', 'titel'],
    properties: { art: { type: 'string', enum: Object.keys(HEAD_SCHRITT_ARTEN) }, titel: { type: 'string' }, text: { type: 'string' }, betreff: { type: 'string' }, tage: { type: 'number' }, feld: { type: 'string' }, op: { type: 'string', enum: [...OPS] }, wert: { type: ['string', 'number', 'boolean'] } },
  };
  if (art === 'baustein') return { type: 'object', additionalProperties: false, required: ['schritte'], properties: { phase: { type: 'string' }, schritte: { type: 'array', items: schritt }, hinweis: { type: 'string' } } };
  return {
    type: 'object', additionalProperties: false, required: ['titel', 'phasen'],
    properties: {
      titel: { type: 'string' }, beschreibung: { type: 'string' }, startKriterium: { type: 'string' }, endKriterium: { type: 'string' }, hinweis: { type: 'string' },
      ausloeser: { type: 'object', additionalProperties: false, properties: { art: { type: 'string', enum: ['hand', 'ereignis', 'zeitplan'] }, ereignis: { type: 'string' }, rhythmus: { type: 'string' }, uhrzeit: { type: 'string' } } },
      phasen: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['titel', 'schritte'], properties: { titel: { type: 'string' }, schritte: { type: 'array', items: schritt } } } },
    },
  };
}

// ── Antwort lesen ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

type O = Record<string, unknown>;
const obj = (v: unknown): O | null => (v && typeof v === 'object' && !Array.isArray(v) ? v as O : null);
const kurz = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max) : '');
/** Nur bekannte Platzhalter bleiben; lose Klammern fallen weg. */
function textSauber(v: unknown, fall: FallArt): string {
  const erlaubt = new Set(platzhalterFuer(fall));
  return kurz(v, HEAD_GRENZEN.text).replace(/\{\{\s*([^}]*?)\s*\}\}/g, (_m, p: string) => (erlaubt.has(p.split('|')[0].trim()) ? `{{${p.trim()}}}` : '')).replace(/\{\{|\}\}/g, '').trim();
}
const tageAus = (v: unknown, vorgabe: number, max = 90): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(1, Math.round(v))) : vorgabe);

/** Eine Feldregel aus der Antwort — nur auf ein bekanntes Feld, sonst null (keine Modell-Rauten). */
function bedingungAus(s: O, felder: readonly string[]): Bedingung | null {
  const feld = kurz(s.feld, 80);
  const op = (OPS as readonly string[]).includes(String(s.op)) ? s.op as (typeof OPS)[number] : null;
  if (!feld || !felder.includes(feld) || !op) return null;
  if (op === 'gesetzt') return B.gesetzt(feld);
  if (op === 'leer') return B.leer(feld);
  const w = s.wert;
  if (op === 'groesser' || op === 'kleiner') return typeof w === 'number' && Number.isFinite(w) ? (op === 'groesser' ? B.groesser(feld, w) : B.kleiner(feld, w)) : null;
  if (typeof w === 'boolean' || (typeof w === 'number' && Number.isFinite(w))) return op === 'gleich' ? B.ist(feld, w) : B.nicht(feld, w);
  const t = kurz(w, 80);
  return t ? (op === 'gleich' ? B.ist(feld, t) : B.nicht(feld, t)) : null;
}

/** Ein Schritt der Antwort → Schritte des Baus (eine Raute bringt ihr „Nicht weiter“ mit). `null` = fällt weg (mit Satz). */
function schrittAus(roh: unknown, id: string, fall: FallArt, felder: readonly string[], hinweise: string[]): Schritt[] | null {
  const s = obj(roh);
  if (!s) return null;
  const titel = kurz(s.titel, HEAD_GRENZEN.titel) || 'Schritt';
  const art = String(s.art) as HeadSchrittArt;
  const text = textSauber(s.text, fall);
  const nein = `${id}n`;
  switch (art) {
    case 'aufgabe': return [S.aufgabe(id, titel, { titel: kurz(text || titel, PROZESS_TEXT.titel), fristTage: tageAus(s.tage, 3, 60) })];
    case 'glocke': return [S.glocke(id, titel, text || titel)];
    case 'followup':
    case 'mail':
    case 'notiz':
      if (!MIT_KONTAKT.includes(fall)) { hinweise.push(`„${titel}“: ohne Kontakt am Fall (${fall}) wird daraus eine Aufgabe.`); return [S.aufgabe(id, titel, { titel: kurz(text || titel, PROZESS_TEXT.titel), fristTage: tageAus(s.tage, 3, 60) })]; }
      if (art === 'followup') return [S.followup(id, titel, { text: text || titel, inTagen: tageAus(s.tage, 3, 60) })];
      if (art === 'notiz') return [S.notiz(id, titel, text || titel)];
      return [S.mail(id, titel, { betreff: kurz(textSauber(s.betreff, fall) || titel, 200), text: text || titel })];
    case 'frage': return [S.mensch(id, titel, kurz(text || titel, 300), ZUSTAENDIG, { zweige: { nein } }), S.abbruch(nein, 'Nicht weiter')];
    case 'regel': {
      const b = bedingungAus(s, felder);
      if (!b) { hinweise.push(`„${titel}“: eine Entscheidung braucht eine Feldregel auf ein bekanntes Feld — weggelassen (keine Modell-Rauten).`); return null; }
      return [S.regel(id, titel, [b], { zweige: { nein } }), S.abbruch(nein, 'Nicht weiter')];
    }
    case 'warten': return [S.wartenDauer(id, titel, tageAus(s.tage, 3))];
    case 'ziel': return [S.ziel(id, titel)];
    case 'abbruch': return [S.abbruch(id, titel)];
    default: hinweise.push(`„${titel}“: diese Schritt-Art kennt die Werkstatt hier nicht — weggelassen.`); return null;
  }
}

function ausloeserAus(roh: unknown, hinweise: string[]): Schritt {
  const a = obj(roh);
  if (a?.art === 'ereignis') {
    if (istEreignisArt(a.ereignis)) return S.ereignis('h0', `Bei „${EREIGNIS_NAME[a.ereignis as SkillEreignis]}“`, a.ereignis as SkillEreignis);
    hinweise.push('Der Auslöser nannte ein unbekanntes Ereignis — der Prozess startet von Hand.');
  }
  if (a?.art === 'zeitplan') {
    const r = (RHYTHMEN as readonly string[]).includes(String(a.rhythmus)) ? a.rhythmus as (typeof RHYTHMEN)[number] : 'werktags';
    const u = typeof a.uhrzeit === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(a.uhrzeit) ? a.uhrzeit : '08:00';
    return S.zeitplan('h0', 'Nach Zeitplan', r, u);
  }
  return S.hand('h0');
}

export type HeadBauErgebnis = { ok: true; definition: ProzessDefinition; hinweise: string[] } | { ok: false; grund: string };

/** Ganzer Prozess: die Antwort des Modells → Definition (rein). Speicherbar oder `ok: false` mit Grund (dann gilt das Regelwerk). */
export function headProzessAus(roh: unknown, a: HeadAnfrage, id = 'head'): HeadBauErgebnis {
  const o = obj(roh);
  if (!o) return { ok: false, grund: 'Die Antwort war kein lesbarer Entwurf.' };
  const hinweise: string[] = [];
  const start = ausloeserAus(o.ausloeser, hinweise);
  const felder = regelFelder(a.fallArt, start.baustein === 'ausloeser.ereignis');
  const ph = (Array.isArray(o.phasen) ? o.phasen : []).slice(0, HEAD_GRENZEN.phasen);
  if (Array.isArray(o.phasen) && o.phasen.length > HEAD_GRENZEN.phasen) hinweise.push(`Mehr als ${HEAD_GRENZEN.phasen} Phasen — die übrigen sind weggelassen.`);
  let n = 0;
  const bauPhasen: ProzessBau['phasen'] = [];
  for (const [i, p] of ph.entries()) {
    const po = obj(p);
    const roheSchritte = Array.isArray(po?.schritte) ? po!.schritte as unknown[] : [];
    const schritte: Schritt[] = i === 0 ? [start] : [];
    for (const r of roheSchritte.slice(0, HEAD_GRENZEN.schritteJePhase)) {
      if (n >= HEAD_GRENZEN.schritte) { hinweise.push(`Mehr als ${HEAD_GRENZEN.schritte} Schritte — die übrigen sind weggelassen.`); break; }
      const l = schrittAus(r, `h${++n}`, a.fallArt, felder, hinweise);
      if (l) schritte.push(...l);
    }
    bauPhasen.push({ titel: kurz(po?.titel, HEAD_GRENZEN.titel) || `Phase ${i + 1}`, schritte });
  }
  if (!bauPhasen.length) bauPhasen.push({ titel: 'Ablauf', schritte: [start] });
  // Ein Ende steht nur am Schluss: eins mitten im Strang fällt weg (ein Seitenziel „Nicht weiter“ bleibt), am Schluss fehlt keins.
  const seiten = new Set(bauPhasen.flatMap(p => p.schritte.flatMap(s => [s.zweige?.nein].filter(Boolean) as string[])));
  bauPhasen.forEach((p, i) => {
    const letzte = i === bauPhasen.length - 1;
    const strang = p.schritte.filter(s => !seiten.has(s.id));
    const endeMitten = strang.filter((s, j) => s.baustein.startsWith('ende.') && (!letzte || j < strang.length - 1));
    if (endeMitten.length) { hinweise.push('Ein Ende mitten im Ablauf ist weggelassen — der Prozess endet am Schluss.'); p.schritte = p.schritte.filter(s => !endeMitten.includes(s)); }
  });
  const letzte = bauPhasen[bauPhasen.length - 1];
  const strangLetzte = letzte.schritte.filter(s => !seiten.has(s.id));
  if (!strangLetzte.at(-1)?.baustein.startsWith('ende.')) letzte.schritte.push(S.ziel('hz'));
  const bau: ProzessBau = {
    id, titel: kurz(o.titel, PROZESS_TEXT.titel) || 'Neuer Prozess', beschreibung: kurz(o.beschreibung, PROZESS_TEXT.beschreibung) || a.ziel.slice(0, PROZESS_TEXT.beschreibung),
    bereich: a.bereich, fallArt: a.fallArt, startKriterium: kurz(o.startKriterium, PROZESS_TEXT.kriterium), endKriterium: kurz(o.endKriterium, PROZESS_TEXT.kriterium), phasen: bauPhasen,
  };
  let d: ProzessDefinition;
  try { d = prozess(bau); } catch (e) { return { ok: false, grund: e instanceof Error ? e.message : 'Der Entwurf ließ sich nicht bauen.' }; }
  const befunde = definitionPruefen(d, {});
  if (sperrtSpeichern(befunde)) return { ok: false, grund: befunde.find(x => x.stufe === 'fehler')!.text };
  const hinweis = kurz(o.hinweis, 500);
  return { ok: true, definition: { ...d, herkunft: { art: 'hand', quelleIds: ['head'], am: '' } }, hinweise: [...(hinweis ? [hinweis] : []), ...hinweise] };
}

/** Neue Knoten für den offenen Prozess (rein, Kennungen `hb:<n>` — die Übernahme vergibt `fk-…`) — ohne Schloss (setzt die Regel beim Speichern). */
export interface BausteinVorschlag { phaseId: string; knoten: K[]; hinweise: string[] }

/** Bausteine: die Antwort des Modells → neue Knoten (rein). */
export function headBausteineAus(roh: unknown, d: Pick<ProzessDefinition, 'knoten' | 'fallArt'>, phaseWunsch?: string): { ok: true; vorschlag: BausteinVorschlag } | { ok: false; grund: string } {
  const o = obj(roh);
  if (!o) return { ok: false, grund: 'Die Antwort war kein lesbarer Vorschlag.' };
  const fall = d.fallArt ?? 'keiner';
  const hinweise: string[] = [];
  const mitEreignis = d.knoten.some(k => k.ausloeser?.art === 'ereignis');
  const felder = regelFelder(fall, mitEreignis);
  const roheSchritte = (Array.isArray(o.schritte) ? o.schritte as unknown[] : []);
  if (roheSchritte.length > HEAD_GRENZEN.bausteine) hinweise.push(`Mehr als ${HEAD_GRENZEN.bausteine} Schritte — die übrigen sind weggelassen.`);
  const schritte: Schritt[] = [];
  let n = 0;
  for (const r of roheSchritte.slice(0, HEAD_GRENZEN.bausteine)) {
    const so = obj(r);
    if (so && (so.art === 'ziel' || so.art === 'abbruch')) { hinweise.push(`„${kurz(so.titel, 80)}“: ein Ende schlägt der Head hier nicht vor — weggelassen.`); continue; }
    const l = schrittAus(r, `h${++n}`, fall, felder, hinweise);
    if (l) schritte.push(...l);
  }
  if (!schritte.length) return { ok: false, grund: hinweise[0] ?? 'Der Head hat keinen Schritt vorgeschlagen.' };
  const ps = phasen(d);
  const wunsch = phaseWunsch ?? kurz(o.phase, 120);
  const phase = ps.find(p => p.id === wunsch) ?? ps.find(p => p.titel.toLowerCase() === wunsch.toLowerCase()) ?? ps[ps.length - 1];
  if (!phase) return { ok: false, grund: 'Der Prozess hat noch keine Phase.' };
  const hinweis = kurz(o.hinweis, 500);
  return { ok: true, vorschlag: { phaseId: phase.id, knoten: bausteinKnoten(schritte), hinweise: [...(hinweis ? [hinweis] : []), ...hinweise] } };
}

/** Schritte des Baus → Knoten mit vorläufigen Kennungen `hb:<id>` (über den Bau, damit Zweige, Felder und Masken genauso entstehen wie in den Vorlagen). */
function bausteinKnoten(schritte: Schritt[]): K[] {
  const d = prozess({ id: 'hb', titel: 'x', beschreibung: '', bereich: 'sales', fallArt: 'keiner', startKriterium: '', endKriterium: '', phasen: [{ titel: 'x', schritte }] });
  const phase = phasen(d)[0];
  return d.knoten.filter(k => k.elternId === phase.id && !k.schloss).map(k => { const { elternId: _e, ...rest } = k; void _e; return rest as K; });
}

// ── Regelwerk (ohne KI) ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const woerter = (t: string) => new Set(t.toLowerCase().normalize('NFC').split(/[^a-zäöüß0-9]+/).filter(w => w.length >= 4));
/** Die passende Vorlage (rein): Fall-Art (+3), Bereich (+2), gemeinsame Wörter mit Titel/Zweck (+1 je Wort). Bei Gleichstand gilt die Reihenfolge der Bibliothek. */
export function passendeVorlage(o: { ziel?: string; titel?: string; bereich?: ProzessBereich; fallArt?: FallArt; ohneTeile?: boolean }): KgVorlage | null {
  const w = woerter(`${o.ziel ?? ''} ${o.titel ?? ''}`);
  let beste: { v: KgVorlage; p: number } | null = null;
  for (const v of KUNDENGEWINNUNG_VORLAGEN) {
    if (o.ohneTeile && v.teile.length) continue;
    let p = (o.fallArt && v.fallArt === o.fallArt ? 3 : 0) + (o.bereich && v.bereich === o.bereich ? 2 : 0);
    for (const x of woerter(`${v.titel} ${v.zweck}`)) if (w.has(x)) p += 1;
    if (!beste || p > beste.p) beste = { v, p };
  }
  return beste?.v ?? null;
}

/** Was der Vorschlag ist — gespeichert im Stapel (Eingabe `_vorschlag`), nur Struktur. */
export type HeadVorschlag =
  | { art: 'prozess'; quelle: 'ki' | 'regelwerk'; vorlage?: string; definition: ProzessDefinition; hinweise: string[] }
  | { art: 'baustein'; quelle: 'ki' | 'regelwerk'; vorlage?: string; prozessId: string; phaseId: string; knoten: K[]; hinweise: string[] };

/** Formen, die das Regelwerk aus einer Vorlage übernimmt — keine Auslöser, Enden, Rauten (die brauchen Zweige), Agenten, Schleifen, Teilprozesse, Abfragen. */
const REGELWERK_BAUSTEINE = new Set(['aufgabe.anlegen', 'glocke.melden', 'erinnerung.runde', 'crm.followup', 'crm.kontakt-notiz', 'inbox.mail-entwurf', 'whatsapp.entwurf', 'warten.dauer', 'crm.deal-schritt', 'crm.entwurf-text', 'crm.karte-ergaenzen', 'kalender.block']);

/** Ohne KI: der Vorschlag aus dem Regelwerk (rein). Ganzer Prozess = die passende Vorlage ohne Teile; Bausteine = fehlendes Ende + fehlende Schritte der passenden Vorlage. */
export function regelwerkVorschlag(a: HeadAnfrage, offen?: ProzessDefinition | null): HeadVorschlag | null {
  if (a.art === 'prozess') {
    const v = passendeVorlage({ ziel: a.ziel, bereich: a.bereich, fallArt: a.fallArt, ohneTeile: true });
    if (!v) return null;
    return {
      art: 'prozess', quelle: 'regelwerk', vorlage: v.id, definition: { ...v.definition, herkunft: { art: 'hand', quelleIds: [v.id], am: '' } },
      hinweise: [`Ohne KI: Entwurf aus der Vorlage „${v.titel}“ (${v.nr}) — in der Werkstatt anpassen.`, ...v.offen.map(x => `${x.punkt}: ${x.text}`)],
    };
  }
  if (!offen || !a.prozessId) return null;
  const ps = phasen(offen);
  const phase = ps.find(p => p.id === a.phaseId) ?? ps[ps.length - 1];
  if (!phase) return null;
  const da = new Set(offen.knoten.map(k => k.katalog?.id).filter(Boolean) as string[]);
  const v = passendeVorlage({ ziel: a.ziel, titel: offen.titel, bereich: offen.bereich, fallArt: offen.fallArt });
  const hinweise: string[] = [];
  const knoten: K[] = [];
  let n = 0;
  if (v) {
    for (const k of v.definition.knoten) {
      if (knoten.length >= 3) break;
      const kid = k.katalog?.id;
      if (!kid || !REGELWERK_BAUSTEINE.has(kid) || da.has(kid) || k.zweige || k.schloss) continue;
      if (JSON.stringify(k.katalog?.werte ?? {}).match(/abfrage:|vorlage:/)) continue;
      if (!katalogEintrag(kid)) continue;
      da.add(kid);
      const { elternId: _e, rang: _r, pos: _p, ...rest } = k; void _e; void _r; void _p;
      knoten.push({ ...rest, id: `hb:r${++n}`, rang: n } as K);
    }
    if (knoten.length) hinweise.push(`Ohne KI: Schritte aus der Vorlage „${v.titel}“ (${v.nr}), die hier noch fehlen.`);
  }
  // Fehlt am Schluss des Prozesses ein Ende, kommt „Ziel erreicht“ dazu (in die letzte Phase).
  const letzte = ps[ps.length - 1];
  const strang = (pid: string) => { const sz = seitenZiele(offen.knoten); const sl = new Set(schloesser(offen.knoten).values()); return schritteDer(offen, pid).filter(s => !sz.has(s.id) && !sl.has(s.id)); };
  const ohneEnde = !strang(letzte.id).some(s => s.form === 'ende');
  if (ohneEnde && phase.id === letzte.id) { knoten.push(...bausteinKnoten([S.ziel('hz')])); hinweise.push('Am Schluss fehlte ein Ende — „Ziel erreicht“ kommt dazu.'); }
  for (const k of offen.knoten) if (k.form === 'entscheidung' && !k.zweige?.nein) hinweise.push(`„${k.titel}“ hat keinen Nein-Zweig — in der Werkstatt am Ausgang „nein“ einen Schritt anhängen.`);
  if (!knoten.length) return null;
  return { art: 'baustein', quelle: 'regelwerk', ...(v ? { vorlage: v.id } : {}), prozessId: a.prozessId, phaseId: phase.id, knoten, hinweise };
}

// ── Übernahme + Unterschied ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Der Strang einer Phase (ohne Seitenziele, ohne Schlösser). */
function strangDer(d: Pick<ProzessDefinition, 'knoten'>, phaseId: string): K[] {
  const sz = seitenZiele(d.knoten), sl = new Set(schloesser(d.knoten).values());
  return schritteDer(d, phaseId).filter(s => !sz.has(s.id) && !sl.has(s.id));
}

/**
 * Die neuen Knoten in den AKTUELLEN Entwurf einfügen (rein): neue Kennungen, im Strang vor das erste Ende der Phase (sonst ans Ende der Phase), Seitenziele
 * neben den Strang. Bestehende Knoten ändern sich nicht — außer ihrem Rang (die neuen rücken dazwischen). Phase weg → Grund (409).
 */
export function bausteineEinfuegen(entwurf: Pick<ProzessDefinition, 'knoten' | 'zettel'>, v: { phaseId: string; knoten: readonly K[] }, neu: () => string): { ok: true; knoten: K[]; wo: string; neueIds: string[] } | { ok: false; grund: string } {
  const phase = phasen(entwurf).find(p => p.id === v.phaseId);
  if (!phase) return { ok: false, grund: 'Die Phase des Vorschlags gibt es im Entwurf nicht mehr — bitte neu fragen. Nichts übernommen.' };
  const karte = new Map(v.knoten.map(k => [k.id, neu()]));
  const m = (x: string | undefined) => (x ? karte.get(x) ?? x : x);
  const neue = v.knoten.map(k => {
    const n: K = { ...k, id: m(k.id)! };
    if (k.zweige) n.zweige = Object.fromEntries(Object.entries(k.zweige).map(([z, x]) => [z, m(x)])) as K['zweige'];
    return n;
  });
  // Ein Zweig des Vorschlags darf nur auf einen neuen Knoten zeigen — nie auf einen bestehenden (sonst änderte der Vorschlag den Fluss des Entwurfs).
  const neuIds = new Set(neue.map(k => k.id));
  for (const k of neue) for (const z of Object.values(k.zweige ?? {})) if (z && !neuIds.has(z)) return { ok: false, grund: 'Der Vorschlag zeigt auf einen Schritt, den es nicht gibt — bitte neu fragen. Nichts übernommen.' };
  const seiten = new Set(neue.flatMap(k => [k.zweige?.nein, k.zweige?.fehler, k.zweige?.abgelaufen].filter(Boolean) as string[]));
  const anker = strangDer(entwurf, phase.id).find(s => s.form === 'ende');
  let f: Fassung = { knoten: [...entwurf.knoten], ...(entwurf.zettel ? { zettel: entwurf.zettel } : {}) };
  for (const k of neue.filter(x => !seiten.has(x.id))) {
    const r = anker ? anlegen(f, k, { vor: anker.id }) : anlegen(f, k, { phaseId: phase.id });
    if (!r.ok) return { ok: false, grund: `${r.grund} Nichts übernommen.` };
    f = r.fassung;
  }
  // Seitenziele (z. B. „Nicht weiter“ einer Raute) stehen neben dem Strang — am Ende der Phase angehängt, ihr Ursprung zeigt schon auf sie.
  let rang = Math.max(0, ...f.knoten.filter(k => k.elternId === phase.id).map(k => k.rang));
  for (const k of neue.filter(x => seiten.has(x.id))) f = { ...f, knoten: [...f.knoten, { ...k, elternId: phase.id, rang: ++rang }] };
  return { ok: true, knoten: f.knoten, wo: anker ? `in „${phase.titel}“ vor „${anker.titel}“` : `am Ende von „${phase.titel}“`, neueIds: neue.map(k => k.id) };
}

/** Der sichtbare Unterschied zum Entwurf (rein, für die Werkstatt und den Stapel). */
export type HeadDiff =
  | { art: 'prozess'; titel: string; phasen: VorschauPhase[]; schritte: number; freigaben: number }
  | { art: 'baustein'; phase: string; wo: string; neu: { titel: string; form: ProzessForm }[]; bleiben: number; fehlt?: string };

export function headDiff(v: HeadVorschlag, entwurf?: Pick<ProzessDefinition, 'knoten'> | null): HeadDiff {
  if (v.art === 'prozess') {
    const ph = vorlageVorschau(v.definition);
    return { art: 'prozess', titel: v.definition.titel, phasen: ph, schritte: ph.reduce((n, p) => n + p.schritte.filter(s => s.form !== 'ausloeser').length, 0), freigaben: schloesser(v.definition.knoten).size };
  }
  const neu = v.knoten.map(k => ({ titel: k.titel, form: (k.form ?? 'schritt') as ProzessForm }));
  if (!entwurf) return { art: 'baustein', phase: '', wo: '', neu, bleiben: 0, fehlt: 'Den Prozess gibt es nicht mehr.' };
  const phase = phasen(entwurf).find(p => p.id === v.phaseId);
  const bleiben = entwurf.knoten.filter(k => k.elternId && k.form && k.form !== 'freigabe').length;
  if (!phase) return { art: 'baustein', phase: '', wo: '', neu, bleiben, fehlt: 'Die Phase gibt es im Entwurf nicht mehr.' };
  const anker = strangDer(entwurf, phase.id).find(s => s.form === 'ende');
  return { art: 'baustein', phase: phase.titel, wo: anker ? `vor „${anker.titel}“` : 'am Ende der Phase', neu, bleiben };
}

/** Der Text im Stapel (`nachher`) — ohne Werte, nur Struktur. */
export function headZusammenfassung(v: HeadVorschlag, diff: HeadDiff): string {
  const quelle = v.quelle === 'ki' ? 'Vorschlag des Heads (KI)' : 'Vorschlag aus dem Regelwerk (ohne KI)';
  if (diff.art === 'prozess') {
    return [`${quelle}: neuer Prozess „${diff.titel}“ — ${diff.schritte} Schritte, ${diff.freigaben} Freigabe${diff.freigaben === 1 ? '' : 'n'}.`,
      ...diff.phasen.map(p => `${p.titel}: ${p.schritte.map(s => s.titel).join(' → ')}`),
      'Übernehmen legt einen NEUEN Prozess als Entwurf an — bestehende Prozesse bleiben unberührt.', ...v.hinweise].join('\n').slice(0, 8000);
  }
  return [`${quelle}: ${diff.neu.length} neue${diff.neu.length === 1 ? 'r' : ''} Schritt${diff.neu.length === 1 ? '' : 'e'} ${diff.phase ? `in „${diff.phase}“ ${diff.wo}` : ''}.`.replace(/\s+\./, '.'),
    ...diff.neu.map(s => `+ ${s.titel}`), `Bestehende Schritte bleiben, wie sie sind (${diff.bleiben}).`, ...v.hinweise].join('\n').slice(0, 8000);
}
