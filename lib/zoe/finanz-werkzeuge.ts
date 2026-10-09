// ─── ZOE-Finanzwerkzeuge über die offiziellen Schreibwege (09.10., Funde der Abdeckungs-Analyse #1/#3) ────────────────
// `setze_kontostand`, `erfasse_rechnung`, `erfasse_zahlung`, `erfasse_planposten`, `setze_ziele` schrieben bis 09.10. mit
// `updateJson` direkt in `finanzplan`/`liquiplan`/`finance`: ohne Fassung/409, ohne Änderungsprotokoll, ohne `privatFinanzZugang`
// (ein Konto „nur Business“ schrieb über ZOE in Bestände, die die Route ihm verweigert), „bezahlt“ ohne Buchung `bu-re-<id>` und ohne
// `bezahltAm`, Beträge auf ganze Euro — und ohne Angabe landete alles still bei der Selbstständigkeit (Privat-Einheit).
//
// Jetzt — wie ein Klick in der Oberfläche:
//   • gelesen und geschrieben NUR über die Routen (`innen()`, lib/zoe/innen.ts) mit `x-make-person` der auslösenden Person
//     (bei der Freigabe: wer im Stapel geklickt hat) — Zugang, Fassung/409, Grenzen/413, Rechnungs-Schutz, Protokoll prüft die Route;
//   • Finanzplan-Altweg und Liquiplan (`finanz-privat`): nur mit privatem Finanzzugang (`privatFinanzZugangFuer`) — ein Konto mit
//     `finanzRecht: 'business'` bekommt die Werkzeuge gar nicht angeboten (kimmi, Agenten) und kann sie im Stapel nicht freigeben;
//   • „bezahlt“ über `PATCH { aktion: 'bezahlt' }` — Status, `bezahltAm` und Buchung `bu-re-<id>` in EINER Sperre;
//   • Gesellschaft nur eine Business-Gesellschaft (`businessFirmaAus`, kein stiller Rückfall auf die Selbstständigkeit);
//   • Beträge auf den Cent; eine Wiederholung derselben Freigabe legt nichts doppelt an (Kennung aus der Vorschlags-Kennung).

import { innen, innenFehler, innenNein } from './innen';
import { ausVorschlag } from './crm-vorschlag';
import { neueKennung } from '@/lib/kennung';
import { localDay } from '@/lib/zeit';
import { businessFirmaAus, bereichVonFirma, finanzOrtAus, finanzOrtName, istRegisterKennung, kontoName, type Gesellschaftskennung } from '@/lib/einheiten';
import type { WerkzeugKontext } from './werkzeuge';

/**
 * Werkzeuge, die in die Bestände `finanzplan`/`liquiplan` schreiben (Routen-Klasse `finanz-privat`: sie tragen auch private Zeilen).
 * Wer keinen privaten Finanzzugang hat, bekommt sie weder angeboten (kimmi, Agenten) noch im Stapel zum Freigeben gezeigt.
 */
export const FINANZPLAN_ALTWEG_WERKZEUGE: ReadonlySet<string> = new Set(['setze_kontostand', 'erfasse_rechnung', 'erfasse_zahlung', 'erfasse_planposten']);

const KEINE_PERSON = 'Nicht ausgeführt: Dieses Werkzeug braucht eine angemeldete Person (kein Systemlauf).';
export const KEIN_FINANZZUGANG = 'Nicht ausgeführt: Kontostände, Rechnungen, Zahlungen und Planposten liegen in den Finanzbeständen des Haushalts — dafür fehlt diesem Konto der Zugang (System › Konto). Nichts gespeichert.';
const PRIVAT_HINWEIS = 'Nicht erfasst: Das ist privat. Private Zahlungen und Rechnungen gehören in die Haushaltsfinanzen (Finanzen › Privat) — dafür gibt es eigene Werkzeuge.';
const istPrivatAngabe = (rein: unknown) => /privat|haushalt|n26/i.test(String(rein ?? ''));
/** Auf den Cent (CLAUDE.md „Geld auf den Cent“) — nie auf ganze Euro. */
const cent = (n: number) => Math.round(n * 100) / 100;
const eur = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(cent(n)) ? 0 : 2, maximumFractionDigits: 2 }).format(cent(n || 0));
/** Der Ablehnungstext der Route, ohne doppeltes „Abgelehnt:“. */
const nein = (t: string) => `Fehlgeschlagen: ${t.replace(/^Abgelehnt: /, '')}`;
const KONFLIKT = 'Fehlgeschlagen: Inzwischen hat jemand diesen Eintrag geändert — nichts überschrieben. Bitte neu ansehen und noch einmal.';

/** Zugang wie die Route (`privatFinanzZugang`) — vorab, damit nichts gelesen wird, was die Person nicht sehen darf. */
async function finanzZugang(person: string | undefined): Promise<string | null> {
  if (!person) return KEINE_PERSON;
  const { privatFinanzZugangFuer } = await import('@/lib/finanzen/haushalt/zugriff');
  return (await privatFinanzZugangFuer(person).catch(() => null)) ? null : KEIN_FINANZZUGANG;
}

type MitFassung = { id: string; fassung?: string } & Record<string, unknown>;
interface PlanSicht { firmen: MitFassung[]; rechnungen: MitFassung[]; zahlungen: MitFassung[] }
const ohneFassung = (e: MitFassung) => { const { fassung: _f, ...rest } = e; return rest; };

/** Den Finanzplan so lesen, wie ihn die Oberfläche bekommt (Route GET: Zugang, Lese-Protokoll, je Eintrag `fassung`). */
async function planLesen(person: string): Promise<PlanSicht | string> {
  const r = await innen('/api/state/finanzplan', 'GET', null, person);
  if (innenNein(r)) return r.status === 403 ? KEIN_FINANZZUGANG : nein(innenFehler(r));
  const liste = (k: string) => (Array.isArray(r.json[k]) ? r.json[k] as MitFassung[] : []);
  return { firmen: liste('firmen'), rechnungen: liste('rechnungen'), zahlungen: liste('zahlungen') };
}

/** Ein Finanzplan-PATCH über die Route — Text bei Ablehnung, sonst die neue Sicht (für die nächste Fassung). */
async function planSchreiben(person: string, body: Record<string, unknown>): Promise<{ ok: true; sicht: PlanSicht; json: Record<string, unknown> } | { ok: false; text: string }> {
  const r = await innen('/api/state/finanzplan', 'PATCH', body, person);
  if (r.status === 403) return { ok: false, text: KEIN_FINANZZUGANG };
  if (r.status === 409 && Array.isArray(r.json.konflikte) && (r.json.konflikte as { grund?: string }[]).some(k => k.grund === 'inzwischen geändert' || k.grund === 'inzwischen gelöscht') && !/höchstens|storn|gestellt|festgeschrieben|Positionen/.test(innenFehler(r))) return { ok: false, text: KONFLIKT };
  if (innenNein(r)) return { ok: false, text: nein(innenFehler(r)) };
  const liste = (k: string) => (Array.isArray(r.json[k]) ? r.json[k] as MitFassung[] : []);
  return { ok: true, sicht: { firmen: liste('firmen'), rechnungen: liste('rechnungen'), zahlungen: liste('zahlungen') }, json: r.json };
}

/** Business-Gesellschaft aus der Angabe — ohne stillen Rückfall (lib/einheiten.ts `businessFirmaAus`). */
function firmaPruefen(roh: unknown): { ok: true; firma: Gesellschaftskennung } | { ok: false; text: string } {
  const f = businessFirmaAus(roh);
  return f.ok ? f : { ok: false, text: `Nicht erfasst: ${f.fehler}` };
}

export async function setzeKontostand(input: Record<string, unknown>, _origin?: string, person?: string): Promise<string> {
  const betrag = Number(input.betrag);
  if (input.betrag === undefined || input.betrag === null || input.betrag === '' || !isFinite(betrag)) return 'Fehlgeschlagen: betrag fehlt oder ist keine Zahl.';
  if (istPrivatAngabe(input.firma)) return PRIVAT_HINWEIS;
  const f = firmaPruefen(input.firma);
  if (!f.ok) return f.text;
  const sperre = await finanzZugang(person);
  if (sperre) return sperre;
  const plan = await planLesen(person!);
  if (typeof plan === 'string') return plan;
  if (!plan.firmen.length) return 'Fehlgeschlagen: Noch kein Finanzplan angelegt (Finanzen einmal öffnen) — nichts erfasst.';
  const alt = plan.firmen.find(x => x.id === f.firma);
  const eintrag = alt ? { ...ohneFassung(alt), kontostand: cent(betrag) } : { id: f.firma, name: finanzOrtName(f.firma), bank: '', kontostand: cent(betrag), stand: null };
  const s = await planSchreiben(person!, { ops: [{ liste: 'firmen', op: 'upsert', eintrag, ...(alt?.fassung ? { stand: alt.fassung } : {}) }] });
  if (!s.ok) return s.text;
  return `Erfasst: Kontostand ${kontoName(f.firma, String(alt?.name ?? finanzOrtName(f.firma)))} = ${eur(betrag)} (Stand heute).`;
}

export async function erfasseRechnung(input: Record<string, unknown>, _origin?: string, person?: string, kontext?: WerkzeugKontext): Promise<string> {
  if (istPrivatAngabe(input.firma)) return PRIVAT_HINWEIS;
  const kunde = String(input.kunde ?? '').trim().slice(0, 120);
  if (!kunde) return 'Fehlgeschlagen: kunde fehlt.';
  const status = ['geplant', 'gestellt', 'bezahlt'].includes(String(input.status)) ? String(input.status) : undefined;
  const betrag = input.betrag != null && input.betrag !== '' && isFinite(Number(input.betrag)) ? Math.max(0, cent(Number(input.betrag))) : undefined;
  const faellig = /^\d{4}-\d{2}-\d{2}$/.test(String(input.faellig ?? '')) ? String(input.faellig) : undefined;
  const titel = input.titel ? String(input.titel).slice(0, 200) : undefined;
  const f = firmaPruefen(input.firma);
  if (!f.ok) return f.text;
  const sperre = await finanzZugang(person);
  if (sperre) return sperre;
  const plan = await planLesen(person!);
  if (typeof plan === 'string') return plan;
  // Nur Rechnungen DIESER Gesellschaft (ohne Gesellschaft: Altbestand) — nie eine Rechnung einer Privat-Einheit.
  const kandidaten = plan.rechnungen.filter(r => (r.firmaId === f.firma || !r.firmaId) && String(r.kunde ?? '').toLowerCase() === kunde.toLowerCase());
  const r = kandidaten.find(x => !titel || String(x.titel ?? '').toLowerCase().includes(titel.toLowerCase()));
  // „bezahlt“ geht nur über die Aktion (Buchung + bezahltAm) — hier bleibt der Status, wie er ist (neu: „gestellt“).
  const statusSchreiben = status === 'bezahlt' ? (r ? undefined : 'gestellt') : status;
  let id: string;
  let fassung: string | undefined;
  let aktion: string;
  if (r) {
    id = r.id;
    const neu = { ...ohneFassung(r), ...(betrag != null ? { betrag } : {}), ...(statusSchreiben ? { status: statusSchreiben } : {}), ...(faellig ? { faellig } : {}), ...(titel ? { titel } : {}) };
    const geaendert = JSON.stringify(neu) !== JSON.stringify(ohneFassung(r));
    fassung = r.fassung;
    if (geaendert) {
      const s = await planSchreiben(person!, { ops: [{ liste: 'rechnungen', op: 'upsert', eintrag: neu, ...(r.fassung ? { stand: r.fassung } : {}) }] });
      if (!s.ok) return s.text;
      fassung = s.sicht.rechnungen.find(x => x.id === id)?.fassung;
    }
    aktion = `Rechnung ${kunde} aktualisiert: ${eur(Number(neu.betrag ?? 0))}${statusSchreiben ? `, Status ${statusSchreiben}` : ''}${faellig ? `, fällig ${faellig}` : ''}`;
  } else {
    // Eine Wiederholung derselben Freigabe trifft die Rechnung oben (gleicher Kunde) — die Kennung aus dem Vorschlag hält sie zusätzlich fest.
    id = kontext?.vorschlagId ? ausVorschlag('r', kontext.vorschlagId) : neueKennung('r');
    const s = await planSchreiben(person!, { ops: [{ liste: 'rechnungen', op: 'upsert', eintrag: { id, firmaId: f.firma, kunde, titel: titel ?? 'Leistung', betrag: betrag ?? 0, status: statusSchreiben ?? 'geplant', ...(faellig ? { faellig } : {}) } }] });
    if (!s.ok) return s.text;
    fassung = s.sicht.rechnungen.find(x => x.id === id)?.fassung;
    aktion = `Neue Rechnung angelegt: ${kunde} ${betrag != null ? eur(betrag) : 'ohne Betrag'} [${statusSchreiben ?? 'geplant'}]`;
  }
  if (status === 'bezahlt') {
    // Wie der Klick: Status, bezahltAm und die Buchung bu-re-<id> in EINER Sperre (app/api/state/finanzplan `bezahlt`).
    const b = await innen('/api/state/finanzplan', 'PATCH', { aktion: 'bezahlt', rechnungId: id, am: localDay(), ...(fassung ? { stand: fassung } : {}) }, person!);
    if (b.status === 403) return KEIN_FINANZZUGANG;
    if (innenNein(b)) return `${aktion}. Bezahlt NICHT vermerkt: ${innenFehler(b).replace(/^Abgelehnt: /, '')}`;
    aktion += b.json.schonBezahlt ? ' — war schon bezahlt' : ` — als bezahlt vermerkt (${localDay()}), Zahlungseingang gebucht`;
  }
  return `Erfasst: ${aktion}. Sichtbar in der Finanzplanung.`;
}

export async function erfasseZahlung(input: Record<string, unknown>, _origin?: string, person?: string, kontext?: WerkzeugKontext): Promise<string> {
  if (istPrivatAngabe(input.firma)) return PRIVAT_HINWEIS;
  const an = String(input.an ?? '').trim().slice(0, 120);
  const betrag = Number(input.betrag);
  if (!an || input.betrag === undefined || input.betrag === null || !isFinite(betrag)) return 'Fehlgeschlagen: an + betrag nötig.';
  const faellig = /^\d{4}-\d{2}-\d{2}$/.test(String(input.faellig ?? '')) ? String(input.faellig) : undefined;
  const f = firmaPruefen(input.firma);
  if (!f.ok) return f.text;
  const sperre = await finanzZugang(person);
  if (sperre) return sperre;
  const id = kontext?.vorschlagId ? ausVorschlag('z', kontext.vorschlagId) : neueKennung('z');
  if (kontext?.vorschlagId) {
    const plan = await planLesen(person!);
    if (typeof plan === 'string') return plan;
    if (plan.zahlungen.some(z => z.id === id)) return `Zahlung an ${an} stand schon da (derselbe Vorschlag) — nichts doppelt angelegt.`;
  }
  const s = await planSchreiben(person!, { ops: [{ liste: 'zahlungen', op: 'upsert', eintrag: { id, firmaId: f.firma, an, titel: String(input.titel ?? '').slice(0, 200), betrag: Math.max(0, cent(betrag)), status: 'offen', ...(faellig ? { faellig } : {}) } }] });
  if (!s.ok) return s.text;
  return `Erfasst: Zahlung an ${an} über ${eur(Math.max(0, betrag))}${faellig ? `, fällig ${faellig}` : ''} (${finanzOrtName(f.firma)}) — steht in der Prioritätenliste.`;
}

/**
 * Welche Firma ein Planposten aus ZOE trägt (09.10., „neutral-rest-2“): eine Gesellschaft aus lib/einheiten.ts, eine des
 * Gesellschafts-Registers (`g-…`) — oder ein Altwert, den der Liquiplan der Instanz schon trägt (eine frühere feste Zuordnung bleibt
 * so zuordenbar, wie sie gespeichert ist; eine feste Firma steht nicht mehr im Code). Sonst keine Firma (= Business wie bisher). Rein.
 */
export function planpostenFirma(angabe: unknown, vorhanden: readonly { firmaId?: string }[]): string | undefined {
  if (typeof angabe !== 'string' || !angabe) return undefined;
  if (istRegisterKennung(angabe)) return angabe;
  const g = finanzOrtAus(angabe);
  if (g && g !== 'privat') return g;
  return /^[a-z][a-z0-9]{1,23}$/.test(angabe) && vorhanden.some(p => p.firmaId === angabe) ? angabe : undefined;
}

/** Wiederkehrende Kosten oder Einnahmen für die Liquiditäts-Planung — über PATCH /api/state/liquiplan. */
export async function erfassePlanposten(input: Record<string, unknown>, _origin?: string, person?: string): Promise<string> {
  if (istPrivatAngabe(input.firma) || String(input.kategorie ?? '') === 'privat') return PRIVAT_HINWEIS;
  const titel = String(input.titel ?? '').trim().slice(0, 160);
  const betrag = Number(input.betrag);
  if (!titel || !isFinite(betrag) || Math.round(betrag) === 0) return 'Fehlgeschlagen: titel + betrag nötig (negativ = Ausgabe).';
  const RHY = ['einmalig', 'monatlich', 'quartal', 'jaehrlich'];
  const rhythmus = RHY.includes(String(input.rhythmus)) ? String(input.rhythmus) : 'monatlich';
  const ab = /^\d{4}-\d{2}-\d{2}$/.test(String(input.ab ?? '')) ? String(input.ab) : localDay();
  const kategorie = input.kategorie ? String(input.kategorie).slice(0, 40) : undefined;
  const sicher = input.sicher !== false;
  const sperre = await finanzZugang(person);
  if (sperre) return sperre;
  const l = await innen('/api/state/liquiplan', 'GET', null, person!);
  if (innenNein(l)) return l.status === 403 ? KEIN_FINANZZUGANG : nein(innenFehler(l));
  const posten = (Array.isArray(l.json.posten) ? l.json.posten : []) as ({ id: string; titel: string; firmaId?: string } & Record<string, unknown>)[];
  const firmaId = planpostenFirma(input.firma, posten);
  // Ein Business-Werkzeug legt nie etwas bei einer Privat-Einheit ab (Funde #3) — auch keine ausdrücklich genannte. Ohne bzw. mit
  // unbekannter Angabe bleibt der Posten ohne Firma (= Business, „nicht zugeordnet“ — die Prüfliste zeigt ihn), nie bei der Selbstständigkeit.
  if (firmaId && bereichVonFirma(firmaId) === 'privat') { const g = businessFirmaAus(firmaId); return `Nicht erfasst: ${g.ok ? 'gehört zu Privat.' : g.fehler}`; }
  const alt = posten.find(p => p.titel.toLowerCase() === titel.toLowerCase());
  if (alt && bereichVonFirma(alt.firmaId) === 'privat') return 'Nicht erfasst: Dieser Planposten gehört zu Privat — im Privat-Bereich der Finanzen ändern.';
  const eintrag = alt
    ? { ...alt, betrag, rhythmus, ab, sicher, ...(kategorie ? { kategorie } : {}), ...(firmaId ? { firmaId } : {}) }
    : { id: neueKennung('lp'), titel, betrag, rhythmus, ab, sicher, ...(kategorie ? { kategorie } : {}), ...(firmaId ? { firmaId } : {}) };
  const r = await innen('/api/state/liquiplan', 'PATCH', { ops: [{ liste: 'posten', op: 'upsert', eintrag }] }, person!);
  if (r.status === 403) return KEIN_FINANZZUGANG;
  if (innenNein(r)) return nein(innenFehler(r));
  if (!Number(r.json.angewandt)) return 'Fehlgeschlagen: Der Planposten wurde nicht angenommen (Betrag 0 oder ungültig) — nichts gespeichert.';
  const wie = rhythmus === 'einmalig' ? 'einmalig' : rhythmus === 'monatlich' ? 'monatlich' : rhythmus === 'quartal' ? 'je Quartal' : 'jährlich';
  return `Erfasst: ${titel} ${alt ? 'aktualisiert' : 'angelegt'} — ${betrag < 0 ? '−' : '+'}${eur(Math.abs(Math.round(betrag)))} ${wie} ab ${ab}. Rechnet sofort in der Liquiditäts-Planung mit.`;
}

/** Jahresziele und Startmonat setzen — über PATCH /api/state/finance (Controlling, Haushalt des Inhabers). */
export async function setzeZiele(input: Record<string, unknown>, _origin?: string, person?: string): Promise<string> {
  if (!person) return KEINE_PERSON;
  const zahl = (v: unknown) => (v !== undefined && v !== null && v !== '' && isFinite(Number(v)) ? Number(v) : undefined);
  const zielUmsatz = zahl(input.zielUmsatz) != null ? Math.max(0, zahl(input.zielUmsatz)!) : undefined;
  const zielGewinn = zahl(input.zielGewinn) != null ? Math.max(0, zahl(input.zielGewinn)!) : undefined;
  const cash = zahl(input.cash);
  const MONATE = ['januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'];
  let startMonat: number | undefined;
  if (input.startMonat != null && input.startMonat !== '') {
    const roh = String(input.startMonat).toLowerCase().trim();
    const alsZahl = Number(roh);
    if (isFinite(alsZahl) && alsZahl >= 0 && alsZahl <= 11) startMonat = Math.round(alsZahl);
    else {
      const i = MONATE.findIndex(m => roh.startsWith(m.slice(0, 3)) || (m === 'märz' && roh.startsWith('mae')));
      if (i >= 0) startMonat = i;
    }
  }
  if (zielUmsatz == null && zielGewinn == null && cash == null && startMonat == null) return 'Fehlgeschlagen: nichts zu setzen (zielUmsatz, zielGewinn, cash oder startMonat angeben).';
  const felder = { ...(zielUmsatz != null ? { zielUmsatz } : {}), ...(zielGewinn != null ? { zielGewinn } : {}), ...(cash != null ? { cash } : {}), ...(startMonat != null ? { startMonat } : {}) };
  const r = await innen('/api/state/finance', 'PATCH', { felder }, person);
  if (r.status === 403) return 'Nicht ausgeführt: Das Controlling gehört zum Haushalt des Inhabers — für dieses Konto nicht verfügbar.';
  if (innenNein(r)) return nein(innenFehler(r));
  const teile = [
    zielUmsatz != null ? `Ziel-Umsatz ${eur(Math.round(zielUmsatz))}` : '', zielGewinn != null ? `Ziel-Gewinn ${eur(Math.round(zielGewinn))}` : '',
    cash != null ? `Cash ${eur(Math.round(cash))}` : '', startMonat != null ? `Start ab ${['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'][startMonat]}` : '',
  ].filter(Boolean);
  return `Erfasst: ${teile.join(' · ')}. Sichtbar im Controlling — Fortschritt und nötige Run-Rate rechnen sofort neu.`;
}
