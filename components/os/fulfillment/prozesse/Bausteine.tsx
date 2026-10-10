'use client';

// ─── Fulfillment › Bausteine — Bibliothek, Editor, Import (Paket C1, 10.10.; FULFILLMENT_KONZEPT.md 2.1, 2.7) ──────────────────────────
// Die Bibliothek: kleinste wiederverwendbare Einheiten (Dokument, Skript, Checkliste, Mail, Kennzahl, Ritual, Formular/Workbook …), die in
// beliebig vielen Paket-Vorlagen stecken. Filter nach Art, Paket und Marken; `?b=<id>` öffnet den Editor (lange Texte erst dann vom Server).
// Marken sichtbar am Baustein: „nur intern“, „vor Einsatz rechtlich prüfen“ (mit Vermerk „geprüft“), „vor Verkauf prüfen“ (Material Dritter).

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FARBE as C, TYP, MIKRO } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Leerzustand, Liste, Zeile, Chip, Pillen, Feldzeile, Schalter, LEUCHT, useRueckfrage } from '../../ui';
import { Wahl } from '../../crm/Wahl';
import { WEG } from '@/lib/wege';
import { suchPasst } from '@/lib/text/such-norm';
import { BAUSTEIN_ART_LABEL } from '@/lib/fulfillment/prozesse/bausteine';
import type { Baustein, BausteinArt, Frage } from '@/lib/fulfillment/typen';
import { useUebersicht, holeJson, vorlagenOps, fehlerText, tagLang, neueAnfrageId, EREIGNIS, type Uebersicht } from './daten';
import { BausteinMarken, Meldung, klein, feld, Leiste, useTextFrage } from './teile';
import { Import } from './Import';

type Filter = 'alle' | 'recht' | 'verkauf' | 'intern';
const ARTEN = Object.keys(BAUSTEIN_ART_LABEL) as BausteinArt[];

export function Bausteine({ b }: { b?: string }) {
  const router = useRouter();
  const { daten, fehler } = useUebersicht();
  if (!daten) return fehler ? <Hinweis art="kritisch">{fehler}</Hinweis> : <div style={klein}>Lädt …</div>;
  if (b) return <BausteinDetail id={b} daten={daten} onZurueck={() => router.push(WEG.fulfillment('bausteine'), { scroll: false })} />;
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Bibliothek daten={daten} onOeffnen={id => router.push(WEG.fulfillment('bausteine', { b: id }), { scroll: false })} />
      <Import daten={daten} />
    </div>
  );
}

function Bibliothek({ daten, onOeffnen }: { daten: Uebersicht; onOeffnen: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [art, setArt] = useState<BausteinArt | 'alle'>('alle');
  const [filter, setFilter] = useState<Filter>('alle');
  const [paket, setPaket] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const frage = useTextFrage();
  const pakete = Array.from(new Set(daten.bausteine.flatMap(x => x.tags.filter(t => t.startsWith('paket:')).map(t => t.slice(6))))).sort();
  const liste = daten.bausteine.filter(x => (art === 'alle' || x.art === art) && (!q || suchPasst([x.titel, x.zweck, ...x.tags], q))
    && (filter === 'alle' || (filter === 'recht' && x.rechtOffen) || (filter === 'verkauf' && x.vorVerkaufOffen) || (filter === 'intern' && x.nurIntern))
    && (!paket || x.tags.includes(`paket:${paket}`)));
  const neu = async () => {
    const titel = await frage.fragen('Titel des neuen Bausteins');
    if (!titel) return;
    const a = await vorlagenOps([{ op: 'baustein', eintrag: { art: art === 'alle' ? 'dokument' : art, titel } }]);
    if (a.ok && a.j.geaendert?.[0]) onOeffnen(a.j.geaendert[0]); else setMeldung(fehlerText(a));
  };
  return (
    <Karte i={1}>
      <Ueberschrift rechts={<Knopf leise onClick={neu}>+ Baustein</Knopf>}>Bibliothek</Ueberschrift>
      <Meldung text={meldung} art="kritisch" />
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Suchen (Titel, Zweck, Schlagwort)" aria-label="Bausteine suchen" style={feld} />
      <Pillen<BausteinArt | 'alle'> liste={[{ id: 'alle', label: 'Alle Arten' }, ...ARTEN.filter(a => daten.bausteine.some(x => x.art === a)).map(a => ({ id: a, label: BAUSTEIN_ART_LABEL[a] }))]} aktiv={art} onWahl={setArt} />
      <Pillen<Filter> liste={[{ id: 'alle', label: 'Alle' }, { id: 'recht', label: `rechtlich prüfen (${daten.bausteine.filter(x => x.rechtOffen).length})` }, { id: 'verkauf', label: `vor Verkauf prüfen (${daten.bausteine.filter(x => x.vorVerkaufOffen).length})` }, { id: 'intern', label: `nur intern (${daten.bausteine.filter(x => x.nurIntern).length})` }]} aktiv={filter} onWahl={setFilter} />
      {pakete.length > 0 && <Pillen<string> liste={[{ id: '', label: 'Alle Pakete' }, ...pakete.map(p => ({ id: p, label: p }))]} aktiv={paket ?? ''} onWahl={x => setPaket(x || null)} />}
      {!daten.bausteine.length ? (
        <Leerzustand symbol="▤" titel="Noch keine Bausteine">Bausteine kommen per Import (unten) oder „+ Baustein“ — das Gerüst „Aus Muster anlegen“ bringt das Playbook-Formular mit.</Leerzustand>
      ) : !liste.length ? <div style={klein}>Nichts passt zu diesem Filter.</div> : (
        <Liste>
          {liste.slice(0, 300).map(x => (
            <Zeile key={x.id} titel={x.titel} umbrechen onClick={() => onOeffnen(x.id)}
              unter={<span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>{BAUSTEIN_ART_LABEL[x.art]}{x.steckt ? ` · in ${x.steckt} Vorlage${x.steckt === 1 ? '' : 'n'}` : ''}<BausteinMarken b={x} /></span>} />
          ))}
        </Liste>
      )}
      {liste.length > 300 && <div style={klein}>{liste.length - 300} weitere — bitte filtern oder suchen.</div>}
      {frage.dialog}
    </Karte>
  );
}

interface Detail { baustein: Baustein & { stand: string }; steckt: { id: string; titel: string }[]; urheberGeprueft: { am: string; von: string } | null }

function BausteinDetail({ id, daten, onZurueck }: { id: string; daten: Uebersicht; onZurueck: () => void }) {
  const { bestaetigen, dialog } = useRueckfrage();
  const frage = useTextFrage();
  const [d, setD] = useState<Detail | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const kurz = daten.bausteine.find(x => x.id === id);
  useEffect(() => {
    let weg = false;
    const laden = () => { void holeJson<Detail>(`/api/fulfillment?baustein=${encodeURIComponent(id)}`).then(a => { if (!weg) { if (a.ok) { setD(a.j); setFehler(null); } else setFehler(fehlerText(a)); } }); };
    laden();
    window.addEventListener(EREIGNIS, laden);
    return () => { weg = true; window.removeEventListener(EREIGNIS, laden); };
  }, [id]);
  if (!d) return fehler ? <div style={{ display: 'grid', gap: 10 }}><div><Knopf leise onClick={onZurueck}>‹ Bibliothek</Knopf></div><Hinweis art="kritisch">{fehler}</Hinweis></div> : <div style={klein}>Lädt …</div>;
  const b = d.baustein;
  const setze = async (eintrag: Record<string, unknown>) => {
    const a = await vorlagenOps([{ op: 'baustein', eintrag: { id: b.id, ...eintrag }, stand: b.stand }]);
    setFehler(a.ok ? null : fehlerText(a));
  };
  const formular = b.art === 'formular' || b.art === 'workbook';
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div><Knopf leise onClick={onZurueck}>‹ Bibliothek</Knopf></div>
      {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
      <Karte i={1}>
        <Ueberschrift rechts={<span>Fassung {b.fassung}{b.vonHand ? ' · von Hand geändert' : ''}</span>}>{b.titel}</Ueberschrift>
        {kurz && <BausteinMarken b={kurz} />}
        {b.rechtPruefen && (
          <Hinweis art={b.rechtGeprueft ? 'gut' : 'achtung'} titel={b.rechtGeprueft ? `Rechtlich geprüft am ${tagLang(b.rechtGeprueft.am)}` : 'Vor Einsatz rechtlich prüfen'}
            aktion={!b.rechtGeprueft ? <Knopf leise onClick={async () => { const n = await frage.fragen('Notiz zur Prüfung (wer, was angepasst)'); if (n) { const a = await vorlagenOps([{ op: 'recht-geprueft', id: b.id, notiz: n }]); setFehler(a.ok ? null : fehlerText(a)); } }}>Als geprüft vermerken</Knopf> : undefined}>
            {b.rechtGeprueft ? b.rechtGeprueft.notiz : `${b.rechtPruefen.grund} Hinweis, keine Rechtsberatung.`}
          </Hinweis>
        )}
        {b.urheberPruefen && (
          <Hinweis art={d.urheberGeprueft ? 'gut' : 'achtung'} titel={d.urheberGeprueft ? `Vor Verkauf geprüft am ${tagLang(d.urheberGeprueft.am)}` : 'Material Dritter — vor Verkauf prüfen'}
            aktion={<Knopf leise onClick={async () => { const a = await vorlagenOps([{ op: 'urheber-geprueft', id: b.id, ...(d.urheberGeprueft ? { zuruecknehmen: true } : {}) }]); setFehler(a.ok ? null : fehlerText(a)); }}>{d.urheberGeprueft ? 'Vermerk zurücknehmen' : 'Als geprüft vermerken'}</Knopf>}>
            {b.urheberPruefen.grund} Intern frei nutzbar; an Kunden erst nach dem Vermerk (sonst Rückfrage beim Ausgeben).
          </Hinweis>
        )}
        <Feldzeile label="Titel"><TextZeile wert={b.titel} onFertig={t => t.trim() && setze({ titel: t.trim() })} /></Feldzeile>
        <Feldzeile label="Art"><Wahl<BausteinArt> label="Art" liste={ARTEN.map(a => ({ id: a, label: BAUSTEIN_ART_LABEL[a] }))} wert={b.art} onWahl={art => setze({ art })} /></Feldzeile>
        <Feldzeile label="Zweck"><TextZeile wert={b.zweck ?? ''} zeilen={2} onFertig={t => setze({ zweck: t || null })} /></Feldzeile>
        <Feldzeile label="Ergebnis"><TextZeile wert={b.ergebnis ?? ''} onFertig={t => setze({ ergebnis: t || null })} /></Feldzeile>
        <Feldzeile label="Kennzahl"><TextZeile wert={b.kennzahl ?? ''} onFertig={t => setze({ kennzahl: t || null })} /></Feldzeile>
        <Feldzeile label="Lieferobjekt (exakt wie in der Leistungstreppe)"><TextZeile wert={b.lieferobjekt ?? ''} onFertig={t => setze({ lieferobjekt: t || null })} /></Feldzeile>
        <Feldzeile label="Hinweis"><TextZeile wert={b.hinweis ?? ''} zeilen={2} onFertig={t => setze({ hinweis: t || null })} /></Feldzeile>
        <Feldzeile label="Gliederung (ein Punkt je Zeile)"><TextZeile wert={b.gliederung.join('\n')} zeilen={Math.min(12, Math.max(3, b.gliederung.length + 1))} onFertig={t => setze({ gliederung: t.split('\n').map(x => x.trim()).filter(Boolean) })} /></Feldzeile>
        <Feldzeile label="Text"><TextZeile wert={b.text ?? ''} zeilen={10} onFertig={t => setze({ text: t || null })} /></Feldzeile>
        <Feldzeile label="Schlagworte (durch Komma getrennt)"><TextZeile wert={b.tags.join(', ')} onFertig={t => setze({ tags: t.split(',').map(x => x.trim()).filter(Boolean) })} /></Feldzeile>
        <Schalter an={b.kundeSichtbar} onChange={v => setze({ kundeSichtbar: v })} aus={kurz?.nurIntern} erklaerung="fulfillment.kundeSichtbar">Für Kunden sichtbar</Schalter>
        <Schalter an={!!kurz?.nurIntern} onChange={v => setze({ nurIntern: v })} erklaerung="fulfillment.nurIntern">Nur intern</Schalter>
        {formular && <Schalter an={!!b.kundeFuellt} onChange={v => setze({ kundeFuellt: v })} erklaerung="fulfillment.kundeFuellt">Kunde füllt aus (über seinen Link)</Schalter>}
        <Leiste>
          {!b.rechtPruefen && <Knopf leise onClick={() => setze({ rechtPruefen: { grund: 'Von Hand markiert.' } })}>Als „rechtlich prüfen“ markieren</Knopf>}
          {b.rechtPruefen && <Knopf leise onClick={() => setze({ rechtPruefen: null })}>Marke „rechtlich prüfen“ lösen</Knopf>}
          {!b.urheberPruefen && <Knopf leise onClick={() => setze({ urheberPruefen: { grund: 'Material Dritter — von Hand markiert.' } })}>Als Material Dritter markieren</Knopf>}
        </Leiste>
      </Karte>
      {formular && <FragenEditor fragen={b.fragen ?? []} onSpeichern={fragen => setze({ fragen })} />}
      <Karte i={3}>
        <Ueberschrift>Steckt in</Ueberschrift>
        {d.steckt.length ? <Liste>{d.steckt.map(v => <Zeile key={v.id} titel={v.titel} />)}</Liste> : <div style={klein}>Noch in keiner Vorlage — im Editor einer Paket-Vorlage als Baustein (Ebene 5) unter einen Einzelschritt hängen.</div>}
        <span style={MIKRO}>Herkunft</span>
        <div style={klein}>{b.herkunft?.art === 'import' ? `Import „${b.herkunft.datei ?? ''}“ am ${tagLang(b.herkunft.am)}` : b.herkunft?.art === 'muster' ? 'Muster' : 'von Hand'}{b.herkunftText ? ` · ${b.herkunftText}` : ''}{b.herkunft?.quelleIds?.length ? ` · Quellen ${b.herkunft.quelleIds.join(', ')}` : ''}</div>
        <Leiste>
          <Knopf leise onClick={async () => {
            if (!(await bestaetigen({ titel: `„${b.titel}“ löschen?`, text: d.steckt.length ? `Er steckt in ${d.steckt.length} Vorlage(n) — dort fällt der Baustein mit weg. Laufende Fälle zeigen „Baustein entfernt“.` : 'Er steckt in keiner Vorlage.', ja: 'Löschen', gefahr: true }))) return;
            const a = await vorlagenOps([{ op: 'baustein-weg', id: b.id, stand: b.stand }]);
            if (a.ok) onZurueck(); else setFehler(fehlerText(a));
          }}>Baustein löschen</Knopf>
        </Leiste>
      </Karte>
      {dialog}{frage.dialog}
    </div>
  );
}

function TextZeile({ wert, onFertig, zeilen }: { wert: string; onFertig: (t: string) => void; zeilen?: number }) {
  const [t, setT] = useState(wert);
  useEffect(() => { setT(wert); }, [wert]);
  const fertig = () => { if (t !== wert) onFertig(t); };
  return zeilen
    ? <textarea value={t} rows={zeilen} onChange={e => setT(e.target.value)} onBlur={fertig} style={{ ...feld, width: '100%', resize: 'vertical', fontSize: 16 }} />
    : <input value={t} onChange={e => setT(e.target.value)} onBlur={fertig} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} style={{ ...feld, width: '100%' }} />;
}

const FRAGE_ARTEN: { id: Frage['art']; label: string }[] = [{ id: 'langtext', label: 'Langtext' }, { id: 'text', label: 'Text' }, { id: 'zahl', label: 'Zahl' }, { id: 'ja-nein', label: 'Ja/Nein' }, { id: 'auswahl', label: 'Auswahl' }];

/** Fragen eines Formulars/Workbooks: Abschnitt, Frage, Art — gespeichert als ganze Liste (die Kennung je Frage bleibt stabil). */
function FragenEditor({ fragen, onSpeichern }: { fragen: Frage[]; onSpeichern: (f: Frage[]) => Promise<void> }) {
  const [l, setL] = useState<Frage[]>(fragen);
  useEffect(() => { setL(fragen); }, [fragen]);
  const aendern = (i: number, teil: Partial<Frage>) => setL(x => x.map((f, j) => (j === i ? { ...f, ...teil } : f)));
  const anders = JSON.stringify(l) !== JSON.stringify(fragen);
  return (
    <Karte i={2}>
      <Ueberschrift rechts={<span>{l.length} Fragen</span>}>Fragen</Ueberschrift>
      {l.map((f, i) => (
        <div key={f.id} style={{ display: 'grid', gap: 6, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,.05)' }}>
          <input value={f.abschnitt ?? ''} placeholder="Abschnitt" aria-label="Abschnitt" onChange={e => aendern(i, { abschnitt: e.target.value || undefined })} style={feld} />
          <textarea value={f.frage} rows={2} aria-label="Frage" onChange={e => aendern(i, { frage: e.target.value })} style={{ ...feld, fontSize: 16 }} />
          <Leiste>
            <Pillen<Frage['art']> liste={FRAGE_ARTEN} aktiv={f.art} onWahl={art => aendern(i, { art })} />
            <Knopf leise onClick={() => setL(x => x.filter((_, j) => j !== i))}>Entfernen</Knopf>
          </Leiste>
        </div>
      ))}
      <Leiste>
        <Knopf leise onClick={() => setL(x => [...x, { id: `f-${neueAnfrageId().slice(3, 15)}`, frage: 'Neue Frage', art: 'langtext' }])}>+ Frage</Knopf>
        {anders && <Knopf haupt onClick={() => onSpeichern(l.filter(f => f.frage.trim()))}>Fragen speichern</Knopf>}
      </Leiste>
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Antworten des Kunden hängen an der Kennung der Frage — eine geänderte Formulierung behält die Antworten.</div>
    </Karte>
  );
}

