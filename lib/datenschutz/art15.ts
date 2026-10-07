// ─── Auskunft nach Art. 15 DSGVO — die Angaben neben den Daten (05.10., Paket „Betroffenenrechte v2“, rein, getestet) ──
// Kevin 05.10.: „Die Software muss auf allen Standards der DSGVO sein, damit wir auch die Daten der Kunden aufnehmen können.“
// Eine Auskunft ist mehr als die Kopie der Daten (Abs. 3): Art. 15 Abs. 1 verlangt dazu
//   a  die Verarbeitungszwecke              → `zwecke` (aus dem Verzeichnis, Art. 30 — EINE Quelle)
//   b  die Kategorien der Daten             → `kategorien` (ebenso)
//   c  Empfänger (Abs. 2: Drittland + Garantie) → `empfaenger` (Empfänger-/AVV-Register der Einrichtung)
//   d  Speicherdauer bzw. Kriterien         → `speicherdauer` (Löschfristen + Speicher-Register + Sicherungen)
//   e  Rechte auf Berichtigung, Löschung, Einschränkung, Widerspruch → `rechte`
//   f  Beschwerderecht bei einer Aufsichtsbehörde → `beschwerde`
//   g  Herkunft, wenn nicht bei der Person erhoben → `herkunft`
//   h  automatisierte Entscheidungen inkl. Profiling (Art. 22) → `automatisiert` — ehrlich: Lead-Score und KI
// Zwei Arten: `kontakt` (Person in der Kartei, Auskunft unter Stammdaten › Datenschutz) und `konto` (die angemeldete Person über
// sich selbst, Konto › Meine Daten). Beide Routen bauen die Angaben HIER — und das druckbare HTML (`auskunftHtml`) kommt auch von hier.
// Alles escaped; die Texte stammen aus Eingaben (Einrichtung, Verzeichnis). Hinweis, keine Rechtsberatung.

import type { Verarbeitung } from '@/lib/crm/typen';
import { empfaengerAuskunft, garantieText, rolleText, verantwortlicherAuskunft, VERANTWORTLICHER_FEHLT, type Empfaenger, type Verantwortlicher } from './einrichtung';

export type AuskunftArt = 'kontakt' | 'konto';

/** Verarbeitungen (Verzeichnis-Kennungen), die jede KONTO-Person betreffen können. */
export const KONTO_VERARBEITUNGEN = ['vv-konten', 'vv-aufgaben-zeit', 'vv-kapazitaet', 'vv-gesundheit', 'vv-familie', 'vv-finanzen', 'vv-zoe', 'vv-ki', 'vv-telegram', 'vv-brain', 'vv-kalender-google', 'vv-email-google', 'vv-email-imap', 'vv-mac-m365', 'vv-bauplan', 'vv-sicherungen'] as const;
/** Verarbeitungen, die jede Person der Kartei betreffen. */
export const KONTAKT_IMMER = ['vv-kontakte', 'vv-vertrieb', 'vv-zoe', 'vv-ki', 'vv-sicherungen'] as const;
/** Weitere Verarbeitungen je Bereich, in dem die Auskunft Daten der Person gefunden hat (`kontaktBereiche`). */
export const KONTAKT_JE_BEREICH: Readonly<Record<string, readonly string[]>> = {
  mandate: ['vv-mandate'], events: ['vv-events'], netzwerken: ['vv-netzwerken'], uebergaben: ['vv-besuche-kunde', 'vv-kunden-export'],
  buchungen: ['vv-buchung'], gesellschaften: ['vv-gesellschaften'], kapazitaet: ['vv-kapazitaet'], kampagnen: ['vv-kampagnen'],
  kalender: ['vv-kalender-google', 'vv-mac-m365'], postfach: ['vv-email-google', 'vv-email-imap', 'vv-mac-m365'], aufgaben: ['vv-aufgaben-zeit'],
};

const gefuellt = (v: unknown): boolean => Array.isArray(v) ? v.length > 0 : v && typeof v === 'object' ? Object.keys(v as object).length > 0 : !!v;

/** In welchen Bereichen die Kontakt-Auskunft Daten gefunden hat (rein). `a` = das Auskunfts-Objekt (person + personAufzaehlen). */
export function kontaktBereiche(a: Record<string, unknown>): string[] {
  const p = (a.person ?? {}) as Record<string, unknown>;
  const b = new Set<string>();
  if (gefuellt(a.mandate) || gefuellt(a.chancen)) b.add('mandate');
  if (gefuellt(a.events)) b.add('events');
  if (gefuellt(p.rechtsgrundlageNotiz) || gefuellt(p.kennengelerntFuer)) b.add('netzwerken');
  if (gefuellt(a.uebergaben)) b.add('uebergaben');
  if (gefuellt(a.buchungen)) b.add('buchungen');
  if (gefuellt(a.gesellschaften)) b.add('gesellschaften');
  if (gefuellt(a.kapazitaet)) b.add('kapazitaet');
  if (gefuellt(p.lead) || (Array.isArray(p.einwilligungen) && p.einwilligungen.some(e => (e as { kanal?: string })?.kanal === 'newsletter'))) b.add('kampagnen');
  if (gefuellt(a.terminBezuege) || gefuellt(a.kommenderTermin) || gefuellt(a.meetings) || gefuellt(a.terminFollowups)) b.add('kalender');
  const weitere = Object.keys((a.weitereSpeicher ?? {}) as object).join(' ');
  if (/gmail|inbox|mail|m365|postfach/.test(weitere)) b.add('postfach');
  if (gefuellt(a.aufgaben)) b.add('aufgaben');
  return Array.from(b).sort();
}

/** Die Verzeichnis-Kennungen, die für eine Auskunft gelten (rein). */
export function verarbeitungenFuer(art: AuskunftArt, bereiche: readonly string[] = []): string[] {
  if (art === 'konto') return [...KONTO_VERARBEITUNGEN];
  const ids = new Set<string>(KONTAKT_IMMER);
  for (const b of bereiche) for (const id of KONTAKT_JE_BEREICH[b] ?? []) ids.add(id);
  return Array.from(ids);
}

// ── Rechte, Beschwerde, automatisierte Entscheidungen (Texte aus Sicht der Person) ──

export interface Recht { recht: string; norm: string; text: string }
const WEG_KONTAKT = 'Schreiben Sie uns formlos an die Kontakt-Adresse des Verantwortlichen (oben).';
const WEG_KONTO = 'Selbst in MAKE OS unter Konto › Meine Daten (Kopie, Herunterladen, Löschen) — oder formlos an die Kontakt-Adresse des Verantwortlichen.';
export function rechte(art: AuskunftArt): Recht[] {
  const weg = art === 'konto' ? WEG_KONTO : WEG_KONTAKT;
  return [
    { recht: 'Auskunft', norm: 'Art. 15 DSGVO', text: `Sie erhalten jederzeit eine Kopie Ihrer Daten mit diesen Angaben. ${weg}` },
    { recht: 'Berichtigung', norm: 'Art. 16 DSGVO', text: art === 'konto' ? 'Name, Adressen und Passwort ändern Sie selbst unter Konto; alles andere korrigieren Sie an seiner Stelle oder lassen es korrigieren.' : 'Falsche oder unvollständige Angaben berichtigen wir auf Ihren Hinweis.' },
    { recht: 'Löschung', norm: 'Art. 17 DSGVO', text: art === 'konto' ? 'Unter Konto › Meine Daten › „Mein Konto löschen“. Was wir aus gesetzlichen Gründen aufbewahren müssen (z. B. Rechnungen), sperren wir statt zu löschen.' : 'Wir löschen Ihre Daten aus allen Speichern; was wir aus gesetzlichen Gründen aufbewahren müssen, sperren wir.' },
    { recht: 'Einschränkung der Verarbeitung', norm: 'Art. 18 DSGVO', text: 'Statt zu löschen, können Sie verlangen, dass wir Ihre Daten nur noch aufbewahren, aber nicht mehr verwenden.' },
    { recht: 'Datenübertragbarkeit', norm: 'Art. 20 DSGVO', text: art === 'konto' ? 'Unter Konto › Meine Daten › „Meine Daten herunterladen“ (maschinenlesbar, JSON).' : 'Die Daten, die Sie uns gegeben haben, erhalten Sie maschinenlesbar (diese JSON-Datei).' },
    { recht: 'Widerspruch', norm: 'Art. 21 DSGVO', text: 'Gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 6 Abs. 1 lit. f) aus Gründen Ihrer besonderen Situation; gegen Werbung jederzeit und ohne Begründung — dann sprechen wir Sie nicht mehr werblich an (Werbesperre).' },
    { recht: 'Widerruf einer Einwilligung', norm: 'Art. 7 Abs. 3 DSGVO', text: art === 'konto' ? 'Einwilligungen (z. B. Gesundheit, KI) widerrufen Sie selbst unter System › Datenschutz — mit Wirkung für die Zukunft.' : 'Eine Einwilligung können Sie jederzeit mit Wirkung für die Zukunft widerrufen — auch über den Abmeldelink in jeder Werbe-Mail.' },
  ];
}

/** Standardtext zur Beschwerde (Art. 77) — die zuständige Behörde trägt der Inhaber in der Einrichtung ein (optional). */
export const BESCHWERDE_TEXT = 'Sie können sich bei einer Datenschutz-Aufsichtsbehörde beschweren — insbesondere in dem Mitgliedstaat Ihres Aufenthaltsorts, Ihres Arbeitsplatzes oder des Orts des mutmaßlichen Verstoßes (Art. 77 DSGVO).';

/** Art. 15 Abs. 1 lit. h — ehrlich, was automatisch läuft. Keine Entscheidung im Sinne von Art. 22 (rechtliche Wirkung ohne Mensch). */
export function automatisiert(art: AuskunftArt): { art22: false; text: string; verfahren: { name: string; logik: string; tragweite: string }[] } {
  const ki = { name: 'KI-Auswertung (ZOE, Anbieter Anthropic, USA)', logik: 'Ein Sprachmodell liest gekapselte Arbeitsfelder (nie private Notizen, nie gesperrte Personen; in automatischen Läufen werden Namen durch Platzhalter ersetzt) und schreibt Entwürfe, Zusammenfassungen und Vorschläge.', tragweite: 'Jede Wirkung nach außen (Mail, Termin, Änderung an Ihren Daten) geschieht erst nach Freigabe durch einen Menschen. Jeder Aufruf wird ohne Inhalte protokolliert (12 Monate).' };
  if (art === 'konto') return {
    art22: false, text: 'Es gibt keine automatisierte Entscheidung, die Ihnen gegenüber rechtliche Wirkung entfaltet oder Sie ähnlich erheblich beeinträchtigt (Art. 22 DSGVO). Automatisch laufen nur Hilfen:',
    verfahren: [ki, { name: 'Planungs- und Kennzahlen-Rechnungen', logik: 'Feste Regeln rechnen aus Ihren Eingaben z. B. verfügbare Zeit (Kapazität), Fortschritt oder einen Index.', tragweite: 'Nur zur Anzeige und Planung; Gesundheitswerte gehen nur mit Ihrer ausdrücklichen Einwilligung ein.' }],
  };
  return {
    art22: false, text: 'Es gibt keine automatisierte Entscheidung, die Ihnen gegenüber rechtliche Wirkung entfaltet oder Sie ähnlich erheblich beeinträchtigt (Art. 22 DSGVO). Wir nutzen aber zwei automatische Verfahren (Profiling im weiteren Sinn):',
    verfahren: [
      { name: 'Lead-Score und Qualifizierung', logik: 'Feste Regeln vergeben Punkte für gemessene Signale (z. B. Antworten, Gespräche, Teilnahme an Veranstaltungen) und für Angaben aus Gesprächen (Bedarf, Zeitpunkt, Passung); über einer Schwelle gilt ein Kontakt als „marketing-“ bzw. „vertriebsqualifiziert“ (MQL/SQL).', tragweite: 'Bestimmt nur die Reihenfolge, in der wir Kontakte ansprechen. Ob und wie wir Sie ansprechen, entscheidet immer ein Mensch; ohne Einwilligung keine Werbung.' },
      ki,
    ],
  };
}

// ── Die Angaben ──────────────────────────────────────────────────────────────

export interface Art15Angaben {
  grundlage: string;
  verantwortlich: Record<string, unknown>;
  zwecke: { verarbeitung: string; zweck: string; rechtsgrundlage: string }[];
  kategorien: { verarbeitung: string; daten: string }[];
  empfaenger: { name: string; rolle: string; zweck: string; drittland: string | null; garantie: string | null }[];
  speicherdauer: { je: { bereich: string; frist: string }[]; sicherungen: string };
  rechte: Recht[];
  beschwerde: { text: string; behoerde?: string };
  herkunft: string[];
  automatisiert: ReturnType<typeof automatisiert>;
}

export interface Art15Eingabe {
  art: AuskunftArt;
  verantwortlicher: Verantwortlicher | null;
  empfaenger: readonly Empfaenger[];
  /** Das ganze Verzeichnis — gefiltert wird hier (`verarbeitungenFuer`). */
  verarbeitungen: readonly Verarbeitung[];
  /** Nur Kontakt: Bereiche mit Daten (`kontaktBereiche`). */
  bereiche?: readonly string[];
  /** Zusätzliche Fristen (Löschfristen, Register) — die der Verarbeitungen kommen von selbst dazu. */
  fristen?: readonly { bereich: string; frist: string }[];
  sicherungen: string;
  herkunft: readonly string[];
}

/** Empfänger für die Auskunft: Kontakt = die mit Daten Dritter (`dritte`), Konto = alle in Gebrauch (die eigenen Daten können überall ankommen). */
export function empfaengerFuer(art: AuskunftArt, liste: readonly Empfaenger[]): Art15Angaben['empfaenger'] {
  if (art === 'kontakt') return empfaengerAuskunft(liste);
  return liste.filter(e => !e.archiviert).map(e => ({ name: e.name, rolle: rolleText(e.rolle), zweck: e.zweck, drittland: e.drittland || null, garantie: e.drittland ? garantieText(e.garantie) : null }));
}

export function art15Angaben(e: Art15Eingabe): Art15Angaben {
  const ids = verarbeitungenFuer(e.art, e.bereiche);
  const vv = ids.map(id => e.verarbeitungen.find(v => v.id === id)).filter((v): v is Verarbeitung => !!v);
  const behoerde = e.verantwortlicher?.aufsicht?.trim();
  return {
    grundlage: 'Angaben nach Art. 15 Abs. 1 lit. a–h und Abs. 2 DSGVO; Kopie der Daten nach Art. 15 Abs. 3 (Feld „daten“ bzw. Abschnitt „Ihre Daten“).',
    verantwortlich: verantwortlicherAuskunft(e.verantwortlicher),
    zwecke: vv.map(v => ({ verarbeitung: v.name, zweck: v.zweck, rechtsgrundlage: v.rechtsgrundlage })),
    kategorien: vv.map(v => ({ verarbeitung: v.name, daten: v.daten })),
    empfaenger: empfaengerFuer(e.art, e.empfaenger),
    speicherdauer: { je: [...vv.map(v => ({ bereich: v.name, frist: v.loeschfrist })), ...(e.fristen ?? [])], sicherungen: e.sicherungen },
    rechte: rechte(e.art),
    beschwerde: { text: BESCHWERDE_TEXT, ...(behoerde ? { behoerde } : {}) },
    herkunft: [...e.herkunft],
    automatisiert: automatisiert(e.art),
  };
}

// ── Druckbares HTML (Browser › Drucken › als PDF) ─────────────────────────────

export const esc = (t: unknown) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const zeilen = (t: unknown) => esc(t).replace(/\n/g, '<br>');
const LISTE_MAX = 400;
const TIEFE_MAX = 7;

/** Beliebige Daten als verschachtelte Tabellen/Listen — escaped, begrenzt (der Rest steht in der JSON-Datei). Rein. */
export function datenHtml(w: unknown, tiefe = 0): string {
  if (w === null || w === undefined || w === '') return '<span class="leer">—</span>';
  if (typeof w !== 'object') return zeilen(typeof w === 'boolean' ? (w ? 'ja' : 'nein') : w);
  if (tiefe >= TIEFE_MAX) return `<code>${esc(JSON.stringify(w).slice(0, 400))}</code>`;
  if (Array.isArray(w)) {
    if (!w.length) return '<span class="leer">keine</span>';
    const rest = w.length > LISTE_MAX ? `<li class="leer">… ${w.length - LISTE_MAX} weitere in der JSON-Datei</li>` : '';
    return `<ol>${w.slice(0, LISTE_MAX).map(x => `<li>${datenHtml(x, tiefe + 1)}</li>`).join('')}${rest}</ol>`;
  }
  const e = Object.entries(w as Record<string, unknown>);
  if (!e.length) return '<span class="leer">—</span>';
  return `<table>${e.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${datenHtml(v, tiefe + 1)}</td></tr>`).join('')}</table>`;
}

/** Das ganze Dokument: Angaben a–h + Kopie der Daten. Eigenständig, ohne Skripte, ohne fremde Quellen. */
export function auskunftHtml(d: { titel: string; erstellt: string; angaben: Art15Angaben; daten: unknown; hinweis?: string }): string {
  const a = d.angaben;
  const v = a.verantwortlich as { fehlt?: boolean; name?: string; anschrift?: string; kontakt?: string; telefon?: string; datenschutzbeauftragter?: { name?: string; kontakt?: string } };
  const vBlock = v.fehlt ? `<p class="fehlt">${esc(VERANTWORTLICHER_FEHLT)}</p>`
    : `<p><strong>${esc(v.name)}</strong><br>${zeilen(v.anschrift)}<br>${esc(v.kontakt)}${v.telefon ? ` · ${esc(v.telefon)}` : ''}${v.datenschutzbeauftragter ? `<br>Datenschutzbeauftragter: ${esc([v.datenschutzbeauftragter.name, v.datenschutzbeauftragter.kontakt].filter(Boolean).join(', '))}` : ''}</p>`;
  const tab = (kopf: string[], z: unknown[][]) => `<table class="liste"><tr>${kopf.map(k => `<th>${esc(k)}</th>`).join('')}</tr>${z.map(r => `<tr>${r.map(c => `<td>${zeilen(c)}</td>`).join('')}</tr>`).join('')}</table>`;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(d.titel)}</title>
<style>body{font:14px/1.5 -apple-system,system-ui,sans-serif;color:#111;background:#fff;max-width:960px;margin:24px auto;padding:0 16px}h1{font-size:22px}h2{font-size:17px;margin-top:28px;border-bottom:1px solid #ccc}table{border-collapse:collapse;width:100%;margin:4px 0}th,td{border:1px solid #ddd;padding:5px 7px;vertical-align:top;text-align:left}th{width:200px;background:#f6f6f6;font-weight:600}table.liste th{width:auto}ol{margin:0;padding-left:20px}.fehlt{color:#b00;font-weight:600}.leer{color:#888}.hinweis{color:#555}code{font-size:12px;word-break:break-all}@media print{body{margin:0}h2{break-after:avoid}}</style></head>
<body><h1>${esc(d.titel)}</h1><p class="hinweis">Erstellt ${esc(d.erstellt.slice(0, 16).replace('T', ' '))} (UTC) · ${esc(a.grundlage)}${d.hinweis ? ` · ${esc(d.hinweis)}` : ''}</p>
<h2>Verantwortlicher</h2>${vBlock}
<h2>a) Zwecke und Rechtsgrundlagen</h2>${tab(['Verarbeitung', 'Zweck', 'Rechtsgrundlage'], a.zwecke.map(z => [z.verarbeitung, z.zweck, z.rechtsgrundlage]))}
<h2>b) Kategorien der Daten</h2>${tab(['Verarbeitung', 'Daten'], a.kategorien.map(z => [z.verarbeitung, z.daten]))}
<h2>c) Empfänger (mit Drittland und Garantie)</h2>${a.empfaenger.length ? tab(['Empfänger', 'Rolle', 'Zweck', 'Drittland', 'Garantie'], a.empfaenger.map(e => [e.name, e.rolle, e.zweck, e.drittland ?? 'EU/EWR', e.garantie ?? '—'])) : '<p class="leer">keine</p>'}
<h2>d) Speicherdauer</h2>${tab(['Bereich', 'Frist'], a.speicherdauer.je.map(f => [f.bereich, f.frist]))}<p>${esc(a.speicherdauer.sicherungen)}</p>
<h2>e) Ihre Rechte</h2>${tab(['Recht', 'Grundlage', 'So geht es'], a.rechte.map(r => [r.recht, r.norm, r.text]))}
<h2>f) Beschwerde</h2><p>${esc(a.beschwerde.text)}${a.beschwerde.behoerde ? `<br>Für uns zuständig: ${zeilen(a.beschwerde.behoerde)}` : ''}</p>
<h2>g) Herkunft der Daten</h2>${a.herkunft.length ? `<ul>${a.herkunft.map(h => `<li>${esc(h)}</li>`).join('')}</ul>` : '<p class="leer">—</p>'}
<h2>h) Automatisierte Entscheidungen und Profiling</h2><p>${esc(a.automatisiert.text)}</p>${tab(['Verfahren', 'Wie es arbeitet', 'Tragweite'], a.automatisiert.verfahren.map(x => [x.name, x.logik, x.tragweite]))}
<h2>Ihre Daten (Kopie, Art. 15 Abs. 3)</h2>${datenHtml(d.daten)}
</body></html>`;
}

/** Kopfzeilen für das HTML: nie zwischenspeichern, keine Skripte, kein Einbetten. */
export const HTML_KOPF: Record<string, string> = {
  'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'", 'Referrer-Policy': 'no-referrer',
};
