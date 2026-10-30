'use client';

import { TermineAkte } from '../kalender/TermineAkte';
import Link from 'next/link';
import { WEG, eventLink } from '@/lib/wege';

// ─── Markttraktion · Firmen — ein Unternehmen, alle Beziehungen ─────────────
// Die Firma ist eigene Stammdaten (lib/crm/firmen.ts): Branche, Größe, Ort,
// Webseite an EINER Stelle. Die Karteikarte zeigt alle Personen, Chancen,
// Mandate und den gemeinsamen Verlauf. Rolle wird aus den Personen
// abgeleitet, bis sie von Hand gesetzt wird.
// 04.10. (Kevin: „alles anpassbar“): jede Firmenzeile am Baustein `ZeileAktionen` — Archivieren (`archiviertAm`, Ansicht
// „Archiv“, zurückholbar, an Personen/Deals/Mandaten weiter lesbar) und Löschen (Papierkorb 30 Tage, Rückgängig) — in den
// Papierkorb nur eine LEERE Firma (keine Personen, Deals, Mandate, Töchter; der Server prüft dazu Rechnungen, Dateien,
// Follow-ups, Events). Hängt etwas daran, bietet die Rückfrage das Archiv an. Die Sicherung beim Zusammenführen bleibt.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Zeile, Leer, Knopf, Chip, Punkt, Zahl, Raster, feld, LEUCHT, ZeileAktionen, ZEILE_MEHR_BREITE, Arbeitsflaeche, FilterKnopf, FilterGruppe, useBreit, useBreite } from '../ui';
import { useCrmAblage, PapierkorbKarte, type CrmAblage } from './ablage';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand } from '@/lib/crm/typen';
import { anzeigename, type Aktivitaet } from '@/lib/make-one/crm';
import { firmenId, firmenDubletten } from '@/lib/crm/firmen';
import { dealZuFirma, mandatZuFirma } from '@/lib/crm/firmen-bezug';
import { dealWertText, OFFENE_STUFEN } from '@/lib/crm/pipeline';
import { umsatzBezug, umsatzKennzahlen, type UmsatzRechnung, type UmsatzKennzahlen, type ZugeordneteRechnung } from '@/lib/crm/umsatz';
import { DATEI_ARTEN, groesseText, type DateiEintrag } from '@/lib/dateien/regeln';
import { eventsFuerKunde, erfassteTeilnahmen, begegnungenFuerFirma, begegnungStatus } from '@/lib/crm/besuche';
import type { Firma, FirmaRolle } from '@/lib/crm/typen';
import { type CrmApi, datum, euro, nurFelder } from './daten';
import { Feldzeile, Pillen, Feld, Verlauf } from './teile';
import { Wahl } from './Wahl';
import { BeanWahl, useOffeneAngebote } from './bean-teile';
import { beanFirma } from '@/lib/crm/bean';
import { Person } from './team';
import { LeadBlock } from './Leads';
import { haeltBeziehung, nameVon } from '@/lib/crm/team';
import { personenJeFirma, personenAufteilen, stationIn, stationenVon, aktivitaetZurFirma, STATION_ART_LABEL } from '@/lib/crm/stationen';
import { useFirmaWechselFrage } from './kontakt/FirmaWechselFrage';
import { firmenGruppe, muetter, toechter as toechterVon } from '@/lib/crm/konzern';
import { beanGruppe, BEAN_LABEL } from '@/lib/crm/bean';
import { AufgabenAkte } from '../aufgaben/AufgabenAkte';
import { ZoeVorschlaege, ZoeFragenKnopf, zoeFragen } from './ZoeFragen';
import { NeuePersonKurz } from './PersonAnlegen';
import { anzahl } from '@/lib/text/zahlwort';

export const ROLLEN: { id: FirmaRolle; label: string; farbe: string }[] = [
  { id: 'kunde', label: 'Kunde', farbe: LEUCHT.gut }, { id: 'zielkunde', label: 'Zielkunde', farbe: LEUCHT.business }, { id: 'partner', label: 'Partner', farbe: LEUCHT.agenten },
  { id: 'netzwerk', label: 'Netzwerk', farbe: LEUCHT.beziehung }, { id: 'dienstleister', label: 'Dienstleister', farbe: LEUCHT.puls }, { id: 'investor', label: 'Investor', farbe: LEUCHT.geld },
  { id: 'ex_kunde', label: 'Ex-Kunde', farbe: C.inkDim }, { id: 'wettbewerb', label: 'Wettbewerb', farbe: LEUCHT.kritisch }, { id: 'offen', label: 'offen', farbe: C.inkLeise },
];
const RECHTSFORMEN = ['GmbH', 'UG (haftungsbeschränkt)', 'GmbH & Co. KG', 'AG', 'SE', 'KG', 'OHG', 'GbR', 'e. K.', 'Einzelunternehmen', 'Freiberufler', 'e. V.', 'eG', 'Ltd.', 'Körperschaft öffentl. Rechts'];
const rolle = (r: FirmaRolle) => ROLLEN.find(x => x.id === r) ?? ROLLEN[ROLLEN.length - 1];

type Ansicht = 'alle' | FirmaRolle | 'ohne_branche' | 'dubletten' | 'archiv' | 'papierkorb';

/** Was an einer Firma hängt (Personen auch ehemalige, Deals, Mandate, Töchter) — leer = darf in den Papierkorb. */
function firmaVerweise(f: Firma, b: CrmBestand, kontakte: Kontakt[]): string {
  const { aktuell, ehemalig } = personenAufteilen(kontakte, f.id);
  const p = aktuell.length + ehemalig.length, d = b.chancen.filter(c => dealZuFirma(c, f)).length, m = b.mandate.filter(x => mandatZuFirma(x, f)).length, t = toechterVon(b.firmen, f.id).length;
  return [p ? `${p} Person${p === 1 ? '' : 'en'}` : '', d ? `${d} Deal${d === 1 ? '' : 's'}` : '', m ? `${m} Mandat${m === 1 ? '' : 'e'}` : '', t ? `${t} Tochterfirm${t === 1 ? 'a' : 'en'}` : ''].filter(Boolean).join(', ');
}

/** Löschen = Papierkorb, nur leer; sonst Rückfrage mit dem Archiv als Weg (nichts verschwindet still). */
export function firmaLoeschen(ablage: CrmAblage, f: Firma, b: CrmBestand, kontakte: Kontakt[]) {
  const dran = firmaVerweise(f, b, kontakte);
  if (!dran) { ablage.loeschen(f.id, f.name); return; }
  ablage.fragen({
    titel: `„${f.name}“ kann nicht in den Papierkorb`,
    text: `An der Firma hängen noch ${dran}. Im Papierkorb wäre sie überall ausgeblendet — diese Einträge zeigten ins Leere. Archivieren blendet sie nur aus der Firmenliste aus und lässt alles lesbar; zum Löschen erst die Personen umhängen bzw. Deals und Mandate einer anderen Firma zuordnen.`,
    wahl: [{ label: 'Archivieren', tun: () => ablage.archivieren(f.id, f.name) }],
  });
}
const FIRMEN_SPALTEN = '10px minmax(0,1.5fr) minmax(0,1fr) minmax(0,1.3fr) minmax(0,.8fr) 44px 84px';

export function Firmen({ api, zuAkte, suche, suchfeld, kopf }: { api: CrmApi; /** Firmenakte öffnen (30.10.): ein Klick auf eine Zeile öffnet die ganze Firma als eigene Seite. */ zuAkte: (id: string) => void; suche: string;
  /** Arbeitsfläche (31.10.): das Suchfeld der Kartei (Zustand bleibt dort) — steht vorn in der Zeile „Suche + Filter“. */ suchfeld?: ReactNode;
  /** Kopf-Teile der Seite: EINE Hauptaktion („+ Firma“), ZOE/Head daneben, Nebenaktionen im „⋯“. */ kopf?: { haupt?: ReactNode; neben?: ReactNode; mehr?: ReactNode } }) {
  const [ansicht, setAnsicht] = useState<Ansicht>('alle');
  const [mehr, setMehr] = useState(80);
  const alleFirmen = api.crm?.stand.firmen;
  // Archivierte Firmen nur in der Ansicht „Archiv“ — überall sonst (Zahlen, Rollen, Dubletten) zählt die laufende Liste.
  const firmen = useMemo(() => (alleFirmen ?? []).filter(x => !x.archiviertAm), [alleFirmen]);
  const archiv = useMemo(() => (alleFirmen ?? []).filter(x => x.archiviertAm), [alleFirmen]);
  const kontakte = useMemo(() => api.kontakte ?? [], [api.kontakte]);
  const ablage = useCrmAblage(api, 'firmen');
  // Personen einer Firma nur über die Stationen (28.09.) — laufende Stationen.
  const personenJe = useMemo(() => new Map(Array.from(personenJeFirma(kontakte, { nurAktiv: true }).entries()).map(([id, l]) => [id, l.length])), [kontakte]);
  const dubl = useMemo(() => (ansicht === 'dubletten' ? firmenDubletten(firmen) : []), [ansicht, firmen]);
  const ANSICHTEN: { id: Ansicht; label: string }[] = [
    { id: 'alle', label: `Alle ${firmen.length}` }, ...ROLLEN.filter(r => firmen.some(f => f.rolle === r.id)).map(r => ({ id: r.id as Ansicht, label: `${r.label} ${firmen.filter(f => f.rolle === r.id).length}` })),
    { id: 'ohne_branche', label: 'Ohne Branche' }, { id: 'dubletten', label: 'Dubletten' },
    ...(archiv.length || ansicht === 'archiv' ? [{ id: 'archiv' as const, label: `Archiv ${archiv.length}` }] : []),
    ...(ablage.korb.length || ansicht === 'papierkorb' ? [{ id: 'papierkorb' as const, label: `Papierkorb ${ablage.korb.length}` }] : []),
  ];
  const treffer = useMemo(() => {
    const q = suche.trim().toLowerCase();
    let l = ansicht === 'archiv' ? archiv : firmen;
    if (ansicht === 'ohne_branche') l = l.filter(f => !f.branche);
    else if (ansicht === 'dubletten') { const ids = new Set(dubl.flatMap(([a, b]) => [a.id, b.id])); l = l.filter(f => ids.has(f.id)); }
    else if (ansicht !== 'alle' && ansicht !== 'archiv' && ansicht !== 'papierkorb') l = l.filter(f => f.rolle === ansicht);
    if (q) l = l.filter(f => `${f.name} ${f.domain ?? ''} ${f.branche ?? ''} ${f.stadt ?? ''}`.toLowerCase().includes(q));
    const R = ['kunde', 'zielkunde', 'partner', 'netzwerk', 'investor', 'dienstleister', 'ex_kunde', 'wettbewerb', 'offen'];
    return [...l].sort((a, b) => R.indexOf(a.rolle) - R.indexOf(b.rolle) || (personenJe.get(b.id) ?? 0) - (personenJe.get(a.id) ?? 0) || a.name.localeCompare(b.name));
  }, [firmen, archiv, ansicht, suche, dubl, personenJe]);
  const loeschen = (x: Firma) => { if (api.crm) firmaLoeschen(ablage, x, api.crm.stand, kontakte); };
  const archivieren = (x: Firma) => { if (x.archiviertAm) ablage.zurueckholen(x.id, x.name); else ablage.archivieren(x.id, x.name); };
  const ohneBranche = firmen.filter(x => !x.branche).length;

  // Breit: dichte Tabelle wie in einer guten Adressverwaltung (Firma · Domain · Branche · Ort · Personen · Rolle).
  const aktionen = (x: Firma, inhalt: ReactNode) => (
    <ZeileAktionen key={x.id} titel={x.name} archiviert={!!x.archiviertAm} onArchivieren={() => archivieren(x)} onLoeschen={() => loeschen(x)}
      href={WEG.firma(x.id)} onOeffnen={() => zuAkte(x.id)} mehr={[{ id: 'zoe', label: 'Mit ZOE besprechen', hinweis: 'ZOE öffnet mit diesem Bezug', tun: () => zoeFragen({ art: 'firma', id: x.id }) }]}>{inhalt}</ZeileAktionen>
  );
  // `breit` = die dichte Tabelle (Arbeitsfläche, gemessen an der Fläche); sonst Zeilen. Ein Klick öffnet die Firmenakte als eigene Seite (30.10.).
  const zeile = (x: Firma, breit: boolean) => breit ? aktionen(x,
    <div onClick={() => zuAkte(x.id)} role="link" className="fassbar" title={[x.name, x.branche, x.stadt].filter(Boolean).join(' · ')}
      style={{ display: 'grid', gridTemplateColumns: FIRMEN_SPALTEN, gap: 12, alignItems: 'center', padding: '8px 8px', minHeight: 40, borderBottom: '1px solid rgba(255,255,255,.05)', cursor: 'pointer', fontSize: TYP.bedien }}>
      <Punkt farbe={rolle(x.rolle).farbe} groesse={8} />
      <span style={{ fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.name}</span>
      <span style={{ color: C.inkLeise, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.domain ?? '—'}</span>
      <span style={{ color: x.branche ? C.inkDim : C.inkLeise, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.branche ?? '—'}</span>
      <span style={{ color: C.inkDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.stadt ?? '—'}</span>
      <span style={{ textAlign: 'right', color: C.inkDim, fontVariantNumeric: 'tabular-nums' }}>{personenJe.get(x.id) ?? '—'}</span>
      <span style={{ fontSize: TYP.bedien, color: rolle(x.rolle).farbe, whiteSpace: 'nowrap' }}>{rolle(x.rolle).label}</span>
    </div>
  ) : (
    <div key={x.id}>
      {aktionen(x, <Zeile onClick={() => zuAkte(x.id)} links={<Punkt farbe={rolle(x.rolle).farbe} />}
        titel={<>{x.name}{x.domain && <span style={{ color: C.inkLeise }}> · {x.domain}</span>}</>}
        unter={[x.branche, x.stadt, x.mitarbeiter ? `${x.mitarbeiter} MA` : ''].filter(Boolean).join(' · ') || 'keine Details'}
        rechts={<span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span style={{ fontSize: TYP.bedien, color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{personenJe.get(x.id) ?? 0} P.</span><Chip farbe={rolle(x.rolle).farbe}>{rolle(x.rolle).label}</Chip></span>} />)}
    </div>
  );

  // ── Arbeitsfläche (31.10., DESIGN_STANDARD.md › Arbeitsfläche — wie die Kontakte) ────────────────────────────────────────────────────────────
  // Kopf in EINER Zeile (Firmen · Zahl · ⋯ · „+ Firma“), Suche + „Filter ▾“ in EINER Zeile (Rolle, Ohne Branche, Dubletten, Archiv, Papierkorb im
  // Popover — nie eine abgeschnittene Pillenreihe), darunter die Liste in voller Breite (der Tabellenkopf klebt). Die Firma öffnet als Akte (30.10.).
  const ansichtName = ANSICHTEN.find(a => a.id === ansicht)?.label.replace(/\s\d+$/, '') ?? '';
  const filterWeg = () => { setAnsicht('alle'); setMehr(80); };
  const tabelle = ansicht !== 'papierkorb' && ansicht !== 'dubletten';
  const leisteZeile = (
    <>
      {suchfeld}
      <FilterKnopf aktiv={ansicht !== 'alle' ? 1 : 0} onZuruecksetzen={filterWeg}>
        <FilterGruppe titel="Ansicht">
          <Pillen liste={ANSICHTEN} aktiv={ansicht} onWahl={a => { setAnsicht(a); setMehr(80); }} />
        </FilterGruppe>
      </FilterKnopf>
      {ansicht !== 'alle' && <button type="button" className="af-chip-weg fassbar" onClick={filterWeg} title="Filter aufheben">{ansichtName} <span aria-hidden>✕</span></button>}
    </>
  );
  const zaehlerText = (
    <span>
      <b style={{ color: C.ink, fontWeight: 600 }}>{suche ? treffer.length : firmen.length}</b> {suche ? `von ${firmen.length}` : 'Firmen'} · <span style={{ color: ohneBranche ? LEUCHT.achtung : undefined }}>{ohneBranche} ohne Branche</span> · {firmen.filter(x => x.rolle === 'kunde').length} Kunden
    </span>
  );
  const tabellenKopf = (
    <div style={{ display: 'grid', gridTemplateColumns: FIRMEN_SPALTEN, gap: 12, padding: `0 ${8 + ZEILE_MEHR_BREITE}px 0 8px`, fontSize: TYP.mikro, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 600 }}>
      <span /><span>Firma</span><span>Domain</span><span>Branche</span><span>Ort</span><span style={{ textAlign: 'right' }}>Pers.</span><span>Rolle</span>
    </div>
  );
  const listeInhalt = (zwei: boolean) => (ansicht === 'papierkorb' ? <div style={{ paddingTop: 12 }}><PapierkorbKarte ablage={ablage} liste="firmen" /></div> : ansicht === 'dubletten' ? (
    <div style={{ display: 'grid', gap: 8, paddingTop: 12 }}>
      {dubl.map(([a, b]) => <div key={`${a.id}|${b.id}`} style={{ fontSize: TYP.bedien, padding: 10, borderRadius: 10, background: 'rgba(255,255,255,.03)' }}>{a.name} ⇄ {b.name}{a.domain ? ` · ${a.domain}` : ''} <span style={{ color: C.inkLeise }}>— Personen der einen Firma in der Karteikarte der anderen zuordnen, dann die leere löschen.</span></div>)}
      {!dubl.length && <Leer>Keine Firmen-Dubletten.</Leer>}
    </div>
  ) : (
    <div style={{ paddingTop: zwei ? 2 : 8 }}>
      <div>{treffer.slice(0, mehr).map(x => zeile(x, zwei))}</div>
      {treffer.length > mehr && <div style={{ marginTop: 10 }}><Knopf leise onClick={() => setMehr(mehr + 150)}>Weitere {Math.min(150, treffer.length - mehr)} zeigen</Knopf></div>}
      {!treffer.length && <Leer>{ansicht === 'archiv' ? 'Das Archiv ist leer. Archivierte Firmen sind aus der Liste ausgeblendet, an Personen, Deals und Mandaten aber weiter lesbar — zurückholen jederzeit.' : 'Keine Firma gefunden.'}</Leer>}
    </div>
  ));

  return (
    <>
      <Arbeitsflaeche titel="Firmen" label="Firmen" zaehler={zaehlerText} verhaeltnis="3:2" zweiAb={880}
        neben={kopf?.neben} mehr={kopf?.mehr} haupt={kopf?.haupt}
        leiste={leisteZeile}
        listeKopf={st => (st.zwei && tabelle ? tabellenKopf : null)}
        liste={st => listeInhalt(st.zwei)}
        // Kein Detail rechts (30.10.): ein Klick öffnet die Firmenakte als eigene, breite Seite — die Liste nutzt die ganze Breite.
        detail={null} />
      {ablage.dialog}
      {ablage.hinweis}
    </>
  );
}

export function neueFirma(name: string): Firma {
  return { id: firmenId(name), name: name.trim(), rolle: 'offen', geaendert: new Date().toISOString() };
}

/**
 * Die Teile einer Firma (30.10.): EINE Stelle für Daten und Bausteine — die schmale Firmenkarte (Seitenfenster der Qualifizierung) und die
 * Firmenakte (eigene, breite Seite) ordnen dieselben Teile nur anders an. Keine zweite Logik, keine eigenen Schreibwege.
 */
function useFirmenTeile({ f, api, zuPerson, zuFirma, onLoeschen }: FirmenTeileProps) {
  const crm = api.crm!;
  const eigeneAblage = useCrmAblage(api, 'firmen');
  const firmen = crm.stand.firmen;
  // Personen nur über die Stationen (28.09.): aktuell (laufende Station) und ehemalig (beendete) getrennt.
  const { aktuell: personen, ehemalig } = personenAufteilen(api.kontakte ?? [], f.id);
  const ids = new Set(personen.map(k => k.id));
  // Mutter- und Tochterfirmen (28.09., #7): „ganze Gruppe“ fasst Deals und Mandate aller Firmen der Gruppe zusammen.
  const gruppe = firmenGruppe(firmen, f.id);
  const [gruppeAn, setGruppeAn] = useState(false);
  const gruppenFirmen = gruppeAn && gruppe.length > 1 ? firmen.filter(x => gruppe.includes(x.id)) : [f];
  const mutter = f.mutterId ? firmen.find(x => x.id === f.mutterId) : undefined;
  const toechter = toechterVon(firmen, f.id);
  // Als Mutter wählbar: jede andere Firma, die nicht selbst (Enkel-)Tochter dieser ist — sonst entstünde ein Kreis.
  const mutterListe = useMemo(() => firmen.filter(x => x.id !== f.id && !muetter(firmen, x.id).includes(f.id)).map(x => ({ id: x.id, label: x.name })), [firmen, f.id]);
  // Per Kennung (dealZuFirma/mandatZuFirma, F1) — der Name nur als Rückfall für Einträge ohne Firmen-Kennung; über
  // die Personen nur, wenn der Eintrag keiner anderen Firma gehört.
  const chancen = crm.stand.chancen.filter(c => gruppenFirmen.some(g => dealZuFirma(c, g)) || (!c.firmaId && c.kontaktIds.some(id => ids.has(id))));
  const mandate = crm.stand.mandate.filter(m => gruppenFirmen.some(g => mandatZuFirma(m, g)) || (!m.firmaId && m.kontaktIds.some(id => ids.has(id))));
  // Begegnungen bei Events (M15): Personen dieser Firma bei Events (auch fremden) + die Firma als Zielfirma eines besuchten Events.
  const begegnungen = useMemo(() => begegnungenFuerFirma(crm.stand.events, crm.stand.teilnahmen, api.kontakte ?? [], f.id), [crm.stand.events, crm.stand.teilnahmen, api.kontakte, f.id]);
  // Zeitlinie (28.09.): Aktivitäten, die bei dieser Firma entstanden — auch von Personen, die inzwischen weitergezogen sind.
  const verlauf: Aktivitaet[] = [...personen, ...ehemalig].flatMap(k => (k.aktivitaeten ?? []).filter(a => a.art !== 'system' && aktivitaetZurFirma(k, a, f.id)).map(a => ({ ...a, text: `${anzeigename(k)}: ${a.text ?? ''}`.replace(/: $/, '') }))).sort((a, b) => a.am.localeCompare(b.am));
  const [zuordnen, setZuordnen] = useState('');
  const [neuePerson, setNeuePerson] = useState(false);
  const firmaName = (id: string) => (id === f.id ? f.name : firmen.find(x => x.id === id)?.name);
  /**
   * Person dieser Firma zuordnen (Kevin 28.09.): ohne bisherige Firma einfach verknüpfen; sonst kurz nachfragen —
   * Jobwechsel · Zusätzliche Firma · Korrektur (`firmaWechsel`, der Server rechnet die Stationen).
   */
  const { frage, dialog: wechselFrage } = useFirmaWechselFrage();
  const zuordnenMit = async (k: (typeof personen)[number]) => {
    if (!stationenVon(k).length) { void api.kontaktTeil(k.id, { firmaId: f.id, firma: f.name }); setZuordnen(''); return; }
    const absicht = await frage({ von: k.firmaId ? firmaName(k.firmaId) ?? k.firma : k.firma, nach: f.name });
    if (!absicht) return;
    void api.kontaktTeil(k.id, { firmaId: f.id, firma: f.name, firmaWechsel: absicht });
    setZuordnen('');
  };
  const angebote = useOffeneAngebote();
  // Nur die geänderten Felder (F1) — ein ganzer Eintrag aus dem Browser-Stand überschrieb gleichzeitige Änderungen (Lead-Qualifizierung).
  const setze = (teil: Partial<Firma>) => api.teil('firmen', f.id, nurFelder(teil));
  const kandidaten = zuordnen.trim().length >= 2 ? (api.kontakte ?? []).filter(k => !ids.has(k.id) && `${anzeigename(k)} ${k.firma ?? ''}`.toLowerCase().includes(zuordnen.toLowerCase())).slice(0, 6) : [];
  const F: [keyof Firma, string, string?][] = [['domain', 'Domain'], ['webseite', 'Webseite'], ['branche', 'Branche'], ['mitarbeiter', 'Mitarbeitende'], ['umsatz', 'Umsatz'], ['stadt', 'Ort'], ['gegruendet', 'Gegründet'], ['telefon', 'Telefon'], ['email', 'E-Mail'], ['linkedin', 'LinkedIn']];


  const teile = {
    rolle: <Feldzeile label="Rolle"><Wahl label="Rolle" liste={ROLLEN.map(r => ({ id: r.id, label: r.label }))} wert={f.rolle} farbe={ROLLEN.find(r => r.id === f.rolle)?.farbe} onWahl={r => setze({ rolle: r, rolleVonHand: true })} /></Feldzeile>,
    // BEAN (28.09., H4): abgeleitet aus Mandaten, Deals und Angeboten der Firma und ihrer Personen — von Hand überschreibbar, gilt dann für Personen ohne eigene Wahl.
    bean: <Feldzeile label="BEAN"><BeanWahl wert={f.bean} ergebnis={beanFirma(f, crm.stand, api.kontakte ?? [], { angebote })} onSetze={bean => setze({ bean })} /></Feldzeile>,
    // Mutter- und Tochterfirmen (28.09., #7) — Kreise lehnt der Server ab.
    mutter: (
      <Feldzeile label="Mutterfirma">
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Wahl label="Mutterfirma" klein liste={mutterListe} wert={f.mutterId} leer="keine ▾" onWahl={mutterId => setze({ mutterId })} onLeeren={f.mutterId ? () => setze({ mutterId: undefined }) : undefined} leerenLabel="keine Mutterfirma" />
          {mutter && <button type="button" onClick={() => zuFirma(mutter.id)} className="fassbar" style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontSize: TYP.bedien, padding: 0 }}>öffnen ›</button>}
        </span>
      </Feldzeile>
    ),
    toechter: toechter.length > 0 ? (
      <Feldzeile label="Töchter">
        <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
          {toechter.map(t => <button key={t.id} type="button" onClick={() => zuFirma(t.id)} className="fassbar" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}><Chip farbe={LEUCHT.agenten}>{t.name} ›</Chip></button>)}
        </span>
      </Feldzeile>
    ) : null,
    gruppe: gruppe.length > 1 ? (() => { const g = beanGruppe(gruppe, crm.stand, api.kontakte ?? [], { angebote }); return (
      <Feldzeile label="Gruppe">
        <span title={g.grund} style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim }}>
          {gruppe.length} Firmen · BEAN der Gruppe <Chip farbe={LEUCHT.geld}>{g.bean} · {BEAN_LABEL[g.bean]}</Chip>
        </span>
      </Feldzeile>
    ); })() : null,
    lead: <LeadBlock api={api} leadId={f.id} />,
    personen: (
      <div>
        {wechselFrage}
        <Ueberschrift rechts={`${personen.length}`}>Personen · aktuell</Ueberschrift>
        {personen.map(k => { const st = stationIn(k, f.id); return <button key={k.id} onClick={() => zuPerson(k.id)} style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 8, background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,.05)', color: C.ink, cursor: 'pointer', fontSize: TYP.bedien, padding: '7px 0', textAlign: 'left' }}><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', minWidth: 0 }}><span title={`Zuständig: ${nameVon(haeltBeziehung(k))}`} style={{ opacity: k.besitzer ? 1 : 0.45, display: 'inline-flex' }}><Person id={haeltBeziehung(k)} groesse={18} /></span>{anzeigename(k)} <span style={{ color: C.inkLeise }}>{[st?.rolle ?? (k.firmaId === f.id ? k.position ?? k.jobtitel : undefined), st?.art ? STATION_ART_LABEL[st.art] : undefined, st && !st.haupt ? 'weitere Station' : undefined].filter(Boolean).join(' · ')}</span></span><span style={{ color: C.inkLeise }}>{k.letzterKontakt ? datum(k.letzterKontakt) : ''} ›</span></button>; })}
        {!personen.length && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Niemand ist aktuell zugeordnet.</div>}
        <input value={zuordnen} onChange={e => setZuordnen(e.target.value)} placeholder="Person zuordnen …" aria-label="Person zuordnen" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px', marginTop: 8 }} />
        {/* 1.13 (09.10.): eine NEUE Person direkt an dieser Firma — über den EINEN Weg (POST /api/crm/person, Weg „firmenkarte“); erst mit einer
            Person wird die Firma ein Lead. */}
        {!neuePerson && <div style={{ marginTop: 8 }}><Knopf leise onClick={() => setNeuePerson(true)}>+ neue Person</Knopf></div>}
        {neuePerson && <div style={{ marginTop: 8 }}><NeuePersonKurz api={api} weg="firmenkarte" firmaId={f.id} firmaName={f.name} onFertig={id => { setNeuePerson(false); if (id) zuPerson(id); }} /></div>}
        {kandidaten.map(k => (
          <div key={k.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim, padding: '3px 0' }}>
            <span>{anzeigename(k)}{k.firma ? ` · bisher ${k.firma}` : ''}</span>
            <button onClick={() => void zuordnenMit(k)} title={k.firmaId ? 'Jobwechsel, zusätzliche Firma oder Korrektur — wird gefragt' : undefined} style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontSize: TYP.bedien, padding: 0 }}>+ zuordnen</button>
          </div>
        ))}
      </div>
    ),
    ehemalig: ehemalig.length > 0 ? (
      <div>
        <Ueberschrift rechts={`${ehemalig.length}`}>Ehemalig</Ueberschrift>
        {ehemalig.map(k => { const st = stationIn(k, f.id); return <button key={k.id} onClick={() => zuPerson(k.id)} style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 8, background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,.05)', color: C.inkDim, cursor: 'pointer', fontSize: TYP.bedien, padding: '7px 0', textAlign: 'left' }}><span style={{ minWidth: 0 }}>{anzeigename(k)} <span style={{ color: C.inkLeise }}>{[st?.rolle, st?.bis ? `bis ${datum(st.bis)}` : 'beendet'].filter(Boolean).join(' · ')}</span></span><span style={{ color: C.inkLeise }}>›</span></button>; })}
      </div>
    ) : null,
    dealsMandate: (chancen.length > 0 || mandate.length > 0 || gruppe.length > 1) ? (
      <div>
        <Ueberschrift rechts={gruppe.length > 1 ? <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: TYP.bedien, cursor: 'pointer' }}><input type="checkbox" checked={gruppeAn} onChange={e => setGruppeAn(e.target.checked)} />ganze Gruppe</label> : undefined}>Deals & Mandate</Ueberschrift>
        {chancen.map(c => <Link key={c.id} href={WEG.deal(c.id)} style={{ display: 'block', fontSize: TYP.bedien, padding: '4px 0', color: C.ink, textDecoration: 'none' }}>{c.titel} <span style={{ color: C.inkLeise }}>· {crm.stufen.find(s => s.id === c.stufe)?.label}{c.wert.betrag || c.wert.einmalBetrag ? ` · ${dealWertText(c, { kurz: true })}` : ''} ›</span></Link>)}
        {mandate.map(m => <Link key={m.id} href={WEG.mandat(m.id)} style={{ display: 'block', fontSize: TYP.bedien, padding: '4px 0', color: C.ink, textDecoration: 'none' }}>{m.titel.slice(0, 80)} <span style={{ color: C.inkLeise }}>· Mandat {m.status}{m.honorar.betrag ? ` · ${euro(m.honorar.betrag)}` : ''} ›</span></Link>)}
      </div>
    ) : null,
    // Events für diesen Kunden (03.10.): besuchte Events, die für diese Firma laufen (Reiter „Events“) — mit ihren erfassten Kontakten.
    eventsKunde: eventsFuerKunde(crm.stand.events, f.id).length > 0 ? (
      <div>
        <Ueberschrift rechts={`${eventsFuerKunde(crm.stand.events, f.id).length}`}>Events für diesen Kunden</Ueberschrift>
        {eventsFuerKunde(crm.stand.events, f.id).map(e => (
          <Link key={e.id} href={WEG.besuch(e.id)} style={{ display: 'block', fontSize: TYP.bedien, padding: '4px 0', color: C.ink, textDecoration: 'none' }}>{e.titel} <span style={{ color: C.inkLeise }}>· {datum(e.datum, crm.heute)} · {anzahl(erfassteTeilnahmen(e.id, crm.stand.teilnahmen).length, 'Kontakt', 'Kontakte')}</span></Link>
        ))}
      </div>
    ) : null,
    // Begegnungen bei Events (M15): wer von dieser Firma wo dabei war — über alle Events, auch fremde; die Firma als Ziel steht dabei.
    begegnungen: begegnungen.length > 0 ? (
      <div>
        <Ueberschrift rechts={`${begegnungen.length}`}>Begegnungen bei Events</Ueberschrift>
        {begegnungen.map(b => (
          <Link key={b.event.id} href={eventLink(b.event)} style={{ display: 'block', fontSize: TYP.bedien, padding: '4px 0', color: C.ink, textDecoration: 'none' }}>{b.event.titel} <span style={{ color: C.inkLeise }}>· {datum(b.event.datum, crm.heute)} · {begegnungStatus(b, crm.heute)}{b.personen.length ? ` · ${b.personen.map(anzeigename).join(', ')}` : ''}{b.ziel && !b.getroffen ? ' · Ziel, noch nicht getroffen' : b.ziel ? ' · Ziel getroffen' : ''}</span></Link>
        ))}
      </div>
    ) : null,
    // Termine (30.09., K3): mit der Firma, ihren Personen, Deals oder Mandaten verknüpft (kalender-bezug).
    termine: (
      <div>
        <Ueberschrift>Termine</Ueberschrift>
        <TermineAkte frage={{ firmen: [f.id], kontakte: personen.map(k => k.id), deals: chancen.map(c => c.id), mandate: mandate.map(m => m.id) }} heute={crm.heute} />
      </div>
    ),
    // Aufgaben (28.09. abends): verknüpft mit der Firma oder einem ihrer Mandate/Deals; bei aktivem Mandat im Mandanten-Space.
    aufgaben: (
      <div>
        <Ueberschrift>Aufgaben</Ueberschrift>
        <AufgabenAkte firmaId={f.id} mandatIds={mandate.map(m => m.id)} dealIds={chancen.map(c => c.id)} mandantFirmaId={mandate.some(m => m.status === 'aktiv' && m.firmaId === f.id) ? f.id : undefined} />
      </div>
    ),
    // ZOE (28.09., C7): fragen mit dieser Firma als Bezug; offene Vorschläge zur Firma und ihren Personen/Deals.
    zoe: (
      <div style={{ display: 'grid', gap: 10 }}>
        <div><ZoeFragenKnopf bezug={{ art: 'firma', id: f.id }} headId="sales" /></div>
        <ZoeVorschlaege art="firma" id={f.id} onUebernommen={() => void api.laden(true)} />
      </div>
    ),
    stammdaten: (
      <div>
        <Ueberschrift>Stammdaten</Ueberschrift>
        <Feldzeile label="Name"><Feld wert={f.name} onFertig={name => name.trim() && setze({ name: name.trim() })} /></Feldzeile>
        {/* Kundennummer (25.10.): vergibt der Server beim ersten Angebot bzw. Mandat — nur lesen. */}
        <Feldzeile label="Kundennummer"><span style={{ fontSize: TYP.bedien, color: f.kundennummer ? C.ink : C.inkLeise }}>{f.kundennummer ?? 'kommt mit dem ersten Angebot bzw. Mandat'}</span></Feldzeile>
        <Feldzeile label="Rechtsform">
          <Wahl label="Rechtsform" liste={RECHTSFORMEN.map(r => ({ id: r, label: r }))} wert={f.rechtsform} onWahl={rechtsform => setze({ rechtsform })} onLeeren={() => setze({ rechtsform: undefined })} />
        </Feldzeile>
        {F.map(([k, l]) => <Feldzeile key={k} label={l}><Feld wert={String(f[k] ?? '')} onFertig={v => setze({ [k]: v.trim() || undefined } as Partial<Firma>)} /></Feldzeile>)}
        <Feldzeile label="Marktinfo"><Feld wert={f.marktinfo} onFertig={v => setze({ marktinfo: v || undefined })} /></Feldzeile>
        <Feldzeile label="Notiz"><Feld wert={f.notiz} onFertig={v => setze({ notiz: v || undefined })} /></Feldzeile>
      </div>
    ),
    verlauf: (max: number) => (
      <div>
        <Ueberschrift rechts={verlauf.length ? `${verlauf.length}` : undefined}>Verlauf aller Personen</Ueberschrift>
        <Verlauf liste={verlauf} name={p => p.charAt(0).toUpperCase() + p.slice(1)} max={max} heute={crm.heute} />
      </div>
    ),
    papierkorb: !personen.length && !ehemalig.length && !toechter.length && !chancen.length && !mandate.length
      ? <div><button onClick={() => (onLoeschen ? onLoeschen() : firmaLoeschen(eigeneAblage, f, crm.stand, api.kontakte ?? []))} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien, padding: 0 }}>Leere Firma in den Papierkorb</button></div>
      : null,
    mitlaeufer: <>{eigeneAblage.dialog}{eigeneAblage.hinweis}</>,
  };
  return { teile, personen, ehemalig, chancen, mandate, bean: beanFirma(f, crm.stand, api.kontakte ?? [], { angebote }) };
}

interface FirmenTeileProps { f: Firma; api: CrmApi; zuPerson: (id: string) => void; zuFirma: (id: string) => void; /** Papierkorb über die Liste (Rückgängig bleibt dort stehen) — sonst der eigene Weg dieser Karte. */ onLoeschen?: () => void }

/** Die schmale Firmenkarte (eine Spalte) — heute im Seitenfenster der Qualifizierung; „Akte“ dort öffnet die Firmenakte. */
export function FirmenKarte(props: FirmenTeileProps) {
  const { f } = props;
  const { teile: t } = useFirmenTeile(props);
  return (
    // Am Handy (17.10., Abnahme 3 · B8): EINE Spalte so breit wie der Platz (minmax(0, 1fr)), lange Wörter/Adressen brechen um — vorher wuchs die
    // implizite Spalte auf ~600 px und die Seite scrollte quer.
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0, 1fr)', minWidth: 0, overflowWrap: 'anywhere' }}>
      <div>
        <div style={{ fontFamily: SCHRIFT.display, fontSize: 21, fontWeight: 700, letterSpacing: '-.015em' }}>{f.name}</div>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 2 }}>{[f.branche, f.stadt, f.webseite ?? f.domain].filter(Boolean).join(' · ') || '—'}</div>
      </div>
      {t.rolle}{t.bean}{t.mutter}{t.toechter}{t.gruppe}{t.lead}
      {t.personen}{t.ehemalig}{t.dealsMandate}{t.eventsKunde}{t.begegnungen}{t.termine}{t.aufgaben}{t.zoe}{t.stammdaten}{t.verlauf(15)}{t.papierkorb}
      {t.mitlaeufer}
    </div>
  );
}

/** Eine Spalte der Akte: Karten untereinander. */
function AktenSpalte({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gap: 14, minWidth: 0, alignContent: 'start' }}>{children}</div>;
}

/** Eine Kennzahl im Kopf der Akte: kleines Wort, Wert — alles in einer Zeile (wie in „Kontakt öffnen“). */
function KopfZahl({ label, wert, farbe, title }: { label: string; wert: ReactNode; farbe?: string; title?: string }) {
  return (
    <span title={title} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: TYP.mikro, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>
      <b style={{ fontSize: 13, fontWeight: 700, color: farbe ?? C.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{wert}</b>
    </span>
  );
}

/**
 * Die Firmenakte (30.10., Kevin: „wenn ich in Firmen bin … die Akte wirklich groß öffnen … sauber in die Akte gehen und alles sauber anpassen“):
 * die ganze Firma als eigene, breite Seite — Kopf (Name, Rolle, BEAN, Branche · Ort · Domain, Kennzahlen Personen · offene Deals · aktive Mandate ·
 * Umsatz), darunter drei Spalten ab `SPALTEN_AB` (Einordnung & Stammdaten · Personen, Verlauf, Termine, Aufgaben · Deals & Mandate, Umsatz,
 * Dateien, Events, ZOE), schmaler zwei bzw. eine. Adresse: `?s=firmen&a=akte&k=<Firma>` (`WEG.firma(id)`); „‹ Zurück“ führt in die Liste.
 */
export function FirmenAkte({ api, id, zurueck, zuPerson, zuFirma }: { api: CrmApi; id: string; zurueck: () => void; zuPerson: (id: string) => void; zuFirma: (id: string) => void }) {
  const f = api.crm?.stand.firmen.find(x => x.id === id) ?? null;
  const zurueckKnopf = (
    <button onClick={zurueck} className="fassbar" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 12px 7px 10px', borderRadius: 11, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: C.ink, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700 }}>
      <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>‹</span> Zurück zu Firmen
    </button>
  );
  if (!api.crm) return <Karte i={0}>{zurueckKnopf}<Leer>Die Firma lädt …</Leer></Karte>;
  if (!f) return <Karte i={0}>{zurueckKnopf}<Leer>Diese Firma gibt es nicht mehr — gelöscht oder mit einer anderen zusammengeführt.</Leer></Karte>;
  return <FirmenAkteInhalt key={f.id} f={f} api={api} zurueck={zurueck} zurueckKnopf={zurueckKnopf} zuPerson={zuPerson} zuFirma={zuFirma} />;
}

function FirmenAkteInhalt({ f, api, zurueck, zurueckKnopf, zuPerson, zuFirma }: { f: Firma; api: CrmApi; zurueck: () => void; zurueckKnopf: ReactNode; zuPerson: (id: string) => void; zuFirma: (id: string) => void }) {
  const crm = api.crm!;
  const drei = useBreit();
  const [huelle, breite] = useBreite();
  const zwei = !drei && (breite ?? 0) >= 640;
  const { teile: t, personen, chancen, mandate, bean } = useFirmenTeile({ f, api, zuPerson, zuFirma });
  const umsatz = useFirmaUmsatz(f, crm.stand, crm.heute);
  // Esc = zurück, außer beim Tippen oder wenn ein Fenster offen ist (wie in „Kontakt öffnen“).
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const el = e.target as HTMLElement;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [data-wahl-menue]')) return;
      zurueck();
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [zurueck]);
  const r = rolle(f.rolle);
  const offeneDeals = chancen.filter(c => OFFENE_STUFEN.includes(c.stufe));
  const aktiveMandate = mandate.filter(m => m.status === 'aktiv');
  const kopf = (
    <Karte i={0} ton={r.farbe}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        {zurueckKnopf}
        <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Firma{f.geaendert ? ` · geändert ${datum(f.geaendert.slice(0, 10), crm.heute)}` : ''}{drei ? ' · Esc schließt' : ''}</span>
      </div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div aria-hidden style={{ width: 46, height: 46, borderRadius: 12, flex: '0 0 auto', display: 'grid', placeItems: 'center', fontFamily: SCHRIFT.display, fontSize: 17, fontWeight: 700, color: r.farbe, background: `${r.farbe}18`, border: `2px solid ${r.farbe}88` }}>{f.name.trim().charAt(0).toUpperCase() || '?'}</div>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <h2 style={{ fontFamily: SCHRIFT.display, fontSize: 'clamp(20px, 2.2vw, 25px)', fontWeight: 700, letterSpacing: '-.02em', margin: 0, lineHeight: 1.15, overflowWrap: 'anywhere' }}>{f.name}</h2>
          <div style={{ fontSize: TYP.body, color: C.inkDim, marginTop: 3, overflowWrap: 'anywhere' }}>{[f.branche, f.stadt, f.webseite ?? f.domain].filter(Boolean).join(' · ') || 'Branche, Ort und Webseite fehlen noch — unter Stammdaten'}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip farbe={r.farbe}>{r.label}</Chip>
            <span title={bean.grund}><Chip farbe={LEUCHT.geld}>{`BEAN ${bean.bean} · ${BEAN_LABEL[bean.bean]}`}</Chip></span>
            {f.kundennummer && <Chip farbe={C.inkDim}>{`Kd.-Nr. ${f.kundennummer}`}</Chip>}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px 22px', flexWrap: 'wrap', marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)' }}>
        <KopfZahl label="Personen" wert={personen.length} title="laufende Stationen bei dieser Firma" />
        <KopfZahl label="Offene Deals" wert={offeneDeals.length || 'keiner'} farbe={offeneDeals.length ? LEUCHT.gut : C.inkLeise} />
        <KopfZahl label="Aktive Mandate" wert={aktiveMandate.length || 'keins'} farbe={aktiveMandate.length ? LEUCHT.gut : C.inkLeise} />
        <KopfZahl label="Umsatz" wert={umsatz.kennzahlen ? euro(umsatz.kennzahlen.bezahlt) : umsatz.zustand === 'kein' ? 'kein Zugang' : '…'} farbe={umsatz.kennzahlen?.bezahlt ? LEUCHT.geld : C.inkLeise} title="bezahlte Rechnungen" />
      </div>
    </Karte>
  );
  const karte = (inhalt: ReactNode, i: number) => (inhalt ? <Karte i={i} style={{ minWidth: 0 }}>{inhalt}</Karte> : null);
  const links = <>
    {karte(<div style={{ display: 'grid', gap: 12, minWidth: 0 }}>{t.rolle}{t.bean}{t.mutter}{t.toechter}{t.gruppe}</div>, 1)}
    {karte(t.lead, 2)}
    {karte(t.stammdaten, 3)}
  </>;
  const mitte = <>
    {karte(<div style={{ display: 'grid', gap: 14 }}>{t.personen}{t.ehemalig}</div>, 1)}
    {karte(t.verlauf(40), 2)}
    {karte(t.termine, 3)}
    {karte(t.aufgaben, 4)}
  </>;
  const rechts = <>
    {karte(t.dealsMandate ?? <div><Ueberschrift>Deals & Mandate</Ueberschrift><div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Noch kein Deal und kein Mandat.</div></div>, 1)}
    {karte(<FirmaUmsatzKarte u={umsatz} />, 2)}
    {karte(<FirmaDateien f={f} chancen={chancen.map(c => c.id)} mandate={mandate.map(m => m.id)} />, 3)}
    {karte(t.eventsKunde, 4)}
    {karte(t.begegnungen, 5)}
    {karte(t.zoe, 6)}
    {t.papierkorb}
  </>;
  return (
    <div ref={huelle} style={{ display: 'grid', gap: 14, minWidth: 0, overflowWrap: 'anywhere' }}>
      {kopf}
      {drei ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(0, 1.35fr) minmax(260px, 1fr)', gap: 14, alignItems: 'start' }}>
          <AktenSpalte>{links}</AktenSpalte><AktenSpalte>{mitte}</AktenSpalte><AktenSpalte>{rechts}</AktenSpalte>
        </div>
      ) : zwei ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
          <AktenSpalte>{links}{rechts}</AktenSpalte><AktenSpalte>{mitte}</AktenSpalte>
        </div>
      ) : (
        <AktenSpalte>{links}{mitte}{rechts}</AktenSpalte>
      )}
      {t.mitlaeufer}
    </div>
  );
}

type UmsatzStand = { zustand: 'laedt' | 'kein' | 'fehler' | 'da'; kennzahlen: UmsatzKennzahlen | null; rechnungen: ZugeordneteRechnung[] };
/**
 * Umsatz der Firma (30.10.): dieselbe Zuordnung wie der Reiter „Umsatz“ in „Kontakt öffnen“ (`umsatzBezug`, lib/crm/umsatz.ts) — nur über die Firma
 * (Mandate und Deals der Firma, Rechnungen mit Kundenfirma bzw. per Name). Die Rechnungen kommen nach Sicht gefiltert vom Server (`/api/rechnung?umsatz=1`).
 */
function useFirmaUmsatz(f: Firma, stand: CrmBestand, heute: string): UmsatzStand {
  const [roh, setRoh] = useState<UmsatzRechnung[] | 'laedt' | 'kein' | 'fehler'>('laedt');
  useEffect(() => {
    let aus = false;
    fetch('/api/rechnung?umsatz=1', { cache: 'no-store' })
      .then(async r => { if (r.status === 403) return 'kein' as const; const d = await r.json() as { ok?: boolean; rechnungen?: UmsatzRechnung[] }; return d.ok ? (Array.isArray(d.rechnungen) ? d.rechnungen : []) : 'fehler' as const; })
      .catch(() => 'fehler' as const)
      .then(x => { if (!aus) setRoh(x); });
    return () => { aus = true; };
  }, []);
  return useMemo(() => {
    if (!Array.isArray(roh)) return { zustand: roh, kennzahlen: null, rechnungen: [] };
    // Eine Kennung, die keine Person ist — so zählt nur, was an der Firma hängt.
    const b = umsatzBezug({ id: `firma:${f.id}`, firmaId: f.id, firma: f.name }, stand, roh, heute);
    return { zustand: 'da', kennzahlen: umsatzKennzahlen(b), rechnungen: b.rechnungen };
  }, [roh, f.id, f.name, stand, heute]);
}

function FirmaUmsatzKarte({ u }: { u: UmsatzStand }) {
  const k = u.kennzahlen;
  // minWidth 0 (Rundgang 30.10.): sonst schoben lange Rechnungstitel und die drei Zahlen die rechte Spalte über den Rand.
  return (
    <div style={{ minWidth: 0 }}>
      <Ueberschrift rechts={<Link href={WEG.rechnungen()} style={{ fontSize: TYP.bedien, color: C.inkLeise, textDecoration: 'none' }}>Finanzen ›</Link>}>Umsatz & Rechnungen</Ueberschrift>
      {u.zustand === 'laedt' && <Leer>lädt …</Leer>}
      {u.zustand === 'kein' && <Leer>Rechnungen sieht nur, wer Zugang zu den Finanzen hat.</Leer>}
      {u.zustand === 'fehler' && <Leer>Die Rechnungen ließen sich gerade nicht laden.</Leer>}
      {k && (
        <div style={{ display: 'grid', gap: 10, minWidth: 0, gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <Raster min={120}>
            <Zahl wert={euro(k.bezahlt)} label="bezahlt" farbe={k.bezahlt ? LEUCHT.geld : undefined} />
            <Zahl wert={euro(k.offen)} label={k.anzahlUeberfaellig ? `offen · ${k.anzahlUeberfaellig} überfällig` : 'offen'} farbe={k.anzahlUeberfaellig ? LEUCHT.achtung : undefined} />
            <Zahl wert={euro(k.monatswert)} label="je Monat aus Mandaten" />
          </Raster>
          {u.rechnungen.slice(0, 8).map(z => (
            <Link key={z.r.id} href={WEG.rechnung(z.r.id)} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, minWidth: 0, fontSize: TYP.bedien, padding: '4px 0', color: C.ink, textDecoration: 'none' }}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{z.r.nummer ?? z.r.titel}<span style={{ color: z.ueberfaellig ? LEUCHT.achtung : C.inkLeise }}> · {z.ueberfaellig ? 'überfällig' : z.r.status}{z.perName ? ' · per Name zugeordnet' : ''}</span></span>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: C.inkDim, flex: '0 0 auto' }}>{euro(z.r.betrag)} ›</span>
            </Link>
          ))}
          {u.rechnungen.length > 8 && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{`und ${u.rechnungen.length - 8} weitere — in den Finanzen`}</div>}
          {!u.rechnungen.length && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Noch keine Rechnung an diese Firma.</div>}
        </div>
      )}
    </div>
  );
}

/** Unterlagen der Firma (30.10.): die CRM-Ablage zu Firma, Deals und Mandaten — nur lesen und herunterladen; hochladen geht in der Akte einer Person bzw. am Mandat. */
function FirmaDateien({ f, chancen, mandate }: { f: Firma; chancen: string[]; mandate: string[] }) {
  const [liste, setListe] = useState<DateiEintrag[] | null | 'fehler'>(null);
  const filter = new URLSearchParams({ firma: f.id, ...(mandate.length ? { mandat: mandate.join(',') } : {}), ...(chancen.length ? { deal: chancen.join(',') } : {}) }).toString();
  useEffect(() => {
    let aus = false;
    fetch(`/api/crm/dateien?${filter}`, { cache: 'no-store' }).then(r => r.json()).then((d: { ok?: boolean; eintraege?: DateiEintrag[] }) => { if (!aus) setListe(d.ok ? d.eintraege ?? [] : 'fehler'); }).catch(() => { if (!aus) setListe('fehler'); });
    return () => { aus = true; };
  }, [filter]);
  return (
    <div>
      <Ueberschrift rechts={Array.isArray(liste) && liste.length ? `${liste.length}` : undefined}>Dateien</Ueberschrift>
      {liste === null && <Leer>lädt …</Leer>}
      {liste === 'fehler' && <Leer>Die Ablage ist gerade nicht erreichbar.</Leer>}
      {Array.isArray(liste) && !liste.length && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Noch keine Unterlagen — Verträge und Angebote legt man in der Akte einer Person (Reiter Umsatz) ab.</div>}
      {Array.isArray(liste) && liste.slice(0, 12).map(e => (
        <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: TYP.bedien, padding: '4px 0' }}>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.titel ?? e.datei?.name ?? 'Unterlage'}<span style={{ color: C.inkLeise }}> · {DATEI_ARTEN.find(a => a.id === e.art)?.label ?? e.art}{e.datei ? ` · ${groesseText(e.datei.groesse)}` : ''}</span></span>
          {e.datei && <a href={`/api/crm/dateien?id=${encodeURIComponent(e.id)}`} download style={{ color: C.aktiv, textDecoration: 'none', flex: '0 0 auto' }}>laden</a>}
        </div>
      ))}
      {Array.isArray(liste) && liste.length > 12 && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{`und ${liste.length - 12} weitere`}</div>}
    </div>
  );
}
