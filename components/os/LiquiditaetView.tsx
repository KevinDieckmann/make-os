'use client';

// ─── MAKE OS — Liquiditäts-Planung ──────────────────────────────────────────
// Die Frage: Wie viel Geld ist wann da? Gerechnet aus dem, was ist
// (Kontostände, Rechnungen, Zahlungen) und dem, was wir erwarten
// (Planposten: Miete, Gehälter, Mandate, Steuern).
// 24.09.: auf das lebendige Muster umgezogen (Karten, Leuchtfarben, Listen).

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { localDay } from '@/lib/zeit';
import { eur } from '@/lib/make-one/finance-data';
import { useSpeichern } from '@/hooks/useSpeichern';
import { useAbgleich } from '@/hooks/useAbgleich';
import { FINANZPLAN_LISTEN } from '@/lib/sync';
import {
  vorschau, KATEGORIEN, KATEGORIE, SZENARIO_LABEL,
  type Firma, type Rechnung, type Zahlung, type Merkposten, type Planposten, type Rhythmus, type Szenario, type Woche,
} from '@/lib/make-one/liquiditaet';
import { useZiel, useZuZiel, zielRahmen } from './ziel';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Knopf, Zahl, Fortschritt, Segmente, feld, LEUCHT } from './schlank';

interface Plan { firmen: Firma[]; rechnungen: Rechnung[]; zahlungen: Zahlung[]; merkposten: Merkposten[] }

const RHYTHMUS_LABEL: Record<Rhythmus, string> = {
  einmalig: 'einmalig', monatlich: 'jeden Monat', quartal: 'jedes Quartal', jaehrlich: 'jedes Jahr',
};
const WOCHEN = [{ id: '8', label: '8 Wo.' }, { id: '12', label: '12 Wo.' }, { id: '26', label: '26 Wo.' }, { id: '52', label: '52 Wo.' }, { id: '66', label: '15 Mon.' }];

const geld: CSSProperties = { fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 15, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', minWidth: 84, textAlign: 'right' };
const leise: CSSProperties = { fontSize: 12, color: C.inkLeise, whiteSpace: 'nowrap' };
const mikro: CSSProperties = { fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise };
const eingabe: CSSProperties = { ...feld, width: 'auto', padding: '8px 10px', fontSize: TYP.bedien, borderRadius: 8 };
const auswahl: CSSProperties = { background: 'rgba(255,255,255,.05)', border: 'none', borderRadius: 8, color: C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, padding: '7px 10px', colorScheme: 'dark', outline: 'none', cursor: 'pointer' };
const option: CSSProperties = { background: C.flaeche };
const datum = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}.`;

/** Stand am Ende der Woche in Zustandsfarbe. */
const standFarbe = (stand: number) => (stand < 0 ? LEUCHT.kritisch : stand < 2000 ? LEUCHT.achtung : LEUCHT.geld);

/** Verlauf als Balken — jede Woche in ihrer Zustandsfarbe, die letzte leuchtet. */
function Wochenbalken({ wochen, hoehe, jede }: { wochen: Woche[]; hoehe: number; jede: number }) {
  const maxAbs = Math.max(1, ...wochen.map(w => Math.abs(w.stand)));
  return (
    <>
      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: hoehe }}>
        {wochen.map((w, i) => {
          const farbe = standFarbe(w.stand);
          const letzte = i === wochen.length - 1;
          return (
            <div key={w.von} className="balken-auf" title={`${w.label} (${datum(w.von)}): ${eur(w.stand)}${w.bewegungen.length ? '\n' + w.bewegungen.map(b => `${datum(b.datum)} ${b.betrag > 0 ? '+' : ''}${b.betrag} € ${b.text}`).join('\n') : '\nkeine Bewegung'}`}
              style={{ ['--i' as string]: i, flex: 1, height: Math.max(3, Math.round((Math.abs(w.stand) / maxAbs) * hoehe)), borderRadius: 3, background: farbe, opacity: letzte ? 1 : w.bewegungen.length ? .8 : .35, boxShadow: letzte ? `0 0 10px ${farbe}33` : undefined }} />
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 3, marginTop: 4, fontSize: TYP.mikro, color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>
        {wochen.map((w, i) => <div key={w.von} style={{ flex: 1, textAlign: 'center', minWidth: 0, overflow: 'hidden' }}>{i % jede === 0 ? datum(w.von) : ''}</div>)}
      </div>
    </>
  );
}

function Feld({ label, children }: { label: ReactNode; children: ReactNode }) {
  return <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={mikro}>{label}</span>{children}</label>;
}

export function LiquiditaetView() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [posten, setPosten] = useState<Planposten[]>([]);
  // Eigene Kategorien aus dem Kompass — Kevin und Malin pflegen sie selbst.
  const [eigeneKat, setEigeneKat] = useState<string[]>([]);
  const [geladen, setGeladen] = useState(false);
  const [wochen, setWochen] = useState(12);
  const [szenario, setSzenario] = useState<Szenario>('real');
  const [nurFirma, setNurFirma] = useState<string>('alle');
  const [offen, setOffen] = useState<string | null>(null);
  // Aus einem Link (?p=<Posten>, z. B. hinter der Fixkostenquote): Posten öffnen und hinspringen; #kontostaende springt zu den Kontoständen.
  const zielPosten = useZiel('p');
  useEffect(() => { if (zielPosten) setOffen(zielPosten); }, [zielPosten]);
  useZuZiel(zielPosten, geladen && !!plan);
  const heute = localDay();

  // Zu zweit: nur Einzeländerungen; Malins Änderungen kommen per Abgleich herein.
  const speichernHook = useSpeichern('/api/state/liquiplan', { verzoegerung: 400, listen: ['posten'], uebernehmen: st => setPosten((st.posten as Planposten[]) ?? []) });
  const planSpeichern = useSpeichern('/api/state/finanzplan', { listen: FINANZPLAN_LISTEN, uebernehmen: st => setPlan(st as unknown as typeof plan) });
  const ladePlan = useCallback(() => fetch('/api/state/finanzplan').then(r => r.json()).then(d => {
    if (planSpeichern.hatOffenes()) return;
    setPlan(d); planSpeichern.kenne(d);
  }).catch(() => {}), [planSpeichern]);
  const ladePosten = useCallback(() => fetch('/api/state/liquiplan').then(r => r.json()).then(d => {
    if (speichernHook.hatOffenes()) return;
    const liste = Array.isArray(d.posten) ? d.posten : [];
    setPosten(liste); speichernHook.kenne({ posten: liste });
    setGeladen(true);
  }).catch(() => setGeladen(true)), [speichernHook]);
  useEffect(() => {
    void ladePlan();
    fetch('/api/state/labels').then(r => r.json()).then(d => setEigeneKat(Array.isArray(d.kategorien) ? d.kategorien : [])).catch(() => {});
    void ladePosten();
  }, [ladePlan, ladePosten]);
  useAbgleich(() => { void ladePlan(); void ladePosten(); }, { pausiert: () => speichernHook.hatOffenes() || planSpeichern.hatOffenes() });
  function setzePosten(next: Planposten[]) {
    setPosten(next);
    speichernHook.speichern({ posten: next });
  }
  const patch = (id: string, p: Partial<Planposten>) => setzePosten(posten.map(x => x.id === id ? { ...x, ...p } : x));

  function anlegen(vorzeichen: 1 | -1) {
    const p: Planposten = {
      id: `lp-${Date.now().toString(36)}`,
      titel: vorzeichen > 0 ? 'Neue Einnahme' : 'Neue Ausgabe',
      betrag: vorzeichen * 100,
      rhythmus: 'monatlich',
      ab: heute,
      sicher: vorzeichen < 0,
    };
    setzePosten([...posten, p]);
    setOffen(p.id);
  }

  function kontostand(firmaId: string, wert: string) {
    if (!plan) return;
    const zahl = wert.trim() === '' ? null : Math.round(Number(wert));
    if (zahl !== null && !Number.isFinite(zahl)) return;
    const next = { ...plan, firmen: plan.firmen.map(f => f.id === firmaId ? { ...f, kontostand: zahl } : f) };
    setPlan(next);
    planSpeichern.speichern(next);
  }

  const firmaFilter = nurFirma === 'alle' ? undefined : nurFirma;
  const v = useMemo(
    () => plan ? vorschau(plan.firmen, plan.rechnungen, plan.zahlungen, plan.merkposten, heute, wochen, false, posten, szenario, firmaFilter, true) : null,
    [plan, posten, heute, wochen, szenario, firmaFilter],
  );
  /** Dieselbe Rechnung in allen drei Szenarien — für den Vergleich. */
  const dreiFaelle = useMemo(() => {
    if (!plan) return null;
    const f = (sz: Szenario) => vorschau(plan.firmen, plan.rechnungen, plan.zahlungen, plan.merkposten, heute, wochen, false, posten, sz, firmaFilter, true);
    return { schlecht: f('schlecht'), real: f('real'), gut: f('gut') };
  }, [plan, posten, heute, wochen, firmaFilter]);
  /** Aufschlüsselung nach Kategorie über den ganzen Zeitraum. */
  const nachKategorie = useMemo(() => {
    if (!v) return [];
    const summen = new Map<string, number>();
    v.wochen.forEach(w => w.bewegungen.forEach(b => {
      const k = b.kategorie ?? (b.betrag > 0 ? 'sonstige-ein' : 'betrieb');
      summen.set(k, (summen.get(k) ?? 0) + b.betrag);
    }));
    return Array.from(summen.entries())
      .map(([id, betrag]) => ({ id, betrag, meta: KATEGORIE[id] }))
      .filter(x => x.meta && Math.abs(x.betrag) > 0)
      .sort((a, b) => Math.abs(b.betrag) - Math.abs(a.betrag));
  }, [v]);

  const ein = posten.filter(p => p.betrag > 0);
  const aus = posten.filter(p => p.betrag < 0);
  /** Was ein Posten im Monat ausmacht — für die Summe unten. */
  const proMonat = (p: Planposten) =>
    p.rhythmus === 'monatlich' ? p.betrag : p.rhythmus === 'quartal' ? p.betrag / 3 : p.rhythmus === 'jaehrlich' ? p.betrag / 12 : 0;
  const monatEin = Math.round(ein.reduce((s, p) => s + proMonat(p), 0));
  const monatAus = Math.round(Math.abs(aus.reduce((s, p) => s + proMonat(p), 0)));

  const zeile = (p: Planposten) => {
    const auf = offen === p.id;
    const raus = p.betrag < 0;
    return (
      <div key={p.id} id={`ziel-${p.id}`} style={zielRahmen(zielPosten === p.id, raus ? LEUCHT.achtung : LEUCHT.gut)}>
        <Zeile onClick={() => setOffen(auf ? null : p.id)} aktiv={auf} titel={p.titel} unter={RHYTHMUS_LABEL[p.rhythmus]}
          rechts={<>
            {!p.sicher && <Chip farbe={LEUCHT.achtung}>unsicher</Chip>}
            <span style={{ ...geld, color: raus ? LEUCHT.achtung : LEUCHT.gut }}>{raus ? '−' : '+'}{eur(Math.abs(p.betrag))}</span>
            <span style={{ ...leise, width: 12, textAlign: 'center' }}>{auf ? '▾' : '▸'}</span>
          </>} />
        {auf && (
          <div style={{ padding: '12px 2px 14px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
            <Feld label="Wofür">
              <input value={p.titel} onChange={e => patch(p.id, { titel: e.target.value })} aria-label="Bezeichnung" style={{ ...eingabe, width: 'min(100%, 220px)' }} />
            </Feld>
            <Feld label="Betrag">
              <input type="number" value={Math.abs(p.betrag)} onChange={e => patch(p.id, { betrag: (raus ? -1 : 1) * Math.abs(Math.round(Number(e.target.value) || 0)) })}
                aria-label="Betrag" style={{ ...eingabe, width: 110, fontFamily: SCHRIFT.display, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }} />
            </Feld>
            <Feld label="Wie oft">
              <select value={p.rhythmus} onChange={e => patch(p.id, { rhythmus: e.target.value as Rhythmus })} aria-label="Rhythmus" style={auswahl}>
                {(Object.keys(RHYTHMUS_LABEL) as Rhythmus[]).map(r => <option key={r} value={r} style={option}>{RHYTHMUS_LABEL[r]}</option>)}
              </select>
            </Feld>
            <Feld label="Ab">
              <input type="date" value={p.ab} onChange={e => patch(p.id, { ab: e.target.value })} aria-label="Ab wann" style={{ ...eingabe, colorScheme: 'dark' }} />
            </Feld>
            <Feld label="Bis (optional)">
              <input type="date" value={p.bis ?? ''} onChange={e => patch(p.id, { bis: e.target.value || undefined })} aria-label="Bis wann" style={{ ...eingabe, colorScheme: 'dark', color: p.bis ? C.ink : C.inkLeise }} />
            </Feld>
            <Feld label="Wofür (Art)">
              <select value={p.kategorie ?? ''} onChange={e => patch(p.id, { kategorie: e.target.value || undefined })} aria-label="Kategorie" style={{ ...auswahl, maxWidth: 190 }}>
                <option value="" style={option}>— nicht zugeordnet</option>
                {KATEGORIEN.filter(k => k.art === (raus ? 'aus' : 'ein')).map(k => (
                  <option key={k.id} value={k.id} style={option}>{k.label}</option>
                ))}
                {/* Eure eigenen Kategorien aus dem Kompass — ohne Code-Änderung. */}
                {eigeneKat.map(k => (
                  <option key={k} value={k} style={option}>{k}</option>
                ))}
              </select>
            </Feld>
            {plan && plan.firmen.length > 1 && (
              <Feld label="Wessen Konto">
                <select value={p.firmaId ?? ''} onChange={e => patch(p.id, { firmaId: e.target.value || undefined })} aria-label="Firma" style={{ ...auswahl, maxWidth: 170 }}>
                  <option value="" style={option}>— alle</option>
                  {plan.firmen.map(f => <option key={f.id} value={f.id} style={option}>{f.name}</option>)}
                </select>
              </Feld>
            )}
            <Knopf farbe={p.sicher ? LEUCHT.gut : LEUCHT.achtung} onClick={() => patch(p.id, { sicher: !p.sicher })}>{p.sicher ? 'sicher' : 'unsicher'}</Knopf>
            {!p.sicher && !raus && (
              <Feld label={<>Wie sicher · {p.wahrscheinlich ?? 50}%</>}>
                <input type="range" min={0} max={100} step={10} value={p.wahrscheinlich ?? 50}
                  onChange={e => patch(p.id, { wahrscheinlich: Number(e.target.value) })}
                  aria-label="Wahrscheinlichkeit"
                  title="Ab 60% zählt der Posten im realistischen Fall mit, ab 100% auch im schlechten"
                  style={{ width: 140, accentColor: LEUCHT.geld, cursor: 'pointer' }} />
              </Feld>
            )}
            <Knopf leise onClick={() => { setzePosten(posten.filter(x => x.id !== p.id)); setOffen(null); }}>Löschen</Knopf>
          </div>
        )}
      </div>
    );
  };

  const ende = v?.wochen.at(-1)?.stand;

  return (
    <Seite titel="Liquidität" unter="Wie viel Geld ist wann da — gerechnet aus Kontoständen, offenen Rechnungen, fälligen Zahlungen und dem, was ihr erwartet. Was hier eingetragen ist, rechnet sofort mit."
      rechts={<Segmente liste={WOCHEN} aktiv={String(wochen)} onWahl={id => setWochen(Number(id))} />}>
      {!v && <Karte i={0}><Leer>lädt …</Leer></Karte>}

      {v && (
        <>
          {/* Der Verlauf */}
          <Karte i={0} akzent={v.engpass ? LEUCHT.kritisch : LEUCHT.geld}>
            <Ueberschrift farbe={v.engpass ? LEUCHT.kritisch : LEUCHT.geld}
              rechts={plan && plan.firmen.length > 1 ? (
                <Segmente liste={['alle', ...plan.firmen.map(f => f.id)].map(fid => ({ id: fid, label: fid === 'alle' ? 'Alle Konten' : plan.firmen.find(f => f.id === fid)?.name.split(' ')[0] ?? fid }))}
                  aktiv={nurFirma} onWahl={setNurFirma} />
              ) : undefined}>
              Verlauf · {wochen} Wochen
            </Ueberschrift>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, alignItems: 'end', margin: '4px 0 16px' }}>
              <Zahl gross wert={eur(v.start)} farbe={v.start < 0 ? LEUCHT.kritisch : LEUCHT.geld} label="heute auf den Konten" />
              <Zahl wert={eur(v.tiefpunkt.stand)} farbe={standFarbe(v.tiefpunkt.stand)} label={`Tiefpunkt · ${v.tiefpunkt.label}`} />
              <Zahl wert={ende != null ? eur(ende) : undefined} farbe={(ende ?? 0) < 0 ? LEUCHT.kritisch : C.ink} label={`am Ende · in ${wochen} Wochen`} />
            </div>

            {/* Ebene 2: drei Szenarien nebeneinander */}
            {dreiFaelle && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 16 }}>
                {(['schlecht', 'real', 'gut'] as const).map(sz => {
                  const f = dreiFaelle[sz];
                  const an = szenario === sz;
                  const szEnde = f.wochen.at(-1)?.stand ?? 0;
                  const farbe = f.engpass ? LEUCHT.kritisch : szEnde < 2000 ? LEUCHT.achtung : LEUCHT.gut;
                  return (
                    <button key={sz} onClick={() => setSzenario(sz)} className="fassbar" style={{
                      textAlign: 'left', padding: '10px 12px', borderRadius: 12, cursor: 'pointer', border: 'none', fontFamily: SCHRIFT.text,
                      background: an ? `${farbe}14` : 'rgba(255,255,255,.04)', boxShadow: an ? `inset 0 0 0 1px ${farbe}66, 0 0 20px -8px ${farbe}40` : undefined,
                    }}>
                      <div style={mikro}>{SZENARIO_LABEL[sz]}</div>
                      <div style={{ fontFamily: SCHRIFT.display, fontSize: 19, fontWeight: 700, color: an ? farbe : C.inkDim, fontVariantNumeric: 'tabular-nums', marginTop: 4, letterSpacing: '-.02em' }}>{eur(szEnde)}</div>
                      <div style={{ fontSize: TYP.mikro, color: f.engpass ? LEUCHT.kritisch : C.inkLeise, marginTop: 2 }}>
                        {f.engpass ? `eng ab ${f.engpass.label}` : `Tief ${eur(f.tiefpunkt.stand)}`}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div style={{ fontSize: TYP.bedien, color: v.engpass ? LEUCHT.kritisch : C.inkDim, lineHeight: 1.55, marginBottom: 14 }}>
              {v.engpass
                ? <><b>Es wird eng {v.engpass.label}</b> — dann fehlen {eur(Math.abs(v.engpass.stand))}. Entweder kommt vorher Geld rein, oder Ausgaben müssen später.</>
                : v.tiefpunkt.stand < 2000
                  ? <>Es reicht, aber knapp — im Tief bleiben {eur(v.tiefpunkt.stand)}.</>
                  : <>Trägt über den ganzen Zeitraum, tiefster Punkt {eur(v.tiefpunkt.stand)}.</>}
              {!!v.unsicher && <> {eur(v.unsicher)} sind in diesem Fall nicht mitgerechnet.</>}
            </div>

            <Wochenbalken wochen={v.wochen} hoehe={110} jede={Math.ceil(wochen / 8)} />
          </Karte>

          {/* Ebene 3: wohin das Geld geht */}
          {!!nachKategorie.length && (
            <Karte i={1}>
              <Ueberschrift farbe={LEUCHT.achtung} rechts={`${wochen} Wochen`}>Wohin es geht</Ueberschrift>
              <div style={{ display: 'grid', gap: 9 }}>
                {(() => {
                  const max = Math.max(...nachKategorie.map(k => Math.abs(k.betrag)), 1);
                  return nachKategorie.map(k => (
                    <div key={k.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px,165px) 1fr 96px', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: TYP.bedien, color: C.inkDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.meta.label}</span>
                      <Fortschritt anteil={Math.abs(k.betrag) / max} farbe={k.meta.farbe} />
                      <span style={{ fontFamily: SCHRIFT.display, fontWeight: 600, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: k.betrag > 0 ? LEUCHT.gut : C.inkDim, textAlign: 'right' }}>
                        {k.betrag > 0 ? '+' : '−'}{eur(Math.abs(k.betrag))}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </Karte>
          )}

          {/* Kontostände */}
          {plan && (
            <Karte i={2} id="kontostaende">
              <Ueberschrift farbe={LEUCHT.geld} rechts="der Startpunkt">Kontostände</Ueberschrift>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {plan.firmen.map(f => (
                  <Feld key={f.id} label={f.name}>
                    <input type="number" value={f.kontostand ?? ''} onChange={e => kontostand(f.id, e.target.value)}
                      placeholder="—" aria-label={`Kontostand ${f.name}`} style={{ ...eingabe, width: 150, fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 17, fontVariantNumeric: 'tabular-nums' }} />
                  </Feld>
                ))}
              </div>
            </Karte>
          )}

          {/* Planposten */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            <Karte i={3}>
              <Ueberschrift farbe={LEUCHT.gut} rechts={<>{!!monatEin && <span>≈ {eur(monatEin)}/Monat</span>}<Knopf leise onClick={() => anlegen(1)}>+ Einnahme</Knopf></>}>Was reinkommt</Ueberschrift>
              <Liste>
                {ein.length ? ein.map(zeile) : <Leer>Noch nichts geplant. Mandate, wiederkehrende Honorare, Gehalt.</Leer>}
              </Liste>
            </Karte>

            <Karte i={4}>
              <Ueberschrift farbe={LEUCHT.achtung} rechts={<>{!!monatAus && <span>≈ {eur(monatAus)}/Monat</span>}<Knopf leise onClick={() => anlegen(-1)}>+ Ausgabe</Knopf></>}>Was rausgeht</Ueberschrift>
              <Liste>
                {aus.length ? aus.map(zeile) : <Leer>Noch nichts geplant. Miete, Versicherungen, Kreditraten, Steuern.</Leer>}
              </Liste>
            </Karte>
          </div>

          {geladen && !posten.length && (
            <Karte i={5}>
              <Leer>
                Solange hier nichts steht, rechnet die Vorschau nur mit dem, was schon im Finanzplan liegt —
                also mit den erkannten Fixkosten aus den Merkposten. Sobald ihr eigene Posten eintragt,
                zählen nur noch diese: eine Wahrheit statt zwei.
              </Leer>
            </Karte>
          )}

          <Karte i={6}>
            <Ueberschrift>Weiter</Ueberschrift>
            <Liste>
              {[
                { href: '/os/finanzen/planung', titel: 'Rechnungen & Zahlungen', satz: 'was reinkommt, was raus muss, in welcher Reihenfolge' },
                { href: '/os/controlling', titel: 'Controlling & Ziele', satz: 'Kurs aufs Jahresziel, Run-Rate, Runway' },
                { href: '/os/finanzen/dashboard', titel: 'Finanz-Dashboard', satz: 'Malins gewachsenes Werkzeug, unverändert' },
              ].map(b => (
                <Link key={b.href} href={b.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <Zeile onClick={() => {}} titel={b.titel} unter={b.satz} rechts={<span style={{ color: C.inkLeise }}>›</span>} />
                </Link>
              ))}
            </Liste>
          </Karte>
        </>
      )}
    </Seite>
  );
}
