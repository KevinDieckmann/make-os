// ─── MAKE OS — ZOE' Werkzeuge (Implementierungen) ────────────────────────
// Bis 07.09. steckten diese Funktionen in app/api/kimmi/route.ts. Sie stehen
// jetzt für sich, weil das Register (register.ts) sie mit Risiko-Stufe,
// Trockenlauf und Protokoll umgibt — und weil eine 711-Zeilen-Route, in der
// Werkzeug, Schleife und Ausführung durcheinanderliegen, nicht prüfbar ist.
//
// Diese Datei enthält NUR die Wirkung. Was ein Werkzeug darf, entscheidet
// register.ts; ob es ausgeführt oder in den Stapel gelegt wird, entscheidet
// die Route.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { PRIO_NAME, tagDe } from './vorschau-text';
import { aufgabenVonMeilenstein, fortschrittAusAufgaben } from '@/lib/planung/meilenstein-aufgaben';
import { zieleNachziehen } from '@/lib/planung/meilenstein-aufgaben-server';
import { kettePruefen } from '@/lib/planung/meilenstein-kette';
import { meilensteineSichtbarFuer, verborgeneMeilensteineFuer } from '@/lib/planung/eigene-ziele-sicht-server';
import { ZIEL_HORIZONTE, type ZieleDatei } from '@/lib/planung/typen';
import { ladeAufgaben, ladeAufgabenSicht } from '@/lib/aufgaben/speicher';
import { elternAusText } from '@/lib/aufgaben/ebenen';
import type { Op as EinkaufOp } from '@/lib/ernaehrung/modell';
import { localDay, tagePlus } from '@/lib/zeit';
import { termineFuerZoe } from '@/lib/kalender/zoe-sicht-server';
import { GRENZEN, UG_FIRMA, rechnungSchutz, sauberFile, type Rechnung as FpRechnung } from '@/lib/finanzen/finanzplan-bestand';
import { GEHOERT_ZU_PRIVAT, finanzOrtAus, firmaAusAngabe, finanzOrtName, gehoertZuPrivat, istGesellschaft, istGesellschaftId, type Gesellschaftskennung } from '@/lib/einheiten';
import type { FaktArt } from './gedaechtnis';
import { projektUnterlagen, dateiLesen } from './aufgaben-unterlagen';
import { AUFGABEN_WERKZEUGE } from './aufgaben-werkzeuge';
import { ARBEIT_WERKZEUGE } from './arbeit-werkzeug';
import { CRM_LESE_LAEUFE, suche_kontakt as sucheKontaktSicht, crm_lage as crmLageSicht } from './crm-werkzeuge';
import { CRM_VORSCHLAG_LAUF } from './crm-vorschlag';
import { neueKennung } from '@/lib/kennung';
import type { PlanArt } from '@/types/planer';
import { blockAnlegen } from '@/lib/planung/bloecke-server';
import { verbunden as icloudVerbunden } from '@/lib/kalender/icloud';
import { blockKollision } from '@/lib/planung/bloecke';
import { planTag } from '@/lib/planung/zeitstrahl';
import { fokusSchreibSchluessel } from '@/lib/planung/jahr-fokus';
import { vornameVon } from '@/lib/zoe/grundauftrag';

// ── ZOE plant: Block in den Kalender der Person (Vorgabe: „dass da auch drin geplant werden kann"). Seit F2 M8
// (29.09., Vorgabe „ZOE schreibt nur über den Stapel“) ist `plan_block` freigabepflichtig (Register, Gruppe „kalender“):
// der Aufruf aus dem Gespräch oder einem Lauf legt einen Vorschlag in den Stapel, erst der Klick führt diese Funktion aus
// (`erzwingen`). Angelegt wird über den Blöcke-Weg (lib/planung/bloecke-server.ts `blockAnlegen`: iCloud-Termin der Art
// Fokus/Block im Kalender der Person → kalender-bezug → Änderungsprotokoll, ohne Teilnehmer) — nie über den Apple-Altweg,
// NIE über feste Termine (Kollision `blockKollision` bei der Freigabe, gelesen ohne Netz).
const PLAN_ARTEN_ZOE = ['fokus', 'reha', 'routine', 'pause', 'aufgabe', 'block'] as const;
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const KEINE_PERSON_PLAN = 'Nicht ausgeführt: Dieses Werkzeug braucht eine angemeldete Person (kein Systemlauf).';

async function planBlock(input: Record<string, unknown>, _o?: unknown, person?: string): Promise<string> {
  if (!person) return KEINE_PERSON_PLAN; // Regel 5: nie ein Rückfall auf eine feste Person
  const date = String(input.date ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Fehlgeschlagen: date muss YYYY-MM-DD sein.';
  if (date < localDay()) return `Fehlgeschlagen: ${date} liegt in der Vergangenheit — plane ab heute (${localDay()}).`;
  const startMin = Math.max(6 * 60, Math.min(22 * 60 - 15, Math.round(Number(input.startMin) / 15) * 15 || 9 * 60));
  const dauerMin = Math.max(15, Math.min(240, Math.round(Number(input.dauerMin) / 15) * 15 || 60));
  const titel = String(input.titel ?? '').slice(0, 120) || 'Block';
  const art = (PLAN_ARTEN_ZOE as readonly string[]).includes(String(input.art)) ? String(input.art) as PlanArt : 'block';
  const ende = startMin + dauerMin;
  if (!icloudVerbunden()) return 'Fehlgeschlagen: iCloud ist nicht verbunden — Blöcke sind Termine im Kalender.';

  // Feste Termine — nichts wird überplant. Über denselben Lesepfad wie ZOE (R-Z #K4, für die Person gefiltert: private
  // der anderen nur „Belegt“, abgesagte fehlen). Ab dem Vortag gelesen: ein Termin über Mitternacht zählt mit (F2 M5).
  const kal = await termineFuerZoe(person, tagePlus(date, -1), tagePlus(date, 1));
  const kollision = blockKollision(kal.termine, person, date, startMin, ende);
  if (kollision) return `Kollision mit festem Termin „${kollision.titel}“ (${hhmm(kollision.s)}–${hhmm(Math.min(kollision.e, 24 * 60 - 1))}) am ${date} — nicht eingeplant. Schlage eine freie Zeit vor.`;

  // Business-frei (08.10., Lücke 7, lib/arbeitsrahmen/regel.ts): Arbeit (Fokus, Aufgabe, eigener Block) kommt nie in eine
  // Business-freie Zeit der Person — Reha, Routine und Pause schon. Der Satz nennt keine Zeiten und keinen Grund aus der Familie.
  {
    const { istArbeitsBlock, ueberlappt } = await import('@/lib/arbeitsrahmen/regel');
    if (istArbeitsBlock(art === 'fokus' ? 'fokus' : 'block', art === 'fokus' || art === 'block' ? null : art)) {
      const { businessFreiFensterFuer } = await import('@/lib/arbeitsrahmen/server');
      const spannen = await businessFreiFensterFuer(person, date, tagePlus(date, 1)).catch(() => []);
      if (ueberlappt(spannen, `${date}T${hhmm(startMin)}:00`, ende >= 24 * 60 ? `${tagePlus(date, 1)}T00:00:00` : `${date}T${hhmm(ende)}:00`)) {
        return `Nicht eingeplant: ${date} ${hhmm(startMin)}–${hhmm(Math.min(ende, 24 * 60 - 1))} liegt in einer Business-freien Zeit — dort plant ZOE keine Arbeit. Schlage eine Zeit außerhalb vor (freie_zeit).`;
      }
    }
  }

  try {
    await blockAnlegen(person, { date, startMin, dauerMin, titel, art }, { art: 'zoe', person });
  } catch (e) {
    return `Fehlgeschlagen: ${e instanceof Error ? e.message.slice(0, 200) : 'Kalender nicht erreichbar.'}`;
  }
  return `Eingeplant: „${titel}“ am ${date}, ${hhmm(startMin)}–${hhmm(ende)} (${art}) — als Block im Kalender (iCloud), frei verschiebbar.`;
}

// ── ZOE sucht freie Zeit (K6a, 29.09.; Verbindung aus K4): NUR lesen, über die EINE Lesefunktion `freieZeitFuer`
// (lib/kalender/freie-zeit.ts — dieselbe wie „Mit … planen“, Buchungsseite und Angebot). Liefert nur Zeiten, nie Titel:
// private Termine der anderen Person sind darin nur „belegt“ (maskiert je Person). Legt nichts an — einen Termin
// schlägt ZOE danach vor, angelegt wird erst per Klick.
const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
async function freieZeit(input: Record<string, unknown>, _o?: unknown, person?: string): Promise<string> {
  if (!person) return KEINE_PERSON_PLAN; // S1 #17: kein Rückfall auf eine feste Person (Regel 5)
  const { personImHaushaltDesInhabers } = await import('@/lib/zugang/haushalt-inhaber');
  if (!(await personImHaushaltDesInhabers(person))) return 'Fehlgeschlagen: freie Zeit nur für Personen des Haushalts.';
  const roh = Array.isArray(input.personen) ? input.personen.map(String) : typeof input.personen === 'string' ? String(input.personen).split(',') : [];
  const personen = Array.from(new Set([person, ...roh.map(x => x.trim().toLowerCase()).filter(x => /^[a-z0-9-]{1,40}$/.test(x))])).slice(0, 4);
  for (const p of personen) if (!(await personImHaushaltDesInhabers(p))) return `Fehlgeschlagen: ${p} gehört nicht zum Haushalt — freie Zeit nur für Personen des Haushalts.`;
  const dauerMin = Math.max(10, Math.min(480, Math.round(Number(input.dauerMin) || 60)));
  const tage = Math.max(1, Math.min(30, Math.round(Number(input.tage) || 7)));
  const von = /^\d{4}-\d{2}-\d{2}$/.test(String(input.von ?? '')) && String(input.von) >= localDay() ? String(input.von) : undefined;
  const { freieZeitFuer } = await import('@/lib/kalender/freie-zeit');
  // Business-freie Zeiten (08.10., Lücke 7) bietet `freieZeitFuer` nie an — K1 rechnet sie als belegt.
  const r = await freieZeitFuer({ personen, dauerMin, tage, grenze: 40, ...(von ? { von } : {}) });
  if (!r.vorschlaege.length) return `Keine gemeinsame freie Zeit von ${dauerMin} Min. für ${personen.join(' + ')} zwischen ${r.von} und ${r.bis} (Arbeitszeit aus der Wochenvorlage, Feiertage NRW, Abwesenheiten, Business-freie Zeiten).`;
  const zeilen = r.vorschlaege.slice(0, 12).map(v => `- ${WT[new Date(`${v.tag}T12:00:00Z`).getUTCDay()]} ${v.tag} ${v.start.slice(11, 16)}–${v.ende.slice(11, 16)}${v.feiertag ? ` (Feiertag ${v.feiertag})` : ''}`);
  return `Freie Zeit (${dauerMin} Min.) für ${personen.join(' + ')} von ${r.von} bis ${r.bis} — ${r.vorschlaege.length} Möglichkeiten, die ersten ${zeilen.length}:\n${zeilen.join('\n')}\nNur ein Vorschlag: einen Termin legt erst ein Klick im Kalender an.`;
}

// ─── ZOE als Eingabe-Schicht: die Person ruft zu, ZOE schreibt in die Stores.
// Interne Buchführung (nichts geht nach außen) — jede Erfassung wird im Chat
// knapp bestätigt und erscheint sofort in Finanzplanung/Meilensteinen/Markttraktion.

const eurW = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(n || 0));
// Die eine Einheitenliste (28.09.): kdc · kdv · ug aus lib/einheiten.ts (`firmaAusAngabe`: Altnamen und Kurzformen → Kennung).
const firmaId = (rein: unknown): Gesellschaftskennung => firmaAusAngabe(rein);
/** Schreibt ZOE etwas auf die Gesellschaft `ug`, bekommt ein Plan ohne UG-Konto es dazu (wie ugFirmaNachziehen im Schreibweg der Route). */
const mitUgKonto = <F extends { firmen?: { id: string }[] }>(f: F, fid: string): F => (fid === UG_FIRMA.id && Array.isArray(f.firmen) && f.firmen.length && !f.firmen.some(x => x.id === UG_FIRMA.id) ? { ...f, firmen: [...f.firmen, { ...UG_FIRMA }] } : f);
/** Privates gehört seit 24.09. in die Haushaltsfinanzen, nicht in den Finanzplan der Firmen. */
const istPrivatAngabe = (rein: unknown) => /privat|haushalt|n26/i.test(String(rein ?? ''));
const PRIVAT_HINWEIS = 'Nicht erfasst: Das ist privat. Private Zahlungen und Rechnungen gehören in die Haushaltsfinanzen (Finanzen › Privat) — dafür gibt es eigene Werkzeuge.';

async function setzeKontostand(input: Record<string, unknown>, _origin?: string, person?: string, kontext?: WerkzeugKontext): Promise<string> {
  const betrag = Number(input.betrag);
  if (!isFinite(betrag)) return 'Fehlgeschlagen: betrag fehlt oder ist keine Zahl.';
  const fid = firmaId(input.firma);
  let name: string = fid;
  await updateJson<{ firmen: { id: string; name: string; kontostand: number | null; stand: string | null }[] }>('finanzplan', current => {
    const f = mitUgKonto(current ?? { firmen: [] }, fid);
    f.firmen = (f.firmen ?? []).map(x => {
      if (x.id !== fid) return x;
      name = x.name;
      return { ...x, kontostand: Math.round(betrag), stand: localDay() };
    });
    return f;
  });
  // Konten-Register (08.10.): führt es die Gesellschaft schon, kommt der Stand auch dort an (freigegeben von einem Menschen — `freigabe`).
  const wer = kontext?.freigegebenVon ?? person;
  if (wer) await (await import('@/lib/finanzen/konten/server')).kontostandAusAltweg({ firma: fid, betrag: Math.round(betrag), datum: localDay(), person: wer, herkunft: 'zoe' });
  return `Erfasst: Kontostand ${name} = ${eurW(betrag)} (Stand heute).`;
}

async function erfasseRechnung(input: Record<string, unknown>): Promise<string> {
  if (istPrivatAngabe(input.firma)) return PRIVAT_HINWEIS;
  const kunde = String(input.kunde ?? '').trim().slice(0, 120);
  if (!kunde) return 'Fehlgeschlagen: kunde fehlt.';
  const status = ['geplant', 'gestellt', 'bezahlt'].includes(String(input.status)) ? String(input.status) : undefined;
  // Auf den Cent (28.09., K3) — vorher auf ganze Euro gerundet.
  const betrag = input.betrag != null && isFinite(Number(input.betrag)) ? Math.max(0, Math.round(Number(input.betrag) * 100) / 100) : undefined;
  const faellig = /^\d{4}-\d{2}-\d{2}$/.test(String(input.faellig ?? '')) ? String(input.faellig) : undefined;
  const titel = input.titel ? String(input.titel).slice(0, 200) : undefined;
  let aktion = '';
  let abgelehnt = '';
  const fidR = firmaId(input.firma);
  await updateJson<{ firmen?: { id: string }[]; rechnungen: { id: string; firmaId: string; kunde: string; titel: string; betrag: number; status: string; faellig?: string }[] }>('finanzplan', current => {
    const f = mitUgKonto(current ?? { rechnungen: [] }, fidR);
    f.rechnungen = f.rechnungen ?? [];
    const idx = f.rechnungen.findIndex(r => r.kunde.toLowerCase() === kunde.toLowerCase() && (!titel || r.titel.toLowerCase().includes(titel.toLowerCase())));
    if (idx >= 0) {
      const r = f.rechnungen[idx];
      const neu = { ...r, ...(betrag != null ? { betrag } : {}), ...(status ? { status } : {}), ...(faellig ? { faellig } : {}), ...(titel ? { titel } : {}) };
      // Dieselbe Regel wie die Route (28.09., K3): ab „gestellt“ kein Zurück und kein neuer Betrag — stornieren.
      const sauber = (x: unknown) => sauberFile({ rechnungen: [x as FpRechnung] }).rechnungen[0];
      abgelehnt = rechnungSchutz(sauber(r), sauber(neu)) ?? '';
      if (abgelehnt) return current ?? f;
      f.rechnungen[idx] = neu;
      aktion = `Rechnung ${kunde} aktualisiert: ${betrag != null ? eurW(betrag) : eurW(f.rechnungen[idx].betrag)}${status ? `, Status ${status}` : ''}${faellig ? `, fällig ${faellig}` : ''}`;
    } else if (f.rechnungen.length >= GRENZEN.rechnungen) {
      // Grenze erreicht: ablehnen, nie kürzen (28.09.) — der Bestand bleibt, wie er ist.
      aktion = '';
    } else {
      f.rechnungen.push({ id: neueKennung('r'), firmaId: fidR, kunde, titel: titel ?? 'Leistung', betrag: betrag ?? 0, status: status ?? 'geplant', ...(faellig ? { faellig } : {}) });
      aktion = `Neue Rechnung angelegt: ${kunde} ${betrag != null ? eurW(betrag) : 'ohne Betrag'} [${status ?? 'geplant'}]`;
    }
    return f;
  });
  if (abgelehnt) return `Fehlgeschlagen: ${abgelehnt}`;
  if (!aktion) return `Fehlgeschlagen: höchstens ${GRENZEN.rechnungen} Rechnungen im Finanzplan — erst Erledigtes aufräumen.`;
  return `Erfasst: ${aktion}. Sichtbar in der Finanzplanung.`;
}

async function erfasseZahlung(input: Record<string, unknown>): Promise<string> {
  if (istPrivatAngabe(input.firma)) return PRIVAT_HINWEIS;
  const an = String(input.an ?? '').trim().slice(0, 120);
  const betrag = Number(input.betrag);
  if (!an || !isFinite(betrag)) return 'Fehlgeschlagen: an + betrag nötig.';
  const faellig = /^\d{4}-\d{2}-\d{2}$/.test(String(input.faellig ?? '')) ? String(input.faellig) : undefined;
  let voll = false;
  const fidZ = firmaId(input.firma);
  await updateJson<{ firmen?: { id: string }[]; zahlungen: { id: string; firmaId: string; an: string; titel: string; betrag: number; status: string; faellig?: string }[] }>('finanzplan', current => {
    const f = mitUgKonto(current ?? { zahlungen: [] }, fidZ);
    // Grenze wie im Schreibweg der Finanzplanung: ablehnen, nie kürzen (28.09.).
    if ((f.zahlungen ?? []).length >= GRENZEN.zahlungen) { voll = true; return f; }
    f.zahlungen = [...(f.zahlungen ?? []), { id: neueKennung('z'), firmaId: fidZ, an, titel: String(input.titel ?? '').slice(0, 200), betrag: Math.max(0, Math.round(betrag)), status: 'offen', ...(faellig ? { faellig } : {}) }];
    return f;
  });
  if (voll) return `Fehlgeschlagen: höchstens ${GRENZEN.zahlungen} Zahlungen im Finanzplan — erst Erledigtes aufräumen.`;
  return `Erfasst: Zahlung an ${an} über ${eurW(betrag)}${faellig ? `, fällig ${faellig}` : ''} — steht in der Prioritätenliste.`;
}

/** Eine Auswahl per Namensteil: genau ein Treffer (ein exakter Name gewinnt), sonst ein Fehlertext. */
function treffer<T extends { id: string; titel: string }>(liste: readonly T[], teil: string, was: string): T | string {
  const s = teil.trim().toLowerCase();
  const exakt = liste.filter(x => x.titel.trim().toLowerCase() === s);
  const l = exakt.length === 1 ? exakt : liste.filter(x => x.titel.toLowerCase().includes(s));
  if (l.length === 1) return l[0];
  return l.length ? `${was} „${teil}“ ist nicht eindeutig (${l.slice(0, 4).map(x => x.titel).join(' · ')}) — genauer benennen.` : `Kein ${was} passt zu „${teil}“.`;
}

async function setzeMeilenstein(input: Record<string, unknown>, _origin?: string, person?: string): Promise<string> {
  const suche = String(input.titel ?? '').trim().toLowerCase();
  if (!suche) return 'Fehlgeschlagen: titel fehlt.';
  const fortschritt = input.fortschritt != null && isFinite(Number(input.fortschritt)) ? Math.max(0, Math.min(100, Math.round(Number(input.fortschritt)))) : undefined;
  const erledigt = input.erledigt === true;
  // Verschieben (30.09.): jedes echte Datum bis 10 Jahre um heute — ausdrücklich auch im nächsten Jahr.
  const faellig = input.faellig != null && input.faellig !== '' ? planTag(input.faellig, localDay()) : undefined;
  if (faellig === null) return 'Fehlgeschlagen: faellig als Datum YYYY-MM-DD angeben (höchstens 10 Jahre voraus).';
  // Ziel und Kette (01.10., Ziel ↔ Meilenstein): `ziel` = Teil des Ziel-Titels (leer = Bezug lösen), `wartet_auf` = Teile der
  // Titel der Vorgänger (leere Liste = Kette lösen). Gilt wie alles hier nur über den Stapel (Register: freigabepflichtig).
  const zielText = input.ziel !== undefined ? String(input.ziel ?? '').trim() : undefined;
  const wartetRoh = input.wartet_auf !== undefined ? (Array.isArray(input.wartet_auf) ? input.wartet_auf : [input.wartet_auf]).map(x => String(x ?? '').trim()).filter(Boolean) : undefined;
  let zielWahl: { id: string; titel: string } | null | string = null;
  if (zielText) {
    const zd = await loadJson<ZieleDatei>('ziele');
    const alle = ZIEL_HORIZONTE.flatMap(h => (Array.isArray(zd?.[h]) ? zd![h] : []).filter(z => !z.abgeleitetVon));
    zielWahl = treffer(alle, zielText, 'Ziel');
    if (typeof zielWahl === 'string') return `Fehlgeschlagen: ${zielWahl}`;
  }
  let ergebnis = '';
  // Fortschritt-Regel (30.09., lib/planung/meilenstein-aufgaben.ts): mit Aufgaben rechnet er sich aus ihnen — dann nicht von Hand.
  const aufgaben = await ladeAufgaben();
  type Ms = { id: string; titel: string; fortschritt: number; erledigt: boolean; erledigtAm?: string; faellig?: string; abgeleitetVon?: string; angepasst?: boolean; zielId?: string; wartetAuf?: string[] };
  // Eigene Ziele nur geteilt (08.10.): Meilensteine an einem nicht geteilten eigenen Ziel einer anderen Person gibt es für diese Person
  // nicht — weder als Treffer noch in der Liste „Offene“ noch als Vorgänger (ohne Person: keiner an einem eigenen Ziel).
  const verborgen = await verborgeneMeilensteineFuer(person ?? null);
  await updateJson<{ meilensteine: Ms[] }>('meilensteine', current => {
    const f = current ?? { meilensteine: [] };
    const liste = f.meilensteine ?? [];
    const sichtbar = liste.filter(x => !verborgen.has(x.id));
    const m = sichtbar.find(x => x.titel.toLowerCase().includes(suche));
    if (!m) {
      ergebnis = `Fehlgeschlagen: Kein Meilenstein passt zu „${input.titel}“. Offene: ${sichtbar.filter(x => !x.erledigt).slice(0, 5).map(x => x.titel).join(' · ')}`;
      return f;
    }
    // Kette zuerst prüfen — nichts wird halb geändert.
    let wartetNeu: string[] | undefined;
    if (wartetRoh) {
      const ids: string[] = [];
      for (const t of wartetRoh) {
        const w = treffer(sichtbar.filter(x => x.id !== m.id), t, 'Meilenstein');
        if (typeof w === 'string') { ergebnis = `Fehlgeschlagen: ${w}`; return f; }
        if (!ids.includes(w.id)) ids.push(w.id);
      }
      wartetNeu = ids;
      const nachher = liste.map(x => (x.id === m.id ? { ...x, wartetAuf: ids } : x));
      const grund = kettePruefen(nachher, [m.id], liste);
      if (grund) { ergebnis = `Fehlgeschlagen: ${grund.replace(/^Abgelehnt: /, '')}`; return f; }
    }
    const teile: string[] = [];
    if (faellig) {
      m.faellig = faellig;
      // Aus einem Jahresziel abgeleitet: das eigene Datum gilt — sonst zöge die Kaskade den Termin des Ziels zurück.
      if (m.abgeleitetVon) m.angepasst = true;
      teile.push(`auf ${faellig.slice(8)}.${faellig.slice(5, 7)}.${faellig.slice(0, 4)} verschoben`);
    }
    if (zielText !== undefined) {
      if (zielWahl && typeof zielWahl !== 'string') { m.zielId = zielWahl.id; teile.push(`zahlt auf das Ziel „${zielWahl.titel}“ ein`); }
      else { delete m.zielId; teile.push('ohne Ziel-Bezug'); }
      if (m.abgeleitetVon) m.angepasst = true;
    }
    if (wartetNeu) {
      if (wartetNeu.length) { m.wartetAuf = wartetNeu; teile.push(`wartet auf ${wartetNeu.map(id => `„${liste.find(x => x.id === id)?.titel}“`).join(', ')}`); }
      else { delete m.wartetAuf; teile.push('wartet auf niemanden mehr'); }
      if (m.abgeleitetVon) m.angepasst = true;
    }
    const errechnet = m.id ? fortschrittAusAufgaben(aufgabenVonMeilenstein(aufgaben, m.id)) : null;
    if (erledigt) { m.erledigt = true; m.fortschritt = 100; m.erledigtAm = localDay(); teile.push('abgehakt ✓'); }
    else if (fortschritt != null && errechnet !== null) teile.push(`nicht von Hand gesetzt — der Fortschritt rechnet sich aus seinen Aufgaben (${errechnet} %); Aufgaben abhaken oder den Meilenstein als erledigt setzen`);
    else if (fortschritt != null) { m.fortschritt = fortschritt; teile.push(`auf ${fortschritt}% gesetzt`); }
    ergebnis = teile.length ? `Meilenstein „${m.titel}“ ${teile.join(' und ')}.` : `Nichts geändert — fortschritt, erledigt, faellig, ziel oder wartet_auf angeben.`;
    return f;
  });
  // Ziele mit Meilensteinen ziehen nach (Mittelwert, lib/planung/meilenstein-aufgaben-server.ts).
  await zieleNachziehen();
  return ergebnis.startsWith('Fehlgeschlagen') ? ergebnis : `Erfasst: ${ergebnis}`;
}

async function setzeFokus(input: Record<string, unknown>): Promise<string> {
  const h = String(input.horizont ?? '');
  if (!['tag', 'woche', 'monat', 'quartal', 'jahr'].includes(h)) return 'Fehlgeschlagen: horizont tag|woche|monat|quartal|jahr nötig.';
  // Fokus je Space (26.09.): ohne Angabe der gemeinsame Satz, sonst „privat:jahr“ / „business:jahr“.
  const space = input.space === 'privat' || input.space === 'business' ? String(input.space) : null;
  // Fokus des Jahres je Jahr (30.09., lib/planung/jahr-fokus.ts): `jahr` nur beim Horizont Jahr, höchstens 10 Jahre um heute.
  const laufend = Number(localDay().slice(0, 4));
  const jahr = h === 'jahr' && input.jahr != null ? Number(input.jahr) : laufend;
  if (!Number.isInteger(jahr) || Math.abs(jahr - laufend) > 10) return 'Fehlgeschlagen: jahr als Jahreszahl angeben (höchstens 10 Jahre um heute).';
  const key = space ? `${space}:${h}` : h;
  const schluessel = h === 'jahr' ? fokusSchreibSchluessel(`${key}:${jahr}`, laufend) : [key];
  const text = String(input.text ?? '').slice(0, 300);
  await updateJson<{ fokus?: Record<string, string> } & Record<string, unknown>>('ziele', current => {
    const f = current ?? {};
    return { ...f, fokus: { ...(f.fokus ?? {}), ...Object.fromEntries(schluessel.map(k => [k, text])) } };
  });
  return `Erfasst: Fokus (${h}${h === 'jahr' && jahr !== laufend ? ` ${jahr}` : ''}${space ? `, ${space}` : ''}) = „${text}“. ${h === 'jahr' && jahr !== laufend ? `Gilt ab Januar ${jahr}.` : 'Steht auf Home, in der Übersicht und lenkt die Planung.'}`;
}

// ── Gesundheit (23.09.): die Griffe, die ein Satz auslöst ───────────────────
// Eine Person antwortet abends auf Telegram mit einem Satz („Routine gemacht, Stimmung 4,
// dankbar für ein gutes Gespräch“) — und ZOE schreibt mehrere Bestände. Jedes
// Werkzeug ist frei: es erfasst nur, was die Person selbst gesagt hat.

/** Persönliche Bestände brauchen eine ausdrücklich benannte Person — kein Rückfall auf den Inhaber (26.09.). */
const KEINE_PERSON = 'Nicht ausgeführt: Dieses Werkzeug braucht eine angemeldete Person (kein Systemlauf).';
const HEUTE_ODER = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : localDay());

async function hakeRoutine(input: Record<string, unknown>, _o: string, person?: string): Promise<string> {
  const { routineAusZuruf } = await import('@/lib/gesundheit/eintraege');
  const { speicherFuer } = await import('./raum');
  if (!person) return KEINE_PERSON;
  const wer = person;
  const f = await loadJson<{ routinen?: { id: string; label: string; aktiv: boolean; owner?: string }[] }>('routinen');
  // Nur Routinen, die diese Person sieht (eigene + gemeinsame) — nie die der anderen abhaken oder aufzählen.
  const { sichtbarFuer } = await import('@/lib/planung/routinen');
  const alle = sichtbarFuer((f?.routinen ?? []).filter(r => r.aktiv), wer);
  const zurufe = Array.isArray(input.routinen) ? (input.routinen as unknown[]).map(String) : [String(input.routine ?? '')];
  const ids = zurufe.map(z => routineAusZuruf(z, alle)).filter((x): x is string => !!x);
  if (!ids.length) return `Keine Routine passt zu „${zurufe.join(', ')}“. Es gibt: ${alle.map(r => r.label).join(' · ')}`;
  const erledigt = input.erledigt !== false;
  const datum = HEUTE_ODER(input.datum);
  await updateJson<Record<string, string[]>>(speicherFuer('health-log', wer), current => {
    const log = current ?? {};
    const tag = new Set(log[datum] ?? []);
    for (const id of ids) { if (erledigt) tag.add(id); else tag.delete(id); }
    return { ...log, [datum]: Array.from(tag) };
  });
  const namen = ids.map(id => alle.find(r => r.id === id)?.label ?? id);
  return `${erledigt ? 'Abgehakt' : 'Zurückgenommen'}: ${namen.join(', ')} (${datum === localDay() ? 'heute' : datum}).`;
}

/**
 * Gesundheits-Werkzeuge schreiben nur wie die Oberfläche (09.10., Merge gesundheit-module): Einwilligung (a) der Person zuerst
 * (`gesundheitVerarbeitungErlaubt`, Art. 9), dann das Modul der Person (`moduleFuer`, lib/gesundheit/module-server.ts — ein
 * ausgeschaltetes Modul nimmt nichts an; nie schaltet ein ZOE-Eintrag ein Modul über den Altbestand „von selbst“ ein).
 */
async function gesundheitsModulSperre(person: string, modul: 'haut' | 'serie'): Promise<string | null> {
  const { gesundheitVerarbeitungErlaubt } = await import('@/lib/datenschutz/gesundheit-einwilligung');
  if (!(await gesundheitVerarbeitungErlaubt(person))) return 'Abgelehnt: Für Gesundheitsdaten fehlt die Einwilligung dieser Person (System › Datenschutz). Nichts gespeichert.';
  const [{ moduleFuer }, { modulAusText }] = await Promise.all([import('@/lib/gesundheit/module-server'), import('@/lib/gesundheit/module')]);
  if (!(await moduleFuer(person))[modul]) return `Abgelehnt: ${modulAusText(modul)} Nichts gespeichert.`;
  return null;
}

async function hautEintrag(input: Record<string, unknown>, _o: string, person?: string): Promise<string> {
  const { saeubereHaut, hautTrend } = await import('@/lib/gesundheit/eintraege');
  const { speicherFuer } = await import('./raum');
  if (!person) return KEINE_PERSON;
  const sperreHaut = await gesundheitsModulSperre(person, 'haut');
  if (sperreHaut) return sperreHaut;
  const e = saeubereHaut(input, new Date().toISOString());
  if (!e) return 'Fehlgeschlagen: juckreiz (0–10) fehlt.';
  const datum = HEUTE_ODER(input.datum);
  const log = await updateJson<Record<string, typeof e>>(speicherFuer('haut', person), current => ({ ...(current ?? {}), [datum]: e }));
  const t = hautTrend(log, localDay());
  const trend = t.richtung === 'besser' ? ' Die Woche ist besser als die davor.' : t.richtung === 'schlechter' ? ' Die Woche ist schlechter als die davor.' : '';
  return `Haut notiert: Juckreiz ${e.juckreiz}/10${e.schub ? ', Schub' : ''}${e.ausloeser ? `, Auslöser ${e.ausloeser}` : ''}.${trend}`;
}

/** „Setz Tomaten und 500 g Lachs auf die Liste“ — Einkaufsliste des Haushalts (26.09.). */
async function einkaufSetzen(input: Record<string, unknown>, _o: string, person?: string): Promise<string> {
  if (!person) return KEINE_PERSON;
  const { personImHaushaltDesInhabers } = await import('@/lib/zugang/haushalt-inhaber');
  if (!(await personImHaushaltDesInhabers(person))) return 'Fehlgeschlagen: die Einkaufsliste gehört zum Haushalt des Inhabers.';
  const roh = Array.isArray(input.posten) ? input.posten : [input.posten];
  const posten = roh.map(x => String(x ?? '').trim()).filter(Boolean).slice(0, 20);
  if (!posten.length) return 'Fehlgeschlagen: keine Posten genannt.';
  const { sauberDatei, wendeAn, postenParsen, postenAus, aufDerListe } = await import('@/lib/ernaehrung/modell');
  const gesetzt: string[] = [], schonDa: string[] = [];
  await updateJson('ernaehrung', cur => {
    const f = sauberDatei(cur as Parameters<typeof sauberDatei>[0]);
    const ops: EinkaufOp[] = [];
    for (const t of posten) {
      const { text, menge } = postenParsen(t);
      if (aufDerListe(text, f.einkauf)) { schonDa.push(text); continue; }
      ops.push({ liste: 'einkauf', op: 'upsert', eintrag: { ...postenAus(text, f.lebensmittel, { menge, quelle: 'zoe' }) } });
      gesetzt.push(menge ? `${menge} ${text}` : text);
    }
    return ops.length ? wendeAn(f, ops, person).datei : f;
  });
  return `${gesetzt.length ? `Auf der Einkaufsliste: ${gesetzt.join(', ')}.` : ''}${schonDa.length ? ` Stand schon drauf: ${schonDa.join(', ')}.` : ''}`.trim() || 'Nichts zu tun.';
}

async function journalEintrag(input: Record<string, unknown>, _o: string, person?: string): Promise<string> {
  if (!person) return KEINE_PERSON;
  const { speicherFuer } = await import('./raum');
  const datum = HEUTE_ODER(input.datum);
  const t = (v: unknown, n = 800) => { const s = String(v ?? '').trim().slice(0, n); return s || undefined; };
  const z = (v: unknown) => { const n = Number(v); return isFinite(n) && n >= 1 && n <= 5 ? Math.round(n) : undefined; };
  const neu = {
    ...(t(input.gut) ? { gut: t(input.gut) } : {}),
    ...(t(input.dankbar) ? { dankbar: t(input.dankbar) } : {}),
    ...(t(input.hart) ? { hart: t(input.hart) } : {}),
    ...(t(input.text, 2000) ? { text: t(input.text, 2000) } : {}),
    ...(z(input.stimmung) ? { mood: z(input.stimmung) } : {}),
    ...(z(input.energie) ? { energy: z(input.energie) } : {}),
    ...(z(input.stress) ? { stress: z(input.stress) } : {}),
  };
  if (!Object.keys(neu).length) return 'Fehlgeschlagen: nichts zum Eintragen (gut, dankbar, hart, text, stimmung, energie, stress).';
  await updateJson<Record<string, Record<string, unknown>>>(speicherFuer('journal', person), current => {
    const log = current ?? {};
    return { ...log, [datum]: { ...(log[datum] ?? {}), ...neu, at: new Date().toISOString() } };
  });
  return `Journal ${datum === localDay() ? 'heute' : datum}: ${Object.keys(neu).join(', ')} festgehalten.`;
}

async function streakEintrag(input: Record<string, unknown>, _o: string, person?: string): Promise<string> {
  const { saeubereStreak, streakStand } = await import('@/lib/gesundheit/eintraege');
  const { speicherFuer } = await import('./raum');
  if (!person) return KEINE_PERSON;
  const sperreSerie = await gesundheitsModulSperre(person, 'serie');
  if (sperreSerie) return sperreSerie;
  const e = saeubereStreak({ ...input, craving: input.verlangen ?? input.craving }, new Date().toISOString());
  if (!e) return 'Fehlgeschlagen: sauber (true/false) fehlt.';
  const datum = HEUTE_ODER(input.datum);
  const log = await updateJson<Record<string, typeof e>>(speicherFuer('streak', person), current => ({ ...(current ?? {}), [datum]: e }));
  const st = streakStand(log, localDay());
  if (!e.sauber) return 'Notiert. Ein Datum, kein Urteil — morgen zählt wieder von vorn.';
  return `Sauber seit ${st.sauberTage} Tag${st.sauberTage === 1 ? '' : 'en'}${typeof e.craving === 'number' ? `, Verlangen ${e.craving}/10` : ''}.`;
}

// 24.09.: Kunden leben als Mandate im CRM (lib/crm) — eine Wahrheit statt zwei.
// 28.09. (Integritätsprüfung): kein Teilstring-Treffer mehr („Beispiel“ traf „Beispiel AG“ UND „Beispielbau“ und
// schrieb in das erste) — nur ein exakter Name (ohne Rechtsform, `mandatTreffer`) oder die Kennung; sonst Rückfrage.
// Geschrieben wird über den normalen Mandat-Weg (`wendeCrmAn`: Säuberung, Grenzen, Stand-Regeln).
async function setzeKunde(input: Record<string, unknown>, _o?: string, person?: string): Promise<string> {
  if (!person) return KEINE_PERSON;
  const name = String(input.name ?? '').trim().slice(0, 120);
  const mandatId = String(input.mandat_id ?? '').trim().slice(0, 80);
  if (!name && !mandatId) return 'Fehlgeschlagen: name fehlt.';
  const status = ({ aktiv: 'aktiv', gespraech: 'verhandlung', ruht: 'pausiert' } as const)[String(input.status) as 'aktiv' | 'gespraech' | 'ruht'];
  const cashflow = isFinite(Number(input.cashflow)) && Number(input.cashflow) > 0 ? Math.round(Number(input.cashflow)) : undefined;
  const schritt = input.naechsterSchritt ? String(input.naechsterSchritt).slice(0, 300) : undefined;
  const { aendereCrm, wendeCrmAn } = await import('@/lib/crm/speicher');
  const { mandatTreffer } = await import('@/lib/crm/mandat-treffer');
  let aktion = '';
  let fehler = '';
  const jetzt = new Date().toISOString();
  await aendereCrm(b => {
    const t = mandatTreffer(b.mandate, { name, id: mandatId || undefined });
    if (t.art === 'mehrdeutig') {
      fehler = `Nicht eindeutig — meinst du ${t.kandidaten.map(m => `„${m.kunde}“ (${m.titel}) [${m.id}]`).join(' oder ')}? Bitte mit mandat_id oder dem genauen Namen erneut. Nichts geändert.`;
      return b;
    }
    if (t.art === 'aehnlich') {
      fehler = `Kein Mandat heißt genau „${name}“. Ähnlich: ${t.kandidaten.map(m => `„${m.kunde}“ [${m.id}]`).join(', ')}. Bitte den genauen Namen oder die mandat_id nennen — oder ausdrücklich neu anlegen (neu: true). Nichts geändert.`;
      if (input.neu !== true) return b;
    }
    if (t.art === 'treffer') {
      const m = t.mandat;
      const felder: Record<string, unknown> = {
        ...(status ? { status } : {}),
        ...(cashflow != null ? { honorar: { ...m.honorar, betrag: cashflow, basis: 'monat' as const } } : {}),
        ...(schritt ? { offen: [...m.offen, `Nächster Schritt: ${schritt}`] } : {}),
      };
      if (!Object.keys(felder).length) { aktion = `${m.kunde}: nichts zu ändern`; return b; }
      const r = wendeCrmAn(b, [{ liste: 'mandate', op: 'teil', id: m.id, felder }], jetzt, person);
      if (r.grenze.length || r.sperren.length || r.konflikte.length || r.abgelehnt?.length || !r.angewandt) { fehler = [...r.grenze, ...r.fehler, ...(r.abgelehnt ?? [])].join(' · ') || 'Mandat nicht geändert.'; return b; }
      aktion = `${m.kunde} aktualisiert${status ? ` (${status})` : ''}${cashflow != null ? `, ${eurW(cashflow)}/Monat` : ''}${schritt ? `, nächster Schritt: ${schritt}` : ''}`;
      return r.bestand;
    }
    if (!name) { fehler = `Kein Mandat mit der Kennung ${mandatId}.`; return b; }
    fehler = '';
    const eintrag = {
      id: neueKennung('m'), kunde: name, kontaktIds: [], titel: 'Mandat', art: 'retainer', gesellschaft: 'offen', status: status ?? 'verhandlung', vertragUnterschrieben: false,
      verlaengerung: 'offen', honorar: { betrag: cashflow ?? 0, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [],
      health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: schritt ? [`Nächster Schritt: ${schritt}`] : [], geaendert: jetzt,
    };
    const r = wendeCrmAn(b, [{ liste: 'mandate', op: 'upsert', eintrag }], jetzt, person);
    if (r.grenze.length || r.sperren.length || r.konflikte.length || r.abgelehnt?.length || !r.angewandt) { fehler = [...r.grenze, ...r.fehler, ...(r.abgelehnt ?? [])].join(' · ') || 'Mandat nicht angelegt.'; return b; }
    aktion = `${name} als Mandat angelegt (${status ?? 'verhandlung'})`;
    return r.bestand;
  });
  if (fehler) return `Nicht ausgeführt: ${fehler}`;
  return `Erfasst: ${aktion}. Sichtbar unter Produkte & Mandate (links in der Leiste).`;
}

/**
 * Postfach lesen — Vorgabe: „Wenn ich ihm sage, hol dir die Infos, soll er den Agenten wirklich angreifen und die Information
 * rausholen.“ Seit 06.10. (Inbox 2) aus dem EINEN Strom der eigenen Postfächer der Person (Gmail + IMAP, lib/inbox/zoe-sicht.ts) — nie
 * die Post einer anderen Person, nie ohne Person. Nur Kopf und Ausschnitt (KI-Grundsatz: Volltext nur beim Entwurf auf Klick).
 * Read-only — es wird nie geantwortet, verschoben oder gelöscht.
 */
async function liesPostfach(input: Record<string, unknown>, _origin: string, person?: string): Promise<string> {
  if (!person) return KEINE_PERSON;
  const suche = String(input.suche ?? '').trim().slice(0, 60);
  const anzahl = Math.min(20, Math.max(1, Number(input.anzahl) || (suche ? 5 : 20)));
  try {
    const { postfachFuerZoe } = await import('@/lib/inbox/zoe-sicht');
    return (await postfachFuerZoe(person, suche, anzahl)).text;
  } catch (err) {
    return `Postfach nicht lesbar: ${err instanceof Error ? err.message.slice(0, 160) : 'Fehler'}`;
  }
}

/**
 * Tagesform eintragen — damit ZOE Werte, die er gerade gelesen oder von
 * der Person gehört hat, direkt ablegen kann, statt sie auf /os/gesundheit zu
 * schicken. Nur was übergeben wurde, wird geschrieben.
 */
async function setzeVitalwerte(input: Record<string, unknown>, origin: string, person?: string): Promise<string> {
  if (!person) return KEINE_PERSON;
  const zahl = (v: unknown, min: number, max: number) => {
    const n = Number(v);
    return isFinite(n) && n >= min && n <= max ? n : undefined;
  };
  const vitals = {
    rec: zahl(input.recovery, 0, 100),
    sleep: zahl(input.schlaf, 0, 24),
    hrv: zahl(input.hrv, 0, 300),
    rhr: zahl(input.ruhepuls, 20, 200),
    ...(input.notiz ? { note: String(input.notiz).slice(0, 400) } : {}),
  };
  const gesetzt = Object.entries(vitals).filter(([, v]) => v !== undefined);
  if (!gesetzt.length) return 'Fehlgeschlagen: keine gültigen Werte übergeben (recovery 0–100, schlaf 0–24, hrv, ruhepuls).';

  const datum = /^\d{4}-\d{2}-\d{2}$/.test(String(input.datum ?? '')) ? String(input.datum) : localDay();
  try {
    const r = await fetch(`${origin}/api/state/vitals`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY ?? '', 'x-make-person': person },
      body: JSON.stringify({ date: datum, vitals }),
      signal: AbortSignal.timeout(30_000),
    });
    const d = await r.json();
    if (!d.ok) return `Nicht gespeichert: ${String(d.error ?? '').slice(0, 200)}`;
    const text = [
      vitals.rec != null ? `Recovery ${vitals.rec}%` : null,
      vitals.sleep != null ? `Schlaf ${vitals.sleep} h` : null,
      vitals.hrv != null ? `HRV ${vitals.hrv}` : null,
      vitals.rhr != null ? `Ruhepuls ${vitals.rhr}` : null,
    ].filter(Boolean).join(' · ');
    return `Eingetragen für ${datum}: ${text}. Steht jetzt im Gesundheits-Cockpit und in jeder Tagesform-Rechnung.`;
  } catch (err) {
    return `Nicht gespeichert: ${err instanceof Error ? err.message.slice(0, 160) : 'Fehler'}`;
  }
}

// Werkzeug-Register: Name → Gruppe (für die ⚙-Chips) + Ausführung.
/** Jahresziele und Startmonat setzen — die Grundlage jeder Controlling-Zahl. */
async function setzeZiele(input: Record<string, unknown>): Promise<string> {
  const zielUmsatz = isFinite(Number(input.zielUmsatz)) ? Math.max(0, Math.round(Number(input.zielUmsatz))) : undefined;
  const zielGewinn = isFinite(Number(input.zielGewinn)) ? Math.max(0, Math.round(Number(input.zielGewinn))) : undefined;
  const cash = isFinite(Number(input.cash)) ? Math.round(Number(input.cash)) : undefined;
  const MONATE = ['januar', 'februar', 'märz', 'maerz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'];
  let startMonat: number | undefined;
  if (input.startMonat != null) {
    const roh = String(input.startMonat).toLowerCase().trim();
    const alsZahl = Number(roh);
    if (isFinite(alsZahl) && alsZahl >= 0 && alsZahl <= 11) startMonat = Math.round(alsZahl);
    else {
      const i = MONATE.findIndex(m => roh.startsWith(m.slice(0, 3)));
      // „maerz" liegt doppelt in der Liste — Index korrigieren.
      if (i >= 0) startMonat = i > 3 ? i - 1 : i;
    }
  }
  if (zielUmsatz == null && zielGewinn == null && cash == null && startMonat == null) {
    return 'Fehlgeschlagen: nichts zu setzen (zielUmsatz, zielGewinn, cash oder startMonat angeben).';
  }
  const teile: string[] = [];
  await updateJson<{ jahr: number; zielUmsatz: number; zielGewinn: number; cash: number; months: unknown[]; startMonat?: number }>('finance', current => {
    const f = current ?? { jahr: new Date().getFullYear(), zielUmsatz: 0, zielGewinn: 0, cash: 0, months: [] };
    if (zielUmsatz != null) { f.zielUmsatz = zielUmsatz; teile.push(`Ziel-Umsatz ${eurW(zielUmsatz)}`); }
    if (zielGewinn != null) { f.zielGewinn = zielGewinn; teile.push(`Ziel-Gewinn ${eurW(zielGewinn)}`); }
    if (cash != null) { f.cash = cash; teile.push(`Cash ${eurW(cash)}`); }
    if (startMonat != null) { f.startMonat = startMonat; teile.push(`Start ab ${['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'][startMonat]}`); }
    return f;
  });
  return `Erfasst: ${teile.join(' · ')}. Sichtbar im Controlling — Fortschritt und nötige Run-Rate rechnen sofort neu.`;
}

/**
 * Welche Firma ein Planposten aus ZOE trägt (09.10., „neutral-rest-2“): eine Gesellschaft aus lib/einheiten.ts, eine des
 * Gesellschafts-Registers (`g-…`) — oder ein Altwert, den der Liquiplan der Instanz schon trägt (eine frühere feste Zuordnung bleibt
 * so zuordenbar, wie sie gespeichert ist; eine feste Firma steht nicht mehr im Code). Sonst keine Firma (= Business wie bisher). Rein.
 */
export function planpostenFirma(angabe: unknown, vorhanden: readonly { firmaId?: string }[]): string | undefined {
  if (typeof angabe !== 'string' || !angabe) return undefined;
  if (istGesellschaftId(angabe)) return angabe;
  return /^[a-z][a-z0-9]{1,23}$/.test(angabe) && vorhanden.some(p => p.firmaId === angabe) ? angabe : undefined;
}

/** Wiederkehrende Kosten oder Einnahmen für die Liquiditäts-Planung. */
async function erfassePlanposten(input: Record<string, unknown>): Promise<string> {
  if (istPrivatAngabe(input.firma) || String(input.kategorie ?? '') === 'privat') return PRIVAT_HINWEIS;
  const titel = String(input.titel ?? '').trim().slice(0, 160);
  const betrag = Math.round(Number(input.betrag));
  if (!titel || !isFinite(betrag) || betrag === 0) return 'Fehlgeschlagen: titel + betrag nötig (negativ = Ausgabe).';
  const RHY = ['einmalig', 'monatlich', 'quartal', 'jaehrlich'];
  const rhythmus = RHY.includes(String(input.rhythmus)) ? String(input.rhythmus) : 'monatlich';
  const ab = /^\d{4}-\d{2}-\d{2}$/.test(String(input.ab ?? '')) ? String(input.ab) : localDay();
  const kategorie = input.kategorie ? String(input.kategorie).slice(0, 40) : undefined;
  const sicher = input.sicher !== false;

  let aktion = '';
  await updateJson<{ posten: { id: string; titel: string; betrag: number; rhythmus: string; ab: string; sicher: boolean; kategorie?: string; firmaId?: string }[] }>('liquiplan', current => {
    const f = current ?? { posten: [] };
    f.posten = f.posten ?? [];
    const firmaId = planpostenFirma(input.firma, f.posten);
    const idx = f.posten.findIndex(p => p.titel.toLowerCase() === titel.toLowerCase());
    if (idx >= 0) {
      f.posten[idx] = { ...f.posten[idx], betrag, rhythmus, ab, sicher, ...(kategorie ? { kategorie } : {}), ...(firmaId ? { firmaId } : {}) };
      aktion = `${titel} aktualisiert`;
    } else {
      f.posten.push({ id: neueKennung('lp'), titel, betrag, rhythmus, ab, sicher, ...(kategorie ? { kategorie } : {}), ...(firmaId ? { firmaId } : {}) });
      aktion = `${titel} angelegt`;
    }
    return f;
  });
  const wie = rhythmus === 'einmalig' ? 'einmalig' : rhythmus === 'monatlich' ? 'monatlich' : rhythmus === 'quartal' ? 'je Quartal' : 'jährlich';
  return `Erfasst: ${aktion} — ${betrag < 0 ? '−' : '+'}${eurW(Math.abs(betrag))} ${wie} ab ${ab}. Rechnet sofort in der Liquiditäts-Planung mit.`;
}

/**
 * Aufgabe anlegen — seit 07.09. ein echtes Werkzeug statt eines Knopfes.
 *
 * Vorher schlug ZOE eine Aufgabe vor und die Person musste sie per Klick
 * bestätigen. Festlegung vom 06.09.: Aufgaben anlegen ist freie Hand.
 * Die Route hat eine eigene Dublettensperre — dieselbe Aufgabe zweimal
 * anzulegen ist also auch dann ausgeschlossen, wenn zwei Wege sie erzeugen.
 */
/** Meilenstein aus einer Angabe (Kennung oder Teil des Titels, offene zuerst) — sonst undefined. */
async function meilensteinAus(v: unknown, person?: string): Promise<string | undefined> {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (!s) return undefined;
  // Nur, was die Person sehen darf (08.10.: kein Meilenstein an einem nicht geteilten eigenen Ziel einer anderen Person).
  const l = await meilensteineSichtbarFuer((await loadJson<{ meilensteine?: { id: string; titel: string; erledigt?: boolean; zielId?: string; abgeleitetVon?: string }[] }>('meilensteine'))?.meilensteine, person ?? null);
  const m = l.find(x => x.id === v) ?? l.filter(x => !x.erledigt).find(x => x.titel.toLowerCase().includes(s)) ?? l.find(x => x.titel.toLowerCase().includes(s));
  return m?.id;
}

async function erstelleAufgabe(input: Record<string, unknown>, origin: string, person?: string): Promise<string> {
  const title = String(input.title ?? '').trim().slice(0, 300);
  if (!title) return 'Fehlgeschlagen: title fehlt.';
  const PRIOS = ['low', 'medium', 'high', 'critical'];
  // Für wen: eine Person des Haushalts (Speichername aus den Konten) oder „both“ — nie eine feste Liste im Code (09.10.).
  // Unbekannt → keine Angabe (die anlegende Person), wie bisher.
  const { haushaltsSpeicher } = await import('@/lib/aufgaben/sicht');
  const WER = [...(await haushaltsSpeicher().catch(() => [] as string[])), 'both'];
  const body = {
    title,
    description: input.why ? String(input.why).slice(0, 800) : undefined,
    priority: PRIOS.includes(String(input.priority)) ? String(input.priority) : 'medium',
    owner: WER.includes(String(input.wer)) ? String(input.wer) : undefined,
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(String(input.faellig ?? '')) ? String(input.faellig) : undefined,
    // Space (26.09.): ZOE kennt den aktiven Space und legt die Aufgabe dort ab.
    space: input.space === 'privat' || input.space === 'business' ? String(input.space) : undefined,
    // Einheit (27.09.): Business — Kerneinheit oder eigene; die Route säubert und verwirft sie bei Privat. Seit 05.10. auch bei Privat eine
    // Privat-Einheit („Selbstständigkeit“) — die Aufgabe landet dann in deren Space unter Privat.
    einheit: typeof input.einheit === 'string' && input.einheit.trim() && (input.space !== 'privat' || gehoertZuPrivat(finanzOrtAus(input.einheit))) ? input.einheit.trim().slice(0, 40) : undefined,
    // Meilenstein (30.09.): Teil des Namens → die Aufgabe landet in seiner Liste (Space/Projekt/Liste vom Meilenstein).
    meilensteinId: await meilensteinAus(input.meilenstein, person),
  };
  if (input.meilenstein !== undefined && input.meilenstein !== '' && !body.meilensteinId) return `Fehlgeschlagen: kein Meilenstein passt zu „${String(input.meilenstein).slice(0, 80)}“.`;
  // Unteraufgabe auf jeder Ebene (01.10.): `unter` = Titel/Pfad/Kennung der übergeordneten Aufgabe — gesucht nur in dem, was die
  // Person sehen darf („nur ich“). Den Ort erbt sie von dort; Tiefe/Kreis prüft der Schreibweg (bis AUFGABEN_EBENEN_MAX).
  let parentId: string | undefined;
  if (typeof input.unter === 'string' && input.unter.trim()) {
    const e = elternAusText((await ladeAufgabenSicht(person ?? null)).tasks, input.unter.slice(0, 300));
    if ('fehler' in e) return `Aufgabe nicht angelegt: ${e.fehler}`;
    parentId = e.id;
  }
  try {
    const r = await fetch(`${origin}/api/tasks/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY ?? '', ...(person ? { 'x-make-person': person } : {}) },
      body: JSON.stringify({ ...body, ...(parentId ? { parentId } : {}) }),
      signal: AbortSignal.timeout(30_000),
    });
    const d = await r.json();
    if (!d.ok) return `Aufgabe nicht angelegt: ${String(d.error ?? '').slice(0, 160)}`;
    if (d.duplikat) return `Gab es schon: „${title}“ steht bereits offen im Board — keine zweite angelegt.`;
    // Rundgang 09.10. („Agenten live“): deutsch angeführt, Priorität und Datum in Worten — der Satz steht als Ergebnis unter Freigaben.
    return `Angelegt: „${title}“${parentId ? ' als Unteraufgabe' : ''}${body.priority !== 'medium' ? ` (${PRIO_NAME[String(body.priority)] ?? body.priority})` : ''}${body.dueDate ? `, fällig ${tagDe(body.dueDate)}` : ''}${body.einheit ? ` · ${body.einheit}` : ''}${body.meilensteinId ? ' · am Meilenstein' : ''}. Steht im Board.`;
  } catch (err) {
    return `Aufgabe nicht angelegt: ${err instanceof Error ? err.message.slice(0, 140) : 'Fehler'}`;
  }
}

/**
 * Mehrere Agenten auf einmal losschicken — Bedingung vom 06.09.
 *
 * Der Unterschied zu run_agent: run_agent läuft IN dem Aufruf, auf den die Person
 * wartet (drei Runden, vier Läufe, dann ist das Zeitfenster zu). Das hier legt
 * die Aufträge in die Warteschlange; der Arbeiter nimmt sie sich und lässt sie
 * nebeneinander laufen, so viele wie die Maschine trägt. Die Person bekommt sofort
 * eine Antwort und sieht die Ergebnisse einlaufen.
 */
async function starteAuftraege(input: Record<string, unknown>, origin: string, person?: string): Promise<string> {
  const roh = Array.isArray(input.auftraege) ? input.auftraege : [];
  const auftraege = roh
    .map(x => (x && typeof x === 'object' ? x as Record<string, unknown> : null))
    .filter(Boolean)
    .map(x => ({
      art: 'agent' as const,
      name: String(x!.agent ?? '').trim(),
      auftrag: x!.auftrag ? String(x!.auftrag).slice(0, 4000) : undefined,
      anlass: input.anlass ? String(input.anlass).slice(0, 200) : undefined,
    }))
    .filter(a => a.name)
    .slice(0, 20);
  if (!auftraege.length) return 'Fehlgeschlagen: keine Agenten angegeben.';
  // Härtetest 09.10.: nur Fach-Agenten — Systemläufe des Takts (Morgenlauf, Löschfristen, Agenten-Lauf `faden` …) startet kein Gespräch;
  // sie liefen sonst auf Zuruf (oder auf einen eingeschleusten Satz) mit Modellkosten bzw. Wirkung außerhalb ihres Takts.
  const { SYSTEM_LAEUFE } = await import('./agenten');
  const system = auftraege.filter(a => (SYSTEM_LAEUFE as readonly string[]).includes(a.name));
  if (system.length) return `Nicht eingereiht: ${system.map(a => a.name).join(', ')} ist kein Fach-Agent (läuft nur im Takt).`;
  // Agenten, die die Kartei lesen, nur für Personen im Haushalt des Inhabers (28.09., K1).
  if (auftraege.some(a => (CRM_AGENTEN as readonly string[]).includes(a.name)) && !(await crmWerkzeugErlaubt(person))) return KEIN_CRM;

  try {
    const r = await fetch(`${origin}/api/zoe/auftraege`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY ?? '', ...(person ? { 'x-make-person': person } : {}) },
      body: JSON.stringify({ auftraege }),
      signal: AbortSignal.timeout(20_000),
    });
    const d = await r.json();
    if (!d.ok) return `Aufträge nicht eingereiht: ${String(d.error ?? '').slice(0, 160)}`;
    const namen = auftraege.map(a => a.name).join(', ');
    return `${d.angelegt} Aufträge laufen jetzt im Hintergrund (${namen})`
      + `${d.schonDa ? `, ${d.schonDa} liefen schon` : ''}. `
      + 'Sag der Person, dass sie parallel laufen und die Ergebnisse unter /os/stapel einlaufen — sie muss nicht warten.';
  } catch (err) {
    return `Warteschlange nicht erreichbar: ${err instanceof Error ? err.message.slice(0, 140) : 'Fehler'}`;
  }
}

/**
 * Sich etwas merken. Entscheidung vom 06.09.: sofort, nicht auf
 * Nachfrage — dafür sichtbar in einer Liste, aus der die Person rauswerfen kann.
 */
async function faktMerken(input: Record<string, unknown>, _origin: string, person?: string): Promise<string> {
  const ARTEN = ['person', 'firma', 'vorliebe', 'entscheidung', 'termin', 'zahl', 'sonstiges'];
  const thema = String(input.thema ?? '').trim().slice(0, 120);
  const satz = String(input.satz ?? '').trim().slice(0, 500);
  if (!thema || !satz) return 'Fehlgeschlagen: thema und satz nötig.';
  if (!person) return KEINE_PERSON;
  const { merke } = await import('./gedaechtnis');
  const GEMEINSAM = ['gemeinsam', 'beide', 'both'];
  const { neu } = await merke({
    art: (ARTEN.includes(String(input.art)) ? String(input.art) : 'sonstiges') as FaktArt,
    raum: GEMEINSAM.includes(String(input.raum ?? '')) ? 'gemeinsam' : person,
    thema, satz,
    woher: input.woher ? String(input.woher).slice(0, 200) : undefined,
    bis: /^\d{4}-\d{2}-\d{2}$/.test(String(input.bis ?? '')) ? String(input.bis) : undefined,
  });
  return neu
    ? `Gemerkt: ${thema} — ${satz}`
    : `Wusste ich schon: ${thema} — ${satz} (nicht doppelt abgelegt).`;
}

/** Business-Index lesen (25.09.) — nur für den Haushalt des Inhabers, wie das Cockpit. */
async function businessIndex(input: Record<string, unknown>, _origin: string, person?: string): Promise<string> {
  const { personImHaushaltDesInhabers } = await import('@/lib/zugang/haushalt-inhaber');
  if (!person || !(await personImHaushaltDesInhabers(person))) return 'Kein Zugang: Der Business-Index gehört zum Haushalt des Inhabers.';
  const { businessText } = await import('@/lib/business/fuer-chef');
  const { scopeAus } = await import('@/lib/business/register');
  // Seit 05.10. gehört die Selbstständigkeit zu Privat — der Business-Index führt sie nicht (ehrlich sagen statt still „Gesamt“).

  if (istGesellschaft(input.sicht) && gehoertZuPrivat(input.sicht)) return `${GEHOERT_ZU_PRIVAT(input.sicht)} Der Business-Index rechnet nur die Gesellschaften im Business; ihre Zahlen stehen unter Finanzen › Privat › Planung.`;
  const sicht = scopeAus(input.sicht);
  return businessText(sicht, typeof input.kennzahl === 'string' && input.kennzahl ? input.kennzahl : undefined);
}

/**
 * Gesellschafts-Register lesen (04.10.): eigene Gesellschaften mit Status, Rechtsform, Kapital, Anteilen (Prozent aus den
 * Nennbeträgen), Vorgänger und laufenden Verträgen samt Stichtagen — nur Haushalt des Inhabers, nur lesen. Notizen und
 * Klausel-Texte gehen bewusst nicht mit (Cap-Table ist sensibel; ZOE nennt Zahlen, wie sie stehen).
 */
async function gesellschaftenLesen(input: Record<string, unknown>, _origin: string, person?: string): Promise<string> {
  const { personImHaushaltDesInhabers } = await import('@/lib/zugang/haushalt-inhaber');
  if (!person || !(await personImHaushaltDesInhabers(person))) return 'Kein Zugang: Das Gesellschafts-Register gehört zum Haushalt des Inhabers.';
  const { haushaltFuer } = await import('@/lib/finanzen/haushalt/zugriff');
  const h = await haushaltFuer(person);
  if (!h) return 'Kein Zugang: Ohne Haushalt am Konto gibt es kein Register.';
  const { ladeRegister } = await import('@/lib/gesellschaften/server');
  const m = await import('@/lib/gesellschaften/modell');
  const alle = m.alleGesellschaften(await ladeRegister(h.haushalt));
  const frage = typeof input.name === 'string' ? input.name.toLocaleLowerCase('de-DE').trim() : '';
  const liste = frage ? alle.filter(g => m.anzeigeName(g).toLocaleLowerCase('de-DE').includes(frage) || (g.firmierung ?? '').toLocaleLowerCase('de-DE').includes(frage)) : alle;
  if (!liste.length) return `Keine Gesellschaft passt zu „${frage}“. Im Register: ${alle.map(m.anzeigeName).join(', ')}.`;
  const name = (b: { art: string; id: string }) => (b.art === 'gesellschaft' ? m.anzeigeName(alle.find(x => x.id === b.id) ?? { id: b.id as never }) : b.art === 'person' ? `Person ${b.id}` : b.art === 'firma' ? `CRM-Firma ${b.id}` : `CRM-Kontakt ${b.id}`);
  return liste.map(g => {
    const a = m.anteile(g);
    const z = [
      `${m.anzeigeName(g)} — ${m.statusLabel(g.status)}${g.rechtsform ? ` · ${m.rechtsformLabel(g.rechtsform)}` : ''}${g.sitz || g.ort ? ` · Sitz ${g.sitz || g.ort}` : ''}${g.register ? ` · ${g.register}` : ''}`,
      g.stammkapitalCent !== undefined ? `  Stammkapital ${m.euroText(g.stammkapitalCent)}${g.eingezahltCent !== undefined ? `, eingezahlt ${m.euroText(g.eingezahltCent)}` : ''}` : '',
      a.zeilen.length ? `  Gesellschafter: ${a.zeilen.map(x => `${name(x.g.wer)} ${x.prozent.toLocaleString('de-DE')} % (${m.euroText(x.g.nennbetragCent)})`).join('; ')}${a.hinweis ? ` — ${a.hinweis}` : ''}` : '',
      g.vorgaengerId ? `  Hervorgegangen aus: ${m.vorgaengerKette(g.id, alle).map(id => m.anzeigeName(alle.find(x => x.id === id) ?? { id })).join(' ← ')}` : '',
      ...m.haelt(g.id, alle).map(x => `  Hält ${x.prozent.toLocaleString('de-DE')} % an ${m.anzeigeName(alle.find(y => y.id === x.an) ?? { id: x.an })}`),
      ...m.aktiveEintraege(g.vertraege).filter(v => v.status !== 'beendet').map(v => `  Vertrag: ${v.titel} (${m.vertragArtLabel(v.art)}, ${m.vertragStatusLabel(v.status)})${v.ende ? ` bis ${v.ende}` : ''}${v.kuendigenBis ? `, kündigen bis ${v.kuendigenBis}` : ''}`),
      m.registerLuecken(g).length ? `  Noch offen: ${m.registerLuecken(g).join(', ')}` : '',
    ].filter(Boolean);
    return z.join('\n');
  }).join('\n\n') + '\n(Quelle: Register /os/unternehmen — Hinweis, keine Rechtsberatung.)';
}

/** Monatsabschluss eintragen (25.09.) — läuft nur nach Freigabe (Register: freigabe). */
async function monatsabschlussErfassen(input: Record<string, unknown>, _origin: string, person?: string): Promise<string> {
  const { personImHaushaltDesInhabers } = await import('@/lib/zugang/haushalt-inhaber');
  if (!person || !(await personImHaushaltDesInhabers(person))) return 'Kein Zugang: Der Business-Index gehört zum Haushalt des Inhabers.';
  const { speichereAbschluss } = await import('@/lib/business/speicher');
  // Nur genannte Zahlen weitergeben — fehlende Felder bleiben, wie sie sind.
  const roh = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  const r = await speichereAbschluss(roh, person);
  if (!r.ok) return `Nicht eingetragen: ${r.fehler}`;
  return `Monatsabschluss ${finanzOrtName(r.eintrag.firma)} ${r.eintrag.monat} gespeichert — der Business-Index rechnet damit (/os/finanzen?s=business).`;
}

/** Gesundheits-Index lesen (26.09.): die eigene Person — oder eine, die ihre Gesundheit teilt. */
async function gesundheitsIndex(input: Record<string, unknown>, _origin: string, person?: string): Promise<string> {
  if (!person) return KEINE_PERSON;
  const fuer = typeof input.person === 'string' && /^[a-z0-9-]{1,40}$/.test(input.person) ? input.person : person;
  // Art. 9 (05.10.): an die KI nur mit Einwilligung — eigene Werte mit (b); fremde nur, wenn die Person (b) UND (c)
  // „mit dem Partner teilen, auch an dessen ZOE“ erklärt hat und mit dir teilt. Vorher reichte „teilt“ allein.
  const { gesundheitFuerZoe } = await import('@/lib/datenschutz/gesundheit-einwilligung');
  if (!(await gesundheitFuerZoe(fuer, person))) {
    return fuer === person
      ? 'Kein Zugang: Gesundheitsdaten gehen nur mit deiner Einwilligung „An die KI geben“ an ZOE (System › Datenschutz).'
      : 'Kein Zugang: Diese Person gibt ihre Gesundheitsdaten nicht an deine ZOE frei.';
  }
  const { gesundheitsIndexFuer } = await import('@/lib/gesundheit/speicher');
  const { schwellenText } = await import('@/lib/business/text');
  const pi = await gesundheitsIndexFuer(fuer);
  const alle = pi.saeulen.flatMap(s => s.kennzahlen);
  const AMPEL = { gruen: 'grün', gelb: 'gelb', rot: 'rot', grau: 'fehlt' } as const;
  if (typeof input.kennzahl === 'string' && input.kennzahl) {
    const k = alle.find(x => x.id === input.kennzahl);
    if (!k) return `Unbekannte Kennzahl „${input.kennzahl}“. Es gibt: ${alle.map(x => x.id).join(', ')}`;
    if (!k.gemessen) return `${k.label}: noch nicht messbar — ${k.quelle}.${k.pflegen ? ` Schließen: ${k.pflegen.text} (${k.pflegen.href}).` : ''}`;
    const punkte = k.details.slice(0, 3).map(d => `${d.titel}${d.wert ? ` ${d.wert}` : ''}${d.unter ? ` (${d.unter})` : ''}`).join(' · ');
    return `${k.label}: ${k.anzeige} — ${AMPEL[k.ampel]} (${schwellenText(k)}). Formel: ${k.formel}. Gerechnet: ${k.quelle}.${punkte ? ` Dahinter: ${punkte}.` : ''}`;
  }
  const rot = alle.filter(k => k.ampel === 'rot').map(k => `${k.label} ${k.anzeige}`);
  return `Gesundheits-Index ${fuer === person ? '' : `von ${fuer} `}: ${pi.index ?? '—'} (${pi.label}) · ${pi.saeulen.map(s => `${s.label} ${s.score ?? '—'}`).join(' · ')}.` +
    `${rot.length ? ` Rot: ${rot.join(', ')}.` : ' Nichts rot.'}${pi.hebel ? ` Größter Hebel: ${pi.hebel.label}.` : ''} ${pi.luecken} Messlücke${pi.luecken === 1 ? '' : 'n'} — /os/gesundheit?s=index. Struktur und Tracking, keine ärztliche Beratung.`;
}

/** Idee, Fehler oder Wunsch an MAKE OS selbst — landet im Bauplan unter „Ideen“ (nie direkt in „Bereit“). */
async function bauplanNotieren(input: Record<string, unknown>, _origin: string, person?: string): Promise<string> {
  const { karteAnlegen } = await import('@/lib/bauplan/speicher');
  const { ARTEN } = await import('@/lib/bauplan/form');
  // Bilder und Seite kommen nur aus der Oberfläche, nie aus dem Gespräch.
  if (!person) return KEINE_PERSON; // S1 #17: kein Rückfall auf eine feste Person (Regel 5)
  const k = await karteAnlegen({ ...input, bilder: undefined, seite: undefined, quelle: 'ZOE' }, person);
  if (!k) return 'Fehlgeschlagen: titel nötig.';
  return `Im Bauplan notiert (Ideen): „${k.titel}“ — ${ARTEN.find(a => a.id === k.art)?.label ?? 'Verbesserung'}, Bereich ${k.bereich}.`;
}

/** Im eigenen Gedächtnis nachsehen, bevor geraten wird. */
async function fragGedaechtnis(input: Record<string, unknown>, _origin: string, person?: string): Promise<string> {
  const { lies } = await import('./gedaechtnis');
  const thema = input.thema ? String(input.thema).slice(0, 120) : undefined;
  // Nur der eigene und der gemeinsame Raum — aus dem der anderen Person nichts.
  if (!person) return KEINE_PERSON;
  const treffer = await lies({ thema, anzahl: 30, raum: person });
  if (!treffer.length) return thema ? `Nichts gemerkt zu „${thema}“.` : 'Das Gedächtnis ist noch leer.';
  return `GEDÄCHTNIS (${treffer.length}):\n` + treffer.map(f => `• [${f.art}] ${f.thema}: ${f.satz}${f.woher ? ` (${f.woher})` : ''}`).join('\n');
}

// ── Das Gehirn: die Notizen im Vault (Baustein 4b) ────────────────────────

// Die Sicht: im Gespräch die Person, für die ZOE arbeitet; ohne Person
// (Hintergrundlauf) ein Agent mit der Sicht des Haushalts — und Agenten bekommen nie Privates (Vertraulichkeitsregeln §1).
// Aufgelöst aus den Konten in lib/zoe/vault.ts (09.10.: keine feste Person mehr).
const sichtFuer = async (person?: string) => { const { AGENT } = await import('./vault'); return person ? { person } : AGENT; };

async function sucheWissen(input: Record<string, unknown>, _o: string, person?: string): Promise<string> {
  const frage = String(input.frage ?? '').trim().slice(0, 300);
  if (!frage) return 'Fehlgeschlagen: frage fehlt.';
  const { suche } = await import('./vault');
  const { treffer, durchsucht } = await suche(frage, Math.min(8, Math.max(1, Number(input.anzahl) || 5)), await sichtFuer(person));
  if (!treffer.length) return `Nichts gefunden zu „${frage}“ (${durchsucht} Notizen durchsucht).`;
  return `WISSEN — ${treffer.length} von ${durchsucht} Notizen:\n\n` + treffer.map(t =>
    `QUELLE ${t.id}\nTITEL ${t.titel} · ${t.bereich}${t.scope === 'privat' ? ' · 🔒 PRIVAT' : ''}${t.stand ? ` · Stand ${t.stand}` : ''}${t.ueberschriften.length ? `\nABSCHNITTE ${t.ueberschriften.slice(0, 4).join(' · ')}` : ''}\n${t.ausschnitt}`,
  ).join('\n\n───\n\n')
  + '\n\nNenne die Quelle, aus der du zitierst. 🔒 PRIVAT heißt: nur im Gespräch mit der Person selbst verwenden — nie in Mails, Entwürfe, Briefings oder Texte nach außen.';
}

async function liesNotiz(input: Record<string, unknown>, _o: string, person?: string): Promise<string> {
  const id = String(input.notiz ?? '').trim();
  if (!id) return 'Fehlgeschlagen: notiz fehlt.';
  const { notiz } = await import('./vault');
  const d = await notiz(id, 12_000, await sichtFuer(person));
  if (!d.ok) return `Notiz nicht lesbar: ${d.fehler}`;
  return `NOTIZ ${d.pfad} — ${d.titel}${d.scope === 'privat' ? ' · 🔒 PRIVAT' : ''}${d.stand ? ` · Stand ${d.stand}` : ''}${d.oben ? `\nGÜLTIGER STAND (oberster 🔴-Block):\n${d.oben}\n───` : ''}\n\n${d.text}`;
}

async function notizAnlegen(input: Record<string, unknown>, _o: string, person?: string): Promise<string> {
  const { legeAn } = await import('./vault');
  const d = await legeAn(String(input.titel ?? ''), String(input.text ?? ''), { person, scope: input.privat === true ? 'privat' : 'intern' });
  return d.ok ? `Protokoll angelegt: ${d.pfad} — steht in deinem Obsidian-Brain.` : `Nicht angelegt: ${d.fehler}`;
}

async function notizErgaenzen(input: Record<string, unknown>, _o: string, person?: string): Promise<string> {
  const { haengeAn } = await import('./vault');
  const d = await haengeAn(String(input.notiz ?? ''), String(input.text ?? ''), { titel: input.titel ? String(input.titel) : undefined, person });
  return d.ok ? `Ergänzt: ${d.pfad} — als datierter Block angehängt, nichts überschrieben.` : `Nicht ergänzt: ${d.fehler}`;
}


// ── Markttraktion (Kartei): Kontakte finden, notieren, ansprechen ──────────────────────────────
// Vorgabe vom 18.09.: „damit wir Kunden ansprechen können." Es gibt bewusst
// KEIN Werkzeug zum Versenden: das bleibt eiserne Regel 3. Seit 29.09. (Vorgabe „ZOE schreibt
// nur über den Stapel“, Paket D-B #90) sind notiere_kontakt, chance_anlegen und uebergeben
// freigabepflichtig (lib/zoe/register.ts) — sie laufen erst nach dem Klick im Stapel.

/** Art. 18 zentral (29.09., #72/#92): eingeschränkte Personen findet ZOE gar nicht erst. */
async function ladeKontakte() {
  return (await import('@/lib/crm/verarbeitung')).kontakteFuerVerarbeitung();
}

async function kontaktFinden(hinweis: string) {
  const { findeKontakte } = await import('@/lib/make-one/crm');
  // Art. 18 (28.09., C7): eingeschränkte Personen findet ZOE nicht — sie werden weder gezeigt noch verarbeitet (seit 29.09. im Leser).
  const alle = await ladeKontakte();
  const direkt = alle.find(k => k.id === hinweis);
  if (direkt) return { treffer: direkt, alle };
  const l = findeKontakte(alle, hinweis, 3);
  return { treffer: l[0], alle, mehrere: l.length > 1 ? l : undefined };
}

// suche_kontakt läuft seit 28.09. (C7) über crm_suche in lib/zoe/crm-werkzeuge.ts — dieselben Leitplanken wie alle CRM-Leser.

/**
 * notiere_kontakt — seit 25.09. die Schnellnotiz: „Hab mit Marc telefoniert,
 * will Angebot bis Freitag“ setzt Verlauf (art + ergebnis), Notiz (bedarf)
 * und nächsten Schritt in EINEM Aufruf. Die Regeln sind dieselben wie in der
 * Power Hour (folgeAus + erfassungAnwenden, wie app/api/crm/aktivitaet):
 * Stufe nur vorwärts, Wiedervorlage = nächster Schritt, „sperre“ sperrt sofort.
 */
async function notiereKontakt(input: Record<string, unknown>, _origin: string, person?: string, kontext?: WerkzeugKontext): Promise<string> {
  const hinweis = String(input.kontakt ?? '').trim().slice(0, 160);
  if (!hinweis) return 'Fehlgeschlagen: kontakt fehlt (Name, Firma oder ID).';
  const { localDay } = await import('@/lib/zeit');
  const { zoeNotiz, erfassungAnwenden } = await import('@/lib/crm/erfassen');
  const heute = localDay();
  const e = zoeNotiz(input, heute);
  if (typeof e === 'string') return e;
  const { treffer, mehrere } = await kontaktFinden(hinweis);
  if (!treffer) return `Kein Kontakt zu „${hinweis}“ gefunden — erst mit suche_kontakt nachsehen.`;
  if (mehrere) {
    const { anzeigename } = await import('@/lib/make-one/crm');
    return `Mehrdeutig — meinst du ${mehrere.map(k => `${anzeigename(k)}${k.firma ? ` (${k.firma})` : ''} [${k.id}]`).join(' oder ')}? Bitte mit der ID erneut.`;
  }
  const { STUFEN, STUFE_LABEL, anzeigename } = await import('@/lib/make-one/crm');
  const { folgeAus } = await import('@/lib/crm/heute');
  const { aendereKontakte } = await import('@/lib/crm/kartei-schreiben');
  const stufe = STUFEN.includes(input.stufe as never) ? (input.stufe as import('@/lib/make-one/crm').Stufe) : undefined;
  let nachher: import('@/lib/make-one/crm').Kontakt | null = null;
  let folgeHinweis = '';
  let eingeschraenkt = false;
  await aendereKontakte<{ kontakte: import('@/lib/make-one/crm').Kontakt[] }>(current => {
    const f = current ?? { kontakte: [] };
    const i = f.kontakte.findIndex(k => k.id === treffer.id);
    if (i < 0) return f;
    const alt = f.kontakte[i];
    // Art. 18 (U2): an einer eingeschränkten Person wird nichts festgehalten.
    if (alt.eingeschraenkt) { eingeschraenkt = true; return f; }
    const folge = e.ergebnis ? folgeAus(e.ergebnis, heute, alt.stufe) : null;
    folgeHinweis = folge?.hinweis ?? '';
    nachher = erfassungAnwenden(alt, {
      art: e.art, text: e.text, von: person ?? 'zoe', ergebnis: e.ergebnis, notiz: e.notiz, stufe, wiedervorlage: e.wiedervorlage, naechster: e.naechster,
      // #94 (29.09.): immer als ZOE-Eintrag gekennzeichnet, mit der Person, die ihn im Stapel freigegeben hat.
      quelle: 'zoe', ...(kontext?.freigegebenVon ? { freigegebenVon: kontext.freigegebenVon } : {}),
    }, folge, heute, new Date().toISOString());
    f.kontakte[i] = nachher;
    return f;
  }, { art: 'zoe', ...(person ? { person } : {}) });
  if (eingeschraenkt) return 'Nicht notiert: die Verarbeitung dieser Person ist eingeschränkt (Art. 18 DSGVO).';
  if (!nachher) return 'Fehlgeschlagen: Kontakt beim Schreiben nicht mehr gefunden.';
  const n = nachher as import('@/lib/make-one/crm').Kontakt;
  const teile = [
    `Notiert: ${anzeigename(n)} · ${e.art}${e.ergebnis ? ` · ${e.ergebnis}` : ''}`,
    e.notiz?.bedarf ? `Bedarf: ${e.notiz.bedarf}` : '',
    e.naechster ? `nächster Schritt „${e.naechster.text}“ bis ${e.naechster.datum}${e.datumAngenommen ? ' (kein Datum genannt — in 5 Tagen angenommen, bei Bedarf ändern)' : ''}` : '',
    n.werbesperre ? 'WERBESPERRE gesetzt' : `jetzt ${STUFE_LABEL[n.stufe]}${n.wiedervorlage ? ` · Wiedervorlage ${n.wiedervorlage}` : ''}`,
  ].filter(Boolean);
  return `${teile.join(' · ')}.${folgeHinweis ? ` ${folgeHinweis}` : ''}`;
}

async function entwurfAnsprache(input: Record<string, unknown>, _o?: string, person?: string): Promise<string> {
  const hinweis = String(input.kontakt ?? '').trim().slice(0, 160);
  if (!hinweis) return 'Fehlgeschlagen: kontakt fehlt (Name, Firma oder ID).';
  const { treffer, mehrere } = await kontaktFinden(hinweis);
  if (!treffer) return `Kein Kontakt zu „${hinweis}“ gefunden.`;
  const { anzeigename } = await import('@/lib/make-one/crm');
  if (mehrere) return `Mehrdeutig — ${mehrere.map(k => `${anzeigename(k)} [${k.id}]`).join(' oder ')}? Bitte mit der ID.`;
  const { entwurfFuer } = await import('@/lib/ansprache');
  const r = await entwurfFuer(treffer, { lauf: 'gespraech', person: person ?? null, kategorien: ['crm'], anzahl: 1 });
  if (!r.ok) return `Entwurf fehlgeschlagen: ${r.fehler}`;
  const { ampel } = await import('@/lib/crm/recht');
  const wege = ampel(treffer).map(c => `${c.kanal} ${c.farbe === 'gruen' ? 'zulässig' : c.farbe === 'gelb' ? 'nur persönlich' : 'NICHT zulässig'}`).join(', ') || 'kein Kanal hinterlegt';
  return `ANSPRACHE-ENTWURF für ${anzeigename(treffer)}${treffer.firma ? ` (${treffer.firma})` : ''} — Kanäle: ${wege}\n\nBETREFF: ${r.entwurf.betreff}\n\nE-MAIL:\n${r.entwurf.email}\n\nLINKEDIN:\n${r.entwurf.linkedin}\n\n${r.entwurf.hinweis}\nNichts wurde versendet. Wenn die Person es geschickt hat, mit notiere_kontakt (art: mail oder linkedin) festhalten.`;
}

// ─── Markttraktion (24.09. nachts): Chance anlegen, Lage abfragen ─────────────────────

/** Kontakt an eine andere Person des Teams übergeben (25.09.) — Verlauf, nächster Schritt, Aufgabe. Nichts wird versendet. */
async function kontaktUebergeben(input: Record<string, unknown>, _o: string, person?: string, kontext?: WerkzeugKontext): Promise<string> {
  if (!person) return 'Nicht verfügbar: Übergeben geht nur im Gespräch mit einer Person des Haushalts.';
  const hinweis = String(input.kontakt ?? '').trim().slice(0, 160);
  if (!hinweis) return 'Fehlgeschlagen: kontakt fehlt (Name, Firma oder ID).';
  const { treffer, mehrere } = await kontaktFinden(hinweis);
  if (!treffer) return `Kein Kontakt zu „${hinweis}“ — erst mit suche_kontakt nachsehen.`;
  const { anzeigename } = await import('@/lib/make-one/crm');
  if (mehrere) return `Mehrdeutig — ${mehrere.map(k => `${anzeigename(k)} [${k.id}]`).join(' oder ')}? Bitte mit der ID.`;
  const { uebergeben } = await import('@/lib/crm/uebergabe');
  const r = await uebergeben({ art: 'kontakt', id: treffer.id, an: String(input.an ?? ''), notiz: input.notiz ? String(input.notiz) : undefined, frist: input.frist ? String(input.frist) : undefined }, person, { art: 'zoe', person }, { quelle: 'zoe', ...(kontext?.freigegebenVon ? { freigegebenVon: kontext.freigegebenVon } : {}) });
  return r.ok ? `Übergeben: ${r.text}.` : `Fehlgeschlagen: ${r.fehler}`;
}

async function chanceAnlegen(input: Record<string, unknown>, _o: string, person?: string): Promise<string> {
  if (!person) return 'Fehlgeschlagen: CRM-Werkzeuge nur im Auftrag einer Person im Haushalt (Regel 5).';
  // Seit 27.09. über den EINEN Anlageweg (lib/crm/deal-anlegen.ts): Firma per Kennung, Kernfragen vom Lead,
  // Pflicht zum nächsten Schritt, kein zweiter offener Deal ohne Absicht, Lead wird SQL.
  const hinweis = String(input.kontakt ?? '').trim().slice(0, 160);
  if (!hinweis) return 'Fehlgeschlagen: kontakt fehlt (Name, Firma oder ID).';
  const { treffer, mehrere } = await kontaktFinden(hinweis);
  if (!treffer) return `Kein Kontakt zu „${hinweis}“ — erst mit suche_kontakt nachsehen oder in der Markttraktion › Kontakte anlegen.`;
  const { anzeigename } = await import('@/lib/make-one/crm');
  if (mehrere) return `Mehrdeutig — ${mehrere.map(k => `${anzeigename(k)} [${k.id}]`).join(' oder ')}? Bitte mit der ID.`;
  const { dealAnlegen } = await import('@/lib/crm/deal-anlegen');
  const { STUFEN } = await import('@/lib/crm/pipeline');
  const stufe = STUFEN.some(x => x.id === input.stufe && x.offen) ? (String(input.stufe) as import('@/lib/crm/typen').ChancenStufe) : undefined;
  const betrag = Number(input.wert_monat) > 0 ? Math.round(Number(input.wert_monat)) : Number(input.wert_einmalig) > 0 ? Math.round(Number(input.wert_einmalig)) : 0;
  const basis = Number(input.wert_monat) > 0 ? 'monat' : 'einmalig';
  const schritt = String(input.naechster_schritt ?? '').trim().slice(0, 300);
  const datum = /^\d{4}-\d{2}-\d{2}$/.test(String(input.faellig ?? '')) ? String(input.faellig) : undefined;
  if (!schritt || !datum) return 'Fehlgeschlagen: naechster_schritt und faellig (YYYY-MM-DD) sind Pflicht — ohne nächsten Schritt verliert sich der Deal.';
  const r = await dealAnlegen({ titel: String(input.titel ?? '').trim().slice(0, 160) || undefined, kontaktIds: [treffer.id], art: 'retainer', wert: { betrag, basis }, schritt: { text: schritt, datum }, stufe, besitzer: person, trotzdem: input.trotzdem === true }, person, undefined, { art: 'zoe', person });
  if (!r.ok) return `Fehlgeschlagen: ${r.fehler}${r.offen ? ` (offener Deal: ${r.offen.id})` : ''}`;
  // Quelle aus der Herkunft des Leads (08.10., 2.5), SQL nur bei erfüllten Kriterien (2.3) — sonst „direkt angelegt“.
  return `Deal angelegt (${r.sql ? 'Lead ist jetzt SQL' : `direkt angelegt — Lead noch kein SQL${r.fehlt.length ? `, es fehlt: ${r.fehlt.join(', ')}` : ''}`}): „${r.chance.titel}“ (${anzeigename(treffer)}) · Stufe ${r.chance.stufe}${betrag ? ` · ${betrag} € ${basis === 'monat' ? 'im Monat' : 'einmalig'}` : ' · noch ohne Wert'} · nächster Schritt ${datum}: ${schritt}`;
}

// crm_lage läuft seit 28.09. (C7) über lib/zoe/crm-werkzeuge.ts (gekapselt, ohne eingeschränkte Kontakte).

// ─── Haushaltsfinanzen (24.09.) ─────────────────────────────────────────────
// Nur für Personen mit Haushalt. Ohne benannte Person (Hintergrundlauf, Rück-
// nahme aus dem Protokoll) verweigern die Werkzeuge — private Finanzen gibt es
// nie „im Auftrag von niemandem“.

async function haushaltDer(person?: string) {
  const { haushaltFuer } = await import('@/lib/finanzen/haushalt/zugriff');
  return haushaltFuer(person ?? null);
}
const KEIN_HAUSHALT = 'Nicht verfügbar: Die Haushaltsfinanzen gibt es nur im Gespräch mit einer Person des Haushalts — nicht im Hintergrund und nicht für andere Konten.';

async function haushaltStand(_i: Record<string, unknown>, _o: string, person?: string): Promise<string> {
  const z = await haushaltDer(person); if (!z) return KEIN_HAUSHALT;
  const { ladeHaushalt } = await import('@/lib/finanzen/haushalt/speicher');
  const { standText } = await import('@/lib/finanzen/haushalt/zoe');
  return standText(await ladeHaushalt(z.haushalt));
}

async function haushaltBuchungen(input: Record<string, unknown>, _o: string, person?: string): Promise<string> {
  const z = await haushaltDer(person); if (!z) return KEIN_HAUSHALT;
  const { ladeHaushalt } = await import('@/lib/finanzen/haushalt/speicher');
  const { buchungenSuchen } = await import('@/lib/finanzen/haushalt/zoe');
  return buchungenSuchen(await ladeHaushalt(z.haushalt), { suche: input.suche ? String(input.suche) : undefined, monat: input.monat ? String(input.monat) : undefined, kategorie: input.kategorie ? String(input.kategorie) : undefined });
}

async function haushaltZuordnen(input: Record<string, unknown>, _o: string, person?: string): Promise<string> {
  const z = await haushaltDer(person); if (!z) return KEIN_HAUSHALT;
  const { ladeHaushalt } = await import('@/lib/finanzen/haushalt/speicher');
  const { regelLernen } = await import('@/lib/finanzen/haushalt/aktionen');
  const { normal } = await import('@/lib/finanzen/haushalt/regeln');
  const h = await ladeHaushalt(z.haushalt);
  const kat = h.stamm.kategorien.find(k => normal(k.name) === normal(String(input.kategorie ?? '')));
  if (!kat) return `Fehlgeschlagen: Kategorie „${String(input.kategorie ?? '')}“ gibt es nicht. Vorhanden: ${h.stamm.kategorien.map(k => k.name).join(', ')}.`;
  const e = await regelLernen(z.haushalt, { muster: String(input.muster ?? ''), kategorie_id: kat.id, rueckwirkend: input.rueckwirkend !== false, ganzes_wort: true }, false);
  return `Gemerkt: „${String(input.muster)}“ → ${kat.name}. ${e.geaendert} Buchung${e.geaendert === 1 ? '' : 'en'} zugeordnet.`;
}

async function haushaltRechnungBezahlt(input: Record<string, unknown>, _o: string, person?: string): Promise<string> {
  const z = await haushaltDer(person); if (!z) return KEIN_HAUSHALT;
  const { ladeHaushalt, patchen } = await import('@/lib/finanzen/haushalt/speicher');
  const { normal } = await import('@/lib/finanzen/haushalt/regeln');
  const { heuteBerlin } = await import('@/lib/finanzen/haushalt/monat');
  const h = await ladeHaushalt(z.haushalt);
  const s = normal(String(input.rechnung ?? ''));
  const r = h.belege.filter(b => b.art === 'rechnung' && !b.erledigt && (normal(b.empfaenger ?? '').includes(s) || normal(b.bezeichnung).includes(s)));
  if (r.length !== 1) return r.length ? `Nicht eindeutig: ${r.map(b => b.empfaenger || b.bezeichnung).join(', ')}.` : `Keine offene Rechnung zu „${String(input.rechnung ?? '')}“.`;
  const e = await patchen(z.haushalt, 'belege', [{ op: 'upsert', stand: r[0].stand, eintrag: { ...r[0], erledigt: true, bezahlt_am: heuteBerlin() } }]);
  return e.ok ? `Als bezahlt vermerkt: ${r[0].empfaenger || r[0].bezeichnung}.` : `Fehlgeschlagen: ${e.fehler}`;
}

async function haushaltRechnungErfassen(input: Record<string, unknown>, _o: string, person?: string): Promise<string> {
  const z = await haushaltDer(person); if (!z) return KEIN_HAUSHALT;
  const { patchen } = await import('@/lib/finanzen/haushalt/speicher');
  const betrag = Number(input.betrag);
  const e = await patchen(z.haushalt, 'belege', [{ op: 'upsert', eintrag: {
    art: 'rechnung', empfaenger: String(input.an ?? ''), bezeichnung: String(input.wofuer ?? input.an ?? 'Rechnung'),
    betrag: Number.isFinite(betrag) ? Math.round(betrag * 100) : null, faellig_am: /^\d{4}-\d{2}-\d{2}$/.test(String(input.faellig ?? '')) ? String(input.faellig) : null,
    // 08.10. spät: Vorname aus dem Konto der auslösenden Person (vorher: wer nicht die zweite Person war, hieß wie die erste).
    verursacher: await vornameVon(person ?? z.person), einheit: 'privat', erledigt: false,
  } }]);
  return e.ok ? `Offene Rechnung erfasst: ${String(input.an ?? '')}${Number.isFinite(betrag) ? ` über ${eurW(betrag)}` : ''}.` : `Fehlgeschlagen: ${e.fehler}`;
}

// ─── Markttraktion nur im Haushalt des Inhabers (28.09., Integritätsprüfung K1) ─────
// Kartei, Deals, Mandate gehören dem Haushalt des Inhabers — wie `karteiZugang` für die Routen. Vorher bot ZOE die
// CRM-Werkzeuge jedem angemeldeten Konto an, und die Werkzeuge lasen/schrieben die Kartei ohne Prüfung. Jetzt:
// kimmi bietet sie nur an, wenn `crmWerkzeugErlaubt(person)`, UND jedes Werkzeug prüft selbst (`nurImHaushalt`) —
// auch bei Freigabe aus dem Stapel, Rücknahme und Aufträgen. Ohne Person: KEINE_PERSON (Regel 5).
export const CRM_WERKZEUGE = ['crm_lage', 'suche_kontakt', 'notiere_kontakt', 'entwurf_ansprache', 'chance_anlegen', 'uebergeben', 'setze_kunde',
  // ZOE sieht und unterstützt die ganze Markttraktion (28.09., C7): lesen (lib/zoe/crm-werkzeuge.ts) und vorschlagen (crm-vorschlag.ts).
  'crm_suche', 'kontakt_akte', 'firma_akte', 'pipeline', 'mandate_lage', 'angebote_lage', 'kampagnen_lage', 'events_lage', 'besuche_lage', 'marketing_lage',
  'kennzahlen', 'sales_lage', 'qualifizierung_lage', 'stammdaten_lage', 'datenqualitaet', 'crm_datei_lesen', 'heads_lage', 'crm_vorschlag'] as const;
/** Agenten, deren Lauf die Kartei liest (run_agent) — nur im Haushalt des Inhabers anbieten. */
export const CRM_AGENTEN = ['crm', 'outreach', 'prospect', 'head-sales', 'head-marketing', 'head-event'] as const;
export const KEIN_CRM = 'Nicht ausgeführt: Die Markttraktion gehört zum Haushalt des Inhabers — für dieses Konto nicht verfügbar.';
export async function crmWerkzeugErlaubt(person: string | null | undefined): Promise<boolean> {
  if (!person) return false;
  const { personImHaushaltDesInhabers } = await import('@/lib/zugang/haushalt-inhaber');
  return personImHaushaltDesInhabers(person);
}
/**
 * Was die Ausführung über ihren Anlass weiß (29.09., Paket D-B #94): `freigegebenVon` = die Person, die den Vorschlag im
 * Stapel freigegeben hat (nur bei der Freigabe gesetzt, von `fuehreAus` — nie aus der Eingabe des Modells).
 */
export interface WerkzeugKontext {
  freigegebenVon?: string;
  /**
   * Das ZOE-Gespräch, aus dem der Aufruf kommt (Paket 4a, 09.10.): Thread und Marken des Zugs — gesetzt NUR vom Server (kimmi über
   * `fuehreAus`), nie aus der Eingabe des Modells. `an_head` hängt den Head-Thread daran und vererbt die Marken.
   */
  zoe?: { fadenId?: string; fremdGelesen?: boolean; vertraulich?: boolean };
}
type Lauf = (input: Record<string, unknown>, origin: string, person?: string, kontext?: WerkzeugKontext) => Promise<string>;
const nurImHaushalt = (lauf: Lauf): Lauf => async (input, origin, person, kontext) => {
  if (!person) return KEINE_PERSON;
  if (!(await crmWerkzeugErlaubt(person))) return KEIN_CRM;
  return lauf(input, origin, person, kontext);
};

export const WERKZEUGE: Record<string, { gruppe: string; lauf: Lauf }> = {
  create_task: { gruppe: 'aufgaben', lauf: erstelleAufgabe },
  starte_auftraege: { gruppe: 'auftraege', lauf: starteAuftraege },
  fakt_merken: { gruppe: 'gedaechtnis', lauf: faktMerken },
  bauplan_notieren: { gruppe: 'bauplan', lauf: bauplanNotieren },
  business_index: { gruppe: 'business', lauf: businessIndex },
  gesellschaften_lesen: { gruppe: 'business', lauf: gesellschaftenLesen },
  monatsabschluss_erfassen: { gruppe: 'finanzen', lauf: monatsabschlussErfassen },
  suche_wissen: { gruppe: 'wissen', lauf: sucheWissen },
  lies_notiz: { gruppe: 'wissen', lauf: liesNotiz },
  notiz_anlegen: { gruppe: 'wissen', lauf: notizAnlegen },
  notiz_ergaenzen: { gruppe: 'wissen', lauf: notizErgaenzen },
  haushalt_stand: { gruppe: 'haushalt', lauf: haushaltStand },
  haushalt_buchungen: { gruppe: 'haushalt', lauf: haushaltBuchungen },
  haushalt_zuordnen: { gruppe: 'haushalt', lauf: haushaltZuordnen },
  haushalt_rechnung_bezahlt: { gruppe: 'haushalt', lauf: haushaltRechnungBezahlt },
  haushalt_rechnung_erfassen: { gruppe: 'haushalt', lauf: haushaltRechnungErfassen },
  frag_gedaechtnis: { gruppe: 'gedaechtnis', lauf: fragGedaechtnis },
  plan_block: { gruppe: 'planer', lauf: planBlock },
  freie_zeit: { gruppe: 'kalender', lauf: freieZeit },
  // Selbst nachsehen statt verweisen — so vorgegeben.
  lies_postfach: { gruppe: 'inbox', lauf: liesPostfach },
  setze_vitalwerte: { gruppe: 'gesundheit', lauf: setzeVitalwerte },
  setze_ziele: { gruppe: 'finanzen', lauf: setzeZiele },
  erfasse_planposten: { gruppe: 'finanzen', lauf: erfassePlanposten },
  setze_kontostand: { gruppe: 'finanzen', lauf: setzeKontostand },
  erfasse_rechnung: { gruppe: 'finanzen', lauf: erfasseRechnung },
  erfasse_zahlung: { gruppe: 'finanzen', lauf: erfasseZahlung },
  setze_meilenstein: { gruppe: 'meilensteine', lauf: setzeMeilenstein },
  setze_fokus: { gruppe: 'fokus', lauf: setzeFokus },
  setze_kunde: { gruppe: 'kunden', lauf: nurImHaushalt(setzeKunde) },
  hake_routine: { gruppe: 'gesundheit', lauf: hakeRoutine },
  gesundheits_index: { gruppe: 'gesundheit', lauf: gesundheitsIndex },
  haut_eintrag: { gruppe: 'gesundheit', lauf: hautEintrag },
  journal_eintrag: { gruppe: 'gesundheit', lauf: journalEintrag },
  einkauf_setzen: { gruppe: 'gesundheit', lauf: einkaufSetzen },
  streak_eintrag: { gruppe: 'gesundheit', lauf: streakEintrag },
  suche_kontakt: { gruppe: 'kontakte', lauf: nurImHaushalt(sucheKontaktSicht) },
  notiere_kontakt: { gruppe: 'kontakte', lauf: nurImHaushalt(notiereKontakt) },
  entwurf_ansprache: { gruppe: 'kontakte', lauf: nurImHaushalt(entwurfAnsprache) },
  chance_anlegen: { gruppe: 'kontakte', lauf: nurImHaushalt(chanceAnlegen) },
  uebergeben: { gruppe: 'kontakte', lauf: nurImHaushalt(kontaktUebergeben) },
  crm_lage: { gruppe: 'kontakte', lauf: nurImHaushalt(crmLageSicht) },
  // Markttraktion ganz (28.09., C7): lesen gekapselt mit Leitplanken; crm_vorschlag legt nur in den Stapel (Art „crm“).
  ...Object.fromEntries(Object.entries(CRM_LESE_LAEUFE).map(([n, lauf]) => [n, { gruppe: 'markttraktion', lauf: nurImHaushalt(lauf) }])),
  crm_vorschlag: { gruppe: 'crm', lauf: nurImHaushalt(CRM_VORSCHLAG_LAUF) },
  // Projekt- und Aufgaben-Dateien lesen (28.09., C2): nur im Haushalt, nur die Aufgaben-Ablage, gekapselt.
  projekt_unterlagen: { gruppe: 'aufgaben-dateien', lauf: nurImHaushalt(projektUnterlagen) },
  datei_lesen: { gruppe: 'aufgaben-dateien', lauf: nurImHaushalt(dateiLesen) },
  // ZOE-Aufgaben (28.09., C4): meine_aufgaben, aufgabe_an_zoe — prüfen den Haushalt selbst (lib/zoe/aufgaben-werkzeuge.ts).
  ...AUFGABEN_WERKZEUGE,
  // Eine Suche über Brain und App (29.09., B3): suche_arbeit — prüft den Haushalt selbst (lib/zoe/arbeit-werkzeug.ts).
  ...ARBEIT_WERKZEUGE,
  // ZOE steuert die Heads (09.10., Paket 4a, lib/agenten/zoe-heads.ts): Auftrag in einen Thread des Heads bzw. eine kurze Frage —
  // nur Heads, die die AUSLÖSENDE Person sieht (lib/agenten/sicht.ts). Dynamisch geladen (der Agenten-Kern liest dieses Register).
  an_head: { gruppe: 'agenten', lauf: async (i, o, p, k) => (await import('@/lib/agenten/zoe-heads')).anHead(i, o, p, k) },
  head_fragen: { gruppe: 'agenten', lauf: async (i, o, p, k) => (await import('@/lib/agenten/zoe-heads')).headFragen(i, o, p, k) },
};
