// ─── MAKE OS — ZOE' Werkzeug-Register ────────────────────────────────────
// Baustein 1 (07.09.), nach der Entscheidung vom 06.09.:
//
//   frei     — Aufgaben, Postfach einordnen, eigener Kalender, CRM anreichern.
//              Läuft durch, wird protokolliert, ist rücknehmbar.
//   freigabe — Geld, Ziele, Kompass, Löschen, alles Ausgehende.
//              Wird zum Vorschlag im Stapel, den die Person morgens und abends
//              durchgeht. Erst ihre Freigabe führt aus.
//   nie      — gibt es hier bewusst noch nicht; die Stufe steht bereit, damit
//              spätere Werkzeuge (Versand, Löschen von Beständen) sie tragen.
//
// 29.09. (Vorgabe „ZOE schreibt nur über den Stapel“, Paket D-B #90/#93): alles, was ins CRM schreibt (notiere_kontakt,
// chance_anlegen, uebergeben, setze_kunde), und eine Aufgabe für eine ANDERE Person (create_task mit `wer`) ist
// freigabepflichtig — auch VOR jedem Fremdtext. `risikoFuer` rechnet die Stufe je Aufruf (nie aus einem Satz im Gespräch).
//
// WICHTIG — und das ist der Grund, warum das hier steht und nicht im Prompt:
// Die Stufe ist eine Eigenschaft des Werkzeugs, nicht eine Entscheidung des
// Modells. Kein Satz, den jemand ZOE schreibt, kann sie umgehen.

import { loadJson } from '@/lib/store/local-db';
import { WERKZEUGE } from './werkzeuge';
import { businessFirmaAus, finanzOrtName, istGesellschaft, kontoName } from '@/lib/einheiten';
import { AUFGABEN_REGISTER } from './aufgaben-werkzeuge';
import { ARBEIT_REGISTER } from './arbeit-werkzeug';
import { fokusImJahr } from '@/lib/planung/jahr-fokus';
import { localDay } from '@/lib/zeit';
import { CRM_VORSCHLAG_REGISTER } from './crm-vorschlag';
// Priorität und Tag deutsch in Vorschau und Stapel (09.10. „Agenten live“: dort stand „(high)“ und „2026-10-10“).
import { PRIO_NAME, tagDe } from './vorschau-text';
export { PRIO_NAME, tagDe };

export type Risiko = 'frei' | 'freigabe' | 'nie';

export const RISIKO_LABEL: Record<Risiko, string> = {
  frei: 'läuft durch',
  freigabe: 'braucht deine Freigabe',
  nie: 'gesperrt',
};

/** Was ein Werkzeug bewirkt, bevor es etwas bewirkt hat. */
export interface Vorschau {
  /** Eine Zeile für den Stapel: was passieren soll. */
  titel: string;
  /** Der Stand davor, falls es einen gibt. */
  vorher?: string;
  /** Der Stand danach. */
  nachher: string;
  /** Wie man es wieder aufhebt — als erneuter Aufruf desselben Werkzeugs mit
   *  dem alten Wert. Nur dort gesetzt, wo der alte Wert eindeutig ist; sonst
   *  behaupten wir keine Rücknahme, die es nicht gibt. */
  zurueck?: { werkzeug: string; eingabe: Record<string, unknown> };
}

interface Eintrag {
  gruppe: string;
  risiko: Risiko;
  /** Stufe je Aufruf (29.09.) — nur strenger als `risiko`, nie lockerer (siehe `risikoFuerAufruf`). */
  risikoFuer?: (input: Record<string, unknown>, person?: string) => Risiko;
  /** Trockenlauf: liest denselben Bestand wie die Ausführung, ändert nichts. */
  /** `person` = für wen der Vorschlag gilt (Sichtregeln wie beim Ausführen); ohne = Systemlauf. */
  vorschau: (input: Record<string, unknown>, person?: string) => Promise<Vorschau>;
}

// Auf den Cent (09.10.): ganze Beträge ohne Nachkommastellen, sonst mit Cent — nie auf ganze Euro gerundet.
const eur = (n: unknown) => {
  const z = Number(n);
  if (n === undefined || n === null || n === '' || !isFinite(z)) return '—';
  const c = Math.round(z * 100) / 100;
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(c) ? 0 : 2, maximumFractionDigits: 2 }).format(c);
};
// Dieselbe Zuordnung wie die Ausführung (09.10.: nur eine Business-Gesellschaft, ohne stillen Rückfall — lib/einheiten.ts `businessFirmaAus`).
const firma = (rein: unknown) => businessFirmaAus(rein);
const text = (v: unknown, n = 120) => String(v ?? '').trim().slice(0, n);
/**
 * Darf die Vorschau den Finanzbestand lesen? Wie die Route (`privatFinanzZugang`, 09.10. Funde Abdeckung #1): eine Person ohne privaten
 * Finanzzugang (Konto „nur Business“) bekommt keinen Kontostand und keine Rechnung zu sehen — auch nicht im Vorher/Nachher des Stapels.
 * Ohne Person (Systemlauf) liest sie wie bisher; solche Vorschläge zeigt der Stapel nur Personen mit Zugang.
 */
async function finanzLesbar(person?: string): Promise<boolean> {
  if (!person) return true;
  const { privatFinanzZugangFuer } = await import('@/lib/finanzen/haushalt/zugriff');
  return !!(await privatFinanzZugangFuer(person).catch(() => null));
}
const OHNE_ZUGANG: Vorschau = { titel: 'Finanzbestand ändern — ohne Zugang', nachher: 'nicht möglich: dafür fehlt der Zugang zu den Finanzbeständen' };


// ── Trockenläufe ───────────────────────────────────────────────────────────
// Jeder liest genau den Bestand, den die Ausführung anfassen würde. Dadurch
// zeigt die Vorschau garantiert dieselbe Wirklichkeit wie der echte Lauf.

async function vsKontostand(i: Record<string, unknown>, person?: string): Promise<Vorschau> {
  const f = firma(i.firma);
  if (!f.ok) return { titel: 'Kontostand setzen — abgelehnt', nachher: f.fehler };
  if (!(await finanzLesbar(person))) return OHNE_ZUGANG;
  const fid = f.firma;
  const plan = await loadJson<{ firmen?: { id: string; name: string; kontostand: number | null }[] }>('finanzplan');
  const treffer = (plan?.firmen ?? []).find(x => x.id === fid);
  return {
    titel: `Kontostand ${treffer ? kontoName(treffer.id, treffer.name) : finanzOrtName(fid)} setzen`,
    vorher: treffer?.kontostand != null ? eur(treffer.kontostand) : 'nicht gesetzt',
    nachher: eur(i.betrag),
    ...(treffer?.kontostand != null
      ? { zurueck: { werkzeug: 'setze_kontostand', eingabe: { firma: fid, betrag: treffer.kontostand } } }
      : {}),
  };
}

async function vsRechnung(i: Record<string, unknown>, person?: string): Promise<Vorschau> {
  const kunde = text(i.kunde);
  const f = firma(i.firma);
  if (!f.ok) return { titel: `Rechnung ${kunde} — abgelehnt`, nachher: f.fehler };
  if (!(await finanzLesbar(person))) return OHNE_ZUGANG;
  const plan = await loadJson<{ rechnungen?: { kunde: string; titel: string; betrag: number; status: string; firmaId?: string }[] }>('finanzplan');
  // Wie die Ausführung: nur Rechnungen DIESER Gesellschaft (ohne Gesellschaft: Altbestand).
  const r = (plan?.rechnungen ?? []).find(x => (x.firmaId === f.firma || !x.firmaId) && x.kunde.toLowerCase() === kunde.toLowerCase());
  const neu = [
    i.betrag != null ? eur(i.betrag) : r ? eur(r.betrag) : '—',
    i.status ? String(i.status) : r?.status,
    i.faellig ? `fällig ${tagDe(i.faellig)}` : undefined,
    finanzOrtName(f.firma),
  ].filter(Boolean).join(' · ');
  return {
    titel: r ? `Rechnung ${kunde} ändern` : `Rechnung ${kunde} anlegen`,
    vorher: r ? `${eur(r.betrag)} · ${r.status}` : undefined,
    nachher: neu,
  };
}

async function vsZahlung(i: Record<string, unknown>): Promise<Vorschau> {
  const f = firma(i.firma);
  if (!f.ok) return { titel: `Zahlung an ${text(i.an)} — abgelehnt`, nachher: f.fehler };
  return {
    titel: `Zahlung an ${text(i.an)} eintragen`,
    nachher: `${eur(i.betrag)}${i.faellig ? ` · fällig ${tagDe(i.faellig)}` : ''} · ${finanzOrtName(f.firma)} — geht in die Prioritätenliste`,
  };
}

async function vsPlanposten(i: Record<string, unknown>, person?: string): Promise<Vorschau> {
  const titel = text(i.titel, 160);
  if (!(await finanzLesbar(person))) return OHNE_ZUGANG;
  const l = await loadJson<{ posten?: { titel: string; betrag: number; rhythmus: string }[] }>('liquiplan');
  const p = (l?.posten ?? []).find(x => x.titel.toLowerCase() === titel.toLowerCase());
  const rhythmus = String(i.rhythmus ?? 'monatlich');
  const betrag = Number(i.betrag);
  return {
    titel: p ? `Planposten „${titel}“ ändern` : `Planposten „${titel}“ anlegen`,
    vorher: p ? `${betrag < 0 ? '−' : '+'}${eur(Math.abs(p.betrag))} ${p.rhythmus}` : undefined,
    nachher: `${betrag < 0 ? '−' : '+'}${eur(Math.abs(betrag))} ${rhythmus} — rechnet in der Liquiditäts-Vorschau mit`,
  };
}

async function vsZiele(i: Record<string, unknown>): Promise<Vorschau> {
  const f = await loadJson<{ zielUmsatz?: number; zielGewinn?: number; cash?: number; startMonat?: number }>('finance');
  const teile: string[] = [];
  const alt: string[] = [];
  if (i.zielUmsatz != null) { teile.push(`Ziel-Umsatz ${eur(i.zielUmsatz)}`); alt.push(`Ziel-Umsatz ${eur(f?.zielUmsatz)}`); }
  if (i.zielGewinn != null) { teile.push(`Ziel-Gewinn ${eur(i.zielGewinn)}`); alt.push(`Ziel-Gewinn ${eur(f?.zielGewinn)}`); }
  if (i.cash != null) { teile.push(`Cash ${eur(i.cash)}`); alt.push(`Cash ${eur(f?.cash)}`); }
  if (i.startMonat != null) { teile.push(`Start ${String(i.startMonat)}`); alt.push(`Start ${f?.startMonat ?? '—'}`); }
  const zurueckEingabe: Record<string, unknown> = {};
  if (i.zielUmsatz != null && f?.zielUmsatz != null) zurueckEingabe.zielUmsatz = f.zielUmsatz;
  if (i.zielGewinn != null && f?.zielGewinn != null) zurueckEingabe.zielGewinn = f.zielGewinn;
  if (i.cash != null && f?.cash != null) zurueckEingabe.cash = f.cash;
  if (i.startMonat != null && f?.startMonat != null) zurueckEingabe.startMonat = f.startMonat;
  return {
    titel: 'Jahresziele im Controlling ändern',
    vorher: alt.join(' · ') || undefined,
    nachher: teile.join(' · ') || 'nichts angegeben',
    ...(Object.keys(zurueckEingabe).length ? { zurueck: { werkzeug: 'setze_ziele', eingabe: zurueckEingabe } } : {}),
  };
}

async function vsMeilenstein(i: Record<string, unknown>, person?: string): Promise<Vorschau> {
  const suche = text(i.titel).toLowerCase();
  const m = await loadJson<{ meilensteine?: { titel: string; fortschritt: number; erledigt: boolean; faellig?: string; zielId?: string; abgeleitetVon?: string }[] }>('meilensteine');
  // Nur, was die Person sehen darf (08.10.: kein Meilenstein an einem nicht geteilten eigenen Ziel einer anderen Person) — wie das Werkzeug.
  const { meilensteineSichtbarFuer } = await import('@/lib/planung/eigene-ziele-sicht-server');
  const treffer = (await meilensteineSichtbarFuer(m?.meilensteine, person ?? null)).find(x => x.titel.toLowerCase().includes(suche));
  const tag = (d?: string) => (d ? `${d.slice(8)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : 'ohne Datum');
  const faellig = typeof i.faellig === 'string' && i.faellig ? text(i.faellig, 10) : '';
  // Ziel und Kette (01.10.): was die Vorschau zusätzlich nennt (Freigabe im Stapel, nie direkt).
  const ziel = i.ziel !== undefined ? (text(i.ziel) ? `Ziel „${text(i.ziel, 80)}“` : 'ohne Ziel-Bezug') : '';
  const wartet = Array.isArray(i.wartet_auf) ? (i.wartet_auf.length ? `wartet auf ${i.wartet_auf.slice(0, 10).map(x => `„${text(x, 80)}“`).join(', ')}` : 'wartet auf niemanden') : '';
  const nachher = [faellig ? `fällig ${tag(faellig)}` : '', i.erledigt === true ? 'abgehakt' : i.fortschritt != null ? `${Number(i.fortschritt)} %` : '', ziel, wartet].filter(Boolean).join(' · ');
  return {
    titel: treffer ? `Meilenstein „${treffer.titel}“` : `Meilenstein „${text(i.titel)}“ — kein Treffer`,
    vorher: treffer ? [faellig ? `fällig ${tag(treffer.faellig)}` : '', treffer.erledigt ? 'erledigt' : `${treffer.fortschritt} %`].filter(Boolean).join(' · ') : undefined,
    nachher: nachher || 'unverändert',
  };
}

async function vsFokus(i: Record<string, unknown>): Promise<Vorschau> {
  const h = String(i.horizont ?? '');
  const z = await loadJson<{ fokus?: Record<string, string> }>('ziele');
  const sp = i.space === 'privat' || i.space === 'business' ? String(i.space) : null;
  const key = sp ? `${sp}:${h}` : h;
  // Fokus des Jahres je Jahr (30.09.): vorher = der Satz dieses Jahres.
  const laufend = Number(localDay().slice(0, 4));
  const jahr = h === 'jahr' && i.jahr != null && Number.isInteger(Number(i.jahr)) ? Number(i.jahr) : null;
  const alt = h === 'jahr' ? fokusImJahr(z?.fokus, key, jahr ?? laufend, laufend) : (z?.fokus?.[key] ?? '');
  return {
    titel: `Fokus (${h}${jahr && jahr !== laufend ? ` ${jahr}` : ''}${sp ? `, ${sp}` : ''}) setzen`,
    vorher: alt ? `„${alt}“` : 'nicht gesetzt',
    nachher: `„${text(i.text, 300)}“`,
    zurueck: { werkzeug: 'setze_fokus', eingabe: { horizont: h, ...(sp ? { space: sp } : {}), ...(jahr ? { jahr } : {}), text: alt } },
  };
}

/** Für die freien Werkzeuge: eine ehrliche Zeile, kein Bestandsvergleich —
 *  sie laufen ohnehin durch, die Vorschau dient nur dem Protokoll. */
const schlicht = (titel: string, nachher: (i: Record<string, unknown>) => string) =>
  async (i: Record<string, unknown>): Promise<Vorschau> => ({ titel, nachher: nachher(i) });

const ABSCHLUSS_LABEL: Record<string, string> = { umsatz: 'Umsatz', kosten: 'Kosten', personal: 'Personal', marketingVertrieb: 'Marketing & Vertrieb', afa: 'AfA', eigenkapital: 'Eigenkapital', bilanzsumme: 'Bilanzsumme', kurzfrVerbindlichkeiten: 'kurzfr. Verbindlichkeiten', bankschulden: 'Bankschulden' };

async function vsMonatsabschluss(i: Record<string, unknown>): Promise<Vorschau> {
  const firma = istGesellschaft(i.firma) ? finanzOrtName(i.firma) : finanzOrtName('kdc');
  const monat = text(i.monat, 7);
  const alt = ((await loadJson<{ eintraege?: Record<string, unknown>[] }>('business-abschluesse'))?.eintraege ?? []).find(e => e.firma === i.firma && e.monat === monat);
  const zeile = (q: Record<string, unknown>) => Object.keys(ABSCHLUSS_LABEL).filter(k => typeof q[k] === 'number').map(k => `${ABSCHLUSS_LABEL[k]} ${eur(q[k])}`).join(' · ');
  return {
    titel: `Monatsabschluss ${firma} ${monat} ${alt ? 'ergänzen' : 'eintragen'}`,
    vorher: alt ? zeile(alt) || 'leer' : undefined,
    nachher: zeile(i) || 'keine Zahlen genannt',
  };
}

// ── Das Register ───────────────────────────────────────────────────────────

export const REGISTER: Record<string, Eintrag> = {
  // Frei — Entscheidung vom 06.09.: Aufgaben, Postfach, eigener Kalender, CRM.
  starte_auftraege: {
    gruppe: 'auftraege', risiko: 'frei',
    // Einreihen wirkt selbst nichts — jeder Auftrag geht beim Ausführen erneut
    // durch dieselbe Risiko-Prüfung. Ein freigabepflichtiges Werkzeug landet
    // also auch aus dem Hintergrund im Stapel.
    vorschau: schlicht('Agenten im Hintergrund starten', i => {
      const liste = Array.isArray(i.auftraege) ? i.auftraege : [];
      return `${liste.length} Aufträge: ${liste.map(x => String((x as Record<string, unknown>)?.agent ?? '?')).join(', ')}`;
    }),
  },
  // Lesen ist frei. Schreiben auch — aber nur ANLEGEN und ANHÄNGEN; ein
  // Werkzeug zum Überschreiben oder Löschen gibt es bewusst nicht.
  suche_wissen: {
    gruppe: 'wissen', risiko: 'frei',
    vorschau: schlicht('Im Gehirn suchen', i => `„${text(i.frage, 120)}“`),
  },
  lies_notiz: {
    gruppe: 'wissen', risiko: 'frei',
    vorschau: schlicht('Notiz lesen', i => text(i.notiz, 160)),
  },
  notiz_anlegen: {
    gruppe: 'wissen', risiko: 'frei',
    vorschau: schlicht('Protokoll im Obsidian-Brain anlegen', i => `„${text(i.titel)}“ in 03. Protokolle`),
  },
  notiz_ergaenzen: {
    gruppe: 'wissen', risiko: 'frei',
    vorschau: schlicht('An Brain-Notiz anhängen', i => `${text(i.notiz, 100)} — ${text(i.text, 80)}`),
  },
  fakt_merken: {
    gruppe: 'gedaechtnis', risiko: 'frei',
    vorschau: schlicht('Fakt merken', i => `${text(i.thema)}: ${text(i.satz, 160)}`),
  },
  frag_gedaechtnis: {
    gruppe: 'gedaechtnis', risiko: 'frei',
    vorschau: schlicht('Im Gedächtnis nachsehen', i => i.thema ? `zu „${text(i.thema)}“` : 'alles'),
  },
  // Business-Index (25.09.): Lesen ist frei; einen Monatsabschluss schreiben sind Finanzzahlen → Freigabe.
  // Gesundheits-Index (26.09.): Lesen ist frei — nur die eigene Person oder wer teilt.
  gesundheits_index: {
    gruppe: 'gesundheit', risiko: 'frei',
    vorschau: schlicht('Gesundheits-Index lesen', i => i.kennzahl ? `Kennzahl ${text(i.kennzahl)}` : 'gesamt'),
  },
  business_index: {
    gruppe: 'business', risiko: 'frei',
    vorschau: schlicht('Business-Index lesen', i => `${text(i.sicht) || 'gesamt'}${i.kennzahl ? ` · ${text(i.kennzahl)}` : ''}`),
  },
  // Gesellschafts-Register (04.10.): nur lesen, Haushalt des Inhabers.
  gesellschaften_lesen: {
    gruppe: 'business', risiko: 'frei',
    vorschau: schlicht('Gesellschaften lesen', i => (i.name ? `„${text(i.name, 80)}“` : 'alle')),
  },
  monatsabschluss_erfassen: { gruppe: 'finanzen', risiko: 'freigabe', vorschau: vsMonatsabschluss },
  // Ideen an MAKE OS selbst — landen in „Ideen“; gebaut wird erst, was eine Person des Haushalts nach „Bereit“ zieht.
  bauplan_notieren: {
    gruppe: 'bauplan', risiko: 'frei',
    vorschau: schlicht('Im Bauplan notieren', i => `„${text(i.titel, 160)}“`),
  },
  create_task: {
    gruppe: 'aufgaben', risiko: 'frei',
    // Für sich selbst frei; für eine ANDERE Person (oder beide) nur nach Freigabe (29.09., #93 der Aufgaben-Liste).
    risikoFuer: (i, person) => {
      const wer = typeof i.wer === 'string' ? i.wer : '';
      return !wer || (person && wer === person) ? 'frei' : 'freigabe';
    },
    vorschau: schlicht('Aufgabe anlegen', i => `„${text(i.title, 200)}“${i.priority && i.priority !== 'medium' ? ` (${PRIO_NAME[String(i.priority)] ?? String(i.priority)})` : ''}${i.einheit && i.space !== 'privat' ? ` · ${text(i.einheit, 40)}` : ''}${typeof i.unter === 'string' && i.unter.trim() ? ` · Unteraufgabe von „${text(i.unter, 80)}“` : ''}`),
  },
  // K6a (29.09.): freie Zeit nur LESEN (freieZeitFuer — Zeiten, nie Titel).
  freie_zeit: {
    gruppe: 'kalender', risiko: 'frei',
    vorschau: schlicht('Freie Zeit suchen', i => `${Number(i.dauerMin) || 60} Min.${Array.isArray(i.personen) && i.personen.length ? ` mit ${(i.personen as unknown[]).map(String).join(', ').slice(0, 60)}` : ''}`),
  },
  // F2 M8 (29.09., Vorgabe „ZOE schreibt nur über den Stapel“): ein Block ist ein Termin im Kalender — erst der Klick im
  // Stapel legt ihn an (Blöcke-Weg, lib/planung/bloecke-server.ts). Gruppe „kalender“: Heute/Glocke zählen ihn als Kalender-Vorschlag.
  plan_block: {
    gruppe: 'kalender', risiko: 'freigabe',
    vorschau: schlicht('Block in deinen Kalender legen', i => `„${text(i.titel)}“ am ${tagDe(i.date)}`),
  },
  lies_postfach: {
    gruppe: 'inbox', risiko: 'frei',
    vorschau: schlicht('Postfach lesen', i => i.suche ? `Suche nach „${text(i.suche, 60)}“` : 'Übersicht der neuesten Nachrichten'),
  },
  setze_vitalwerte: {
    gruppe: 'gesundheit', risiko: 'frei',
    vorschau: schlicht('Tagesform eintragen', i => [
      i.recovery != null ? `Recovery ${Number(i.recovery)} %` : null,
      i.schlaf != null ? `Schlaf ${Number(i.schlaf)} h` : null,
      i.hrv != null ? `HRV ${Number(i.hrv)} ms` : null,
      i.ruhepuls != null ? `Ruhepuls ${Number(i.ruhepuls)}` : null,
    ].filter(Boolean).join(' · ') || 'keine Werte'),
  },
  // Gesundheit (23.09.): vier Griffe, alle frei — sie erfassen nur, was die
  // Person selbst gesagt hat, und verlassen das System nicht.
  hake_routine: {
    gruppe: 'gesundheit', risiko: 'frei',
    vorschau: schlicht('Routine abhaken', i => Array.isArray(i.routinen) ? (i.routinen as unknown[]).map(String).join(', ') : text(i.routine)),
  },
  haut_eintrag: {
    gruppe: 'gesundheit', risiko: 'frei',
    vorschau: schlicht('Haut-Tagebuch', i => `Juckreiz ${Number(i.juckreiz)}/10${i.schub ? ' · Schub' : ''}${i.ausloeser ? ` · ${text(i.ausloeser, 40)}` : ''}`),
  },
  einkauf_setzen: {
    gruppe: 'gesundheit', risiko: 'frei',
    vorschau: schlicht('Einkaufsliste', i => (Array.isArray(i.posten) ? i.posten.map(String).join(', ') : String(i.posten ?? '')) || 'Posten'),
  },
  journal_eintrag: {
    gruppe: 'gesundheit', risiko: 'frei',
    vorschau: schlicht('Journal', i => ['gut', 'dankbar', 'hart', 'text'].filter(k => i[k]).join(', ') || 'Tages-Check'),
  },
  streak_eintrag: {
    gruppe: 'gesundheit', risiko: 'frei',
    vorschau: schlicht('Streak', i => i.sauber === false ? 'Rückfall notieren' : 'sauber geblieben'),
  },
  // 26.09.: Honorare landen im MRR und im Business-Index — Freigabe statt frei.
  setze_kunde: {
    gruppe: 'kunden', risiko: 'freigabe',
    vorschau: schlicht('Kunde in der Markttraktion pflegen', i => `${text(i.name)}${i.status ? ` · ${String(i.status)}` : ''}`),
  },
  // CRM (18.09.): finden und entwerfen frei; seit 29.09. (#90) SCHREIBT ZOE ins CRM nur über den Stapel —
  // notieren, Deal anlegen, übergeben erst nach Freigabe. Ein Werkzeug zum VERSENDEN gibt es absichtlich nicht.
  suche_kontakt: {
    gruppe: 'kontakte', risiko: 'frei',
    vorschau: schlicht('Kontakt in der Kartei suchen', i => text(i.frage)),
  },
  notiere_kontakt: {
    gruppe: 'kontakte', risiko: 'freigabe',
    vorschau: schlicht('Aktivität am Kontakt notieren', i => `${text(i.kontakt)} · ${text(i.art) || 'notiz'}${i.ergebnis ? ` · ${text(i.ergebnis)}` : ''}${i.naechster_schritt ? ` · nächster Schritt ${text(i.naechster_schritt, 60)}` : ''}`),
  },
  chance_anlegen: {
    gruppe: 'kontakte', risiko: 'freigabe',
    vorschau: schlicht('Chance in der Pipeline anlegen', i => `${text(i.kontakt)}${i.titel ? ` · ${text(i.titel)}` : ''}`),
  },
  uebergeben: {
    gruppe: 'kontakte', risiko: 'freigabe',
    vorschau: schlicht('Kontakt im Team übergeben', i => `${text(i.kontakt)} → ${text(i.an)}`),
  },
  crm_lage: {
    gruppe: 'kontakte', risiko: 'frei',
    vorschau: schlicht('Markttraktion lesen', () => 'Traction-Score, Übergaben, wer dran ist, Befunde'),
  },
  // Markttraktion ganz (28.09., C7): alles Lesen frei (gekapselt, Art. 18 ausgeblendet, fremde private Notizen weg,
  // IBAN maskiert); crm_vorschlag ist frei, weil es NUR in den Stapel legt — übernommen wird erst per Klick.
  crm_suche: { gruppe: 'markttraktion', risiko: 'frei', vorschau: schlicht('Markttraktion durchsuchen', i => text(i.frage) || 'mit Filtern') },
  kontakt_akte: { gruppe: 'markttraktion', risiko: 'frei', vorschau: schlicht('Kontakt lesen', i => text(i.kontakt)) },
  firma_akte: { gruppe: 'markttraktion', risiko: 'frei', vorschau: schlicht('Firmenakte lesen', i => text(i.firma)) },
  pipeline: { gruppe: 'markttraktion', risiko: 'frei', vorschau: schlicht('Pipeline lesen', i => text(i.deal) || 'alle offenen Deals') },
  mandate_lage: { gruppe: 'markttraktion', risiko: 'frei', vorschau: schlicht('Mandate lesen', i => text(i.mandat) || 'alle') },
  angebote_lage: { gruppe: 'markttraktion', risiko: 'frei', vorschau: schlicht('Angebote lesen', i => text(i.angebot) || 'alle') },
  kampagnen_lage: { gruppe: 'markttraktion', risiko: 'frei', vorschau: schlicht('Kampagnen lesen', i => text(i.kampagne) || 'alle') },
  events_lage: { gruppe: 'markttraktion', risiko: 'frei', vorschau: schlicht('Events lesen', i => text(i.event) || 'alle') },
  besuche_lage: { gruppe: 'markttraktion', risiko: 'frei', vorschau: schlicht('Besuchte Events lesen', i => text(i.event) || 'alle') },
  marketing_lage: { gruppe: 'markttraktion', risiko: 'frei', vorschau: schlicht('Marketing lesen', () => 'Beiträge, Newsletter, Segmente, Kennzahlen') },
  kennzahlen: { gruppe: 'markttraktion', risiko: 'frei', vorschau: schlicht('Kennzahlen lesen', () => 'Traktions-Index, Kennzahlen, Befunde') },
  sales_lage: { gruppe: 'markttraktion', risiko: 'frei', vorschau: schlicht('Sales lesen', () => 'Power Hour, Team, Auswertung') },
  qualifizierung_lage: { gruppe: 'markttraktion', risiko: 'frei', vorschau: schlicht('Qualifizierung lesen', () => 'Runden, Score, Lifecycle') },
  stammdaten_lage: { gruppe: 'markttraktion', risiko: 'frei', vorschau: schlicht('Stammdaten lesen', () => 'Gesellschaften, Produkte, Import-Konflikte') },
  datenqualitaet: { gruppe: 'markttraktion', risiko: 'frei', vorschau: schlicht('Datenqualität lesen', () => 'Verbindungsprüfung, Dubletten') },
  crm_datei_lesen: { gruppe: 'markttraktion', risiko: 'frei', vorschau: schlicht('CRM-Datei lesen', i => `${text(i.datei, 40)}${i.teil ? ` · Teil ${text(i.teil, 4)}` : ''}`) },
  heads_lage: { gruppe: 'markttraktion', risiko: 'frei', vorschau: schlicht('Heads lesen', i => text(i.head) || 'Sales, Marketing, Event') },
  ...CRM_VORSCHLAG_REGISTER,
  entwurf_ansprache: {
    gruppe: 'kontakte', risiko: 'frei',
    vorschau: schlicht('Ansprache entwerfen — kein Versand', i => text(i.kontakt)),
  },
  // Projekt-/Aufgaben-Dateien (28.09., C2): nur lesen, gekapselt, nie die CRM-Ablage.
  projekt_unterlagen: {
    gruppe: 'aufgaben-dateien', risiko: 'frei',
    vorschau: schlicht('Projekt-Unterlagen lesen', i => text(i.aufgabe) || text(i.projekt) || '—'),
  },
  datei_lesen: {
    gruppe: 'aufgaben-dateien', risiko: 'frei',
    vorschau: schlicht('Projekt-Datei lesen', i => `${text(i.datei, 40)}${i.teil ? ` · Teil ${text(i.teil, 4)}` : ''}`),
  },
  // ZOE-Aufgaben (28.09., C4): lesen und übergeben frei; das Übernehmen ist KEIN Werkzeug (nur Stapel/Route).
  ...AUFGABEN_REGISTER,
  // Eine Suche über Brain und App (29.09., B3, lib/zoe/arbeit-werkzeug.ts) — nur lesen.
  ...ARBEIT_REGISTER,
  // ZOE steuert die Heads (09.10., Paket 4a, lib/agenten/zoe-heads.ts). an_head ist frei, weil es NUR einreiht (Thread + Warteschlange):
  // jede Wirkung des Heads bleibt ein Vorschlag im Stapel. head_fragen liest nur (der Head bekommt nur lesende Werkzeuge).
  an_head: {
    gruppe: 'agenten', risiko: 'frei',
    vorschau: schlicht('Auftrag an einen Head', i => `${text(i.head, 40)}: ${text(i.auftrag, 140)}`),
  },
  head_fragen: {
    gruppe: 'agenten', risiko: 'frei',
    vorschau: schlicht('Einen Head fragen', i => `${text(i.head, 40)}: ${text(i.frage, 140)}`),
  },

  // Freigabe — Geld, Ziele, Kompass. Wird zum Vorschlag im Stapel.
  // Haushaltsfinanzen (24.09.): lesen läuft durch, Ändern braucht die Freigabe.
  haushalt_stand: { gruppe: 'haushalt', risiko: 'frei', vorschau: schlicht('Haushalts-Stand lesen', () => 'privat, nur lesen') },
  haushalt_buchungen: { gruppe: 'haushalt', risiko: 'frei', vorschau: schlicht('Private Buchungen suchen', i => text(i.suche) || text(i.monat) || text(i.kategorie) || 'alle') },
  haushalt_zuordnen: { gruppe: 'haushalt', risiko: 'freigabe', vorschau: schlicht('Private Buchungen zuordnen und Regel merken', i => `„${text(i.muster)}“ → ${text(i.kategorie)}${i.rueckwirkend === false ? '' : ' · auch rückwirkend'}`) },
  haushalt_rechnung_bezahlt: { gruppe: 'haushalt', risiko: 'freigabe', vorschau: schlicht('Private Rechnung als bezahlt vermerken', i => text(i.rechnung)) },
  haushalt_rechnung_erfassen: { gruppe: 'haushalt', risiko: 'freigabe', vorschau: schlicht('Private offene Rechnung erfassen', i => `${text(i.an)}${i.betrag ? ` · ${eur(i.betrag)}` : ''}${i.faellig ? ` · fällig ${tagDe(i.faellig)}` : ''}`) },
  setze_kontostand: { gruppe: 'finanzen', risiko: 'freigabe', vorschau: vsKontostand },
  erfasse_rechnung: { gruppe: 'finanzen', risiko: 'freigabe', vorschau: vsRechnung },
  erfasse_zahlung: { gruppe: 'finanzen', risiko: 'freigabe', vorschau: vsZahlung },
  erfasse_planposten: { gruppe: 'finanzen', risiko: 'freigabe', vorschau: vsPlanposten },
  setze_ziele: { gruppe: 'finanzen', risiko: 'freigabe', vorschau: vsZiele },
  setze_meilenstein: { gruppe: 'meilensteine', risiko: 'freigabe', vorschau: vsMeilenstein },
  setze_fokus: { gruppe: 'fokus', risiko: 'freigabe', vorschau: vsFokus },
};

/** Kennt das Register jedes Werkzeug, das es auch wirklich gibt? Fällt sonst
 *  erst zur Laufzeit auf — und dann liefe ein Werkzeug ohne Stufe durch. */
export function fehlendeStufen(): string[] {
  return Object.keys(WERKZEUGE).filter(n => !REGISTER[n]);
}

export function risikoVon(name: string): Risiko {
  // Unbekanntes Werkzeug ist im Zweifel freigabepflichtig, nicht frei.
  return REGISTER[name]?.risiko ?? 'freigabe';
}

const RANG: Record<Risiko, number> = { frei: 0, freigabe: 1, nie: 2 };
/**
 * Die Stufe für DIESEN Aufruf (29.09.): die feste Stufe, verschärft durch `risikoFuer` — nie gelockert
 * (ein `risikoFuer`, das „frei“ liefert, macht aus „freigabe“ nichts Freies).
 */
export function risikoFuerAufruf(name: string, input: Record<string, unknown>, person?: string): Risiko {
  const fest = risikoVon(name);
  const e = REGISTER[name];
  if (!e?.risikoFuer) return fest;
  let je: Risiko = fest;
  try { je = e.risikoFuer(input ?? {}, person); } catch { je = 'freigabe'; }
  return RANG[je] > RANG[fest] ? je : fest;
}

export function gruppeVon(name: string): string {
  return REGISTER[name]?.gruppe ?? WERKZEUGE[name]?.gruppe ?? 'sonstige';
}

export async function vorschauVon(name: string, input: Record<string, unknown>, person?: string): Promise<Vorschau> {
  const e = REGISTER[name];
  if (!e) return { titel: name, nachher: 'unbekanntes Werkzeug' };
  try {
    return await e.vorschau(input, person);
  } catch {
    return { titel: name, nachher: 'Vorschau nicht möglich' };
  }
}
