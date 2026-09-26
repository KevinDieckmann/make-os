// ─── MAKE OS — Jarvis' Werkzeug-Register ────────────────────────────────────
// Baustein 1 (07.09.), nach Kevins Entscheidung vom 06.09.:
//
//   frei     — Aufgaben, Postfach einordnen, eigener Kalender, CRM anreichern.
//              Läuft durch, wird protokolliert, ist rücknehmbar.
//   freigabe — Geld, Ziele, Kompass, Löschen, alles Ausgehende.
//              Wird zum Vorschlag im Stapel, den Kevin morgens und abends
//              durchgeht. Erst seine Freigabe führt aus.
//   nie      — gibt es hier bewusst noch nicht; die Stufe steht bereit, damit
//              spätere Werkzeuge (Versand, Löschen von Beständen) sie tragen.
//
// WICHTIG — und das ist der Grund, warum das hier steht und nicht im Prompt:
// Die Stufe ist eine Eigenschaft des Werkzeugs, nicht eine Entscheidung des
// Modells. Kein Satz, den jemand Jarvis schreibt, kann sie umgehen.

import { loadJson } from '@/lib/store/local-db';
import { WERKZEUGE } from './werkzeuge';

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
  /** Trockenlauf: liest denselben Bestand wie die Ausführung, ändert nichts. */
  vorschau: (input: Record<string, unknown>) => Promise<Vorschau>;
}

const eur = (n: unknown) => {
  const z = Number(n);
  return isFinite(z)
    ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(z))
    : '—';
};
const firma = (rein: unknown) => (/ventures|kdv/i.test(String(rein ?? '')) ? 'kdv' : 'kdc');
const text = (v: unknown, n = 120) => String(v ?? '').trim().slice(0, n);

// ── Trockenläufe ───────────────────────────────────────────────────────────
// Jeder liest genau den Bestand, den die Ausführung anfassen würde. Dadurch
// zeigt die Vorschau garantiert dieselbe Wirklichkeit wie der echte Lauf.

async function vsKontostand(i: Record<string, unknown>): Promise<Vorschau> {
  const fid = firma(i.firma);
  const f = await loadJson<{ firmen?: { id: string; name: string; kontostand: number | null }[] }>('finanzplan');
  const treffer = (f?.firmen ?? []).find(x => x.id === fid);
  return {
    titel: `Kontostand ${treffer?.name ?? fid} setzen`,
    vorher: treffer?.kontostand != null ? eur(treffer.kontostand) : 'nicht gesetzt',
    nachher: eur(i.betrag),
    ...(treffer?.kontostand != null
      ? { zurueck: { werkzeug: 'setze_kontostand', eingabe: { firma: fid, betrag: treffer.kontostand } } }
      : {}),
  };
}

async function vsRechnung(i: Record<string, unknown>): Promise<Vorschau> {
  const kunde = text(i.kunde);
  const f = await loadJson<{ rechnungen?: { kunde: string; titel: string; betrag: number; status: string }[] }>('finanzplan');
  const r = (f?.rechnungen ?? []).find(x => x.kunde.toLowerCase() === kunde.toLowerCase());
  const neu = [
    i.betrag != null ? eur(i.betrag) : r ? eur(r.betrag) : '—',
    i.status ? String(i.status) : r?.status,
    i.faellig ? `fällig ${i.faellig}` : undefined,
  ].filter(Boolean).join(' · ');
  return {
    titel: r ? `Rechnung ${kunde} ändern` : `Rechnung ${kunde} anlegen`,
    vorher: r ? `${eur(r.betrag)} · ${r.status}` : undefined,
    nachher: neu,
  };
}

async function vsZahlung(i: Record<string, unknown>): Promise<Vorschau> {
  return {
    titel: `Zahlung an ${text(i.an)} eintragen`,
    nachher: `${eur(i.betrag)}${i.faellig ? ` · fällig ${i.faellig}` : ''} — geht in die Prioritätenliste`,
  };
}

async function vsPlanposten(i: Record<string, unknown>): Promise<Vorschau> {
  const titel = text(i.titel, 160);
  const l = await loadJson<{ posten?: { titel: string; betrag: number; rhythmus: string }[] }>('liquiplan');
  const p = (l?.posten ?? []).find(x => x.titel.toLowerCase() === titel.toLowerCase());
  const rhythmus = String(i.rhythmus ?? 'monatlich');
  const betrag = Number(i.betrag);
  return {
    titel: p ? `Planposten „${titel}" ändern` : `Planposten „${titel}" anlegen`,
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

async function vsMeilenstein(i: Record<string, unknown>): Promise<Vorschau> {
  const suche = text(i.titel).toLowerCase();
  const m = await loadJson<{ meilensteine?: { titel: string; fortschritt: number; erledigt: boolean }[] }>('meilensteine');
  const treffer = (m?.meilensteine ?? []).find(x => x.titel.toLowerCase().includes(suche));
  return {
    titel: treffer ? `Meilenstein „${treffer.titel}"` : `Meilenstein „${text(i.titel)}" — kein Treffer`,
    vorher: treffer ? (treffer.erledigt ? 'erledigt' : `${treffer.fortschritt} %`) : undefined,
    nachher: i.erledigt === true ? 'abgehakt' : i.fortschritt != null ? `${Number(i.fortschritt)} %` : 'unverändert',
  };
}

async function vsFokus(i: Record<string, unknown>): Promise<Vorschau> {
  const h = String(i.horizont ?? '');
  const z = await loadJson<{ fokus?: Record<string, string> }>('ziele');
  return {
    titel: `Fokus (${h}) setzen`,
    vorher: z?.fokus?.[h] ? `„${z.fokus[h]}"` : 'nicht gesetzt',
    nachher: `„${text(i.text, 300)}"`,
    zurueck: { werkzeug: 'setze_fokus', eingabe: { horizont: h, text: z?.fokus?.[h] ?? '' } },
  };
}

/** Für die freien Werkzeuge: eine ehrliche Zeile, kein Bestandsvergleich —
 *  sie laufen ohnehin durch, die Vorschau dient nur dem Protokoll. */
const schlicht = (titel: string, nachher: (i: Record<string, unknown>) => string) =>
  async (i: Record<string, unknown>): Promise<Vorschau> => ({ titel, nachher: nachher(i) });

const ABSCHLUSS_LABEL: Record<string, string> = { umsatz: 'Umsatz', kosten: 'Kosten', personal: 'Personal', marketingVertrieb: 'Marketing & Vertrieb', afa: 'AfA', eigenkapital: 'Eigenkapital', bilanzsumme: 'Bilanzsumme', kurzfrVerbindlichkeiten: 'kurzfr. Verbindlichkeiten', bankschulden: 'Bankschulden' };

async function vsMonatsabschluss(i: Record<string, unknown>): Promise<Vorschau> {
  const firma = i.firma === 'kdv' ? 'KD Ventures' : 'Consulting';
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
  // Frei — Kevins Entscheidung: Aufgaben, Postfach, eigener Kalender, CRM.
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
    vorschau: schlicht('Im Gehirn suchen', i => `„${text(i.frage, 120)}"`),
  },
  lies_notiz: {
    gruppe: 'wissen', risiko: 'frei',
    vorschau: schlicht('Notiz lesen', i => text(i.notiz, 160)),
  },
  notiz_anlegen: {
    gruppe: 'wissen', risiko: 'frei',
    vorschau: schlicht('Protokoll im Obsidian-Brain anlegen', i => `„${text(i.titel)}" in 03. Protokolle`),
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
    vorschau: schlicht('Im Gedächtnis nachsehen', i => i.thema ? `zu „${text(i.thema)}"` : 'alles'),
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
  monatsabschluss_erfassen: { gruppe: 'finanzen', risiko: 'freigabe', vorschau: vsMonatsabschluss },
  // Ideen an MAKE OS selbst — landen in „Ideen“; gebaut wird erst, was Kevin oder Malin nach „Bereit“ ziehen.
  bauplan_notieren: {
    gruppe: 'bauplan', risiko: 'frei',
    vorschau: schlicht('Im Bauplan notieren', i => `„${text(i.titel, 160)}“`),
  },
  create_task: {
    gruppe: 'aufgaben', risiko: 'frei',
    vorschau: schlicht('Aufgabe anlegen', i => `„${text(i.title, 200)}"${i.priority && i.priority !== 'medium' ? ` (${String(i.priority)})` : ''}`),
  },
  plan_block: {
    gruppe: 'planer', risiko: 'frei',
    vorschau: schlicht('Block in den Planer legen', i => `„${text(i.titel)}" am ${text(i.date, 10)}`),
  },
  lies_postfach: {
    gruppe: 'inbox', risiko: 'frei',
    vorschau: schlicht('Postfach lesen', i => i.suche ? `Suche nach „${text(i.suche, 60)}"` : 'Übersicht der neuesten Nachrichten'),
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
  // CRM (18.09.): finden, notieren, entwerfen — alles frei, weil nichts davon
  // das System verlässt. Ein Werkzeug zum VERSENDEN gibt es absichtlich nicht.
  suche_kontakt: {
    gruppe: 'kontakte', risiko: 'frei',
    vorschau: schlicht('Kontakt in der Kartei suchen', i => text(i.frage)),
  },
  notiere_kontakt: {
    gruppe: 'kontakte', risiko: 'frei',
    vorschau: schlicht('Aktivität am Kontakt notieren', i => `${text(i.kontakt)} · ${text(i.art) || 'notiz'}${i.ergebnis ? ` · ${text(i.ergebnis)}` : ''}${i.naechster_schritt ? ` · nächster Schritt ${text(i.naechster_schritt, 60)}` : ''}`),
  },
  chance_anlegen: {
    gruppe: 'kontakte', risiko: 'frei',
    vorschau: schlicht('Chance in der Pipeline anlegen', i => `${text(i.kontakt)}${i.titel ? ` · ${text(i.titel)}` : ''}`),
  },
  uebergeben: {
    gruppe: 'kontakte', risiko: 'frei',
    vorschau: schlicht('Kontakt übergeben (Kevin/Malin)', i => `${text(i.kontakt)} → ${text(i.an)}`),
  },
  crm_lage: {
    gruppe: 'kontakte', risiko: 'frei',
    vorschau: schlicht('Markttraktion lesen', () => 'Traction-Score, Übergaben, wer dran ist, Befunde'),
  },
  entwurf_ansprache: {
    gruppe: 'kontakte', risiko: 'frei',
    vorschau: schlicht('Ansprache entwerfen — kein Versand', i => text(i.kontakt)),
  },

  // Freigabe — Geld, Ziele, Kompass. Wird zum Vorschlag im Stapel.
  // Haushaltsfinanzen (24.09.): lesen läuft durch, Ändern braucht die Freigabe.
  haushalt_stand: { gruppe: 'haushalt', risiko: 'frei', vorschau: schlicht('Haushalts-Stand lesen', () => 'privat, nur lesen') },
  haushalt_buchungen: { gruppe: 'haushalt', risiko: 'frei', vorschau: schlicht('Private Buchungen suchen', i => text(i.suche) || text(i.monat) || text(i.kategorie) || 'alle') },
  haushalt_zuordnen: { gruppe: 'haushalt', risiko: 'freigabe', vorschau: schlicht('Private Buchungen zuordnen und Regel merken', i => `„${text(i.muster)}“ → ${text(i.kategorie)}${i.rueckwirkend === false ? '' : ' · auch rückwirkend'}`) },
  haushalt_rechnung_bezahlt: { gruppe: 'haushalt', risiko: 'freigabe', vorschau: schlicht('Private Rechnung als bezahlt vermerken', i => text(i.rechnung)) },
  haushalt_rechnung_erfassen: { gruppe: 'haushalt', risiko: 'freigabe', vorschau: schlicht('Private offene Rechnung erfassen', i => `${text(i.an)}${i.betrag ? ` · ${eur(i.betrag)}` : ''}${i.faellig ? ` · fällig ${text(i.faellig, 10)}` : ''}`) },
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

export function gruppeVon(name: string): string {
  return REGISTER[name]?.gruppe ?? WERKZEUGE[name]?.gruppe ?? 'sonstige';
}

export async function vorschauVon(name: string, input: Record<string, unknown>): Promise<Vorschau> {
  const e = REGISTER[name];
  if (!e) return { titel: name, nachher: 'unbekanntes Werkzeug' };
  try {
    return await e.vorschau(input);
  } catch {
    return { titel: name, nachher: 'Vorschau nicht möglich' };
  }
}
