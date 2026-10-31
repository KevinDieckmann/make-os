// ─── Checks — was der Browser vom Katalog bekommt (24.10., Innovations-Check) ───────────────────────────────────
// Fragen und Antwort-Texte für die öffentliche Seite — OHNE Punkte, Hebel-Stufen, Codes, Rubriken und interne Intros (die Seite
// braucht sie nicht, und so lässt sich das Ergebnis nicht gezielt „hochklicken“). Dazu Zoes Satz je Abschnitt. Rein.

import { alleFragen, type FrageMitAbschnitt } from './katalog';
import { OFFENE_ZUSATZFRAGEN } from './ablauf';
import { ABSCHNITT_SATZ, BELEG_BAUSTEINE, belegHilfe } from './zoe-texte';
import type { CheckVorlage, FrageTyp } from './typen';

export interface OeffentlicheFrage {
  id: string;
  abschnitt: string;
  text: string;
  typ: FrageTyp;
  /** Pflichtfrage des Kurzchecks (die Reihenfolge der Strecke entscheidet trotzdem der Server). */
  kurz?: true;
  optionen?: { id: string; text: string; freitext?: boolean; exklusiv?: boolean }[];
  zusatz?: { text: string };
  /** Hilfe-Satz unter der Frage (Beleg: Nachfragen; G1: Hinweis zum AI Act). */
  hilfe?: string;
  /** Bausteine zum Antippen (Beleg-Fragen). */
  bausteine?: readonly string[];
  /** Pflichtfrage in eigenen Worten (nie überspringbar). */
  pflicht?: true;
}

export interface OeffentlicherKatalog { vorlage: string; name: string; fragen: OeffentlicheFrage[]; abschnittSatz: Record<string, string>; /** Name je Abschnitt für den Fortschritt („Strategie und Führung“). */ abschnittName: Record<string, string> }

function oeffentlich(f: FrageMitAbschnitt): OeffentlicheFrage {
  return {
    id: f.id,
    abschnitt: f.abschnitt,
    text: f.text,
    typ: f.typ,
    ...(f.kurzcheck ? { kurz: true as const } : {}),
    ...(f.pflicht ? { pflicht: true as const } : {}),
    ...(f.optionen ? { optionen: f.optionen.map(o => ({ id: o.id, text: o.text, ...(o.freitext ? { freitext: true } : {}), ...(o.exklusiv ? { exklusiv: true } : {}) })) } : {}),
    ...(f.zusatz ? { zusatz: { text: f.zusatz.text } } : {}),
    ...(f.typ === 'beleg' ? { hilfe: belegHilfe(f.nachfragen), bausteine: BELEG_BAUSTEINE[f.id] ?? [] } : f.hinweis ? { hilfe: f.hinweis } : {}),
  };
}

export function oeffentlicherKatalog(v: CheckVorlage): OeffentlicherKatalog {
  // Zoes Satz je Abschnitt: der Satz aus dem Katalog (Vertriebscheck, Sichtbarkeitstest), sonst die festen Sätze des Innovations-Checks.
  const ausKatalog = Object.fromEntries(v.katalog.abschnitte.filter(a => !!a.satz).map(a => [a.id, a.satz!]));
  const abschnittName: Record<string, string> = { X: 'Zum Schluss', ...Object.fromEntries(v.katalog.abschnitte.map(a => [a.id, a.dimension ? a.name : a.id === 'A' ? 'Ihr Unternehmen' : /^[HIJ]$/.test(a.id) ? 'Ihre Branche' : a.name])) };
  return { vorlage: v.id, name: v.name, fragen: [...alleFragen(v.katalog), ...OFFENE_ZUSATZFRAGEN].map(oeffentlich), abschnittSatz: { ...ABSCHNITT_SATZ, ...ausKatalog }, abschnittName };
}
