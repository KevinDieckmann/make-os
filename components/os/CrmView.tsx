'use client';

// ─── MAKE OS — CRM & Kunden (Mandate) ───────────────────────────────────────
// Die Mandate von KD Ventures (du & Malin arbeitet darüber) + der Anschluss an
// die Neukunden-Pipeline (Prospecting). HubSpot-Anbindung kommt später — bis
// dahin ist DAS die eine Kundenliste.
// 24.09.: auf das lebendige Muster umgezogen (Seite/Karte/Zeile/Zahl aus
// schlank). Mit `eingebettet` (in Kontakte → Mandate) kommen nur die
// Abschnitte, ohne Seite und ohne eigene Karte.

import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { listeSchreiben } from '@/lib/make-one/liste-sync';
import { useTasks } from '@/context/TasksContext';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Chip, Punkt, Zahl, feld, LEUCHT } from './schlank';

interface Kunde { id: string; name: string; status: 'aktiv' | 'gespraech' | 'ruht'; mandat?: string; cashflow?: number; naechsterSchritt?: string; notizen?: string }
interface Prospect { id: string; company: string; score?: number; status: string }
interface Rechnung { id: string; firmaId: string; kunde: string; titel: string; betrag: number; status: 'geplant' | 'gestellt' | 'bezahlt'; faellig?: string }
interface Produkt { id: string; name: string; beschreibung: string; preis: number; einheit: string; status: string }
interface Finanzplan { rechnungen: Rechnung[]; produkte: Produkt[]; firmen: { id: string }[] }
const RSTATUS_FARBE: Record<Rechnung['status'], string> = { geplant: C.inkLeise, gestellt: LEUCHT.achtung, bezahlt: LEUCHT.gut };

const STATUS: { id: Kunde['status']; label: string; farbe: string }[] = [
  { id: 'aktiv', label: 'Aktiv', farbe: LEUCHT.gut },
  { id: 'gespraech', label: 'Im Gespräch', farbe: LEUCHT.achtung },
  { id: 'ruht', label: 'Ruht', farbe: C.inkLeise },
];
const eur = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const mikro: CSSProperties = { fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise };
const verweis: CSSProperties = { color: C.aktiv, textDecoration: 'none', textTransform: 'none', letterSpacing: 0 };
/** Nie eine Null als große Zahl — dann lieber der Strich. */
const z = (n: number) => (n ? String(n) : undefined);

/** Pillen-Schalter — eine Wahl aus mehreren, ohne Rahmen. */
function Wahl({ an, farbe, onClick, children, title }: { an: boolean; farbe?: string; onClick: () => void; children: ReactNode; title?: string }) {
  const f = farbe ?? C.aktiv;
  return (
    <button onClick={onClick} title={title} className="fassbar" style={{ fontFamily: SCHRIFT.text, fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', background: an ? `${f}22` : 'rgba(255,255,255,.05)', color: an ? f : C.inkDim, whiteSpace: 'nowrap', transition: 'background .2s ease, color .2s ease' }}>{children}</button>
  );
}

export function CrmView({ eingebettet = false }: { eingebettet?: boolean } = {}) {
  const { state: tasksState } = useTasks();
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [fplan, setFplan] = useState<Finanzplan | null>(null);
  const [neu, setNeu] = useState('');
  const [offen, setOffen] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Zuletzt gelesener/geschriebener Stand — Basis für die Unterschiede. */
  const gespeichert = useRef<Kunde[] | null>(null);

  // Ohne geladene Stände wird nichts zurückgeschrieben — sonst überschreibt
  // die erste Änderung Kundenliste oder Finanzplan mit einem leeren Stand.
  const [ladeFehler, setLadeFehler] = useState(false);
  useEffect(() => {
    const pruefen = (r: Response) => { if (!r.ok) throw new Error(`Status ${r.status}`); return r.json(); };
    const melden = (was: string) => (err: unknown) => {
      console.error(`[MAKE OS] ${was} konnte nicht geladen werden — Speichern gesperrt.`, err);
      setLadeFehler(true);
    };
    fetch('/api/state/kunden').then(pruefen).then(d => { const l = d.kunden ?? []; gespeichert.current = l; setKunden(l); }).catch(melden('Kunden'));
    fetch('/api/state/prospects').then(pruefen).then(d => setProspects(d.state?.prospects ?? [])).catch(melden('Zielkunden'));
    fetch('/api/state/finanzplan').then(pruefen).then(setFplan).catch(melden('Finanzplan'));
  }, []);

  /** Rechnung im Finanzplan anlegen (z.B. Produkt an Kunden) — gleiche Wahrheit wie /os/finanzen.
   *  Zwei-Fenster-Fundament: es geht NUR die neue Rechnung raus, nicht der
   *  ganze Finanzplan — sonst überschriebe ein Klick hier Malins gerade
   *  gepflegte Kontostände und Zahlungen. */
  function rechnungAnlegen(kunde: string, titel: string, betrag: number) {
    if (!fplan || ladeFehler) return;
    const neu = { id: `r-${Date.now().toString(36)}`, firmaId: 'kdc', kunde, titel, betrag, status: 'geplant' as const };
    setFplan({ ...fplan, rechnungen: [...fplan.rechnungen, neu] });
    fetch('/api/state/finanzplan', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ops: [{ liste: 'rechnungen', op: 'upsert', eintrag: neu }] }),
    }).catch(() => { /* offline — nächster Versuch beim nächsten Anlegen */ });
  }

  const rechnungenVon = (name: string) => (fplan?.rechnungen ?? []).filter(r => r.kunde.toLowerCase() === name.toLowerCase());
  const aufgabenVon = (name: string) => tasksState.tasks.filter(t => t.status !== 'done' && t.title.toLowerCase().includes(name.toLowerCase()));

  function persist(next: Kunde[]) {
    setKunden(next);
    if (ladeFehler) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const alt = gespeichert.current;
      gespeichert.current = next;
      void listeSchreiben<Kunde>('/api/state/kunden', 'kunden', alt, next);
    }, 500);
  }
  const patch = (id: string, p: Partial<Kunde>) => persist(kunden.map(k => k.id === id ? { ...k, ...p } : k));

  const addKunde = () => {
    const n = neu.trim();
    if (!n) return;
    persist([...kunden, { id: `k-${Date.now().toString(36)}`, name: n, status: 'gespraech' }]);
    setNeu('');
  };

  const mrr = kunden.filter(k => k.status === 'aktiv').reduce((s, k) => s + (k.cashflow ?? 0), 0);
  const hot = prospects.filter(p => (p.score ?? 0) >= 80 && p.status !== 'verworfen').length;
  const kontaktiert = prospects.filter(p => p.status === 'kontaktiert').length;

  // ── Kennzahlen ──
  const kopf = (
    <>
      <Ueberschrift farbe={LEUCHT.business} rechts={<Link href="/os/prospecting" style={{ color: C.inkLeise, textDecoration: 'none' }}>Neukunden-Pipeline · {prospects.length} Firmen · {hot} heiß · {kontaktiert} kontaktiert ›</Link>}>Mandate · KD Ventures</Ueberschrift>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 16, marginBottom: eingebettet ? 18 : 0 }}>
        <Zahl wert={z(kunden.filter(k => k.status === 'aktiv').length)} label="Aktive Mandate" farbe={LEUCHT.gut} />
        <Zahl wert={mrr ? eur(mrr) : undefined} label="Cashflow / Monat" farbe={LEUCHT.geld} />
        <Zahl wert={z(kunden.filter(k => k.status === 'gespraech').length)} label="Im Gespräch" farbe={LEUCHT.achtung} />
      </div>
    </>
  );

  // ── Neu + Liste ──
  const liste = (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input value={neu} onChange={e => setNeu(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addKunde(); }}
          placeholder="Kunde/Mandat hinzufügen …" aria-label="Neuer Kunde"
          style={{ ...feld, flex: 1, minWidth: 180, width: 'auto' }} />
        <Knopf onClick={addKunde} farbe={LEUCHT.business}>+ Kunde</Knopf>
      </div>
      <Liste>
        {!kunden.length && <Leer>Noch kein Mandat — oben eintragen.</Leer>}
        {kunden.map(k => {
          const st = STATUS.find(s => s.id === k.status)!;
          const auf = offen === k.id;
          return (
            <div key={k.id}>
              <Zeile onClick={() => setOffen(auf ? null : k.id)} aktiv={auf}
                links={<Punkt farbe={st.farbe} />}
                titel={k.name}
                unter={[k.cashflow ? `${eur(k.cashflow)}/Monat` : '', k.naechsterSchritt ?? k.mandat ?? ''].filter(Boolean).join(' · ')}
                rechts={<span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Chip farbe={st.farbe}>{st.label}</Chip><span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{auf ? '▾' : '▸'}</span></span>}
              />
              {auf && (
                <div style={{ padding: '8px 2px 18px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {STATUS.map(s => (
                      <Wahl key={s.id} an={k.status === s.id} farbe={s.farbe} onClick={() => patch(k.id, { status: s.id })}>{s.label}</Wahl>
                    ))}
                    <input value={k.cashflow ?? ''} onChange={e => patch(k.id, { cashflow: Number(e.target.value.replace(/[^\d]/g, '')) || undefined })}
                      placeholder="€/Monat" inputMode="numeric" aria-label="Cashflow je Monat"
                      style={{ ...feld, width: 110, padding: '6px 10px', fontSize: TYP.bedien, fontVariantNumeric: 'tabular-nums' }} />
                    <span style={{ marginLeft: 'auto' }}><Knopf leise onClick={() => persist(kunden.filter(x => x.id !== k.id))}>Löschen</Knopf></span>
                  </div>
                  <input value={k.mandat ?? ''} onChange={e => patch(k.id, { mandat: e.target.value })}
                    placeholder="Mandat / Leistung …" aria-label="Mandat" style={feld} />
                  <input value={k.naechsterSchritt ?? ''} onChange={e => patch(k.id, { naechsterSchritt: e.target.value })}
                    placeholder="Nächster Schritt …" aria-label="Nächster Schritt" style={feld} />
                  <textarea value={k.notizen ?? ''} onChange={e => patch(k.id, { notizen: e.target.value })}
                    placeholder="Notizen — Gesprächsstände, Vereinbarungen, Kontext …" rows={3} aria-label="Notizen"
                    style={{ ...feld, resize: 'vertical', lineHeight: 1.5 }} />

                  {/* Rechnungen dieses Kunden — dieselbe Wahrheit wie in der Finanzplanung */}
                  {(() => {
                    const re = rechnungenVon(k.name);
                    const offenSum = re.filter(r => r.status !== 'bezahlt').reduce((s, r) => s + r.betrag, 0);
                    return (
                      <div>
                        <div style={{ ...mikro, marginBottom: 6 }}>Rechnungen <span style={{ textTransform: 'none', letterSpacing: 0 }}>{re.length ? `· ${eur(offenSum)} offen` : ''}</span> <Link href="/os/finanzen" style={verweis}>Finanzplanung ›</Link></div>
                        {re.length
                          ? re.map(r => (
                            <div key={r.id} style={{ display: 'flex', gap: 9, alignItems: 'center', fontSize: TYP.bedien, padding: '3px 0', flexWrap: 'wrap' }}>
                              <Chip farbe={RSTATUS_FARBE[r.status]}>{r.status}</Chip>
                              <span style={{ color: C.inkDim }}>{r.titel || 'Leistung'}</span>
                              <span style={{ fontWeight: 700, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{r.betrag ? eur(r.betrag) : '— €'}</span>
                              {r.faellig && <span style={{ fontSize: 12, color: C.inkLeise }}>fällig {r.faellig.slice(8)}.{r.faellig.slice(5, 7)}.</span>}
                            </div>
                          ))
                          : <span style={{ fontSize: 12, color: C.inkLeise }}>Noch keine Rechnung — unten ein Produkt anbieten oder in der Finanzplanung anlegen.</span>}
                      </div>
                    );
                  })()}

                  {/* Produkte anbieten → legt eine geplante Rechnung an */}
                  {fplan && fplan.produkte.length > 0 && (
                    <div>
                      <div style={{ ...mikro, marginBottom: 6 }}>Produkt anbieten <span style={{ textTransform: 'none', letterSpacing: 0 }}>(legt geplante Rechnung an)</span></div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {fplan.produkte.map(p => (
                          <Wahl key={p.id} an={p.status === 'aktiv'} farbe={LEUCHT.geld} title={p.beschreibung} onClick={() => rechnungAnlegen(k.name, p.name, p.preis)}>
                            + {p.name}{p.preis ? ` · ${eur(p.preis)}` : ''}{p.status !== 'aktiv' ? ' (Entwurf)' : ''}
                          </Wahl>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Offene Aufgaben zu diesem Kunden */}
                  {(() => {
                    const at = aufgabenVon(k.name);
                    if (!at.length) return null;
                    return (
                      <div>
                        <div style={{ ...mikro, marginBottom: 6 }}>Offene Aufgaben <Link href="/os/aufgaben" style={verweis}>Taskmanagement ›</Link></div>
                        {at.slice(0, 5).map(t => (
                          <div key={t.id} style={{ fontSize: TYP.bedien, color: C.inkDim, padding: '2px 0' }}>
                            {t.priority === 'critical' ? '‼ ' : '· '}{t.title}{t.dueDate ? <span style={{ fontSize: 12, color: C.inkLeise }}> · {t.dueDate.slice(8)}.{t.dueDate.slice(5, 7)}.</span> : null}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </Liste>
    </>
  );

  if (eingebettet) return <>{kopf}{liste}</>;

  return (
    <Seite
      titel="Deine Mandate."
      unter={<>Wer zahlt, wer im Gespräch ist, was als Nächstes passiert — du und Malin arbeitet über dieselbe Liste. <span style={{ color: C.inkLeise }}>(HubSpot-Anbindung steht im Bauplan; bis dahin ist das hier die Wahrheit.)</span></>}
    >
      <Karte i={0} akzent={LEUCHT.business}>{kopf}</Karte>
      <Karte i={1}>{liste}</Karte>
    </Seite>
  );
}
