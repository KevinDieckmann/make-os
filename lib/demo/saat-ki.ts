// ─── MAKE OS — Demo-Instanz: KI-Beispiele (Server, 15.10.) ────────────────────────────────────────────────────────────────────────────────
// Abnahme 2 B13 („Die Demo zeigt keine KI“), Kevin 15.10.: „Beispiel-Ergebnisse säen.“ Ohne KI-Schlüssel zeigt die Demo erfundene Ergebnisse, die
// sichtbar als „Beispiel“ markiert sind (`beispiel: true` an den Daten, lib/demo/beispiel.ts; Chip components/os/BeispielMarke.tsx):
//   · je Head (Sales, Marketing, Event) ein Lauf mit Bericht und 2–3 Vorschlägen in der Freigabe-Liste (Bestand `head-<id>`)
//   · der Head of Finance mit einem Wochenreview und zwei Vorschlägen (Bestände `haushalt-chef--<haushalt>` und `finanzchef` — nur Business-Inhalt)
//   · ein ZOE-Vorschlag mehr im Freigabe-Stapel (`lege`, wie ein Lauf) — die zwei der Saat (lib/demo/saat.ts 7c) tragen die Marke ebenfalls
//   · ein kurzer ZOE-Gesprächsverlauf (Thread der Inhaberin, `ablageAendernFuer` — dieselbe Schreibstelle wie der Lauf)
// Begründete Ausnahme von „Saat über Routen“ (Kopf von lib/demo/saat.ts): Berichte und Vorschläge der Agenten entstehen im Browser NUR über einen
// Lauf, der ein Modell ruft — darum schreibt die Saat sie direkt in die Bestände der Läufe (dieselbe Form wie ein Lauf). Annehmen/Ablehnen läuft
// danach über die normalen Routen: Annehmen legt einen nächsten Schritt oder eine Aufgabe an — gesendet wird nie etwas.
// Riegel: NUR in einer Demo-Instanz (`beispieleErlaubt`: MAKE_OS_DEMO=1 UND Demo-Marke) — sonst wird nichts geschrieben.
// Alles erfunden: Personen und Firmen der Demo-Saat, keine Beträge in den Texten (der Prüfer der Heads verlangt Belege für jede Zahl).

import { createHash } from 'node:crypto';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { tagPlus } from '@/lib/zeit/kalender-kern';
import { verantwortlich } from '@/lib/crm/team';
import { DEMO_MARKE, demoUuid } from './schutz';
import { beispieleErlaubt } from './beispiel';
import type { HeadBericht, HeadStand, HeadVorschlag } from '@/lib/heads/stand';
import type { Vorschlag as HeadVorschlagRoh } from '@/lib/heads/pruefer';
import type { Bericht as ChefBericht, ChefStand, ChefVorschlag } from '@/lib/finanzen/chef/stand';
import type { VorschlagRoh as ChefVorschlagRoh } from '@/lib/finanzen/chef/pruefer';

export interface KiSaatKontext { lena: string; jonas: string; haushalt: string; heute: string; jetzt: Date; kontaktId: (schluessel: string) => string }

/** Darf in diesem Datenordner überhaupt ein Beispiel entstehen? (Schalter + Demo-Marke — die Marke legt nur die Saat an.) */
export async function kiBeispieleErlaubt(): Promise<boolean> {
  return beispieleErlaubt({ env: process.env, marke: await loadJson(DEMO_MARKE).catch(() => null) });
}

type HeadId = 'sales' | 'marketing' | 'event';
const sha = (t: string) => createHash('sha256').update(t).digest('hex');
/** Feste Kennungen (Form wie im Lauf), damit Links nach dem Zurücksetzen gleich bleiben. */
const kennung = (praefix: string, schluessel: string) => `${praefix}-${demoUuid(`ki-beispiel:${schluessel}`, sha)}`;
const leer = { kontakt_id: null, chance_id: null, mandat_id: null, event_id: null, entwurf: null, quelle: [] as string[] };

/** Je Head: Modus, Lagebild und Vorschläge — erfunden, mit Frist und „Warum jetzt“, ohne Beträge. */
function headBeispiele(k: KiSaatKontext): Record<HeadId, { modus: string; status: HeadBericht['antwort']['status']; zusammenfassung: string; befund: { titel: string; text: string }; vorschlaege: HeadVorschlagRoh[] }> {
  const { heute, kontaktId } = k;
  const sales = verantwortlich('sales'), marketing = verantwortlich('marketing'), event = verantwortlich('event');
  return {
    sales: {
      modus: 'deal_review', status: 'beobachten',
      zusammenfassung: 'Die Pipeline trägt: ein Angebot wartet auf Antwort, ein Workshop steht an. Zuerst Grünfeld Bau nachfassen. (Beispiel)',
      befund: { titel: 'Angebot ohne Rückmeldung', text: 'Das Angebot an Grünfeld Bau liegt seit einigen Tagen ohne Antwort — die Entscheidung fällt in zwei Wochen. (Beispiel)' },
      vorschlaege: [
        { ...leer, art: 'angebot_nachfassen', titel: 'Angebot Grünfeld Bau telefonisch nachfassen', begruendung: 'Die Entscheidung fällt in zwei Wochen; ein kurzer Anruf klärt offene Fragen, bevor das Angebot liegen bleibt. (Beispiel)', kontakt_id: kontaktId('elif'), frist: tagPlus(heute, 2), prioritaet: 'hoch', dedup_schluessel: 'beispiel:sales:gruenfeld', signal: { typ: 'frist', datum: tagPlus(heute, 14), text: 'Entscheidung in zwei Wochen (Beispiel)' }, entwurf: { kanal: 'telefon', text: 'Leitfaden: Danke fürs Gespräch — passt der Umfang der Diagnose? Gibt es Fragen zum Ablauf in zwei Wochen? Nächster Schritt: Termin für den Start festhalten. (Beispiel)' }, fuer: sales },
        { ...leer, art: 'review_ansetzen', titel: 'Quartals-Review mit Nordwerk vorbereiten', begruendung: 'Das Review steht in neun Tagen an; die Kennzahlen des letzten Monats gehören vorher in die Unterlage. (Beispiel)', kontakt_id: kontaktId('sophie'), mandat_id: 'm-demo-nordwerk', frist: tagPlus(heute, 7), prioritaet: 'mittel', dedup_schluessel: 'beispiel:sales:nordwerk-review', signal: { typ: 'kunde', datum: tagPlus(heute, 9), text: 'Quartals-Review (Beispiel)' }, fuer: sales },
        { ...leer, art: 'intro_erbitten', titel: 'Bei Atlas Software um ein Gespräch mit der Finanzleitung bitten', begruendung: 'Der Workshop zur Ausgangslage steht an; die Finanzleitung entscheidet mit. (Beispiel)', kontakt_id: kontaktId('nina'), frist: tagPlus(heute, 5), prioritaet: 'niedrig', dedup_schluessel: 'beispiel:sales:atlas-intro', entwurf: { kanal: 'mail', text: 'Hallo Nina, für den Workshop wäre es gut, die Finanzleitung kurz dabeizuhaben — wer wäre die richtige Person? Viele Grüße (Beispiel)' }, fuer: sales },
      ],
    },
    marketing: {
      modus: 'wochenplan', status: 'ruhig',
      zusammenfassung: 'Diese Woche zwei Beiträge und eine Anfrage für eine Fallstudie — der Redaktionsplan ist sonst gefüllt. (Beispiel)',
      befund: { titel: 'Fallstudie fehlt', text: 'Für Vertriebsaufbau gibt es noch keine Fallstudie; Nordwerk ist seit einigen Wochen dabei und zufrieden. (Beispiel)' },
      vorschlaege: [
        { ...leer, art: 'beitrag_entwurf', titel: 'Beitrag: Drei Kennzahlen, die jede Geschäftsführung kennen sollte', begruendung: 'Passt zur Positionierung und zur Abendreihe; kurzer Text, ein Bild aus dem Album. (Beispiel)', frist: tagPlus(heute, 4), prioritaet: 'mittel', dedup_schluessel: 'beispiel:marketing:beitrag', entwurf: { kanal: 'linkedin', text: 'Drei Zahlen reichen oft: Auftragseingang, Marge je Projekt, frei verfügbare Liquidität. Welche schaut ihr jeden Montag an? (Beispiel)' }, fuer: marketing },
        { ...leer, art: 'fallstudie_anfragen', titel: 'Nordwerk um eine kurze Fallstudie bitten', begruendung: 'Das erste Ziel des Mandats ist erreicht — ein guter Moment für eine Referenz. (Beispiel)', kontakt_id: kontaktId('sophie'), frist: tagPlus(heute, 10), prioritaet: 'niedrig', dedup_schluessel: 'beispiel:marketing:fallstudie', fuer: marketing },
      ],
    },
    event: {
      modus: 'planung', status: 'ruhig',
      zusammenfassung: 'Der nächste Abend braucht Ziel und Gästemischung; Einladungen zwei Wochen vorher. (Beispiel)',
      befund: { titel: 'Ziel des Abends offen', text: 'Für den nächsten Abend der Reihe ist noch kein Ziel festgelegt. (Beispiel)' },
      vorschlaege: [
        { ...leer, art: 'ziel_schaerfen', titel: 'Ziel des nächsten Abends festlegen: drei echte Gespräche mit Zielkunden', begruendung: 'Ein messbares Ziel macht das Nachfassen leichter. (Beispiel)', frist: tagPlus(heute, 5), prioritaet: 'mittel', dedup_schluessel: 'beispiel:event:ziel', fuer: event },
        { ...leer, art: 'einladen', titel: 'Gästeliste mischen: Kundschaft und zwei Zielkunden', begruendung: 'Gemischte Runden bringen Empfehlungen; zwei Zielkunden aus der Kartei passen. (Beispiel)', frist: tagPlus(heute, 8), prioritaet: 'niedrig', dedup_schluessel: 'beispiel:event:gaeste', fuer: event },
      ],
    },
  };
}

async function headsSaen(k: KiSaatKontext): Promise<number> {
  const b = headBeispiele(k);
  let n = 0;
  for (const head of Object.keys(b) as HeadId[]) {
    const x = b[head];
    const zeit = new Date(k.jetzt.getTime() - 2 * 3_600_000).toISOString();
    const berichtId = `hb-beispiel-${head}`;
    const bericht: HeadBericht = {
      id: berichtId, zeit, modus: x.modus, ausgeloest: 'takt',
      antwort: { status: x.status, zusammenfassung: x.zusammenfassung, befunde: [{ ...x.befund, quelle: [] }], vorschlaege: x.vorschlaege, fragen: [], datenluecken: [], antwort: '' },
      pruefung: { gestrichen: [], unbelegt: [], verstoesse: [], geprueft: x.vorschlaege.length, korrigiert: false },
      modell: 'beispiel', dauer_ms: 0, quelle: 'ki', beispiel: true,
    };
    const vorschlaege: HeadVorschlag[] = x.vorschlaege.map((v, i) => ({ ...v, herkunft: 'ki', id: `hs-beispiel-${head}-${i + 1}`, status: 'offen', erstellt: zeit, aktualisiert: zeit, berichtId, modus: x.modus, beispiel: true }));
    await updateJson<HeadStand>(`head-${head}`, s => {
      const st: HeadStand = { berichte: [], vorschlaege: [], letzte: {}, versuche: {}, ...(s ?? {}) };
      if (st.berichte.some(y => y.id === berichtId)) return st;
      return { ...st, berichte: [...st.berichte, bericht], vorschlaege: [...st.vorschlaege, ...vorschlaege.filter(v => !st.vorschlaege.some(y => y.id === v.id))], letzte: { ...st.letzte, [x.modus]: zeit } };
    });
    n += vorschlaege.length;
  }
  return n;
}

/** Head of Finance: ein Wochenreview mit zwei Vorschlägen — nur Business-Inhalt (dieselbe Form in beiden Beständen). */
async function chefSaen(k: KiSaatKontext): Promise<number> {
  const zeit = new Date(k.jetzt.getTime() - 3 * 3_600_000).toISOString();
  const roh: ChefVorschlagRoh[] = [
    { titel: 'Monatsabschluss September an die Kanzlei geben', begruendung: 'Die Zahlen des Vormonats sind eingetragen; die Kanzlei braucht sie für die Umsatzsteuer-Voranmeldung. (Beispiel)', betrag_eur: null, frist: tagPlus(k.heute, 6), prioritaet: 'mittel', verantwortlich: k.jonas, bereich: 'business', art: 'abschluss', quelle: [], dedup_schluessel: 'beispiel:chef:abschluss' },
    { titel: 'Steuerrücklage der operativen Gesellschaft prüfen', begruendung: 'Die Schätzung unter Finanzen › Steuern ist gestiegen; die Rücklage sollte sie decken. Hinweis, keine Steuerberatung. (Beispiel)', betrag_eur: null, frist: tagPlus(k.heute, 10), prioritaet: 'niedrig', verantwortlich: k.lena, bereich: 'steuern', art: 'ruecklage', quelle: [], dedup_schluessel: 'beispiel:chef:ruecklage' },
  ];
  let n = 0;
  for (const [name, umfang] of [[`haushalt-chef--${k.haushalt}`, 'business+haushalt'], ['finanzchef', 'business']] as const) {
    const berichtId = 'fb-beispiel-woche';
    const bericht: ChefBericht = {
      id: berichtId, zeit, modus: 'wochenreview', umfang, ausgeloest: 'takt',
      antwort: {
        modus: 'wochenreview', status: 'ruhig',
        zusammenfassung: 'Die Kasse trägt über das Quartal; zwei Rechnungen sind in den nächsten Wochen fällig, der Monatsabschluss steht. (Beispiel)',
        ampel: [{ bereich: 'business', farbe: 'gruen', grund: 'Liquidität über zwölf Wochen gedeckt (Beispiel)' }],
        befunde: [{ titel: 'Retainer laufen planmäßig', was: 'Beide Mandate stehen im Liquiditätsplan. (Beispiel)', bedeutung: 'Die Einnahmen der nächsten Monate sind planbar. (Beispiel)', typ: 'fakt', schwere: 'niedrig', bereich: 'business', steuerhinweis: false, quelle: [] }],
        vorschlaege: roh, fragen: [], datenluecken: [], antwort: null, bericht_markdown: null,
      },
      pruefung: { geprueft: 0, unbelegt: [], quellenFehlen: [], betraegeUnbelegt: [], fristenUnbelegt: [], verstoesse: [], korrigiert: false },
      modell: 'beispiel', dauer_ms: 0, beispiel: true,
    };
    const vorschlaege: ChefVorschlag[] = roh.map((v, i) => ({ ...v, id: `fs-beispiel-${i + 1}`, status: 'offen', erstellt: zeit, aktualisiert: zeit, berichtId, beispiel: true }));
    await updateJson<ChefStand>(name, s => {
      const st: ChefStand = { berichte: [], vorschlaege: [], letzte: {}, versuche: {}, ...(s ?? {}) };
      if (st.berichte.some(y => y.id === berichtId)) return st;
      return { ...st, berichte: [...st.berichte, bericht], vorschlaege: [...st.vorschlaege, ...vorschlaege], letzte: { ...st.letzte, wochenreview: zeit } };
    });
    n = vorschlaege.length;
  }
  return n;
}

/** Ein ZOE-Vorschlag mehr im Stapel (wie ein Lauf ihn ablegt) — Titel, Was (nachher), Wofür (Anlass). */
async function stapelSaen(k: KiSaatKontext): Promise<number> {
  const { lege } = await import('@/lib/zoe/stapel');
  await lege({ werkzeug: 'create_task', gruppe: 'aufgaben', titel: 'Aufgabe anlegen', nachher: 'Aufgabe „Kennzahlen für das Quartals-Review Nordwerk zusammenstellen“ anlegen', eingabe: { title: 'Kennzahlen für das Quartals-Review Nordwerk zusammenstellen', priority: 'medium', faellig: tagPlus(k.heute, 7) }, anlass: 'Das Quartals-Review steht in neun Tagen an; die Zahlen des letzten Monats fehlen noch in der Unterlage. (Beispiel)', person: k.lena, quelle: 'lauf', beispiel: true } as Parameters<typeof lege>[0]);
  return 1;
}

/** Ein kurzer ZOE-Gesprächsverlauf der Inhaberin (Bereich Business) — dieselbe Schreibstelle wie ein Lauf, ohne Modell. */
async function gespraechSaen(k: KiSaatKontext): Promise<number> {
  const [{ ablageAendernFuer }, { neuerFaden, anhaengen }] = await Promise.all([import('@/lib/agenten/faeden-server'), import('@/lib/agenten/faeden')]);
  const zeit = (min: number) => new Date(k.jetzt.getTime() - min * 60_000).toISOString();
  const id = kennung('fd', 'zoe-faden');
  const f0 = neuerFaden({ id, besitzer: k.lena, agent: { art: 'zoe' }, bereich: 'business', titel: 'Was steht heute an?', jetzt: zeit(45), kette: ['zoe'] });
  const h = anhaengen(f0, [
    { id: kennung('nr', 'zoe-1'), rolle: 'person', von: k.lena, text: 'Was steht heute an?', zeit: zeit(45) },
    { id: kennung('nr', 'zoe-2'), rolle: 'agent', von: 'zoe', text: 'Heute zählt vor allem eins: das Kennzahlen-Review für Nordwerk vorbereiten — es ist morgen fällig. Danach lohnt der Anruf bei Grünfeld Bau zum Angebot; ein Vorschlag dafür liegt in den Freigaben. (Beispiel)', zeit: zeit(44), ki: true, kosten: { cent: 0 }, beispiel: true },
    { id: kennung('nr', 'zoe-3'), rolle: 'person', von: k.lena, text: 'Und was kann warten?', zeit: zeit(43) },
    { id: kennung('nr', 'zoe-4'), rolle: 'agent', von: 'zoe', text: 'Die Beitragsidee für nächste Woche und die Gästeliste für den nächsten Abend — beides hat noch mehrere Tage Luft. (Beispiel)', zeit: zeit(42), ki: true, kosten: { cent: 0 }, beispiel: true },
  ], zeit(42));
  if (!h.ok) throw new Error(h.fehler);
  const r = await ablageAendernFuer<null>(k.lena, t => {
    if (t.kopf(id)) return { e: null };
    return t.hinzu({ ...h.faden, gelesenAm: zeit(42) }) ?? { e: null };
  });
  if (!r.ok) throw new Error(r.fehler);
  return 1;
}

/** Alle KI-Beispiele der Demo — oder gar nichts (Riegel). Liefert die Schritte für den Bericht der Saat. */
export async function kiBeispieleSaen(k: KiSaatKontext): Promise<{ name: string; anzahl: number }[]> {
  if (!(await kiBeispieleErlaubt())) return [{ name: 'KI-Beispiele (nur in der Demo-Instanz, MAKE_OS_DEMO=1)', anzahl: 0 }];
  const heads = await headsSaen(k);
  const chef = await chefSaen(k);
  const stapel = await stapelSaen(k);
  const gespraech = await gespraechSaen(k);
  return [
    { name: 'KI-Beispiele: Heads (Vorschläge)', anzahl: heads },
    { name: 'KI-Beispiele: Head of Finance (Vorschläge)', anzahl: chef },
    { name: 'KI-Beispiele: ZOE-Stapel', anzahl: stapel },
    { name: 'KI-Beispiele: ZOE-Gespräch', anzahl: gespraech },
  ];
}
