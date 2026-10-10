'use client';

// ─── Produkte · Leistungstreppe — die Treppe, ihre Stufen und deren Schritte (10.10.) ──────────────────────────────
// Entscheidung 10.10.: die Pakete sauber abbilden und IMMER visualisieren — wohin wir wollen und warum die Schritte so wichtig sind.
// Rechner: die Stufen steigen von links nach rechts (gleiche Ebene = Alternativen übereinander in einer Spalte); Handy: eine Liste.
// Klick auf eine Stufe = Detail: Aufgabe und „warum vor der nächsten“, Ergebnis + Lieferobjekte, Kennzahl, Dauer/Aufwand/Preis, Regeln,
// verknüpfte Produkte — und deren Schritte (Phasen der Leistung) je mit Ziel & Warum · Ergebnis · Kennzahl · Dauer/Aufwand.
// Gerechnet wird nichts hier (lib/crm/treppe.ts); geschrieben wird über Einzel-Schritte mit Stand (daten.ts) bzw. die Phasen über das CRM (api.teil).

import { useMemo, useState, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP, TIEF } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Hinweis, Leerzustand, Liste, Zeile, Segmente, feld, LEUCHT, useHandy, useRueckfrage } from '../../ui';
import { ebenenVon, preisText } from '@/lib/crm/treppe';
import { TREPPE_GRENZEN, type PreisArt } from '@/lib/crm/treppe-daten';
import type { CrmApi } from '../../crm/daten';
import type { ProduktPhase } from '@/lib/crm/typen';
import { Feld } from '../../crm/teile';
import { Wahl, WahlMehrfach } from '../../crm/Wahl';
import { useTreppe, euro, type TreppeApi, type TreppeLage, type StufeMitStand } from './daten';
import { AusDokument, DokumentVorschau } from './AusDokument';
import { Kundenreise, Zielbild, Roadmap, PositionierungKarte } from './Teile';
import { farbeVonEbene } from './bausteine';

const klein = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 } as const;
const beschriftung = { fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: C.inkLeise };

/** Eine beschriftete Angabe im Detail. */
function Angabe({ label, children }: { label: string; children: ReactNode }) {
  return <div style={{ display: 'grid', gap: 4 }}><span style={beschriftung}>{label}</span><div style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{children}</div></div>;
}

type Reiter = 'reise' | 'zielbild' | 'roadmap' | 'positionierung';

/** Der ganze Bereich über dem Produktkatalog: Treppe (immer sichtbar), Dokument-Vorschläge, dann Kundenreise · Zielbild · Roadmap · Positionierung. */
export function TreppenBereich({ crmApi }: { crmApi: CrmApi }) {
  const api = useTreppe();
  const [reiter, setReiter] = useState<Reiter>('reise');
  const lage = api.lage;
  if (api.fehler && !lage) return <Hinweis art="kritisch">{api.fehler}</Hinweis>;
  if (!lage) return <Karte i={0}><span style={klein}>Leistungstreppe lädt …</span></Karte>;
  return (
    <>
      {api.hinweis && <Hinweis art="achtung" aktion={<Knopf leise onClick={() => api.setHinweis(null)}>Ok</Knopf>}>{api.hinweis}</Hinweis>}
      <Leistungstreppe api={api} lage={lage} crmApi={crmApi} />
      {lage.vorschlaege.map(v => <DokumentVorschau key={v.id} v={v} />)}
      <Segmente<Reiter> liste={[{ id: 'reise', label: 'Kundenreise' }, { id: 'zielbild', label: 'Zielbild' }, { id: 'roadmap', label: 'Roadmap' }, { id: 'positionierung', label: 'Positionierung & Story' }]} aktiv={reiter} onWahl={setReiter} />
      {reiter === 'reise' && <Kundenreise api={api} lage={lage} />}
      {reiter === 'zielbild' && <Zielbild api={api} lage={lage} />}
      {reiter === 'roadmap' && <Roadmap api={api} lage={lage} />}
      {reiter === 'positionierung' && <PositionierungKarte api={api} lage={lage} />}
    </>
  );
}

function Leistungstreppe({ api, lage, crmApi }: { api: TreppeApi; lage: TreppeLage; crmApi: CrmApi }) {
  const handy = useHandy();
  const { fragen, dialog } = useRueckfrage();
  const [auswahl, setAuswahl] = useState<string | null>(null);
  const [bearbeiten, setBearbeiten] = useState(false);
  const stufen = lage.datei.stufen;
  const ebenen = useMemo(() => ebenenVon(stufen), [stufen]);
  const kundenJe = useMemo(() => { const m = new Map<string, number>(); for (const k of lage.kunden) if (k.stufe) m.set(k.stufe.id, (m.get(k.stufe.id) ?? 0) + 1); return m; }, [lage.kunden]);
  const gewaehlt = stufen.find(s => s.id === auswahl) ?? null;
  const neu = async () => {
    const ebene = (ebenen[ebenen.length - 1]?.ebene ?? 0) + 1;
    if (await api.schreibe([{ op: 'stufe', eintrag: { name: `Stufe ${ebene}`, ebene, preis: { art: 'fest' } } }])) setBearbeiten(true);
  };
  const entfernen = (s: StufeMitStand) => fragen({
    titel: `Stufe „${s.name}“ entfernen?`,
    text: 'Verweise darauf (Kundenreise, Roadmap, Kunden) werden gelöst — die Mandate selbst bleiben unverändert.',
    wahl: [{ label: 'Entfernen', ton: 'gefahr', tun: () => { void api.schreibe([{ op: 'stufe-weg', id: s.id, stand: s.stand }]); setAuswahl(null); } }],
  });
  const kopf = (
    <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <AusDokument ki={lage.ki} />
      {stufen.length < TREPPE_GRENZEN.stufen && <Knopf onClick={neu}>+ Stufe</Knopf>}
    </span>
  );
  if (!stufen.length) return (
    <Karte i={0}>
      <Ueberschrift rechts={kopf}>Leistungstreppe</Ueberschrift>
      <Leerzustand symbol="↗" titel="Noch keine Leistungstreppe" aktion={<Knopf onClick={() => api.schreibe([{ op: 'vorlage' }])}>Leere Vorlage anlegen</Knopf>}>
        Bildet ab, wohin ihr mit euren Kunden wollt: vom ersten Kontakt über das Einstiegsangebot bis zum großen Paket — und warum jede Stufe vor der nächsten kommt.
        Ladet euer Positionierungs-Dokument hoch (der Head of Sales schlägt eine Treppe vor, ihr gebt frei) oder füllt die leere Vorlage aus.
      </Leerzustand>
      {dialog}
    </Karte>
  );
  const maxEbene = ebenen[ebenen.length - 1]?.ebene ?? 1;
  const stufeKarte = (s: StufeMitStand) => {
    const f = farbeVonEbene(s.ebene), an = s.id === auswahl, n = kundenJe.get(s.id) ?? 0;
    return (
      <button key={s.id} type="button" aria-pressed={an} onClick={() => { setAuswahl(an ? null : s.id); setBearbeiten(false); }} className="fassbar"
        style={{ textAlign: 'left', minHeight: 44, padding: '12px 14px', borderRadius: 14, cursor: 'pointer', fontFamily: SCHRIFT.text, color: C.ink,
          background: an ? `${f}2E` : TIEF.flaeche(f), border: `1px solid ${an ? f : TIEF.rand(f)}`, display: 'grid', gap: 4, width: '100%' }}>
        <span style={{ fontSize: TYP.body, fontWeight: 700 }}>{s.name}</span>
        <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{preisText(s.preis)}{s.dauerTage ? ` · ${s.dauerTage} Tage` : ''}</span>
        <span style={{ fontSize: TYP.bedien, color: n ? f : C.inkLeise }}>{n ? `${n} ${n === 1 ? 'Kunde' : 'Kunden'} jetzt` : 'noch kein Kunde'}{s.regeln.maxGleichzeitig ? ` · ${n}/${s.regeln.maxGleichzeitig} Plätze` : ''}</span>
      </button>
    );
  };
  return (
    <>
      <Karte i={0}>
        <Ueberschrift rechts={kopf}>Leistungstreppe</Ueberschrift>
        {handy ? (
          <Liste>
            {ebenen.flatMap(e => e.stufen.map(s => (
              <Zeile key={s.id} aktiv={s.id === auswahl} onClick={() => { setAuswahl(s.id === auswahl ? null : s.id); setBearbeiten(false); }} titel={s.name}
                unter={`${preisText(s.preis)}${s.dauerTage ? ` · ${s.dauerTage} Tage` : ''}${kundenJe.get(s.id) ? ` · ${kundenJe.get(s.id)} Kunden` : ''}`}
                links={<span aria-hidden style={{ width: 26, height: 26, borderRadius: 99, display: 'inline-grid', placeItems: 'center', fontSize: TYP.bedien, fontWeight: 700, color: farbeVonEbene(e.ebene), background: TIEF.flaeche(farbeVonEbene(e.ebene)) }}>{e.ebene}</span>} />
            )))}
          </Liste>
        ) : (
          <div role="group" aria-label="Die Leistungstreppe — von links (Einstieg) nach rechts (Ziel)" style={{ display: 'flex', alignItems: 'flex-end', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
            {ebenen.map((e, i) => (
              <div key={e.ebene} style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flex: '1 1 0', minWidth: 170 }}>
                <div style={{ display: 'grid', gap: 8, flex: 1, marginBottom: (e.ebene - 1) * 26 }}>
                  <span style={{ ...beschriftung, color: farbeVonEbene(e.ebene) }}>Stufe {e.ebene}{e.stufen.length > 1 ? ' · Alternativen' : ''}</span>
                  {e.stufen.map(stufeKarte)}
                  <span aria-hidden style={{ height: 6, borderRadius: 3, background: farbeVonEbene(e.ebene), opacity: 0.55 }} />
                </div>
                {i < ebenen.length - 1 && <span aria-hidden style={{ color: C.inkLeise, fontSize: TYP.titel, marginBottom: (e.ebene - 1) * 26 + 40 }}>›</span>}
              </div>
            ))}
          </div>
        )}
        <div style={{ ...klein, marginTop: 10 }}>
          {maxEbene > 1 ? 'Von links nach rechts: jede Stufe bereitet die nächste vor. ' : ''}Antippen zeigt Aufgabe, Ergebnis und Schritte der Stufe.
          {lage.kapa.jeStufe.some(x => x.ueber) ? ' Achtung: mindestens eine Stufe ist über ihrer Platzgrenze.' : ''}
        </div>
      </Karte>
      {gewaehlt && (bearbeiten
        ? <StufeEditor s={gewaehlt} lage={lage} api={api} onFertig={() => setBearbeiten(false)} />
        : <StufeDetail s={gewaehlt} lage={lage} crmApi={crmApi} onBearbeiten={() => setBearbeiten(true)} onEntfernen={() => entfernen(gewaehlt)} />)}
      {dialog}
    </>
  );
}

function StufeDetail({ s, lage, crmApi, onBearbeiten, onEntfernen }: { s: StufeMitStand; lage: TreppeLage; crmApi: CrmApi; onBearbeiten: () => void; onEntfernen: () => void }) {
  const f = farbeVonEbene(s.ebene);
  const leistungen = (crmApi.crm?.stand.leistungen ?? []).filter(l => s.leistungIds.includes(l.id));
  const kapa = lage.kapa.jeStufe.find(x => x.stufeId === s.id);
  const regeln = [
    s.regeln.mindestlaufzeitMonate ? `Mindestlaufzeit ${s.regeln.mindestlaufzeitMonate} Monate` : '', s.regeln.anrechnung ? `Anrechnung: ${s.regeln.anrechnung}` : '',
    s.regeln.bonus ? `Bonus: ${s.regeln.bonus}` : '', s.regeln.maxGleichzeitig ? `höchstens ${s.regeln.maxGleichzeitig} gleichzeitig` : '',
  ].filter(Boolean);
  const phaseSetzen = (lid: string, phasen: ProduktPhase[], id: string, teil: Partial<ProduktPhase>) =>
    void crmApi.teil('leistungen', lid, { phasen: phasen.map(p => (p.id === id ? { ...p, ...teil } : p)) });
  return (
    <Karte i={1} ton={f}>
      <Ueberschrift farbe={f} rechts={<span style={{ display: 'flex', gap: 8 }}><Knopf leise onClick={onBearbeiten}>Bearbeiten</Knopf><Knopf leise onClick={onEntfernen}>Entfernen</Knopf></span>}>Stufe {s.ebene} · {s.name}</Ueberschrift>
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))' }}>
        <Angabe label="Aufgabe — und warum vor der nächsten">{s.aufgabe || <span style={{ color: C.inkLeise }}>noch nicht beschrieben</span>}</Angabe>
        <Angabe label="Ergebnis">{s.ergebnis || <span style={{ color: C.inkLeise }}>noch nicht beschrieben</span>}</Angabe>
        <Angabe label="Kennzahl beim Kunden">{s.kennzahl || <span style={{ color: C.inkLeise }}>noch keine</span>}</Angabe>
        <Angabe label="Dauer · Aufwand · Preis">{[s.dauerTage ? `${s.dauerTage} Tage` : 'Dauer offen', s.aufwandStunden ? `${s.aufwandStunden} h${s.preis.art === 'monat' ? ' je Monat' : s.preis.art === 'jahr' ? ' je Jahr' : ''}` : 'Aufwand offen', preisText(s.preis)].join(' · ')}</Angabe>
      </div>
      {s.lieferobjekte.length > 0 && <div style={{ marginTop: 14 }}><span style={beschriftung}>Lieferobjekte</span><ul style={{ margin: '6px 0 0', paddingLeft: 18, display: 'grid', gap: 4 }}>{s.lieferobjekte.map(x => <li key={x} style={{ fontSize: TYP.body, color: C.ink }}>{x}</li>)}</ul></div>}
      {(regeln.length > 0 || kapa) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
          {regeln.map(r => <Chip key={r} farbe={C.inkDim}>{r}</Chip>)}
          {kapa && kapa.kunden > 0 && <Chip farbe={kapa.ueber ? LEUCHT.kritisch : kapa.voll ? LEUCHT.achtung : LEUCHT.gut}>{kapa.kunden} Kunden · {kapa.stundenWoche} h/Woche</Chip>}
        </div>
      )}
      <div style={{ marginTop: 18 }}>
        <span style={beschriftung}>Schritte</span>
        {!leistungen.length && <div style={{ ...klein, marginTop: 6 }}>Noch kein Produkt verknüpft — unter „Bearbeiten“ die Produkte dieser Stufe wählen; deren Ablauf in Phasen erscheint hier als Schritte.</div>}
        {leistungen.map(l => (
          <div key={l.id} style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            <div style={{ fontSize: TYP.body, fontWeight: 600 }}>{l.name}{!l.phasen?.length ? <span style={{ ...klein, fontWeight: 400 }}> — noch ohne Ablauf (unten im Produkt „+ Phase“)</span> : null}</div>
            {(l.phasen ?? []).map((p, i) => (
              <div key={p.id} style={{ display: 'grid', gap: 6, padding: '10px 12px', borderRadius: 12, background: TIEF.flaeche(f), border: `1px solid ${TIEF.rand(f)}` }}>
                <div style={{ fontSize: TYP.body, fontWeight: 600 }}>{i + 1}. {p.name}<span style={{ ...klein, fontWeight: 400 }}>{[p.dauerTage ? ` · ${p.dauerTage} Tage` : '', p.aufwandStunden ? ` · ${p.aufwandStunden} h` : ''].join('')}</span></div>
                <div style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))' }}>
                  <Feld wert={p.ziel ?? ''} platzhalter="Ziel & warum wichtig" onFertig={t => phaseSetzen(l.id, l.phasen ?? [], p.id, { ziel: t.trim() || undefined })} />
                  <Feld wert={p.ergebnis ?? ''} platzhalter="Ergebnis" onFertig={t => phaseSetzen(l.id, l.phasen ?? [], p.id, { ergebnis: t.trim() || undefined })} />
                  <Feld wert={p.kennzahl ?? ''} platzhalter="Kennzahl" onFertig={t => phaseSetzen(l.id, l.phasen ?? [], p.id, { kennzahl: t.trim() || undefined })} />
                  <Feld typ="number" wert={p.aufwandStunden ? String(p.aufwandStunden) : ''} platzhalter="Aufwand h" onFertig={t => phaseSetzen(l.id, l.phasen ?? [], p.id, { aufwandStunden: Number(t) || undefined })} />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Karte>
  );
}

const zahlOder = (t: string): number | null => { const n = Number(t.replace(/\./g, '').replace(',', '.')); return t.trim() === '' ? null : Number.isFinite(n) ? n : NaN; };

function StufeEditor({ s, lage, api, onFertig }: { s: StufeMitStand; lage: TreppeLage; api: TreppeApi; onFertig: () => void }) {
  const [e, setE] = useState({
    name: s.name, ebene: String(s.ebene), aufgabe: s.aufgabe ?? '', ergebnis: s.ergebnis ?? '', lieferobjekte: s.lieferobjekte.join('\n'), kennzahl: s.kennzahl ?? '',
    dauerTage: s.dauerTage ? String(s.dauerTage) : '', aufwandStunden: s.aufwandStunden ? String(s.aufwandStunden) : '', preisArt: s.preis.art, betrag: s.preis.betrag ? String(s.preis.betrag) : '',
    mindestlaufzeit: s.regeln.mindestlaufzeitMonate ? String(s.regeln.mindestlaufzeitMonate) : '', anrechnung: s.regeln.anrechnung ?? '', bonus: s.regeln.bonus ?? '',
    max: s.regeln.maxGleichzeitig ? String(s.regeln.maxGleichzeitig) : '', leistungIds: s.leistungIds, zielUmsatz: s.ziel?.umsatz ? String(s.ziel.umsatz) : '', zielKunden: s.ziel?.kunden ? String(s.ziel.kunden) : '',
  });
  const [fehler, setFehler] = useState<string | null>(null);
  const set = <K extends keyof typeof e>(k: K, v: (typeof e)[K]) => setE(x => ({ ...x, [k]: v }));
  const speichern = async () => {
    const z = (t: string, label: string): number | null => { const n = zahlOder(t); if (Number.isNaN(n)) throw new Error(`${label}: bitte eine Zahl.`); return n; };
    let eintrag: Record<string, unknown>;
    try {
      const opt = (k: string, n: number | null) => (n === null ? { [k]: null } : { [k]: n });
      eintrag = {
        id: s.id, name: e.name.trim(), ebene: z(e.ebene, 'Ebene') ?? 1, aufgabe: e.aufgabe.trim() || null, ergebnis: e.ergebnis.trim() || null,
        lieferobjekte: e.lieferobjekte.split('\n').map(x => x.trim()).filter(Boolean), kennzahl: e.kennzahl.trim() || null,
        ...opt('dauerTage', z(e.dauerTage, 'Dauer')), ...opt('aufwandStunden', z(e.aufwandStunden, 'Aufwand')),
        preis: { art: e.preisArt, betrag: e.preisArt === 'kostenlos' ? null : z(e.betrag, 'Preis') },
        regeln: { mindestlaufzeitMonate: z(e.mindestlaufzeit, 'Mindestlaufzeit'), anrechnung: e.anrechnung.trim() || null, bonus: e.bonus.trim() || null, maxGleichzeitig: z(e.max, 'Plätze') },
        leistungIds: e.leistungIds, ziel: { umsatz: z(e.zielUmsatz, 'Umsatzziel'), kunden: z(e.zielKunden, 'Kundenziel') },
      };
    } catch (x) { setFehler((x as Error).message); return; }
    setFehler(null);
    if (await api.schreibe([{ op: 'stufe', eintrag, stand: s.stand }])) onFertig();
  };
  const reihe = (label: string, kind: ReactNode) => <label style={{ display: 'grid', gap: 4, minWidth: 0 }}><span style={beschriftung}>{label}</span>{kind}</label>;
  const input = (k: keyof typeof e, platzhalter?: string, modus?: 'decimal') => <input value={String(e[k])} inputMode={modus} placeholder={platzhalter} onChange={x => set(k, x.target.value as never)} style={{ ...feld, fontSize: TYP.bedien }} />;
  return (
    <Karte i={1} ton={farbeVonEbene(s.ebene)}>
      <Ueberschrift rechts={<span style={{ display: 'flex', gap: 8 }}><Knopf leise onClick={onFertig}>Abbrechen</Knopf><Knopf onClick={speichern}>Speichern</Knopf></span>}>Stufe bearbeiten</Ueberschrift>
      {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))' }}>
        {reihe('Name', input('name', 'Name der Stufe'))}
        {reihe('Ebene (1 = Einstieg; gleich = Alternative)', input('ebene', '1', 'decimal'))}
        {reihe('Preisart', <Wahl<PreisArt> label="Preisart" liste={lage.auswahl.preisArten.map(p => ({ id: p.id, label: p.label }))} wert={e.preisArt} onWahl={v => set('preisArt', v)} />)}
        {e.preisArt !== 'kostenlos' && reihe('Preis netto (€)', input('betrag', 'z. B. 2.500', 'decimal'))}
        {reihe('Dauer (Tage)', input('dauerTage', 'z. B. 30', 'decimal'))}
        {reihe(`Aufwand (h${e.preisArt === 'monat' ? ' je Monat' : e.preisArt === 'jahr' ? ' je Jahr' : ''})`, input('aufwandStunden', 'z. B. 20', 'decimal'))}
        {reihe('Mindestlaufzeit (Monate)', input('mindestlaufzeit', '—', 'decimal'))}
        {reihe('Höchstens gleichzeitig', input('max', '—', 'decimal'))}
        {reihe('Anrechnung', input('anrechnung', 'z. B. auf die nächste Stufe'))}
        {reihe('Bonus', input('bonus', 'z. B. bei erreichten Zielen'))}
        {reihe(`Umsatzziel ${lage.datei.zielJahr} (€)`, input('zielUmsatz', '—', 'decimal'))}
        {reihe(`Kundenziel ${lage.datei.zielJahr}`, input('zielKunden', '—', 'decimal'))}
        {reihe('Kennzahl beim Kunden', input('kennzahl', 'Woran der Kunde den Fortschritt sieht'))}
        {reihe('Verknüpfte Produkte', <WahlMehrfach label="Produkte" liste={lage.leistungen.map(l => ({ id: l.id, label: l.name }))} wert={e.leistungIds} onWahl={v => set('leistungIds', v)} leer="kein Produkt" />)}
      </div>
      <div style={{ display: 'grid', gap: 12, marginTop: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))' }}>
        {reihe('Aufgabe — und warum vor der nächsten Stufe', <textarea value={e.aufgabe} rows={4} onChange={x => set('aufgabe', x.target.value)} style={{ ...feld, fontSize: TYP.bedien, fontFamily: SCHRIFT.text }} />)}
        {reihe('Ergebnis', <textarea value={e.ergebnis} rows={4} onChange={x => set('ergebnis', x.target.value)} style={{ ...feld, fontSize: TYP.bedien, fontFamily: SCHRIFT.text }} />)}
        {reihe('Lieferobjekte (eins je Zeile)', <textarea value={e.lieferobjekte} rows={4} onChange={x => set('lieferobjekte', x.target.value)} style={{ ...feld, fontSize: TYP.bedien, fontFamily: SCHRIFT.text }} />)}
      </div>
      <div style={{ ...klein, marginTop: 10 }}>Ein Umsatzziel von {euro(zahlOder(e.zielUmsatz) || 0)} im Zieljahr {lage.datei.zielJahr}; das Zieljahr stellt ihr unter „Zielbild“ ein.</div>
    </Karte>
  );
}
