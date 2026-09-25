'use client';

// ─── MAKE OS — Finanzplanung ────────────────────────────────────────────────
// Der lebende Finanz-Organismus: beide Firmen mit Vivid-Konten (Stand von
// Hand, bis die Anbindung steht — siehe Bauplan), die Rechnungs-Pipeline
// (geplant → gestellt → bezahlt, Klick wechselt den Status) und Merkposten
// (Björn-Kredit). Oben die Verknüpfung zum Umsatzziel aus dem Controlling.
// 24.09.: auf das lebendige Muster umgezogen (Karten, Leuchtfarben, Listen).

import Link from 'next/link';
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { computeMetrics, eur, type FinanceState } from '@/lib/make-one/finance-data';
import { useSpeichern } from '@/hooks/useSpeichern';
import { useAbgleich } from '@/hooks/useAbgleich';
import { FINANZPLAN_LISTEN } from '@/lib/sync';
import { localDay } from '@/lib/zeit';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Knopf, Haken, Zahl, feld, LEUCHT } from './schlank';

interface Firma { id: string; name: string; bank: string; kontostand: number | null; stand: string | null }
type RStatus = 'geplant' | 'gestellt' | 'bezahlt';
interface Rechnung {
  id: string; firmaId: string; kunde: string; titel: string; betrag: number; status: RStatus; faellig?: string; notiz?: string;
  /** Der Vorgang: Angebot → Rechnung → Eingang (Kevins Ansage 02.08.). */
  nummer?: string; datum?: string; angebot?: string; angebotAm?: string; bezahltAm?: string;
  netto?: number; ustSatz?: number; leistungVon?: string; leistungBis?: string;
}
interface Merkposten { id: string; firmaId: string; titel: string; betrag: number; art: 'kredit' | 'sonstig'; datum?: string; notiz?: string }
interface Zahlung { id: string; firmaId: string; an: string; titel: string; betrag: number; status: 'offen' | 'bezahlt'; faellig?: string }
interface Produkt { id: string; name: string; beschreibung: string; preis: number; einheit: 'einmalig' | 'monatlich' | 'projekt'; status: 'entwurf' | 'aktiv' }
interface Uhrwerk { letztesMeeting: string | null; agenda: { id: string; label: string; done: boolean }[] }
interface Plan { firmen: Firma[]; rechnungen: Rechnung[]; merkposten: Merkposten[]; zahlungen: Zahlung[]; produkte: Produkt[]; uhrwerk: Uhrwerk }

const STATUS_FARBE: Record<RStatus, string> = { geplant: C.inkDim, gestellt: LEUCHT.achtung, bezahlt: LEUCHT.gut };
const STATUS_NEXT: Record<RStatus, RStatus> = { geplant: 'gestellt', gestellt: 'bezahlt', bezahlt: 'geplant' };
/** Kredite in Lila — wie bisher, jetzt aus der Leuchtpalette. */
const KREDIT = LEUCHT.agenten;
const HAAR = 'rgba(255,255,255,.06)';

const geld: CSSProperties = { fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 15, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
const leise: CSSProperties = { fontSize: 12, color: C.inkLeise, whiteSpace: 'nowrap' };
/** Kompaktes Eingabefeld in einer Zeile. */
const eingabe: CSSProperties = { ...feld, width: 'auto', padding: '7px 10px', fontSize: TYP.bedien, borderRadius: 8 };
const auswahl: CSSProperties = { background: 'rgba(255,255,255,.05)', border: 'none', borderRadius: 8, color: C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, padding: '7px 10px', colorScheme: 'dark', outline: 'none', cursor: 'pointer' };
const option: CSSProperties = { background: C.flaeche };
const datum = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}.`;

/** Ein Chip, den man drücken kann — für Status-Wechsel. */
function ChipKnopf({ farbe, onClick, title, children }: { farbe: string; onClick: () => void; title?: string; children: ReactNode }) {
  return (
    <button onClick={onClick} title={title} className="fassbar" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', minWidth: 76, justifyContent: 'center' }}>
      <Chip farbe={farbe}>{children}</Chip>
    </button>
  );
}

/** Kleiner Zeichen-Knopf — ▲ ▼ ✕. */
function Zeichen({ onClick, aus, label, children }: { onClick: () => void; aus?: boolean; label: string; children: ReactNode }) {
  return (
    <button onClick={onClick} disabled={aus} aria-label={label} title={label} style={{
      width: 28, height: 28, borderRadius: 8, border: 'none', padding: 0, flex: '0 0 auto', display: 'grid', placeItems: 'center',
      background: 'rgba(255,255,255,.05)', color: aus ? 'rgba(255,255,255,.18)' : C.inkDim, cursor: aus ? 'default' : 'pointer', fontSize: 12, lineHeight: 1,
    }}>{children}</button>
  );
}

export function FinanzplanungView() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [finance, setFinance] = useState<FinanceState | null>(null);
  const [neu, setNeu] = useState({ kunde: '', titel: '', betrag: '', firmaId: 'kdc' });
  const [neuZ, setNeuZ] = useState({ an: '', titel: '', betrag: '', faellig: '', firmaId: 'kdc' });
  const heute = localDay();

  // Speichert auch beim Seitenwechsel — nichts geht zwischen zwei Klicks verloren.
  // Zu zweit: nur Einzeländerungen, und Malins Änderungen kommen per Abgleich herein.
  const planSpeichern = useSpeichern('/api/state/finanzplan', { listen: FINANZPLAN_LISTEN, uebernehmen: st => setPlan(st as unknown as Plan) });
  const ladePlan = useCallback(() => fetch('/api/state/finanzplan').then(r => r.json()).then((d: Plan) => {
    if (planSpeichern.hatOffenes()) return;
    setPlan(d); planSpeichern.kenne(d);
  }).catch(() => {}), [planSpeichern]);
  useEffect(() => {
    void ladePlan();
    fetch('/api/state/finance').then(r => r.json()).then(d => setFinance(d.state ?? d)).catch(() => {});
  }, [ladePlan]);
  useAbgleich(ladePlan, { pausiert: planSpeichern.hatOffenes });
  function speichern(next: Plan) {
    setPlan(next);
    planSpeichern.speichern(next);
  }

  if (!plan) return <Seite titel="Finanzplanung" unter={`Finanzen · ${datum(heute)}`}><Karte i={0}><Leer>lade …</Leer></Karte></Seite>;

  const m = finance ? computeMetrics(finance) : null;
  // Privat zählt hier nicht mit — die privaten Konten stehen unter Zahlen → Privat.
  const cash = plan.firmen.filter(f => f.id !== 'privat').reduce((s, f) => s + (f.kontostand ?? 0), 0);
  const gestellt = plan.rechnungen.filter(r => r.status === 'gestellt');
  const geplant = plan.rechnungen.filter(r => r.status === 'geplant');
  const sum = (list: Rechnung[]) => list.reduce((s, r) => s + r.betrag, 0);
  const kredite = plan.merkposten.filter(x => x.art === 'kredit').reduce((s, x) => s + x.betrag, 0);
  const zuZahlen = plan.zahlungen.filter(z => z.status === 'offen');
  const firmaName = (id: string) => plan.firmen.find(f => f.id === id)?.name ?? id;

  function rechnungAendern(id: string, patch: Partial<Rechnung>) {
    speichern({ ...plan!, rechnungen: plan!.rechnungen.map(r => r.id === id ? { ...r, ...patch } : r) });
  }
  function zahlungBewegen(id: string, richtung: -1 | 1) {
    const z = [...plan!.zahlungen];
    const i = z.findIndex(x => x.id === id);
    const j = i + richtung;
    if (i < 0 || j < 0 || j >= z.length) return;
    [z[i], z[j]] = [z[j], z[i]];
    speichern({ ...plan!, zahlungen: z });
  }

  const uhrwerk = plan.uhrwerk ?? { letztesMeeting: null, agenda: [] };
  const agendaOffen = uhrwerk.agenda.filter(a => !a.done).length;
  const tageSeitMeeting = uhrwerk.letztesMeeting
    ? Math.round((new Date(`${heute}T12:00:00`).getTime() - new Date(`${uhrwerk.letztesMeeting}T12:00:00`).getTime()) / 86_400_000)
    : null;
  const meetingUeberfaellig = tageSeitMeeting !== null && tageSeitMeeting > 16;

  return (
    <Seite titel="Finanzplanung" unter={`Finanzen · ${datum(heute)}`}>
      {/* ── Finanzmeeting — das Uhrwerk: 2× im Monat, läuft immer wieder durch ── */}
      <Karte i={0} akzent={meetingUeberfaellig ? LEUCHT.kritisch : undefined}>
        <Ueberschrift farbe={meetingUeberfaellig ? LEUCHT.kritisch : agendaOffen ? LEUCHT.achtung : LEUCHT.gut}
          rechts={<><Chip farbe={agendaOffen ? LEUCHT.achtung : LEUCHT.gut}>{uhrwerk.agenda.length - agendaOffen}/{uhrwerk.agenda.length}</Chip>
            <span style={{ color: meetingUeberfaellig ? LEUCHT.kritisch : C.inkLeise }}>
              {uhrwerk.letztesMeeting
                ? `zuletzt ${datum(uhrwerk.letztesMeeting)}${meetingUeberfaellig ? ' — überfällig, der Takt ist alle 2 Wochen' : ''}`
                : 'noch keins abgeschlossen — das erste steht an'}
            </span></>}>
          Finanzmeeting · 2× im Monat
        </Ueberschrift>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 4 }}>
          <b style={{ color: C.ink }}>Rollen:</b> Malin bereitet vor, gleicht ab und prüft · Kevin entscheidet und gibt frei.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', columnGap: 24 }}>
          {uhrwerk.agenda.map(a => {
            const wechsel = () => speichern({ ...plan, uhrwerk: { ...uhrwerk, agenda: uhrwerk.agenda.map(x => x.id === a.id ? { ...x, done: !x.done } : x) } });
            return (
              <Zeile key={a.id} onClick={wechsel} links={<Haken an={a.done} onChange={wechsel} />}
                titel={<span style={{ color: a.done ? C.inkLeise : C.ink, textDecoration: a.done ? 'line-through' : 'none' }}>{a.label}</span>} />
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 14 }}>
          <Knopf onClick={() => speichern({ ...plan, uhrwerk: { letztesMeeting: heute, agenda: uhrwerk.agenda.map(a => ({ ...a, done: false })) } })}>✓ Meeting abgeschlossen</Knopf>
          <span style={{ fontSize: 12, color: C.inkLeise }}>stempelt das Datum und setzt die Liste fürs nächste Mal zurück</span>
        </div>
      </Karte>

      {/* Ziel-Verknüpfung: dieselben Zahlen wie im Controlling */}
      {m && finance && (
        <Karte i={1}>
          <Ueberschrift farbe={LEUCHT.business} rechts={<Link href="/os/controlling" style={{ color: C.inkLeise, textDecoration: 'none' }}>Controlling ›</Link>}>Jahresziel</Ueberschrift>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
            <Zahl wert={eur(finance.zielUmsatz)} label="Jahresziel" />
            <Zahl wert={eur(m.istUmsatz)} label={`Ist · ${Math.round(m.fortschritt * 100)} %`} farbe={LEUCHT.gut} />
            <Zahl wert={eur(sum(gestellt))} label="gestellt offen" farbe={gestellt.length ? LEUCHT.achtung : C.inkLeise} />
            <Zahl wert={eur(sum(geplant))} label="in Vorbereitung" />
          </div>
        </Karte>
      )}

      {/* KPIs */}
      <Karte i={2} akzent={LEUCHT.geld}>
        <Ueberschrift farbe={LEUCHT.geld}>Cash · beide Konten</Ueberschrift>
        <Zahl gross wert={plan.firmen.some(f => f.kontostand != null) ? eur(cash) : undefined} farbe={cash < 0 ? LEUCHT.kritisch : LEUCHT.geld} label={plan.firmen.some(f => f.kontostand != null) ? `${plan.firmen.length} Konten` : 'noch kein Kontostand eingetragen'} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginTop: 14 }}>
          <Zahl wert={eur(sum(gestellt))} label={`offene Forderungen · ${gestellt.length}`} farbe={gestellt.length ? LEUCHT.achtung : C.inkLeise} />
          <Zahl wert={eur(sum(geplant))} label={`in Vorbereitung · ${geplant.length}`} />
          <Zahl wert={eur(zuZahlen.reduce((s, z) => s + z.betrag, 0))} label={`zu zahlen · ${zuZahlen.length} offen`} farbe={zuZahlen.length ? LEUCHT.kritisch : C.inkLeise} />
          <Zahl wert={eur(kredite)} label="Kredite erhalten" farbe={kredite ? KREDIT : C.inkLeise} />
        </div>
      </Karte>

      {/* Firmen & Konten */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {plan.firmen.map((f, fi) => {
          const offen = plan.rechnungen.filter(r => r.firmaId === f.id && r.status === 'gestellt');
          return (
            <Karte key={f.id} i={3 + fi}>
              <Ueberschrift farbe={offen.length ? LEUCHT.achtung : LEUCHT.gut} rechts={f.bank}>{f.name}</Ueberschrift>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>Kontostand</span>
                <input type="number" value={f.kontostand ?? ''} placeholder="—" aria-label={`Kontostand ${f.name}`}
                  onChange={e => speichern({ ...plan, firmen: plan.firmen.map(x => x.id === f.id ? { ...x, kontostand: e.target.value === '' ? null : Number(e.target.value) } : x) })}
                  style={{ ...eingabe, width: 130, fontFamily: SCHRIFT.display, fontSize: 17, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }} />
                <span style={leise}>€{f.stand ? ` · Stand ${datum(f.stand)}` : ''}</span>
              </div>
              <div style={{ marginTop: 10 }}>
                <Chip farbe={offen.length ? LEUCHT.achtung : C.inkLeise}>
                  {offen.length ? `${offen.length} Rechnung${offen.length > 1 ? 'en' : ''} offen · ${eur(sum(offen))}` : 'keine offenen Forderungen'}
                </Chip>
              </div>
            </Karte>
          );
        })}
      </div>

      {/* Rechnungs-Pipeline */}
      <Karte i={3 + plan.firmen.length}>
        <Ueberschrift farbe={LEUCHT.gut} rechts="Klick auf den Status wechselt: geplant → gestellt → bezahlt">Rechnungen</Ueberschrift>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {plan.rechnungen.map(r => {
            const spaet = r.status === 'gestellt' && r.faellig && r.faellig < heute;
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderBottom: `1px solid ${HAAR}`, padding: '10px 0' }}>
                <ChipKnopf farbe={STATUS_FARBE[r.status]} onClick={() => rechnungAendern(r.id, { status: STATUS_NEXT[r.status] })} title="Status wechseln">{r.status}</ChipKnopf>
                <span style={{ fontSize: TYP.body, fontWeight: 600, color: C.ink }}>{r.kunde}</span>
                <span style={{ fontSize: TYP.bedien, color: C.inkDim, flex: 1, minWidth: 140 }}>{r.titel}</span>
                <span style={leise}>{firmaName(r.firmaId)}</span>
                {r.faellig && <span style={{ ...leise, color: spaet ? LEUCHT.kritisch : C.inkLeise }}>{spaet ? 'überfällig ' : 'fällig '}{datum(r.faellig)}</span>}
                <input type="number" value={r.betrag || ''} placeholder="0" aria-label="Betrag"
                  onChange={e => rechnungAendern(r.id, { betrag: Number(e.target.value) || 0 })}
                  style={{ ...eingabe, width: 96, textAlign: 'right', fontFamily: SCHRIFT.display, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }} />
                <span style={leise}>€</span>
                <Zeichen onClick={() => speichern({ ...plan, rechnungen: plan.rechnungen.filter(x => x.id !== r.id) })} label="Rechnung löschen">✕</Zeichen>

                {/* Der Vorgang dahinter — Kevins Ansage: der Betrag allein
                    reicht nicht, Angebot, Nummer und Daten gehören dazu. */}
                <div style={{ flexBasis: '100%', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {([
                    ['nummer', 'Rechnungs-Nr.', 'text', 118],
                    ['datum', 'gestellt am', 'date', 138],
                    ['angebot', 'Angebots-Nr.', 'text', 118],
                    ['angebotAm', 'Angebot vom', 'date', 138],
                    ['bezahltAm', 'bezahlt am', 'date', 138],
                  ] as const).map(([name, platz, typ, breite]) => (
                    <input key={name} type={typ} value={(r[name] as string) ?? ''} placeholder={platz} title={platz} aria-label={platz}
                      onChange={e => rechnungAendern(r.id, { [name]: e.target.value || undefined })}
                      style={{ ...eingabe, width: breite, fontSize: 12, padding: '5px 8px', colorScheme: 'dark', color: r[name] ? C.ink : C.inkLeise }} />
                  ))}
                  <span style={leise}>
                    netto {(r.netto ?? r.betrag / 1.19).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    {r.ustSatz != null ? ` · ${r.ustSatz}% USt` : ' · 19% angenommen'}
                  </span>
                </div>
              </div>
            );
          })}
          {!plan.rechnungen.length && <Leer>Keine Rechnungen — unten anlegen.</Leer>}
        </div>
        {/* Neu anlegen */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={neu.kunde} onChange={e => setNeu({ ...neu, kunde: e.target.value })} placeholder="Kunde" aria-label="Kunde" style={{ ...eingabe, width: 140 }} />
          <input value={neu.titel} onChange={e => setNeu({ ...neu, titel: e.target.value })} placeholder="Leistung/Titel" aria-label="Leistung" style={{ ...eingabe, flex: 1, minWidth: 160 }} />
          <input value={neu.betrag} onChange={e => setNeu({ ...neu, betrag: e.target.value })} placeholder="€" type="number" aria-label="Betrag" style={{ ...eingabe, width: 96, textAlign: 'right' }} />
          <select value={neu.firmaId} onChange={e => setNeu({ ...neu, firmaId: e.target.value })} aria-label="Firma" style={auswahl}>
            {plan.firmen.map(f => <option key={f.id} value={f.id} style={option}>{f.name}</option>)}
          </select>
          <Knopf onClick={() => {
            if (!neu.kunde.trim()) return;
            speichern({ ...plan, rechnungen: [...plan.rechnungen, { id: `r-${Date.now().toString(36)}`, firmaId: neu.firmaId, kunde: neu.kunde.trim(), titel: neu.titel.trim(), betrag: Number(neu.betrag) || 0, status: 'geplant' }] });
            setNeu({ kunde: '', titel: '', betrag: '', firmaId: neu.firmaId });
          }}>+ Rechnung</Knopf>
        </div>
        <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 12, lineHeight: 1.6 }}>
          Bezahlt? Dann den Betrag im <Link href="/os/controlling" style={{ color: C.aktiv, textDecoration: 'none' }}>Controlling</Link> als Monats-Umsatz erfassen — dort zählt er aufs Jahresziel.
        </div>
      </Karte>

      {/* ── Zahlungs-Prioritäten: was zuerst bezahlt wird, steht oben ── */}
      <Karte i={4 + plan.firmen.length}>
        <Ueberschrift farbe={LEUCHT.achtung} rechts="oben = zuerst · ▲▼ ordnen">Zahlungs-Prioritäten</Ueberschrift>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {plan.zahlungen.map((z, i) => {
            const spaet = z.status === 'offen' && z.faellig && z.faellig < heute;
            return (
              <div key={z.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderBottom: `1px solid ${HAAR}`, padding: '10px 0', opacity: z.status === 'bezahlt' ? 0.5 : 1 }}>
                <span style={{ fontFamily: SCHRIFT.display, fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: i === 0 && z.status === 'offen' ? LEUCHT.kritisch : C.inkLeise, width: 24, textAlign: 'right' }}>{i + 1}.</span>
                <span style={{ display: 'flex', gap: 3 }}>
                  <Zeichen onClick={() => zahlungBewegen(z.id, -1)} aus={i === 0} label="nach oben">▲</Zeichen>
                  <Zeichen onClick={() => zahlungBewegen(z.id, 1)} aus={i === plan.zahlungen.length - 1} label="nach unten">▼</Zeichen>
                </span>
                <ChipKnopf farbe={z.status === 'bezahlt' ? LEUCHT.gut : LEUCHT.achtung} title="offen ↔ bezahlt"
                  onClick={() => speichern({ ...plan, zahlungen: plan.zahlungen.map(x => x.id === z.id ? { ...x, status: x.status === 'offen' ? 'bezahlt' : 'offen' } : x) })}>
                  {z.status}
                </ChipKnopf>
                <span style={{ fontSize: TYP.body, fontWeight: 600, color: C.ink }}>{z.an}</span>
                <span style={{ fontSize: TYP.bedien, color: C.inkDim, flex: 1, minWidth: 120 }}>{z.titel}</span>
                <span style={leise}>{firmaName(z.firmaId)}</span>
                {z.faellig && <span style={{ ...leise, color: spaet ? LEUCHT.kritisch : C.inkLeise }}>{spaet ? 'überfällig ' : 'fällig '}{datum(z.faellig)}</span>}
                <span style={{ ...geld, color: spaet ? LEUCHT.kritisch : C.ink }}>{eur(z.betrag)}</span>
                <Zeichen onClick={() => speichern({ ...plan, zahlungen: plan.zahlungen.filter(x => x.id !== z.id) })} label="Zahlung löschen">✕</Zeichen>
              </div>
            );
          })}
          {!plan.zahlungen.length && <Leer>Noch leer — im Finanzmeeting alle offenen Rechnungen zusammenziehen und hier priorisieren.</Leer>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={neuZ.an} onChange={e => setNeuZ({ ...neuZ, an: e.target.value })} placeholder="An wen" aria-label="An wen" style={{ ...eingabe, width: 140 }} />
          <input value={neuZ.titel} onChange={e => setNeuZ({ ...neuZ, titel: e.target.value })} placeholder="Wofür" aria-label="Wofür" style={{ ...eingabe, flex: 1, minWidth: 140 }} />
          <input value={neuZ.betrag} onChange={e => setNeuZ({ ...neuZ, betrag: e.target.value })} placeholder="€" type="number" aria-label="Betrag" style={{ ...eingabe, width: 96, textAlign: 'right' }} />
          <input value={neuZ.faellig} onChange={e => setNeuZ({ ...neuZ, faellig: e.target.value })} type="date" aria-label="Fällig am" style={{ ...eingabe, colorScheme: 'dark', color: neuZ.faellig ? C.ink : C.inkLeise }} />
          <select value={neuZ.firmaId} onChange={e => setNeuZ({ ...neuZ, firmaId: e.target.value })} aria-label="Firma" style={auswahl}>
            {plan.firmen.map(f => <option key={f.id} value={f.id} style={option}>{f.name}</option>)}
          </select>
          <Knopf farbe={LEUCHT.achtung} onClick={() => {
            if (!neuZ.an.trim()) return;
            speichern({ ...plan, zahlungen: [...plan.zahlungen, { id: `z-${Date.now().toString(36)}`, firmaId: neuZ.firmaId, an: neuZ.an.trim(), titel: neuZ.titel.trim(), betrag: Number(neuZ.betrag) || 0, status: 'offen', faellig: neuZ.faellig || undefined }] });
            setNeuZ({ an: '', titel: '', betrag: '', faellig: '', firmaId: neuZ.firmaId });
          }}>+ Zahlung</Knopf>
        </div>
      </Karte>

      {/* ── Produkte: 2–3 Pakete, im Meeting festzurren ── */}
      <Karte i={5 + plan.firmen.length}>
        <Ueberschrift farbe={LEUCHT.business} rechts="Entwürfe — im Finanzmeeting festzurren, Klick auf Status aktiviert">Produkte</Ueberschrift>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 10 }}>
          {plan.produkte.map(p => (
            <div key={p.id} style={{ background: 'rgba(255,255,255,.04)', borderRadius: 14, padding: '12px 14px', boxShadow: p.status === 'aktiv' ? `inset 0 0 0 1px ${LEUCHT.gut}55, 0 0 24px -10px ${LEUCHT.gut}40` : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input value={p.name} aria-label="Produktname" onChange={e => speichern({ ...plan, produkte: plan.produkte.map(x => x.id === p.id ? { ...x, name: e.target.value } : x) })}
                  style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: TYP.body, fontWeight: 700, color: C.ink, fontFamily: SCHRIFT.display, flex: 1, minWidth: 0, padding: 0 }} />
                <ChipKnopf farbe={p.status === 'aktiv' ? LEUCHT.gut : C.inkLeise} title="Entwurf ↔ aktiv"
                  onClick={() => speichern({ ...plan, produkte: plan.produkte.map(x => x.id === p.id ? { ...x, status: x.status === 'aktiv' ? 'entwurf' : 'aktiv' } : x) })}>
                  {p.status}
                </ChipKnopf>
              </div>
              <div style={{ fontSize: 12.5, color: C.inkDim, margin: '6px 0 10px', lineHeight: 1.45 }}>{p.beschreibung}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="number" value={p.preis || ''} placeholder="Preis" aria-label="Preis"
                  onChange={e => speichern({ ...plan, produkte: plan.produkte.map(x => x.id === p.id ? { ...x, preis: Number(e.target.value) || 0 } : x) })}
                  style={{ ...eingabe, width: 96, textAlign: 'right', fontFamily: SCHRIFT.display, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }} />
                <span style={leise}>€ · {p.einheit}</span>
              </div>
            </div>
          ))}
        </div>
      </Karte>

      {/* Merkposten */}
      <Karte i={6 + plan.firmen.length}>
        <Ueberschrift farbe={KREDIT}>Merkposten</Ueberschrift>
        <Liste>
          {plan.merkposten.map(x => (
            <Zeile key={x.id} links={<Chip farbe={KREDIT}>{x.art === 'kredit' ? 'KREDIT' : 'MERK'}</Chip>} titel={x.titel}
              unter={`${firmaName(x.firmaId)}${x.datum ? ` · ${datum(x.datum)}` : ''}${x.notiz ? ` · ${x.notiz}` : ''}`}
              rechts={<span style={{ ...geld, color: x.betrag >= 0 ? LEUCHT.gut : LEUCHT.kritisch }}>{eur(x.betrag)}</span>} />
          ))}
          {!plan.merkposten.length && <Leer>Nichts vorgemerkt.</Leer>}
        </Liste>
      </Karte>
    </Seite>
  );
}
