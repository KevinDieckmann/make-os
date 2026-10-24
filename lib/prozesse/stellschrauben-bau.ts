// ─── Prozesse — Stellschrauben bauen (rein; 22.10., Branch `prozesse-stellschrauben`) ──────────────────────────────────────────────────────────────────────
// Aus den gelesenen Beständen (`StellschraubenQuellen`, geladen in lib/prozesse/stellschrauben-server.ts) entsteht je System-Prozess die Liste seiner
// Stellschrauben (Modell: ./stellschrauben.ts). EINE Stelle, die weiß, welcher Ablauf welche Einstellung liest — die Belege stehen je Eintrag im Kommentar.
// Werte kommen NUR aus den Quellen (nie geraten); fehlt eine Quelle (nicht lesbar), fehlen ihre Stellschrauben — nie eine erfundene Vorgabe statt des Werts.
// Ein fehlender Bestand ist dagegen die Vorgabe (der Lader liefert sie). Keine Namen, keine Firmen, keine Beträge im Code — Werte sind Daten der Instanz.

import { WEG } from '@/lib/wege';
import { qualifizierungLink } from '@/lib/crm/adresse';
import { KREIS_TAKT, type Kreis } from '@/lib/make-one/crm';
import { LOESCHFRISTEN, fristText, type FristArt } from '@/lib/crm/loeschfristen';
import type { Wertelisten } from '@/lib/crm/typen';
import { CRM_STELLSCHRAUBEN, type CrmStellschraubeId } from '@/lib/crm/stellschrauben';
import type { Stellschraube, StellschraubeArt } from './stellschrauben';
import { AUCH_IN, WERTE, wert as wertVon, type Werte } from './stellschrauben-werte';

/**
 * Die Einstellungen eines Heads, wie sie hier gezeigt werden (nur Business-Heads, nie Abschnitte von Personen). Restpunkte (24.10.): mit `stand` (Stand der
 * Einstellung des Heads, 409) und den Vorgaben des Katalogs werden die Zeilen zu Feldern (Schalter, Auswahl, Betrag) — ohne `stand` bleiben sie zum Ansehen.
 */
export interface HeadKurz {
  aktiv?: boolean; stufe?: string; budgetCentMonat?: number; autonomie?: string; notAus?: boolean;
  stand?: string;
  /** Modellstufe des Katalogs (gilt ohne Eintrag). */
  stufeVorgabe?: string;
  /** Der Boden der Autonomie (mehr Freiheit gibt es nicht) und die wirksame Stufe (lib/agenten/leistung.ts `autonomieLage`). */
  autonomieBoden?: string; autonomieWirksam?: string;
}
/** Eine Buchungsseite, wie der Steckbrief sie zeigt (nur die Felder der Maske; `stand` = `geaendert` der gelesenen Fassung, 409). */
export interface BuchungsseiteKurz { id: string; titel: string; aktiv: boolean; dauerMin: number; vorlaufMin: number; maxJeTag: number; pufferMin: number; stand: string }
/** Grenzen und Vorgaben der Felder einer Buchungsseite — dieselben wie `seiteSauber` (lib/kalender/buchung.ts `SEITE_ZAHLEN`; der Lader gibt sie mit). */
export type BuchungZahlen = Record<'dauerMin' | 'vorlaufMin' | 'maxJeTag' | 'pufferMin', { min: number; max: number; vorgabe: number }>;

/** Was der Bau braucht. Ein Feld `undefined` = Quelle nicht lesbar → ihre Stellschrauben fehlen. */
export interface StellschraubenQuellen {
  wertelisten?: Wertelisten;
  scoring?: {
    marketing: number; sales: number; mussMarketing: number; mussSales: number; temperatur: { lau: number; warm: number; heiss: number };
    /** Restpunkte (24.10.): Stand der Scoring-Einstellungen (`scoringStand`, 409), die Werte des Standards und die Grenze der Schwellen — mit ihnen werden die Zeilen Felder. */
    stand?: string; vorgabe?: { marketing: number; sales: number; temperatur: { lau: number; warm: number; heiss: number } }; schwelleMax?: number;
  };
  /** Gespeicherte Abweichungen der Löschfristen (`crm-loeschfristen`). */
  loeschfristen?: Partial<Record<FristArt, number>>;
  mahnTage?: [number, number, number];
  fulfillment?: { pulsSchwelle: number; willkommenStunden: number; nachsorgeTage: number[] };
  /** Business-Heads des Haushalts (Kennung → Einstellung). */
  heads?: Partial<Record<string, HeadKurz>>;
  kanaele?: number;
  buchungsseiten?: { aktiv: number; gesamt: number; /** Restpunkte (24.10.): je Seite die Felder der Maske — fehlt es, steht nur die Zahl da. */ seiten?: BuchungsseiteKurz[]; zahlen?: BuchungZahlen };

  /** Die neuen Stellschrauben (Bestand `prozesse-stellschrauben--<h>`, nur Abweichungen) — `undefined` = nicht lesbar. */
  werte?: Werte;
}

/** Wo die neuen Stellschrauben einer Gruppe eine Maske in der Fachseite haben (sonst nur hier). */
const WERT_LINK: Readonly<Record<string, { href: string; text: string }>> = {
  'sp-head-takt': { href: WEG.agenten(), text: 'ZOE › Agenten' },
  'sp-monatsabschluss': { href: WEG.abschluss(), text: 'Finanzen › Business › Monatsabschluss' },
  'sp-buchung': { href: WEG.kalender(), text: 'Kalender › Buchungsseiten' },
  'sp-meilensteine': { href: WEG.kapazitaet(), text: 'Planung › Kapazität' },
  'sp-vertriebsplanung': { href: WEG.kapazitaet(), text: 'Planung › Kapazität' },
  'sp-treppe': { href: WEG.produkt(), text: 'Produkte & Mandate' },
};
/** Wo die Stellschrauben der Markttraktion im Steckbrief stehen (EIN Wert, mehrere Abläufe). */
const CRM_IN: Readonly<Record<CrmStellschraubeId, { prozesse: readonly string[]; gruppe: string }>> = {
  nachfassWerktage: { prozesse: ['sp-event-nachfassen', 'sp-netzwerken', 'sp-makeone'], gruppe: 'Nachfassen' },
  qualiWiedervorlageTage: { prozesse: ['sp-lead-sql'], gruppe: 'Qualifizierung' },
  verschobenGelb: { prozesse: ['sp-deal'], gruppe: 'Deal' },
};

/** Vorgaben der vorhandenen Bestände (nur gelesen — die Quelle der Wahrheit ist jeweils der Bestand bzw. sein Säuberer). */
export const VORGABE_MAHNTAGE: [number, number, number] = [7, 14, 21];
export const VORGABE_FULFILLMENT = { pulsSchwelle: 6, willkommenStunden: 24, nachsorgeTage: [14, 45, 90] } as const;

const KREISE: readonly Kreis[] = ['A', 'B', 'C', 'D'];
const KREIS_WORT: Record<Kreis, string> = { A: 'eng', B: 'wichtig', C: 'locker', D: 'Netzwerk' };

const STUFE_TEXT: Record<string, string> = { schnell: 'schnell', ausgewogen: 'ausgewogen', stark: 'stark' };
const AUTONOMIE_TEXT: Record<string, string> = { vorschlag: 'nur Vorschläge', intern: 'interne Kleinigkeiten selbst' };
const HEADS: readonly { id: string; name: string }[] = [
  { id: 'sales', name: 'Head of Sales' }, { id: 'marketing', name: 'Head of Marketing' }, { id: 'event', name: 'Head of Event' },
];

/** Grenze des Budgets je Head in Euro (lib/agenten/einstellung.ts `HEAD_BUDGET_MAX_CENT` / 100 — der Schreibweg prüft noch einmal). */
export const HEAD_BUDGET_MAX_EURO = 100_000;
const STUFEN_WAHL = ['schnell', 'ausgewogen', 'stark'] as const;

/**
 * Die Einstellungen eines Business-Heads. Mit `stand` (Restpunkte 24.10.) als Felder — geändert über denselben Schreibweg wie ZOE › Agenten (`einstellungAendern`:
 * Stand/409, Autonomie nur verschärfen); ohne `stand` nur zu sehen. Not-Aus, Auftrag, Wissen, Mitarbeiter bleiben in ZOE › Agenten (Link).
 */
function headZeilen(id: string, name: string, h: HeadKurz | undefined): Stellschraube[] {
  const link = { href: WEG.agenten({ h: id }), text: `${name} in ZOE › Agenten einstellen` };
  const wo = 'heads' as const;
  if (h?.stand) {
    const stand = h.stand;
    const boden = h.autonomieBoden === 'intern' ? 'intern' : 'vorschlag';
    const autonomie = AUTONOMIE_TEXT;
    const feld = (k: string, rest: Omit<Stellschraube, 'id' | 'gruppe' | 'wo' | 'link'>): Stellschraube => ({ id: `head-${id}-${k}`, gruppe: name, wo, link, ...rest });
    return [
      feld('aktiv', { name: 'An / aus', art: 'schalter', wert: h.aktiv !== false, vorgabe: true, weg: { art: 'head', head: id, feld: 'aktiv', stand },
        erklaerung: 'Ausgeschaltet schlägt der Head im Takt nichts vor; Läufe, die deshalb warteten, laufen beim Einschalten weiter.' }),
      ...(h.notAus ? [feld('notaus', { name: 'Not-Aus', art: 'info', wert: 'angehalten', erklaerung: 'Der Not-Aus hält alle Läufe des Heads an — aufheben in ZOE › Agenten.' })] : []),
      feld('stufe', { name: 'Modell', art: 'auswahl', optionen: STUFEN_WAHL.map(x => ({ wert: x, text: STUFE_TEXT[x] })), wert: h.stufe ?? h.stufeVorgabe ?? null,
        ...(h.stufeVorgabe ? { vorgabe: h.stufeVorgabe } : {}), weg: { art: 'head', head: id, feld: 'stufe', stand },
        erklaerung: 'Welche Modellstufe der Head nimmt — schnell ist günstig, stark für schwierige Fälle.' }),
      feld('budget', { name: 'Budget je Monat', art: 'zahl', einheit: '€', min: 0, max: HEAD_BUDGET_MAX_EURO, wert: typeof h.budgetCentMonat === 'number' ? h.budgetCentMonat / 100 : null,
        weg: { art: 'head', head: id, feld: 'budget', stand },
        erklaerung: 'Ab 80 % meldet sich die Glocke, bei 100 % pausiert der Head bis Monatsende. Leer = keine Grenze, nur messen.' }),
      feld('autonomie', { name: 'Autonomie', art: 'auswahl', optionen: (boden === 'intern' ? ['vorschlag', 'intern'] : ['vorschlag']).map(x => ({ wert: x, text: autonomie[x] })),
        wert: h.autonomieWirksam ?? h.autonomie ?? boden, vorgabe: boden, weg: { art: 'head', head: id, feld: 'autonomie', stand },
        erklaerung: 'Was der Head ohne Klick selbst erledigen darf — nur verschärfen; zurück auf die Vorgabe erst mit guter Annahmequote (prüft der Server).' }),
    ];
  }
  const z = (k: string, n: string, wert: string, erklaerung: string): Stellschraube => ({ id: `head-${id}-${k}`, gruppe: name, name: n, erklaerung, art: 'info', wert, wo, link });
  return [
    z('aktiv', 'An / aus', h?.notAus ? 'angehalten (Not-Aus)' : h?.aktiv === false ? 'aus' : 'an', 'Ausgeschaltet schlägt der Head im Takt nichts vor; Not-Aus hält alle seine Läufe an.'),
    z('stufe', 'Modell', h?.stufe ? STUFE_TEXT[h.stufe] ?? h.stufe : 'Vorgabe des Katalogs', 'Welche Modellstufe der Head nimmt (schnell, ausgewogen oder stark).'),
    z('budget', 'Budget je Monat', typeof h?.budgetCentMonat === 'number' ? `${(h.budgetCentMonat / 100).toLocaleString('de-DE')} €` : 'keine Grenze', 'Ab 80 % meldet sich die Glocke, bei 100 % pausiert der Head bis Monatsende.'),
    z('autonomie', 'Autonomie', h?.autonomie ? AUTONOMIE_TEXT[h.autonomie] ?? h.autonomie : 'Vorgabe', 'Was der Head ohne Klick selbst erledigen darf — nur verschärfen.'),
  ];
}

/** Je System-Prozess (Kennung) seine Stellschrauben. Prozesse ohne Eintrag haben keine. */
export function stellschraubenBauen(q: StellschraubenQuellen): Record<string, Stellschraube[]> {
  const raus: Record<string, Stellschraube[]> = {};
  const dazu = (p: string, l: readonly Stellschraube[]) => { if (l.length) raus[p] = [...(raus[p] ?? []), ...l]; };
  const w = q.wertelisten;
  const WL = 'wertelisten' as const;
  const wertelistenLink = { href: WEG.stammdaten('wertelisten'), text: 'Stammdaten › Wertelisten' };

  // ── Vertriebsplanung: Ziele je Monat (Messlatte der Kennzahlen, lib/crm/wertelisten.ts ZIEL_FELDER) · Kanäle (lib/crm/planung-server.ts) ──
  if (w) {
    const ziel = (id: 'umsatzNeuMonat' | 'sqlMonat' | 'gespraecheWoche', name: string, einheit: string, erklaerung: string): Stellschraube => ({
      id: `ziel-${id}`, gruppe: 'Ziele', name, erklaerung, art: 'zahl', wert: typeof w.ziele?.[id] === 'number' ? w.ziele[id]! : null, einheit, min: 0, max: 100_000_000,
      wo: WL, weg: { art: 'wertelisten', feld: 'ziele', schluessel: id }, link: wertelistenLink,
    });
    dazu('sp-vertriebsplanung', [
      ziel('umsatzNeuMonat', 'Umsatz neu je Monat', '€', 'Messlatte für die Kennzahl „Umsatz neu“ — leer = kein Ziel.'),
      ziel('sqlMonat', 'Neue SQL je Monat', 'SQL', 'Messlatte für „Neue SQL“ — leer = kein Ziel.'),
      ziel('gespraecheWoche', 'Echte Gespräche je Woche', 'Gespräche', 'Messlatte für die Gespräche — leer = kein Ziel.'),
    ]);
  }
  if (typeof q.kanaele === 'number') {
    dazu('sp-vertriebsplanung', [{ id: 'kanaele', gruppe: 'Kanäle und Quoten', name: 'Lead-Kanäle', art: 'info', wert: `${q.kanaele} eingerichtet`,
      erklaerung: 'Woher die Leads kommen sollen, mit Wochenziel und Quoten je Kanal — gepflegt in der Planung der Markttraktion.',
      wo: 'vertriebsplanung', link: { href: WEG.vertriebsplanung('kanaele'), text: 'Markttraktion › Planung › Kanäle' } }]);
  }

  // ── Follow-up: Kadenz je Kreis (lib/crm/followup.ts `faellige`, Standard KREIS_TAKT) ──
  if (w) {
    dazu('sp-followup', KREISE.map((k): Stellschraube => {
      const v = w.kadenzTage?.[k];
      return {
        id: `kadenz-${k}`, gruppe: 'Kadenz je Kreis', name: `Kreis ${k} (${KREIS_WORT[k]})`, art: 'zahl', einheit: 'Tage', min: 7, max: 730,
        wert: typeof v === 'number' && Number.isInteger(v) && v >= 7 && v <= 730 ? v : KREIS_TAKT[k], vorgabe: KREIS_TAKT[k],
        erklaerung: 'So lange ohne Kontakt, dann wird die Beziehung fällig (Follow-up, Power Hour).', wo: WL,
        weg: { art: 'wertelisten', feld: 'kadenzTage', schluessel: k }, link: { href: WEG.followup('kadenz'), text: 'Follow-up › Kadenz' },
      };
    }));
  }

  // ── Deal: Verlustgründe (lib/crm/pipeline.ts VERLUSTGRUENDE + eigene) ──
  if (w) {
    const eigene = (w.verlustgruende ?? []).length;
    dazu('sp-deal', [{ id: 'verlustgruende', gruppe: 'Deal', name: 'Verlustgründe', art: 'info', wert: eigene ? `feste und ${eigene} eigene` : 'nur die festen',
      erklaerung: 'Zur Wahl, wenn ein Deal verloren geht — eigene Gründe ergänzt du in den Wertelisten.', wo: WL, link: wertelistenLink }]);
  }

  // ── Lead → SQL: Scoring (lib/crm/scoring.ts, Bestand crm-scoring) — die Maske ist der Reiter Scoring (zu reich für eine Zeile) ──
  if (q.scoring?.stand && q.scoring.vorgabe) {
    // Restpunkte (24.10.): Schwellen und Temperatur direkt — geschrieben über `scoringSchreiben` (Stand/409, `scoringPruefen` → 400 mit Satz);
    // Fragen, Stufen und Muss-Kriterien bleiben im Reiter Scoring (Link).
    const s = q.scoring, v = q.scoring.vorgabe, stand = q.scoring.stand;
    const link = { href: qualifizierungLink(undefined, 'scoring'), text: 'Qualifizierung › Scoring' };
    const wo = 'scoring' as const;
    const max = s.schwelleMax ?? 1000;
    const muss = (n: number) => (n ? ` Dazu ${n === 1 ? 'ein Muss-Kriterium' : `${n} Muss-Kriterien`} (Reiter Scoring).` : '');
    const t = (k: 'lau' | 'warm' | 'heiss', n: string): Stellschraube => ({ id: `scoring-${k}`, gruppe: 'Scoring', name: n, art: 'zahl', einheit: 'Punkte', min: 1, max: 100,
      wert: s.temperatur[k], vorgabe: v.temperatur[k], wo, link, weg: { art: 'scoring', feld: k, stand },
      erklaerung: 'Ab diesen Punkten ist ein Lead lau, warm oder heiß (lau < warm < heiß, höchstens 100) — kalte zeigt die Runde nur auf Wunsch.' });
    dazu('sp-lead-sql', [
      { id: 'scoring-mql', gruppe: 'Scoring', name: 'MQL ab (Marketing-Punkte)', art: 'zahl', einheit: 'Punkte', min: 0, max, wert: s.marketing, vorgabe: v.marketing, wo, link,
        weg: { art: 'scoring', feld: 'marketing', stand }, erklaerung: `Ab dieser Marketing-Schwelle wird ein Lead aus dem Marketing zum MQL.${muss(s.mussMarketing)}` },
      { id: 'scoring-sql', gruppe: 'Scoring', name: 'SQL ab (Sales-Punkte)', art: 'zahl', einheit: 'Punkte', min: 0, max, wert: s.sales, vorgabe: v.sales, wo, link,
        weg: { art: 'scoring', feld: 'sales', stand }, erklaerung: `Ab dieser Sales-Schwelle und mit allen Muss-Kriterien ist ein Lead SQL-bereit.${muss(s.mussSales)}` },
      t('lau', 'Lau ab'), t('warm', 'Warm ab'), t('heiss', 'Heiß ab'),
    ]);
  } else if (q.scoring) {
    const s = q.scoring;
    const link = { href: qualifizierungLink(undefined, 'scoring'), text: 'Qualifizierung › Scoring' };
    const wo = 'scoring' as const;
    dazu('sp-lead-sql', [
      { id: 'scoring-mql', gruppe: 'Scoring', name: 'MQL ab (Marketing-Punkte)', art: 'info', wert: `${s.marketing} Punkte${s.mussMarketing ? ` · ${s.mussMarketing} Muss` : ''}`, erklaerung: 'Ab dieser Marketing-Schwelle (und den Muss-Kriterien) wird ein Lead aus dem Marketing zum MQL.', wo, link },
      { id: 'scoring-sql', gruppe: 'Scoring', name: 'SQL ab (Sales-Punkte)', art: 'info', wert: `${s.sales} Punkte${s.mussSales ? ` · ${s.mussSales} Muss` : ''}`, erklaerung: 'Ab dieser Sales-Schwelle und mit allen Muss-Kriterien ist ein Lead SQL-bereit.', wo, link },
      { id: 'scoring-temperatur', gruppe: 'Scoring', name: 'Temperatur', art: 'info', wert: `lau ab ${s.temperatur.lau} · warm ab ${s.temperatur.warm} · heiß ab ${s.temperatur.heiss}`, erklaerung: 'Ab welchen Punkten ein Lead lau, warm oder heiß ist — kalte zeigt die Runde nur auf Wunsch.', wo, link },
    ]);
  }

  // ── Terminbuchung: Buchungsseiten (lib/kalender/buchung.ts — Dauer, Fenster, Vorlauf, max./Tag, Puffer je Seite) ──
  if (q.buchungsseiten) {
    const link = { href: WEG.kalender(), text: 'Kalender › Buchungsseiten' };
    const z = q.buchungsseiten.zahlen;
    const masken = !!z && !!q.buchungsseiten.seiten;
    dazu('sp-buchung', [{ id: 'buchungsseiten', gruppe: 'Buchungsseiten', name: 'Seiten', art: 'info', wert: q.buchungsseiten.gesamt ? `${q.buchungsseiten.aktiv} von ${q.buchungsseiten.gesamt} aktiv` : 'noch keine',
      erklaerung: masken
        ? 'Je Seite stehen An/aus, Dauer, Vorlauf, höchstens je Tag und Puffer hier — buchbare Fenster, Fragen, Ort und Zielkalender in der Verwaltung der Buchungsseiten.'
        : 'Je Seite: Dauer, buchbare Fenster, Vorlauf, höchstens je Tag, Puffer, Zielkalender — eingestellt in der Verwaltung der Buchungsseiten.',
      wo: 'buchung', link }]);
    // Restpunkte (24.10.): je Seite die Felder der Maske — geschrieben über `seiteSpeichern` (dieselbe Stelle wie die Verwaltung; Stand = `geaendert`, 409).
    if (z) for (const seite of q.buchungsseiten.seiten ?? []) {
      const gruppe = `Seite „${seite.titel}“`;
      const zahl = (feld: keyof BuchungZahlen, name: string, einheit: string, erklaerung: string): Stellschraube => ({
        id: `buchung-${seite.id}-${feld}`, gruppe, name, art: 'zahl', einheit, min: z[feld].min, max: z[feld].max, wert: seite[feld], vorgabe: z[feld].vorgabe,
        erklaerung, wo: 'buchung', link, weg: { art: 'buchung', seite: seite.id, feld, stand: seite.stand },
      });
      dazu('sp-buchung', [
        { id: `buchung-${seite.id}-aktiv`, gruppe, name: 'An / aus', art: 'schalter', wert: seite.aktiv, vorgabe: true, wo: 'buchung', link,
          weg: { art: 'buchung', seite: seite.id, feld: 'aktiv', stand: seite.stand }, erklaerung: 'Ausgeschaltet zeigt die Seite keine freien Zeiten mehr; der Link bleibt gleich.' },
        zahl('dauerMin', 'Dauer', 'Minuten', 'So lange dauert ein gebuchter Termin.'),
        zahl('vorlaufMin', 'Vorlauf', 'Minuten', 'So viel Zeit muss mindestens vor dem Termin liegen (1.440 Minuten = 24 Stunden).'),
        zahl('maxJeTag', 'Höchstens je Tag', 'Termine', 'Mehr Buchungen dieser Seite nimmt ein Tag nicht an.'),
        zahl('pufferMin', 'Puffer', 'Minuten', 'So viel Luft bleibt vor und nach jedem Termin frei.'),
      ]);
    }
  }

  // ── Übergabe & Wirkung: Einstellungen des Fulfillments (lib/fulfillment/lesen.ts EINSTELLUNGEN_VORGABE) ──
  if (q.fulfillment) {
    const f = q.fulfillment;
    const wo = 'fulfillment' as const;
    const puls: Stellschraube = { id: 'puls-schwelle', gruppe: 'Puls', name: 'Puls braucht Aufmerksamkeit bis', art: 'zahl', wert: f.pulsSchwelle, vorgabe: VORGABE_FULFILLMENT.pulsSchwelle, einheit: 'von 10', min: 0, max: 10,
      erklaerung: 'Bis zu diesem Wert gilt ein Kunden-Puls als „braucht Aufmerksamkeit“ — dann meldet sich die Glocke.', wo, weg: { art: 'puls-schwelle' } };
    dazu('sp-uebergabe', [
      { id: 'willkommen-stunden', gruppe: 'Onboarding', name: 'Willkommen binnen', art: 'zahl', wert: f.willkommenStunden, vorgabe: VORGABE_FULFILLMENT.willkommenStunden, einheit: 'Stunden', min: 1, max: 168,
        erklaerung: 'So schnell nach dem Mandat soll die Willkommens-Nachricht raus — danach meldet sich der Fall als überfällig.', wo, weg: { art: 'fulfillment', feld: 'willkommenStunden' } },
      puls,
    ]);
    dazu('sp-wirkung', [
      { id: 'nachsorge-tage', gruppe: 'Nachsorge', name: 'Nachsorge nach Ende', art: 'tage-liste', wert: [...f.nachsorgeTage], vorgabe: [...VORGABE_FULFILLMENT.nachsorgeTage], einheit: 'Tage', min: 1, max: 365,
        erklaerung: 'An diesen Tagen nach dem Ende eines Mandats steht die Nachsorge an (ein bis sechs Zeitpunkte).', wo, weg: { art: 'fulfillment', feld: 'nachsorgeTage' } },
      puls,
    ]);
  }

  // ── Rechnung: Mahnstufen (lib/finanzen/rechnung/regeln.ts MAHN_VORGABE_TAGE, Bestand rechnungswesen) ──
  if (q.mahnTage) {
    const t = q.mahnTage;
    dazu('sp-rechnung', ([0, 1, 2] as const).map((i): Stellschraube => ({
      id: `mahnstufe-${i + 1}`, gruppe: 'Mahnstufen', name: i === 0 ? 'Zahlungserinnerung ab' : `${i + 1}. Mahnung ab`, art: 'zahl', wert: t[i], vorgabe: VORGABE_MAHNTAGE[i], einheit: 'Tage überfällig',
      min: i === 0 ? 1 : t[i - 1] + 1, max: i === 2 ? 365 : t[i + 1] - 1,
      erklaerung: 'Ab so vielen Tagen nach Fälligkeit schlägt der Morgenlauf diese Stufe vor (eine Aufgabe; verschickt wird per Klick). Die Stufen steigen.',
      wo: 'rechnungswesen', weg: { art: 'mahntage', stufe: i, tage: [t[0], t[1], t[2]] }, link: { href: WEG.rechnungen(), text: 'Finanzen › Rechnungen & Zahlungen' },
    })));
  }

  // ── Betroffenenrechte: Löschfristen (lib/crm/loeschfristen.ts LOESCHFRISTEN) und die Monatsfrist des Art. 12 ──
  if (q.loeschfristen) {
    const g = q.loeschfristen;
    const wo = 'loeschfristen' as const;
    const link = { href: WEG.stammdaten('datenschutz'), text: 'Stammdaten › Datenschutz' };
    dazu('sp-betroffenenrechte', [
      { id: 'art12-frist', gruppe: 'Fristen', name: 'Antwort auf einen Antrag', art: 'fest', wert: '1 Monat', fest: 'fest (Gesetz) — Art. 12 Abs. 3 DSGVO', erklaerung: 'Auskunft, Löschung, Einschränkung: binnen eines Monats nach Eingang.', wo: 'gesetz' },
      ...LOESCHFRISTEN.map((f): Stellschraube => {
        const v = g[f.id];
        const wert = f.wirkung !== 'fest' && typeof v === 'number' && Number.isInteger(v) && v >= f.min && v <= f.max ? v : f.standard;
        const einheit = f.einheit === 'monate' ? 'Monate' : 'Tage';
        return f.wirkung === 'fest'
          ? { id: `frist-${f.id}`, gruppe: 'Löschfristen', name: f.titel, art: 'fest', wert: fristText(f.id, f.standard), fest: `fest (Gesetz) — ${f.norm}`, erklaerung: f.hinweis, wo }
          : { id: `frist-${f.id}`, gruppe: 'Löschfristen', name: f.titel, art: 'zahl', wert, vorgabe: f.standard, einheit, min: f.min, max: f.max, erklaerung: f.hinweis, wo, weg: { art: 'loeschfrist', id: f.id }, link };
      }),
    ]);
  }

  // ── Heads: Einstellungen je Business-Head (lib/agenten/typen.ts HeadEinstellung) — nur zu sehen, die Maske ist ZOE › Agenten ──
  if (q.heads) {
    dazu('sp-head-takt', HEADS.flatMap(h => headZeilen(h.id, h.name, q.heads![h.id])));
    dazu('sp-monatsabschluss', headZeilen('finanzen', 'Head of Finance', q.heads.finanzen));
  }

  // ── Teil B (22.10.): Werte, die bis heute fest im Code standen — jetzt im Bestand `prozesse-stellschrauben--<h>` (Lesefunktionen: ./stellschrauben-werte.ts) ──
  if (q.werte) {
    const werte = q.werte;
    for (const d of WERTE) {
      const s: Stellschraube = {
        id: d.id, gruppe: d.gruppe, name: d.name, art: d.art as StellschraubeArt, wert: wertVon(werte, d.id), vorgabe: d.vorgabe,
        ...(d.einheit ? { einheit: d.einheit } : {}), ...(d.min !== undefined ? { min: d.min, max: d.max } : {}),
        erklaerung: d.erklaerung, wo: 'prozesse', weg: { art: 'prozesse', id: d.id },
      };
      for (const p of [d.prozess, ...(AUCH_IN[d.id] ?? [])]) dazu(p, [{ ...s, ...(WERT_LINK[p] ? { link: WERT_LINK[p] } : {}) }]);
    }
  }
  // Stellschrauben der Markttraktion in den Wertelisten (lib/crm/stellschrauben.ts) — Nachfassfrist, Wiedervorlage, Deal-Ampel.
  if (w) {
    for (const d of CRM_STELLSCHRAUBEN) {
      const v = w.stellschrauben?.[d.id];
      const s: Stellschraube = {
        id: `crm-${d.id}`, gruppe: CRM_IN[d.id].gruppe, name: d.name, art: 'zahl', wert: typeof v === 'number' && Number.isInteger(v) && v >= d.min && v <= d.max ? v : d.vorgabe, vorgabe: d.vorgabe,
        einheit: d.einheit, min: d.min, max: d.max, erklaerung: d.erklaerung, wo: WL, weg: { art: 'wertelisten', feld: 'stellschrauben', schluessel: d.id },
      };
      for (const p of CRM_IN[d.id].prozesse) dazu(p, [s]);
    }
  }

  // ── Vorlagen der Kampagnen und eigenen Abende: nur ansehen (überführt werden sie in einem eigenen Paket) ──
  dazu('sp-kampagnen', [{ id: 'playbooks', gruppe: 'Vorlagen', name: 'Playbooks', art: 'info', wert: 'im System', erklaerung: 'Die Playbooks der Kampagnen (Segment, Kanal, Texte, Nachfassen) — ansehen und daraus planen.', wo: 'system', link: { href: WEG.marketing('kampagnen'), text: 'Vorlagen ansehen' } }]);
  dazu('sp-makeone', [{ id: 'event-vorlagen', gruppe: 'Vorlagen', name: 'Event-Vorlagen', art: 'info', wert: 'im System', erklaerung: 'Vorlagen eigener Abende (Ablauf, Checkliste, Budget) — ansehen und daraus planen.', wo: 'system', link: { href: WEG.event(), text: 'Vorlagen ansehen' } }]);

  return raus;
}
