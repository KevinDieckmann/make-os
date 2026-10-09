// ─── Agenten-Bereich: Werkzeuge der Heads und Mitarbeiter (09.10., Paket 1 „Kern“; AGENTEN_KONZEPT.md C3/C5, ARCHITEKTUR.md R1–R5) ─
// Welche Werkzeuge ein Agent angeboten bekommt — die SCHNITTMENGE aus
//   (1) der Liste im Katalog (Head; Mitarbeiter: seine ∩ die des Heads, für den er arbeitet — auch bei Aushilfe über `auchFuer`),
//   (2) den KI-Schaltern der Person (ausgeschaltete Bereiche gar nicht anbieten — lib/datenschutz/ki-werkzeuge.ts),
//   (3) der Einwilligung (Gesundheit nur mit (a)+(b)) und den aktiven Kategorien des Heads,
// dazu die Agenten-Werkzeuge (`HEAD_WERKZEUGE` bzw. `MITARBEITER_WERKZEUGE` + Brett/Rat für Mitarbeiter). Die Stufe (frei/Freigabe)
// kommt IMMER aus dem ZOE-Register; im Agenten-Bereich wirkt jedes schreibende Werkzeug nur als Vorschlag (Antwort 10: „Aufgaben/
// Termine/Entwürfe nur als Vorschlag“) — ausgeführt wird über `fuehreAus` (lib/zoe/ausfuehren.ts), die EINE Stelle zur Wirkung.
//
// Die Beschreibungen der Register-Werkzeuge stehen seit Paket 4a (09.10.) an EINER Stelle: lib/zoe/werkzeug-defs.ts — dieselbe, die das
// ZOE-Gespräch liest (keine Kopie mehr). Hier wird daraus nur die Fassung für den Agenten-Bereich abgeleitet (`agentenDef`): Felder, die
// der Bereich des Heads festlegt, fallen weg (space, wer, einheit, person), Gesellschaften nur aus dem Business, und schreibende Werkzeuge
// sagen, dass sie hier nur Vorschläge sind. Werkzeuge ohne eigenen Bereich (Postfach, Arbeitssuche) sind auf den Bereich des Heads
// beschränkt (`eingabeImBereich`, `BEREICHS_LESER`).

import { gruppeVon } from '@/lib/zoe/register';
import { WERKZEUGE } from '@/lib/zoe/werkzeuge';
import { werkzeugDefs, type WerkzeugDef } from '@/lib/zoe/werkzeug-defs';
import { LESEND } from '@/lib/zoe/gespraech-schutz';
import { kategorieVonWerkzeug, werkzeugSperre } from '@/lib/datenschutz/ki-werkzeuge';
import { istBereich, type KiSchalter } from '@/lib/datenschutz/ki-einstellungen';
import { BUSINESS_GESELLSCHAFTEN, finanzOrtName } from '@/lib/einheiten';
import { HEAD_WERKZEUGE, MITARBEITER_WERKZEUGE, GRENZEN, type HeadDef, type KiKategorie, type Mitarbeiter } from './typen';

export type { WerkzeugDef };

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required });
const S = (description: string) => ({ type: 'string', description });
const VORSCHLAG = 'Im Agenten-Bereich wirkt das nur als VORSCHLAG im Freigabe-Stapel — ein Mensch übernimmt per Klick.';
const firmen = () => BUSINESS_GESELLSCHAFTEN.map(g => `${g} = ${finanzOrtName(g)}`).join(', ');

/** Felder, die im Agenten-Bereich der Head festlegt (`eingabeImBereich`) — sie stehen dort gar nicht erst im Schema. */
const FEST_IM_BEREICH: Readonly<Record<string, readonly string[]>> = { create_task: ['wer', 'space', 'einheit'], setze_fokus: ['space'], gesundheits_index: ['person'] };
/** Werkzeuge mit einer Gesellschaft — im Agenten-Bereich nur die Business-Gesellschaften (die Selbstständigkeit gehört zu Privat). */
const MIT_FIRMA = new Set(['erfasse_planposten', 'setze_kontostand', 'erfasse_rechnung']);
const ZUSATZ: Readonly<Record<string, string>> = {
  lies_postfach: 'Im Agenten-Bereich: nur die Postfächer im Bereich dieses Heads.',
  suche_arbeit: 'Im Agenten-Bereich: nur Bestände im Bereich dieses Heads.',
  gesundheits_index: 'Im Agenten-Bereich: nur die eigenen Werte der Person — Wellness, keine Diagnose.',
};

/** Die Fassung einer Beschreibung für Heads und Mitarbeiter — abgeleitet aus der einen Quelle, nie abgeschrieben. */
export function agentenDef(d: WerkzeugDef): WerkzeugDef {
  const schema = JSON.parse(JSON.stringify(d.input_schema)) as { properties?: Record<string, unknown>; required?: string[] };
  const props = { ...(schema.properties ?? {}) };
  for (const f of FEST_IM_BEREICH[d.name] ?? []) delete props[f];
  if (MIT_FIRMA.has(d.name)) props.firma = { type: 'string', enum: [...BUSINESS_GESELLSCHAFTEN], description: `Business-Gesellschaft: ${firmen()}` };
  const required = (schema.required ?? []).filter(r => r in props);
  const text = [d.description, ZUSATZ[d.name] ?? '', LESEND.has(d.name) ? '' : VORSCHLAG].filter(Boolean).join(' ');
  return { name: d.name, description: text, input_schema: { ...schema, properties: props, required } };
}

/** Alle Beschreibungen der Register-Werkzeuge, die ein Agent bekommen kann — abgeleitet aus lib/zoe/werkzeug-defs.ts. */
export const REGISTER_DEFS: ReadonlyMap<string, WerkzeugDef> = new Map(Array.from(werkzeugDefs().values()).map(d => [d.name, agentenDef(d)]));

// ── Agenten-Werkzeuge (nur im Agenten-Bereich, nie im ZOE-Register) ─────────────────────────────────────────────────────

/** Werkzeuge der Mitarbeiter über `MITARBEITER_WERKZEUGE` hinaus: Brett, Hilfe über den Head, Rat beim starken Modell, Fach-Agent. */
export const MITARBEITER_ZUSATZ = ['brett_eintragen', 'hilfe_anfragen', 'rat_holen', 'fach_agent'] as const;
/** Head: Antworten auf offene Fragen im Brett (vermitteln). */
export const HEAD_ZUSATZ = ['brett_antworten'] as const;
export const AGENTEN_WERKZEUG_NAMEN: ReadonlySet<string> = new Set([...HEAD_WERKZEUGE, ...MITARBEITER_WERKZEUGE, ...MITARBEITER_ZUSATZ, ...HEAD_ZUSATZ]);

const AUFTRAG_SCHEMA = obj({
  ziel: S('Ein Satz: was am Ende da sein soll'),
  format: S('Wie das Ergebnis aussieht (z. B. „drei Entwürfe mit Anlass“)'),
  grenzen: S('Was NICHT getan wird (z. B. „nichts senden, nur Vorschläge, keine privaten Daten“)'),
  quellen: S('Welche Daten/Werkzeuge der Mitarbeiter nutzen soll'),
}, ['ziel', 'format', 'grenzen', 'quellen']);

export function agentenDefs(o: { mitarbeiter: readonly Pick<Mitarbeiter, 'id' | 'name' | 'rolle'>[]; headWerkzeuge: readonly string[] }): Record<string, WerkzeugDef> {
  return {
    an_mitarbeiter: { name: 'an_mitarbeiter', description: `Gibt einen Auftrag an einen deiner Mitarbeiter: ein neuer Thread entsteht, der Mitarbeiter arbeitet im Hintergrund und berichtet hierher zurück („Bericht aus Thread …“). Nur, wenn es sich lohnt: eine Frage beantwortest du selbst, Recherche/Entwurf = 1 Mitarbeiter, eine Kampagne höchstens 3. Mehr als ${2} Mitarbeiter in einem Zug brauchen eine Plan-Freigabe per Klick. Für eine offene Hilfe-Frage im Arbeitsstand: hilfe_fuer = Kennung der Frage.`,
      input_schema: obj({ mitarbeiter: { type: 'string', enum: o.mitarbeiter.map(m => m.id), description: o.mitarbeiter.map(m => `${m.id} = ${m.name}: ${m.rolle}`).join(' · ') }, auftrag: AUFTRAG_SCHEMA, hilfe_fuer: S('Optional: Kennung einer offenen Frage im Arbeitsstand (der Mitarbeiter liefert nur Funde)') }, ['mitarbeiter', 'auftrag']) },
    skill_laden: { name: 'skill_laden', description: 'Lädt die Anleitung eines Skills (Name aus der Liste SKILLS) — erst dann kennst du die Schritte.', input_schema: obj({ skill: S('Kennung des Skills') }, ['skill']) },
    merksatz_vorschlagen: { name: 'merksatz_vorschlagen', description: 'Ein kurzer Merksatz („so machen wir das“). ebene „persoenlich“: nur für diese Person, du legst ihn selbst ab (sichtbar und löschbar) — nur ohne fremden Text im Thread. ebene „haushalt“: gilt für alle, geht als Vorschlag in den Stapel (Klick). Nie Namen, Adressen oder Daten Dritter.',
      input_schema: obj({ text: S(`Höchstens ${GRENZEN.merksatzZeichen} Zeichen`), ebene: { type: 'string', enum: ['persoenlich', 'haushalt'] } }, ['text', 'ebene']) },
    skill_vorschlagen: { name: 'skill_vorschlagen', description: 'Schlägt einen neuen Skill (wiederverwendbare Anleitung) vor — er geht in den Stapel und wird erst nach Klick und Testlauf aktiv.',
      input_schema: obj({ name: S('kebab-case, höchstens 64 Zeichen'), beschreibung: S('Was und wann, dritte Person'), anleitung: S('Schritte'), werkzeuge: { type: 'array', items: { type: 'string', enum: [...o.headWerkzeuge] } }, tests: { type: 'array', items: obj({ eingabe: S(''), erwartet: { type: 'array', items: { type: 'string' } } }, ['eingabe', 'erwartet']) } }, ['name', 'beschreibung', 'anleitung']) },
    mitarbeiter_vorschlagen: { name: 'mitarbeiter_vorschlagen', description: 'Schlägt einen neuen Mitarbeiter vor — er geht in den Stapel und ist erst nach Klick da.',
      input_schema: obj({ name: S('Name'), rolle: S('Ein Satz'), anleitung: S('Wie er arbeitet'), werkzeuge: { type: 'array', items: { type: 'string', enum: [...o.headWerkzeuge] } } }, ['name', 'rolle']) },
    brett_antworten: { name: 'brett_antworten', description: 'Beantwortet eine offene Frage eines Mitarbeiters im Arbeitsstand — sein Lauf setzt danach fort.', input_schema: obj({ frage_id: S('Kennung der Frage'), antwort: S('Die Antwort') }, ['frage_id', 'antwort']) },
    brett_eintragen: { name: 'brett_eintragen', description: 'Trägt einen Fund (mit Beleg) oder eine Entscheidung in den gemeinsamen Arbeitsstand des Auftrags ein.', input_schema: obj({ art: { type: 'string', enum: ['fund', 'entscheidung'] }, text: S('Kurz, mit Beleg') }, ['art', 'text']) },
    hilfe_anfragen: { name: 'hilfe_anfragen', description: 'Fragt deinen Head um Hilfe (höchstens einmal je Lauf). Dein Lauf endet danach mit „wartet“ und setzt fort, sobald die Antwort im Arbeitsstand steht. Nur wenn du ohne die Antwort nicht weiterkommst.', input_schema: obj({ frage: S('Was du brauchst'), warum: S('Wofür'), wer: S('Optional: welcher Mitarbeiter helfen könnte') }, ['frage', 'warum']) },
    rat_holen: { name: 'rat_holen', description: 'Fragt ein stärkeres Modell um Rat (höchstens zweimal je Lauf) — es liest den bisherigen Verlauf und antwortet nur mit Text.', input_schema: obj({ frage: S('Wobei du unsicher bist') }, ['frage']) },
    fach_agent: { name: 'fach_agent', description: 'Führt deinen Fach-Agenten aus und liefert sein Ergebnis (Daten).', input_schema: obj({ auftrag: S('Konkreter Auftrag') }) },
  };
}

// ── Angebot: die Schnittmenge ───────────────────────────────────────────────────────────────────────────────────────────

/** Die Kategorien eines Heads, die gerade an die KI dürfen: Bereiche nach den Schaltern, Gesundheit nur mit (b), Web nur mit Web-Suche. */
export function aktiveKategorien(kats: readonly KiKategorie[], s: KiSchalter, gesundheitKi: boolean): KiKategorie[] {
  return kats.filter(k => k === 'gesundheit' ? gesundheitKi : istBereich(k) ? s.bereiche[k] : k === 'web' ? s.websuche : true);
}

export interface Angebot { tools: WerkzeugDef[]; register: Set<string>; agenten: Set<string> }

/**
 * Was ein Agent angeboten bekommt. `liste` = Katalog-Werkzeuge (Head) bzw. Mitarbeiter ∩ Head. Ein Register-Werkzeug fällt weg,
 * wenn seine Kategorie nicht zu den aktiven des Heads gehört oder der KI-Schalter/die Einwilligung es sperrt.
 */
export function werkzeugAngebot(o: {
  art: 'head' | 'mitarbeiter';
  liste: readonly string[];
  kategorien: readonly KiKategorie[];
  schalter: KiSchalter;
  gesundheitKi: boolean;
  head: HeadDef;
  mitarbeiter: readonly Pick<Mitarbeiter, 'id' | 'name' | 'rolle'>[];
  /** Mitarbeiter-Thread mit Brett (Auftrag des Heads) — sonst kein Brett, keine Hilfe. */
  brett: boolean;
  /** Helfer-Thread: keine Hilfe-Anfrage (R3), nur lesende Register-Werkzeuge (R4). */
  helfer: boolean;
  /** Nur lesende Register-Werkzeuge, KEINE Agenten-Werkzeuge (ZOE fragt den Head, `head_fragen` — keine Delegation, keine Vorschläge). */
  nurLesen?: boolean;
  /** Head-Thread mit offenen Fragen im Brett. */
  offeneFragen: boolean;
  agentId?: string;
  stufe?: string;
  lesend: ReadonlySet<string>;
}): Angebot {
  const register = new Set<string>();
  for (const w of o.liste) {
    if (!WERKZEUGE[w] || !REGISTER_DEFS.has(w)) continue;
    if ((o.helfer || o.nurLesen) && !o.lesend.has(w)) continue;
    if (o.nurLesen && w === 'crm_vorschlag') continue; // legt in den Stapel — eine Frage legt nichts an
    const k = kategorieVonWerkzeug(w, gruppeVon(w));
    if (k && !o.kategorien.includes(k)) continue;
    if (werkzeugSperre(k, o.schalter, o.gesundheitKi)) continue;
    register.add(w);
  }
  const agenten = new Set<string>();
  if (o.nurLesen) { /* keine Agenten-Werkzeuge */ } else if (o.art === 'head') {
    for (const w of HEAD_WERKZEUGE) agenten.add(w);
    if (!o.mitarbeiter.length) agenten.delete('an_mitarbeiter');
    if (o.offeneFragen) agenten.add('brett_antworten');
  } else {
    for (const w of MITARBEITER_WERKZEUGE) agenten.add(w);
    if (o.brett) { agenten.add('brett_eintragen'); if (!o.helfer) agenten.add('hilfe_anfragen'); }
    if (o.stufe === 'schnell') agenten.add('rat_holen');
    if (o.agentId) agenten.add('fach_agent');
  }
  const defs = agentenDefs({ mitarbeiter: o.mitarbeiter, headWerkzeuge: o.head.werkzeuge });
  const tools = [...Array.from(register).map(n => REGISTER_DEFS.get(n)!), ...Array.from(agenten).map(n => defs[n]).filter(Boolean)];
  return { tools, register, agenten };
}

/** Werkzeuge eines Mitarbeiters für einen Head: seine ∩ die des Heads (geteilte Mitarbeiter immer die Schnittmenge). */
export const mitarbeiterListe = (m: Pick<Mitarbeiter, 'werkzeuge'>, head: HeadDef): string[] => m.werkzeuge.filter(w => head.werkzeuge.includes(w));

// ── Bereich ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Eingaben auf den Bereich des Heads festlegen (Werkzeuge ohne eigenen Bereich): Aufgaben und Fokus im Bereich des Heads,
 * Aufgaben nur für die Person selbst (keine Zuweisung an andere aus dem Agenten-Bereich), Gesundheit nur eigene Werte.
 */
export function eingabeImBereich(name: string, input: Record<string, unknown>, head: HeadDef): Record<string, unknown> {
  const e = { ...input };
  if (name === 'create_task') { e.space = head.bereich; delete e.wer; if (head.bereich === 'privat') delete e.einheit; }
  if (name === 'setze_fokus') e.space = head.bereich;
  if (name === 'gesundheits_index') delete e.person;
  return e;
}

/** Lesende Werkzeuge, die der Kern selbst auf den Bereich beschränkt (statt des ZOE-Lesers über alle Bereiche). */
export const BEREICHS_LESER = new Set(['lies_postfach', 'suche_arbeit']);

/** Postfächer der Person nur im Bereich des Heads (Inbox 2 filtert serverseitig über `imBereich`). */
export async function postfachImBereich(person: string, bereich: 'privat' | 'business', input: Record<string, unknown>): Promise<string> {
  const { stromFuer } = await import('@/lib/inbox/strom-server');
  const { lageText } = await import('@/lib/inbox/zoe-sicht');
  const s = await stromFuer(person, { space: bereich });
  if (!s.postfaecher.length) return `Im Bereich ${bereich === 'business' ? 'Business' : 'Privat'} ist kein Postfach verbunden.`;
  const suche = String(input.suche ?? '').trim().slice(0, 60).toLowerCase();
  const anzahl = Math.min(20, Math.max(1, Number(input.anzahl) || (suche ? 5 : 20)));
  const liste = s.gespraeche
    .filter(g => g.fach !== 'geblockt' && (suche ? `${g.betreff} ${g.ausschnitt} ${g.gegenueber.email} ${g.gegenueber.name ?? ''}`.toLowerCase().includes(suche) : g.inArbeit && g.fach !== 'info'))
    .sort((a, b) => b.am.localeCompare(a.am)).slice(0, anzahl);
  const namen = Object.fromEntries(s.bereiche.map(b => [b.id, b.name]));
  const kopf = s.lage.map(l => lageText(l, l.bereich ? namen[l.bereich] ?? l.bereich : 'Ohne Bereich')).join('\n');
  if (!liste.length) return `${suche ? 'Kein Gespräch zum Suchwort.' : 'Nichts offen.'}\nLAGE:\n${kopf}`;
  const zeilen = liste.map(g => `• [${g.fach}] ${(g.zuordnung?.name ?? g.gegenueber.name ?? g.gegenueber.email).slice(0, 40)} — ${g.betreff.slice(0, 90)}${g.ausschnitt ? ` · ${g.ausschnitt.slice(0, 160)}` : ''}`);
  return `GESPRÄCHE (${liste.length}; nur Kopf und Ausschnitt):\n${zeilen.join('\n')}\n\nLAGE:\n${kopf}`;
}

/** Arbeitssuche nur im Bereich: Business-Heads ohne Privat-Space und ohne private Notizen (Agenten-Sicht des Brains). */
export async function arbeitImBereich(person: string, bereich: 'privat' | 'business', input: Record<string, unknown>): Promise<string> {
  const frage = String(input.frage ?? input.suche ?? '').replace(/\u0000/g, '').trim();
  if (!frage) return 'Fehlgeschlagen: frage fehlt (Stichworte).';
  if (frage.length > 300) return 'Nicht ausgeführt: die Frage ist länger als 300 Zeichen — bitte Stichworte.';
  const { haushaltDesInhabers } = await import('@/lib/zugang/haushalt-inhaber');
  const haushalt = await haushaltDesInhabers();
  if (!haushalt) return 'Nicht ausgeführt: nur im Haushalt des Inhabers.';
  const anzahl = Math.max(1, Math.min(20, Number(input.anzahl) || 8));
  const A = await import('@/lib/brain/app-index');
  const { mischen, arbeitAntwort } = await import('@/lib/zoe/arbeit-werkzeug');
  let app: { treffer: import('@/lib/brain/app-index').AppTreffer[]; durchsucht: number } = { treffer: [], durchsucht: 0 };
  if (input.nur !== 'brain') {
    try { await A.appIndexAktualisieren(); } catch { /* ohne frischen Index: der vorhandene */ }
    const r = A.appSuche(frage, { haushalt, privat: bereich === 'privat' }, anzahl);
    app = { treffer: bereich === 'privat' ? r.treffer.filter(t => t.privat) : r.treffer.filter(t => !t.privat), durchsucht: r.durchsucht };
  }
  let brain: { treffer: { id: string; titel: string; ausschnitt: string }[]; durchsucht: number } = { treffer: [], durchsucht: 0 };
  if (input.nur !== 'app') {
    try { const { suche } = await import('@/lib/zoe/vault'); brain = await suche(frage, anzahl, bereich === 'privat' ? { person } : { person, agent: true }); } catch { /* Brain nicht lesbar */ }
  }
  return arbeitAntwort(mischen(app.treffer, brain.treffer, anzahl), { app: app.durchsucht, brain: brain.durchsucht });
}
