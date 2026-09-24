'use client';

// Buchungen — Malins Aufbau: vorbelegt auf den jüngsten Monat mit Daten (die
// Frage ist immer „was war in diesem Monat“), darüber „Wofür geht das Geld?“
// mit aufklappbaren Empfängern, darunter jede Buchung einzeln zuordenbar,
// änderbar und löschbar. Zuordnen lernt eine Regel — auf Wunsch rückwirkend.

import { useMemo, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import type { Buchung, Turnus } from '@/lib/finanzen/haushalt/typen';
import { eur, zuCent } from '@/lib/finanzen/haushalt/typen';
import { summen, type KatName } from '@/lib/finanzen/haushalt/einordnung';
import { aufschluesselung, monateMitDaten, letzterMonatMitDaten } from '@/lib/finanzen/haushalt/kennzahlen';
import { monatVon, monatName, datumDe } from '@/lib/finanzen/haushalt/monat';
import { normal } from '@/lib/finanzen/haushalt/regeln';
import { Karte, Ueberschrift, Leer, Knopf, Chip, feld, LEUCHT } from '../schlank';
import { Betrag, Dialog, Feld, Haken, Hinweis, KategorieOptionen, Leiste, auswahl, type HaushaltDaten, type Op } from './gemeinsam';

interface Props {
  h: HaushaltDaten; katName: KatName;
  patch: (teil: string, ops: Op[]) => Promise<boolean>;
  aktion: <T = Record<string, unknown>>(b: Record<string, unknown>) => Promise<(T & { ok: boolean; fehler?: string }) | null>;
  melde: (art: 'ok' | 'fehler' | 'info', titel: string, text?: string) => void;
  laden: () => Promise<void>;
  onImport: () => void;
}

const SEITE = 200;

export function Buchungen({ h, katName, patch, aktion, melde, laden, onImport }: Props) {
  const monate = useMemo(() => monateMitDaten(h.buchungen), [h.buchungen]);
  const [f, setF] = useState({ konto: '', monat: letzterMonatMitDaten(h.buchungen), kategorie: '', suche: '' });
  const [offeneBereiche, setOffen] = useState<Record<string, boolean>>({});
  const [zeigen, setZeigen] = useState(SEITE);
  const [merken, setMerken] = useState<{ b: Buchung; katId: string } | null>(null);
  const [bearb, setBearb] = useState<Buchung | 'neu' | null>(null);
  const [loesch, setLoesch] = useState<Buchung | null>(null);

  const liste = useMemo(() => {
    const s = normal(f.suche);
    return h.buchungen.filter(b => {
      if (f.konto && b.konto_id !== f.konto) return false;
      if (f.monat && monatVon(b.datum) !== f.monat) return false;
      if (f.kategorie === '__offen') { if (b.kategorie_id) return false; }
      else if (f.kategorie && b.kategorie_id !== f.kategorie) return false;
      if (s && !normal(b.beschreibung).includes(s) && !normal(b.empfaenger).includes(s)) return false;
      return true;
    }).sort((a, b) => b.datum.localeCompare(a.datum) || a.betrag - b.betrag);
  }, [h.buchungen, f]);
  const sum = useMemo(() => summen(liste, katName), [liste, katName]);
  const auf = useMemo(() => aufschluesselung(liste, katName), [liste, katName]);
  const offen = liste.filter(b => !b.kategorie_id && !b.ist_umbuchung).length;
  const konto = (id: string) => h.stamm.konten.find(k => k.id === id)?.name.replace(/^Privatkonto /, '') ?? '–';

  async function zuordnen(b: Buchung, katId: string) {
    const ok = await patch('buchungen', [{ op: 'upsert', stand: b.stand, eintrag: { ...b, kategorie_id: katId || null } }]);
    if (ok && katId && (b.empfaenger || b.beschreibung)) setMerken({ b, katId });
  }

  const max = auf.bereiche[0]?.summe || 1;
  return (
    <>
      <Karte i={1}>
        <Ueberschrift farbe={LEUCHT.geld} rechts={<Knopf leise onClick={() => setBearb('neu')}>+ Buchung von Hand</Knopf>}>Buchungen</Ueberschrift>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          <select aria-label="Konto" value={f.konto} onChange={e => { setF({ ...f, konto: e.target.value }); setZeigen(SEITE); }} style={auswahl}>
            <option value="">Alle Konten</option>{h.stamm.konten.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
          <select aria-label="Monat" value={f.monat} onChange={e => { setF({ ...f, monat: e.target.value }); setZeigen(SEITE); }} style={auswahl}>
            <option value="">Alle Monate</option>{monate.map(m => <option key={m} value={m}>{monatName(m)}</option>)}
          </select>
          <select aria-label="Kategorie" value={f.kategorie} onChange={e => { setF({ ...f, kategorie: e.target.value }); setZeigen(SEITE); }} style={auswahl}>
            <option value="">Alle Kategorien</option><option value="__offen">— nicht zugeordnet —</option><KategorieOptionen kategorien={h.stamm.kategorien} />
          </select>
          <input aria-label="Suche" placeholder="Empfänger oder Text" value={f.suche} onChange={e => setF({ ...f, suche: e.target.value })} style={{ ...feld, padding: '9px 12px', fontSize: TYP.bedien }} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 12, fontSize: TYP.bedien, color: C.inkDim, fontVariantNumeric: 'tabular-nums' }}>
          <span>{liste.length} Buchungen</span>
          <span style={{ color: LEUCHT.gut }}>Einkommen {eur(sum.ein)}</span>
          <span style={{ color: LEUCHT.achtung }}>Ausgaben {eur(sum.aus)}</span>
          <span>Saldo {eur(sum.saldo)}</span>
          {sum.geliehen > 0 && <span>geliehen {eur(sum.geliehen)}</span>}
          {sum.durchlauf > 0 && <span>durchlaufend {eur(sum.durchlauf)}</span>}
          {offen > 0 && <span style={{ color: LEUCHT.achtung }}>{offen} nicht zugeordnet</span>}
        </div>
      </Karte>

      {auf.anzahl > 0 && (
        <Karte i={2}>
          <Ueberschrift farbe={LEUCHT.achtung} rechts={f.monat ? monatName(f.monat) : 'alle Monate'}>Wofür geht das Geld?</Ueberschrift>
          <div style={{ fontSize: 13, color: C.inkDim, marginBottom: 10 }}>{auf.anzahl} Ausgaben, zusammen <strong style={{ color: C.ink }}>{eur(auf.gesamt)}</strong>. Bereich antippen für die Empfänger. Umbuchungen zwischen euren Konten sind nicht enthalten.</div>
          <div style={{ display: 'grid', gap: 4 }}>
            {auf.bereiche.map(g => {
              const auf_ = !!offeneBereiche[g.id];
              const farbe = g.id === '__offen' ? LEUCHT.achtung : LEUCHT.geld;
              return (
                <div key={g.id}>
                  <button onClick={() => setOffen(o => ({ ...o, [g.id]: !o[g.id] }))} aria-expanded={auf_} className="zeile-klick" style={{ display: 'grid', gridTemplateColumns: '14px 1fr auto 56px', gap: 10, alignItems: 'center', width: '100%', border: 'none', background: 'transparent', color: C.ink, font: 'inherit', cursor: 'pointer', padding: '8px 4px', textAlign: 'left' }}>
                    <span style={{ color: C.inkLeise }}>{auf_ ? '▾' : '▸'}</span>
                    <span style={{ minWidth: 0 }}><strong style={{ fontSize: TYP.body }}>{g.name}</strong> <span style={{ color: C.inkLeise, fontSize: 12 }}>({g.anzahl})</span><Leiste anteil={g.summe / max * 100} farbe={farbe} /></span>
                    <Betrag cent={g.summe} farbe={C.ink} />
                    <span style={{ fontSize: 12.5, color: C.inkDim, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{g.anteil.toFixed(1).replace('.', ',')} %</span>
                  </button>
                  {auf_ && g.haendler.map(x => (
                    <div key={x.name} style={{ display: 'grid', gridTemplateColumns: '14px 1fr auto 56px', gap: 10, padding: '4px 4px 4px 4px', fontSize: 13, color: C.inkDim }}>
                      <span />
                      <span style={{ paddingLeft: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>• {x.name}{x.anzahl > 1 ? ` (${x.anzahl}×)` : ''}</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{eur(x.summe)}</span>
                      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: C.inkLeise }}>{x.anteilImBereich.toFixed(0)} %</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          <Hinweis>Die Prozente der Empfänger beziehen sich auf ihren Bereich, nicht auf alle Ausgaben.</Hinweis>
        </Karte>
      )}

      <Karte i={3}>
        <Ueberschrift rechts={liste.length > zeigen ? `${zeigen} von ${liste.length}` : undefined}>Einzelne Buchungen</Ueberschrift>
        {!liste.length && <Leer>{h.buchungen.length ? 'Keine Buchungen für diesen Filter.' : <>Noch keine Buchungen. <button onClick={onImport} style={{ background: 'none', border: 'none', color: LEUCHT.geld, cursor: 'pointer', font: 'inherit', padding: 0 }}>Kontoauszug einlesen</button></>}</Leer>}
        <div style={{ display: 'grid' }}>
          {liste.slice(0, zeigen).map(b => (
            <div key={b.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '6px 14px', padding: '10px 2px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: TYP.body, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.empfaenger || '–'}</div>
                <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.beschreibung}>{datumDe(b.datum)} · {konto(b.konto_id)}{b.beschreibung && b.beschreibung !== b.empfaenger ? ` · ${b.beschreibung.slice(0, 90)}` : ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}><Betrag cent={b.betrag} vorzeichen /></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
                <select aria-label="Kategorie" value={b.kategorie_id ?? ''} onChange={e => void zuordnen(b, e.target.value)} style={{ ...auswahl, padding: '5px 8px', fontSize: 12.5, maxWidth: 230, color: b.kategorie_id ? C.ink : LEUCHT.achtung }}>
                  <option value="">— offen —</option><KategorieOptionen kategorien={h.stamm.kategorien} />
                </select>
                {b.ist_umbuchung && <Chip farbe={C.inkDim}>Umbuchung</Chip>}
                {b.ist_fixkosten && <Chip farbe={LEUCHT.schlaf}>Fixkosten{b.turnus !== 'monatlich' ? ` · ${b.turnus === 'quartal' ? 'Quartal' : 'Jahr'}` : ''}</Chip>}
                {b.notiz && <span style={{ fontSize: 12, color: C.inkLeise }} title={b.notiz}>✎</span>}
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button onClick={() => setBearb(b)} style={klein}>Bearbeiten</button>
                <button onClick={() => setLoesch(b)} style={{ ...klein, color: LEUCHT.kritisch }}>Löschen</button>
              </div>
            </div>
          ))}
        </div>
        {liste.length > zeigen && <div style={{ marginTop: 12 }}><Knopf leise onClick={() => setZeigen(z => z + SEITE)}>Weitere {Math.min(SEITE, liste.length - zeigen)} zeigen</Knopf></div>}
      </Karte>

      {merken && <MerkenDialog b={merken.b} katId={merken.katId} katName={katName} aktion={aktion} melde={melde} laden={laden} onZu={() => setMerken(null)} />}
      {bearb && <BearbeitenDialog b={bearb === 'neu' ? null : bearb} h={h} patch={patch} melde={melde} onZu={() => setBearb(null)} />}
      {loesch && (
        <Dialog titel="Buchung löschen?" onZu={() => setLoesch(null)} aktionen={<Knopf farbe={LEUCHT.kritisch} onClick={async () => { const ok = await patch('buchungen', [{ op: 'delete', id: loesch.id, stand: loesch.stand }]); if (ok) melde('ok', 'Gelöscht', 'Die Buchung ist weg und kommt nicht zurück.'); setLoesch(null); }}>Ja, löschen</Knopf>}>
          <div>Buchung vom <strong>{datumDe(loesch.datum)}</strong> über <strong>{eur(loesch.betrag)}</strong> ({loesch.empfaenger || '–'}) wirklich löschen? Das lässt sich nicht rückgängig machen — ein erneuter Import desselben Auszugs würde sie allerdings wieder anlegen.</div>
        </Dialog>
      )}
    </>
  );
}

const klein = { background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: 12.5, padding: '4px 6px', fontFamily: SCHRIFT.text } as const;

function MerkenDialog({ b, katId, katName, aktion, melde, laden, onZu }: { b: Buchung; katId: string; katName: KatName; aktion: Props['aktion']; melde: Props['melde']; laden: () => Promise<void>; onZu: () => void }) {
  const muster = b.empfaenger || b.beschreibung;
  const [wort, setWort] = useState(true);
  const [umb, setUmb] = useState(b.ist_umbuchung);
  const [fix, setFix] = useState(b.ist_fixkosten);
  const [turnus, setTurnus] = useState<Turnus>(b.turnus);
  const [alt, setAlt] = useState(true);
  const [treffer, setTreffer] = useState<number | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const eingabe = { aktion: 'regel', muster, kategorie_id: katId, ist_umbuchung: umb, ganzes_wort: wort, ist_fixkosten: fix, turnus, rueckwirkend: alt, buchungId: b.id };
  async function vorschau() { const d = await aktion<{ rueckwirkend: number }>({ ...eingabe, vorschau: true }); if (d?.ok) setTreffer(d.rueckwirkend); }
  return (
    <Dialog titel="Zuordnung merken?" onZu={onZu} aktionen={<Knopf farbe={LEUCHT.geld} aus={laeuft} onClick={async () => {
      setLaeuft(true);
      const d = await aktion<{ geaendert: number }>({ ...eingabe, vorschau: false });
      setLaeuft(false);
      if (d?.ok) { melde('ok', 'Gemerkt', d.geaendert > 1 ? `${d.geaendert - 1} weitere vorhandene Buchung${d.geaendert === 2 ? '' : 'en'} gleich mit zugeordnet.` : 'Diese Zuordnung wird nicht mehr gefragt.'); await laden(); onZu(); }
    }}>Merken</Knopf>}>
      <div>Soll <strong>{muster}</strong> künftig automatisch auf <strong>{katName(katId)}</strong> laufen?</div>
      <Haken an={wort} onChange={setWort}>Nur als ganzes Wort suchen <span style={{ color: C.inkLeise }}>(empfohlen — verhindert Fehltreffer wie „mOBIlity“ auf „OBI“)</span></Haken>
      <Haken an={umb} onChange={setUmb}>Ist eine Umbuchung <span style={{ color: C.inkLeise }}>(zählt nicht als Ausgabe)</span></Haken>
      <Haken an={fix} onChange={setFix}>Ist ein Fixkostenposten <span style={{ color: C.inkLeise }}>(Miete, Abo, Versicherung)</span></Haken>
      {fix && <Feld label="Wie oft kommt die Zahlung?"><select value={turnus} onChange={e => setTurnus(e.target.value as Turnus)} style={auswahl}><option value="monatlich">monatlich</option><option value="quartal">quartalsweise</option><option value="jahr">jährlich</option></select></Feld>}
      <Haken an={alt} onChange={v => { setAlt(v); setTreffer(null); }}>Auch auf vorhandene Buchungen anwenden <span style={{ color: C.inkLeise }}>(sonst gilt die Regel erst ab dem nächsten Import)</span></Haken>
      {alt && (treffer === null ? <div><Knopf leise onClick={() => void vorschau()}>Wie viele wären das?</Knopf></div> : <div style={{ color: C.inkDim }}>{treffer ? `${treffer} weitere Buchung${treffer === 1 ? '' : 'en'} würden mit zugeordnet.` : 'Keine weiteren Buchungen betroffen.'}</div>)}
    </Dialog>
  );
}

/** Bearbeiten — oder, ohne Buchung, eine neue von Hand anlegen (Bargeld, fehlt im Auszug). */
function BearbeitenDialog({ b, h, patch, melde, onZu }: { b: Buchung | null; h: HaushaltDaten; patch: Props['patch']; melde: Props['melde']; onZu: () => void }) {
  const standardKonto = h.stamm.konten.find(k => k.aktiv)?.id ?? h.stamm.konten[0]?.id ?? '';
  const [e, setE] = useState(b
    ? { datum: b.datum, betrag: (b.betrag / 100).toFixed(2).replace('.', ','), empfaenger: b.empfaenger, beschreibung: b.beschreibung, konto_id: b.konto_id, kategorie_id: b.kategorie_id ?? '', ist_umbuchung: b.ist_umbuchung, ist_fixkosten: b.ist_fixkosten, notiz: b.notiz ?? '' }
    : { datum: new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' }), betrag: '', empfaenger: '', beschreibung: '', konto_id: standardKonto, kategorie_id: '', ist_umbuchung: false, ist_fixkosten: false, notiz: '' });
  if (!b && !h.stamm.konten.length) return <Dialog titel="Buchung von Hand" onZu={onZu}><Hinweis>Erst ein Konto anlegen (Konten & Kategorien) — jede Buchung gehört zu einem Konto.</Hinweis></Dialog>;
  return (
    <Dialog titel={b ? 'Buchung bearbeiten' : 'Buchung von Hand'} onZu={onZu} aktionen={<Knopf farbe={LEUCHT.geld} onClick={async () => {
      const betrag = zuCent(e.betrag);
      if (!e.datum || betrag === null || betrag === 0) { melde('fehler', 'Eingabe unvollständig', 'Datum und Betrag werden gebraucht (Ausgaben mit Minus).'); return; }
      const eintrag = b
        ? { ...b, ...e, betrag, kategorie_id: e.kategorie_id || null, notiz: e.notiz || null }
        : { ...e, betrag, kategorie_id: e.kategorie_id || null, notiz: e.notiz || null, einheit: 'privat', erfasst_von: h.person, beschreibung: e.beschreibung || e.empfaenger || 'Buchung von Hand' };
      const ok = await patch('buchungen', [b ? { op: 'upsert', stand: b.stand, eintrag } : { op: 'upsert', eintrag }]);
      if (ok) { melde('ok', b ? 'Gespeichert' : 'Buchung angelegt'); onZu(); }
    }}>{b ? 'Speichern' : 'Anlegen'}</Knopf>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Feld label="Datum"><input type="date" value={e.datum} onChange={x => setE({ ...e, datum: x.target.value })} style={feld} /></Feld>
        <Feld label="Betrag (negativ = Ausgabe)"><input inputMode="decimal" placeholder="z. B. -12,50" value={e.betrag} onChange={x => setE({ ...e, betrag: x.target.value })} style={feld} /></Feld>
      </div>
      <Feld label="Empfänger"><input value={e.empfaenger} onChange={x => setE({ ...e, empfaenger: x.target.value })} style={feld} /></Feld>
      <Feld label="Beschreibung"><textarea rows={2} value={e.beschreibung} onChange={x => setE({ ...e, beschreibung: x.target.value })} style={{ ...feld, resize: 'vertical' }} /></Feld>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Feld label="Konto"><select value={e.konto_id} onChange={x => setE({ ...e, konto_id: x.target.value })} style={auswahl}>{h.stamm.konten.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}</select></Feld>
        <Feld label="Kategorie"><select value={e.kategorie_id} onChange={x => setE({ ...e, kategorie_id: x.target.value })} style={auswahl}><option value="">— offen —</option><KategorieOptionen kategorien={h.stamm.kategorien} /></select></Feld>
      </div>
      <Haken an={e.ist_umbuchung} onChange={v => setE({ ...e, ist_umbuchung: v })}>Umbuchung — zählt nicht als echte Ausgabe</Haken>
      <Haken an={e.ist_fixkosten} onChange={v => setE({ ...e, ist_fixkosten: v })}>Fixkosten — kommt regelmäßig in gleicher Höhe</Haken>
      <Feld label="Notiz"><input value={e.notiz} onChange={x => setE({ ...e, notiz: x.target.value })} style={feld} /></Feld>
    </Dialog>
  );
}
