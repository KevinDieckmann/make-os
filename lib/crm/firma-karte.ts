// ─── Power Hour: Betriebe ohne Person (rein, getestet — 02.11., Prüfung D „Steuerung, Erinnerung, Rechte“) ──────────────────────────────
// Der Kampagnen-Motor legt für Betriebe OHNE Ansprechpartner (Welle A: Firmen aus OpenStreetMap) echte Follow-ups an — Anruf, Besuch, LinkedIn —
// mit `bezug: { art: 'firma' }` und ohne `kontaktId`. Die Power Hour kannte nur Follow-ups mit Person (lib/crm/heute.ts `nimm` bricht ohne Kontakt ab):
// die Anrufe standen nur in Follow-up › Fällig, nicht dort, wo telefoniert wird. Hier:
//   firmenKarten        die fälligen Follow-ups an Betrieben als Karten (Firma, Telefon der Firma, Leitfaden, Kampagne) — je Person wie die übrigen
//                       Karten (Zuständigkeit des Follow-ups), Betriebe mit Werbesperre, im Papierkorb oder Archiv nie
//   firmaErgebnisImCrm  was ein Ergebnis-Knopf an einer solchen Karte bewirkt — DIESELBE Regel wie an einer Person (lib/crm/aktivitaet-folgen.ts):
//                       nicht erreicht · Mailbox · Rückruf → das Follow-up wandert (EINE Erinnerung), sonst erledigt mit Ergebnis (der Motor schaltet
//                       daran weiter bzw. beendet); das Ergebnis steht am Betrieb in der Kampagne (`firmenErgebnisse`); „Sperre“ = Werbewiderspruch
//                       am Betrieb (der CRM-Schreibweg trägt ihn auf die Sperrliste, lib/crm/speicher.ts).
// Nachtrag 02.11. (Prüfung R2-2 „Prozesse“, Fund 1): „Gespräch“ und „Termin“ führten an einem Betrieb ins Leere — dieselbe Regel wie an einer
// Person (lib/crm/heute.ts `folgeAus`, lib/crm/event-bruecke.ts `leadNachGespraech`): der Lead des Betriebs rückt auf „Im Gespräch“ (Termin:
// „Qualifizierung“ — ein vereinbarter Termin ist Interesse, Kampagnen-Ergebnis „Chance“); nie über Kein Fit/Ruht (bewusst gesetzt), SQL oder
// Kunde hinweg. Dazu EIN Folge-Follow-up am Betrieb (Gespräch: nachfassen in 5 Werktagen; Termin: „Termin vorbereiten“) — die Route vergibt
// Kennung und Tag; das erledigte Follow-up meldet `followup-erledigt`, das Ergebnis am Betrieb `kampagnen-ergebnis` (lib/ereignisse).
// Nichts wird versendet.

import type { CrmBestand, FollowUp, KampagnenErgebnis, Kampagne, Lead, LeadStatus } from './typen';
import type { Ergebnis, Kontakt } from '@/lib/make-one/crm';
import { sequenzFollowupId, postIdAusAntwort } from './kampagnen-post';
import { wer, verantwortlich, BEIDE } from './team';
import { leadNachGespraech } from './event-bruecke';
import { abgeleitet, leereKriterien } from './leads';
import { OFFENE_STUFEN } from './pipeline';
import { dealZuFirma } from './firmen-bezug';

export interface FirmenKarte {
  firmaId: string; name: string; telefon?: string; ort?: string;
  followupId: string; art: FollowUp['art']; text: string; faellig: string;
  gruende: string[]; punkte: number;
  /** Wem die Karte gehört — die Zuständigkeit des Follow-ups (sonst Sales-Verantwortung). */
  gehoert: string;
  kampagneId?: string; kampagneName?: string;
  /** Notiz des Follow-ups (Leitfaden eines Sequenz-Schritts, Kanal-Ampel). */
  leitfaden?: string;
  /** „Antwort bearbeiten“ einer Kampagnen-Mail (`fu-kr-…`) — die Karte bietet „Als Lead übernehmen“ (02.11., Zusatz C). */
  antwort?: true;
}

/** Ergebnisse, nach denen das Follow-up wiederkommt — wie an einer Person (`FOLLOWUP_NOCHMAL`). */
export const FIRMA_NOCHMAL: readonly Ergebnis[] = ['nicht_erreicht', 'mailbox', 'rueckruf'];

/** Ist das ein offenes Follow-up an einem Betrieb ohne Person? */
export const firmaFollowup = (f: Pick<FollowUp, 'status' | 'kontaktId' | 'bezug'>): boolean => f.status === 'offen' && !f.kontaktId && f.bezug.art === 'firma';

/** Die Kampagne hinter einem Sequenz-Follow-up an einem Betrieb (über die Kennung `fu-ks-…`) — oder undefined. */
export function kampagneZuFirmaFollowup(kampagnen: readonly Kampagne[], f: Pick<FollowUp, 'id' | 'bezug'>): Kampagne | undefined {
  if (f.bezug.art !== 'firma' || !f.id.startsWith('fu-ks-')) return undefined;
  const ziel = { art: 'firma' as const, id: f.bezug.id };
  return kampagnen.find(k => (k.firmaIds ?? []).includes(ziel.id) && (k.sequenz ?? []).some(s => sequenzFollowupId(k.id, ziel, s.id) === f.id));
}

const tage = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);

/**
 * Fällige Follow-ups an Betrieben ohne Person als Karten. `person` null = alle (Systemlauf); sonst nur, was dieser Person gehört (oder beiden).
 * Zähler `beiAnderen`/`sperre` wie die übrigen Karten (die Power Hour nennt sie).
 */
export function firmenKarten(crm: Pick<CrmBestand, 'followups' | 'firmen' | 'kampagnen'>, heute: string, person: string | null, max = 12): { karten: FirmenKarte[]; beiAnderen: number; sperre: number } {
  const raus: FirmenKarte[] = [];
  let beiAnderen = 0, sperre = 0;
  const firmen = new Map(crm.firmen.map(f => [f.id, f]));
  for (const f of (crm.followups ?? []).filter(x => firmaFollowup(x) && x.faellig <= heute)) {
    const firma = firmen.get(f.bezug.id);
    if (!firma || firma.geloeschtAm || firma.archiviertAm) continue;
    if (firma.werbesperre) { sperre++; continue; }
    const gehoert = wer(f.zustaendig) ?? verantwortlich('sales');
    if (person !== null && gehoert !== person && gehoert !== BEIDE) { beiAnderen++; continue; }
    const k = kampagneZuFirmaFollowup(crm.kampagnen ?? [], f);
    const d = tage(f.faellig, heute);
    raus.push({
      firmaId: firma.id, name: firma.name, ...(firma.telefon || firma.mobil ? { telefon: firma.telefon || firma.mobil } : {}),
      ...(firma.adresse?.ort || firma.stadt ? { ort: firma.adresse?.ort || firma.stadt } : {}),
      followupId: f.id, art: f.art, text: f.text, faellig: f.faellig,
      gruende: [d > 0 ? `Follow-up „${f.text}“ seit ${d} ${d === 1 ? 'Tag' : 'Tagen'} überfällig` : `Follow-up heute: ${f.text}`, 'Betrieb ohne Ansprechpartner — über die Firma'],
      punkte: 45 + Math.min(20, d), gehoert,
      ...(k ? { kampagneId: k.id, kampagneName: k.name } : {}),
      ...(f.notiz ? { leitfaden: f.notiz } : {}),
      ...(postIdAusAntwort(f.id) ? { antwort: true as const } : {}),
    });
  }
  raus.sort((a, b) => b.punkte - a.punkte || a.faellig.localeCompare(b.faellig) || a.followupId.localeCompare(b.followupId));
  return { karten: raus.slice(0, max), beiAnderen, sperre };
}

/** Ergebnis in die Kampagnen-Sprache — dieselbe Regel wie an einer Person (lib/crm/aktivitaet-folgen.ts). */
export const kampagnenErgebnisVon = (erg: Ergebnis): KampagnenErgebnis => (erg === 'gespraech' || erg === 'termin' ? 'gespraech' : erg === 'kein_bedarf' || erg === 'sperre' ? 'kein_interesse' : 'angesprochen');

/** Ergebnis eines Betriebs in der Kampagne: wie an einer Person, ein vereinbarter Termin ist dazu „Chance“ (der Lead geht in die Qualifizierung). */
export const firmaKampagnenErgebnis = (erg: Ergebnis): KampagnenErgebnis => (erg === 'termin' ? 'chance' : kampagnenErgebnisVon(erg));

/** Ergebnisse, nach denen am Betrieb ein Folge-Follow-up entsteht (Gespräch → nachfassen, Termin → vorbereiten). */
export const FIRMA_FOLGE: readonly Ergebnis[] = ['gespraech', 'termin'];
export const firmaFolgeText = (erg: Ergebnis): string => (erg === 'termin' ? 'Termin vorbereiten' : 'Nach dem Gespräch nachfassen');

const RANG: Record<LeadStatus, number> = { neu: 0, kontaktiert: 1, im_gespraech: 2, qualifizierung: 3, sql: 4, kunde: 5, kein_fit: -1, ruht: -1 };

/**
 * Lead des Betriebs nach „Gespräch“ bzw. „Termin“ (rein). Gespräch → mindestens „Im Gespräch“ (die EINE Regel `leadNachGespraech`), Termin →
 * mindestens „Qualifizierung“. Bewusst gesetztes Kein Fit/Ruht bleibt, SQL/Kunde bleiben; nie abwärts. null = nichts zu ändern.
 */
export function firmaLeadNachErgebnis(crm: Pick<CrmBestand, 'chancen'>, firma: { id: string; name: string; lead?: Lead }, personen: Kontakt[], ergebnis: Ergebnis, jetzt: string, von: string): Lead | null {
  if (!FIRMA_FOLGE.includes(ergebnis)) return null;
  const offen = crm.chancen.some(c => OFFENE_STUFEN.includes(c.stufe) && dealZuFirma(c, firma));
  const g = leadNachGespraech(firma.lead, personen, offen, jetzt, von);
  if (ergebnis === 'gespraech') return g.geaendert && g.lead ? g.lead : null;
  const alt = firma.lead;
  if (alt?.status && (alt.status === 'kein_fit' || alt.status === 'ruht')) return null;
  const jetztStatus: LeadStatus = alt?.status ?? abgeleitet(personen, offen);
  if (RANG[jetztStatus] >= RANG.qualifizierung) return null;
  return { ...(alt ?? { kriterien: leereKriterien() }), kriterien: alt?.kriterien ?? leereKriterien(), status: 'qualifizierung', geaendert: jetzt, geaendertVon: von };
}

export type FirmaErgebnisFehler = { status: 404 | 409; fehler: string };

/**
 * Ein Ergebnis-Knopf an einer Betriebs-Karte (rein, in der Sperre des CRM angewandt). `nochmalAm` = der Tag aus der Regel (`folgeAus`) für
 * nicht erreicht · Mailbox · Rückruf. `notiz` hängt am Follow-up (nie gekürzt — der Aufrufer prüft die Grenze).
 */
export function firmaErgebnisImCrm(crm: CrmBestand, e: { followupId: string; ergebnis: Ergebnis; heute: string; jetzt: string; von: string; nochmalAm?: string; notiz?: string; personen?: Kontakt[]; folge?: { id: string; faellig: string } }): { crm: CrmBestand; wie: 'erledigt' | 'verschoben'; kampagneId?: string; erledigt?: FollowUp; folge?: FollowUp; lead?: { von: LeadStatus | null; nach: LeadStatus } } | FirmaErgebnisFehler {
  const fu = (crm.followups ?? []).find(f => f.id === e.followupId);
  if (!fu) return { status: 404, fehler: 'Follow-up nicht gefunden.' };
  if (!firmaFollowup(fu)) return { status: 409, fehler: 'Dieses Follow-up ist nicht (mehr) offen bzw. hängt an einer Person — dort festhalten.' };
  const firma = crm.firmen.find(f => f.id === fu.bezug.id && !f.geloeschtAm);
  if (!firma) return { status: 404, fehler: 'Betrieb nicht gefunden.' };
  const nochmal = FIRMA_NOCHMAL.includes(e.ergebnis) && e.nochmalAm ? e.nochmalAm : undefined;
  const notiz = e.notiz?.trim() ? `${fu.notiz ? `${fu.notiz}\n` : ''}${e.notiz.trim()}` : fu.notiz;
  const fNeu: FollowUp = nochmal
    ? { ...fu, faellig: nochmal > fu.faellig ? nochmal : fu.faellig, ...(notiz ? { notiz } : {}), geaendert: e.jetzt, geaendertVon: e.von }
    : { ...fu, status: 'erledigt', erledigtAm: e.jetzt, ergebnis: e.ergebnis, ...(notiz ? { notiz } : {}), geaendert: e.jetzt, geaendertVon: e.von };
  let neu: CrmBestand = { ...crm, followups: (crm.followups ?? []).map(f => (f.id === fu.id ? fNeu : f)) };
  // Ergebnis am Betrieb in der Kampagne (`firmenErgebnisse`) — dasselbe Ergebnis am selben Tag nur einmal.
  const k = kampagneZuFirmaFollowup(neu.kampagnen ?? [], fu);
  if (k) {
    const erg = firmaKampagnenErgebnis(e.ergebnis);
    if (!(k.firmenErgebnisse ?? []).some(x => x.firmaId === firma.id && x.ergebnis === erg && x.am === e.heute)) {
      neu = { ...neu, kampagnen: neu.kampagnen.map(x => (x.id === k.id ? { ...x, firmenErgebnisse: [...(x.firmenErgebnisse ?? []), { firmaId: firma.id, ergebnis: erg, am: e.heute, ...(wer(e.von) && wer(e.von) !== BEIDE ? { von: e.von } : {}) }], geaendert: e.jetzt, geaendertVon: e.von } : x)) };
    }
  }
  // Werbewiderspruch am Betrieb (Art. 21): an der Firma — der CRM-Schreibweg trägt ihn auf die Sperrliste; der Motor stoppt die Sequenz am Ergebnis.
  if (e.ergebnis === 'sperre' && !firma.werbesperre) {
    neu = { ...neu, firmen: neu.firmen.map(f => (f.id === firma.id ? { ...f, werbesperre: { seit: e.heute, grund: 'Werbewiderspruch im Gespräch (Art. 21)' }, geaendert: e.jetzt, geaendertVon: e.von } : f)) };
  }
  // Gespräch/Termin (R2-2 Fund 1): Lead des Betriebs + EIN Folge-Follow-up — wie an einer Person.
  let lead: { von: LeadStatus | null; nach: LeadStatus } | undefined;
  let folge: FollowUp | undefined;
  if (!nochmal && FIRMA_FOLGE.includes(e.ergebnis)) {
    const l = firmaLeadNachErgebnis(neu, firma, e.personen ?? [], e.ergebnis, e.jetzt, e.von);
    if (l) {
      lead = { von: firma.lead?.status ?? null, nach: l.status };
      neu = { ...neu, firmen: neu.firmen.map(f => (f.id === firma.id ? { ...f, lead: l, geaendert: e.jetzt, geaendertVon: e.von } : f)) };
    }
    if (e.folge && !(neu.followups ?? []).some(f => f.id === e.folge!.id)) {
      folge = {
        id: e.folge.id, bezug: { art: 'firma', id: firma.id }, art: e.ergebnis === 'termin' ? 'termin' : 'anruf', text: firmaFolgeText(e.ergebnis), faellig: e.folge.faellig,
        zustaendig: fu.zustaendig, status: 'offen', quelle: k ? 'kampagne' : 'hand', angelegt: e.jetzt, geaendert: e.jetzt, geaendertVon: e.von,
      };
      neu = { ...neu, followups: [...(neu.followups ?? []), folge] };
    }
  }
  return { crm: neu, wie: nochmal ? 'verschoben' : 'erledigt', ...(k ? { kampagneId: k.id } : {}), ...(nochmal ? {} : { erledigt: fNeu }), ...(folge ? { folge } : {}), ...(lead ? { lead } : {}) };
}
