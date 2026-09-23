// ─── MAKE OS — Finanzplan (lokal) ───────────────────────────────────────────
// Der lebende Finanz-Organismus: beide Firmen (KD Ventures + Kevin Dieckmann
// Consulting) mit Konten (Vivid, Stand von Hand — Anbindung steht im Bauplan),
// die Rechnungs-Pipeline (geplant → gestellt → bezahlt) und Merkposten wie der
// Björn-Kredit. Das Controlling (/os/controlling) bleibt die Ist-Buchhaltung
// je Monat — hier lebt die Planung/Verwaltung davor.

import { NextResponse } from 'next/server';
import { loadJson, updateJson, updateGeschuetztListen } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface Firma {
  id: string;
  name: string;
  bank: string;
  /** Kontostand in €, von Hand gepflegt (null = noch nie eingetragen). */
  kontostand: number | null;
  /** Tag des letzten Eintrags YYYY-MM-DD. */
  stand: string | null;
}
export type RechnungStatus = 'geplant' | 'gestellt' | 'bezahlt';
export interface Rechnung {
  id: string;
  firmaId: string;
  kunde: string;
  titel: string;
  betrag: number;
  status: RechnungStatus;
  faellig?: string;
  /** Der ganze Vorgang: Angebot → Rechnung → Eingang (Kevins Ansage 02.08.). */
  nummer?: string;
  datum?: string;
  angebot?: string;
  angebotAm?: string;
  bezahltAm?: string;
  netto?: number;
  ustSatz?: number;
  leistungVon?: string;
  leistungBis?: string;
  notiz?: string;
}
export interface Merkposten {
  id: string;
  firmaId: string;
  titel: string;
  /** Positiv = erhalten (z.B. Kredit), negativ = zu zahlen. */
  betrag: number;
  art: 'kredit' | 'sonstig';
  datum?: string;
  notiz?: string;
}
/** Zu zahlende Posten — die Reihenfolge im Array IST die Prioritätenliste. */
export interface Zahlung {
  id: string;
  firmaId: string;
  an: string;
  titel: string;
  betrag: number;
  status: 'offen' | 'bezahlt';
  faellig?: string;
}
export interface Produkt {
  id: string;
  name: string;
  beschreibung: string;
  preis: number;
  einheit: 'einmalig' | 'monatlich' | 'projekt';
  status: 'entwurf' | 'aktiv';
}
/** Das Finanz-Uhrwerk: 2× im Monat Meeting, Checkliste läuft immer wieder durch. */
export interface Uhrwerk {
  letztesMeeting: string | null;
  agenda: { id: string; label: string; done: boolean }[];
}
export interface FinanzplanFile {
  firmen: Firma[];
  rechnungen: Rechnung[];
  merkposten: Merkposten[];
  zahlungen: Zahlung[];
  produkte: Produkt[];
  uhrwerk: Uhrwerk;
}

const STATI: RechnungStatus[] = ['geplant', 'gestellt', 'bezahlt'];

// Echter Startbestand (Kevins Ansage 31.07.2026) — alles editierbar.
const SEED: FinanzplanFile = {
  firmen: [
    { id: 'kdv', name: 'KD Ventures', bank: 'Vivid', kontostand: null, stand: null },
    { id: 'kdc', name: 'Kevin Dieckmann Consulting', bank: 'Vivid', kontostand: null, stand: null },
  ],
  rechnungen: [
    { id: 'r-onebanking', firmaId: 'kdc', kunde: 'OneBanking', titel: 'Beratung/Umsetzung — Leistung abrechnen', betrag: 0, status: 'geplant', faellig: '2026-08-02', notiz: 'Betrag eintragen, dann stellen.' },
    { id: 'r-acme', firmaId: 'kdc', kunde: 'ACME', titel: 'Neues Mandat — Einstieg', betrag: 0, status: 'geplant', notiz: 'Kunde im Aufbau — Umfang klären.' },
  ],
  merkposten: [
    { id: 'm-bjoern', firmaId: 'kdc', titel: 'Björn-Kredit erhalten', betrag: 17_000, art: 'kredit', datum: '2026-07-30', notiz: 'Eingang 30.07 — Rückzahlung offen halten.' },
  ],
  zahlungen: [],
  // Entwürfe fürs Finanzmeeting — zum Festzurren, alles editierbar.
  produkte: [
    { id: 'p-sprint', name: 'Klarheits-Sprint', beschreibung: 'Kompakter Einstieg: Analyse + Maßnahmenplan mit klarem Ergebnis.', preis: 0, einheit: 'einmalig', status: 'entwurf' },
    { id: 'p-mandat', name: 'Begleitungs-Mandat', beschreibung: 'Laufende Beratung & Steuerung im monatlichen Mandat.', preis: 0, einheit: 'monatlich', status: 'entwurf' },
    { id: 'p-umsetzung', name: 'Umsetzungs-Mandat', beschreibung: 'Projekt mit definiertem Ergebnis — wie OneBanking.', preis: 0, einheit: 'projekt', status: 'entwurf' },
  ],
  uhrwerk: {
    letztesMeeting: null,
    agenda: [
      { id: 'a-konten', label: 'Kontostände beider Vivid-Konten eintragen', done: false },
      { id: 'a-rechnungen', label: 'Alle offenen Rechnungen zusammenziehen (rein & raus)', done: false },
      { id: 'a-prio', label: 'Zahlungs-Prioritätenliste festlegen — was zuerst?', done: false },
      { id: 'a-kredit', label: 'Kreditvertrag Firma → privat aufsetzen (mit Steuerberater absichern)', done: false },
      { id: 'a-plan', label: 'Finanzplan füllen: Monats-Umsatz & Kosten im Controlling', done: false },
      { id: 'a-produkte', label: 'Produktpakete festzurren (Entwürfe unten)', done: false },
      { id: 'a-vertrieb', label: 'Vertriebsziele festlegen → in Jahr & Ziele eintragen', done: false },
    ],
  },
};

/** Ein Datum oder gar nichts — spart die Wiederholung bei jedem Feld. */
const tag = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

function sauberFile(f: Partial<FinanzplanFile> | null): FinanzplanFile {
  return {
    firmen: (Array.isArray(f?.firmen) ? f!.firmen : []).slice(0, 10).map(x => ({
      id: String(x.id ?? '').slice(0, 40) || `f-${Math.random().toString(36).slice(2, 8)}`,
      name: String(x.name ?? '').slice(0, 120),
      bank: String(x.bank ?? '').slice(0, 60),
      kontostand: x.kontostand == null || !isFinite(Number(x.kontostand)) ? null : Math.round(Number(x.kontostand)),
      stand: typeof x.stand === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.stand) ? x.stand : null,
    })).filter(x => x.name),
    rechnungen: (Array.isArray(f?.rechnungen) ? f!.rechnungen : []).slice(0, 200).map(x => ({
      id: String(x.id ?? '').slice(0, 40) || `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      firmaId: String(x.firmaId ?? '').slice(0, 40),
      kunde: String(x.kunde ?? '').slice(0, 120),
      titel: String(x.titel ?? '').slice(0, 200),
      betrag: isFinite(Number(x.betrag)) ? Math.max(0, Math.round(Number(x.betrag))) : 0,
      status: STATI.includes(x.status as RechnungStatus) ? x.status as RechnungStatus : 'geplant',
      faellig: tag(x.faellig),
      // Der ganze Vorgang, nicht nur der Betrag: Angebot → Rechnung → Eingang.
      nummer: x.nummer ? String(x.nummer).slice(0, 60) : undefined,
      datum: tag(x.datum),
      angebot: x.angebot ? String(x.angebot).slice(0, 60) : undefined,
      angebotAm: tag(x.angebotAm),
      bezahltAm: tag(x.bezahltAm),
      netto: x.netto == null || !isFinite(Number(x.netto)) ? undefined : Math.round(Number(x.netto) * 100) / 100,
      ustSatz: x.ustSatz == null || !isFinite(Number(x.ustSatz)) ? undefined : Math.max(0, Math.min(30, Number(x.ustSatz))),
      leistungVon: tag(x.leistungVon),
      leistungBis: tag(x.leistungBis),
      notiz: x.notiz ? String(x.notiz).slice(0, 300) : undefined,
    })).filter(x => x.kunde || x.titel),
    merkposten: (Array.isArray(f?.merkposten) ? f!.merkposten : []).slice(0, 100).map(x => ({
      id: String(x.id ?? '').slice(0, 40) || `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      firmaId: String(x.firmaId ?? '').slice(0, 40),
      titel: String(x.titel ?? '').slice(0, 200),
      betrag: isFinite(Number(x.betrag)) ? Math.round(Number(x.betrag)) : 0,
      art: (x.art === 'kredit' ? 'kredit' : 'sonstig') as Merkposten['art'],
      datum: typeof x.datum === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.datum) ? x.datum : undefined,
      notiz: x.notiz ? String(x.notiz).slice(0, 300) : undefined,
    })).filter(x => x.titel),
    zahlungen: (Array.isArray(f?.zahlungen) ? f!.zahlungen : []).slice(0, 100).map(x => ({
      id: String(x.id ?? '').slice(0, 40) || `z-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      firmaId: String(x.firmaId ?? '').slice(0, 40),
      an: String(x.an ?? '').slice(0, 120),
      titel: String(x.titel ?? '').slice(0, 200),
      betrag: isFinite(Number(x.betrag)) ? Math.max(0, Math.round(Number(x.betrag))) : 0,
      status: (x.status === 'bezahlt' ? 'bezahlt' : 'offen') as Zahlung['status'],
      faellig: typeof x.faellig === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.faellig) ? x.faellig : undefined,
    })).filter(x => x.an || x.titel),
    produkte: (Array.isArray(f?.produkte) ? f!.produkte : []).slice(0, 30).map(x => ({
      id: String(x.id ?? '').slice(0, 40) || `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: String(x.name ?? '').slice(0, 120),
      beschreibung: String(x.beschreibung ?? '').slice(0, 300),
      preis: isFinite(Number(x.preis)) ? Math.max(0, Math.round(Number(x.preis))) : 0,
      einheit: (['einmalig', 'monatlich', 'projekt'].includes(x.einheit as string) ? x.einheit : 'einmalig') as Produkt['einheit'],
      status: (x.status === 'aktiv' ? 'aktiv' : 'entwurf') as Produkt['status'],
    })).filter(x => x.name),
    uhrwerk: {
      letztesMeeting: typeof f?.uhrwerk?.letztesMeeting === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f.uhrwerk.letztesMeeting) ? f.uhrwerk.letztesMeeting : null,
      agenda: (Array.isArray(f?.uhrwerk?.agenda) ? f!.uhrwerk!.agenda : []).slice(0, 20).map(x => ({
        id: String(x.id ?? '').slice(0, 40) || `a-${Math.random().toString(36).slice(2, 8)}`,
        label: String(x.label ?? '').slice(0, 200),
        done: x.done === true,
      })).filter(x => x.label),
    },
  };
}

export async function GET() {
  let f = await loadJson<FinanzplanFile>('finanzplan');
  if (!f || !Array.isArray(f.firmen) || !f.firmen.length) {
    f = await updateJson<FinanzplanFile>('finanzplan', () => SEED);
  } else if (!Array.isArray(f.produkte) || !f.produkte.length || !Array.isArray(f.uhrwerk?.agenda) || !f.uhrwerk.agenda.length) {
    // Bestand aus der Zeit vor Produkten/Uhrwerk → neue Abschnitte nachziehen.
    f = await updateJson<FinanzplanFile>('finanzplan', current => ({
      ...SEED,
      ...(current ?? {}),
      produkte: Array.isArray(current?.produkte) && current.produkte.length ? current.produkte : SEED.produkte,
      uhrwerk: current?.uhrwerk?.agenda?.length ? current.uhrwerk : SEED.uhrwerk,
      zahlungen: Array.isArray(current?.zahlungen) ? current.zahlungen : [],
    }));
  }
  return NextResponse.json(sauberFile(f));
}

/** Kompletten Stand setzen (die Seite verwaltet die Listen). */
export async function PUT(req: Request) {
  let body: Partial<FinanzplanFile>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const sauber = sauberFile(body);
  if (!sauber.firmen.length) return NextResponse.json({ ok: false, error: 'firmen darf nicht leer sein.' }, { status: 400 });
  // Kontostand-Änderung stempelt automatisch das Stand-Datum.
  const vorher = await loadJson<FinanzplanFile>('finanzplan');
  for (const fa of sauber.firmen) {
    const alt = vorher?.firmen?.find(x => x.id === fa.id);
    if (fa.kontostand !== null && fa.kontostand !== (alt?.kontostand ?? null)) fa.stand = localDay();
  }
  // Hier hängt Geld dran: Rechnungen, offene Zahlungen, Merkposten. Ein Client
  // mit halb geladenem Stand darf das nicht überschreiben — jede Liste wird
  // einzeln geprüft, eine schrumpfende reicht zur Ablehnung.
  const { ok, next, verloren } = await updateGeschuetztListen<FinanzplanFile>(
    'finanzplan', sauber, ['firmen', 'rechnungen', 'zahlungen', 'merkposten', 'produkte'],
  );
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: `Abgelehnt: das hätte über die Hälfte von ${verloren} gelöscht.` },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, ...next });
}

/**
 * Einzelne Einträge ändern statt der ganzen Datei.
 *
 * Zwei-Fenster-Fundament: Malin pflegt Rechnungen, Kevin lässt nebenher einen
 * Beleg von Jarvis buchen — vorher schrieb jeder Weg den KOMPLETTEN Finanzplan
 * zurück und überschrieb still die Arbeit des anderen. Jetzt geht nur der eine
 * geänderte Eintrag raus, und zwar in der benannten Liste.
 *
 * Format: { ops: [{ liste: 'rechnungen', op: 'upsert', eintrag: {…} }, … ] }
 */
const PATCHBAR = ['firmen', 'rechnungen', 'zahlungen', 'merkposten', 'produkte'] as const;
type PatchListe = typeof PATCHBAR[number];

export async function PATCH(req: Request) {
  let body: { ops?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const roh = Array.isArray(body.ops) ? body.ops.slice(0, 100) : null;
  if (!roh) return NextResponse.json({ ok: false, error: 'Feld "ops" (Liste) fehlt.' }, { status: 400 });

  interface Op { liste: PatchListe; op: 'upsert' | 'delete'; eintrag?: Record<string, unknown>; id?: string }
  const ops: Op[] = [];
  for (const o of roh as Record<string, unknown>[]) {
    const l = String(o?.liste ?? '') as PatchListe;
    if (!(PATCHBAR as readonly string[]).includes(l)) continue;
    if (o.op === 'delete' && typeof o.id === 'string') ops.push({ liste: l, op: 'delete', id: o.id });
    else if (o.op === 'upsert' && o.eintrag && typeof o.eintrag === 'object') {
      ops.push({ liste: l, op: 'upsert', eintrag: o.eintrag as Record<string, unknown> });
    }
  }
  if (!ops.length) return NextResponse.json({ ok: false, error: 'Keine gültigen Änderungen.' }, { status: 400 });

  let angewandt = 0;
  const next = await updateJson<FinanzplanFile>('finanzplan', current => {
    // Immer vom gesäuberten Bestand ausgehen — nie vom Rohzustand.
    const f = sauberFile(current);
    for (const o of ops) {
      const liste = f[o.liste] as { id: string }[];
      const nachId = new Map(liste.map(x => [x.id, x]));
      if (o.op === 'delete') { if (nachId.delete(o.id!)) angewandt++; }
      else {
        // Einzelnen Eintrag über sauberFile schleusen: dieselben Regeln wie
        // beim Vollschreiben, kein zweiter Satz Prüfungen.
        const geprueft = (sauberFile({ [o.liste]: [o.eintrag] } as Partial<FinanzplanFile>)[o.liste] as { id: string }[])[0];
        if (geprueft) { nachId.set(geprueft.id, geprueft); angewandt++; }
      }
      (f[o.liste] as unknown) = Array.from(nachId.values());
    }
    // Kontostand-Änderung stempelt das Stand-Datum, wie beim Vollschreiben.
    const alt = sauberFile(current);
    for (const fa of f.firmen) {
      const vorher = alt.firmen.find(x => x.id === fa.id);
      if (fa.kontostand !== null && fa.kontostand !== (vorher?.kontostand ?? null)) fa.stand = localDay();
    }
    return f;
  });

  return NextResponse.json({ ok: true, angewandt, ...next });
}
