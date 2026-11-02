'use client';

// ─── Unternehmen › Verträge › Vorlagen (01.11.) ──────────────────────────────────────────────────────────────────────
// Kevin: „Vorlagen … Gesellschafterverträge, Dienstleistungsverträge, Handelsvertreterverträge … hinterlegen unter Unternehmen › Verträge › Vorlagen.“
// Liste mit Ampel (anwaltlich geprüft / ungeprüft / geändert seit Prüfung), neu aus einem Gerüst (nur Überschriften) oder per Import aus DOCX/PDF/Text
// (Vorschau → Werte als Felder markieren → speichern — nichts automatisch), Bearbeiten (Paragraphen, eigene Felder, Platzhalter-Hilfe), Prüfvermerk.
// Daten: GET/POST /api/vertraege/vorlagen, POST /api/vertraege/import. Hinweis, keine Rechtsberatung.

import { useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { Karte, Ueberschrift, Knopf, Hinweis, Leerzustand, Leer, Liste, Zeile, Chip, Feldzeile, eingabe, Pillen, Schalter } from '../ui';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { localDay } from '@/lib/zeit';
import { VERTRAG_HINWEIS, artLabel, type VorlageFeld, type VorlageParagraph, type FeldTyp } from '@/lib/vertraege/modell';
import { wertAlsPlatzhalter, schluesselAus, type VorlageImport } from '@/lib/vertraege/import';
import { importLesen, senden, sammelSenden, useVorlagen, type VorlageMitStand } from './daten';
import { SAMMEL_MAX_BYTES, type SammelVorschau, type SammelZustand } from '@/lib/vertraege/sammel';

const klein = { fontSize: TYP.bedien, color: C.inkDim } as const;
interface Entwurf { id?: string; stand?: string; titel: string; art: string; fassung: string; anrede: 'Sie' | 'Du'; paragraphen: VorlageParagraph[]; felder: VorlageFeld[]; notiz?: string }
const leer = (): Entwurf => ({ titel: '', art: 'sonstiges', fassung: '1', anrede: 'Sie', paragraphen: [], felder: [] });
const ausVorlage = (v: VorlageMitStand): Entwurf => ({ id: v.id, stand: v.stand, titel: v.titel, art: v.art, fassung: v.fassung, anrede: v.anrede, paragraphen: v.paragraphen.map(p => ({ ...p })), felder: v.felder.map(f => ({ ...f })), ...(v.notiz ? { notiz: v.notiz } : {}) });

export function VorlagenBereich({ offenId, oeffnen }: { offenId?: string; oeffnen: (id?: string) => void }) {
  const daten = useVorlagen();
  const [entwurf, setEntwurf] = useState<Entwurf | null>(null);
  const [importOffen, setImportOffen] = useState(false);
  const [sammelOffen, setSammelOffen] = useState(false);
  const [archiv, setArchiv] = useState(false);
  const [meldung, setMeldung] = useState<{ art: 'kritisch' | 'gut'; text: string } | null>(null);
  const s = daten.stand;
  if (daten.gesperrt) return <Karte><Leer>Vertragsvorlagen gehören zum Haushalt des Inhabers — für dieses Konto nicht freigegeben.</Leer></Karte>;
  if (!s) return <Karte><Leer>{daten.fehler ?? 'Vorlagen laden …'}</Leer></Karte>;
  const offen = offenId ? s.vorlagen.find(v => v.id === offenId) : undefined;
  if (entwurf || offen) {
    return <Bearbeiten key={entwurf?.id ?? offen?.id ?? 'neu'} start={entwurf ?? ausVorlage(offen!)} vorlage={offen} daten={daten} nurLesen={!!s.nurLesen}
      fertig={id => { setEntwurf(null); oeffnen(id); }} />;
  }
  const liste = s.vorlagen.filter(v => !!v.archiviert === archiv);
  return (
    <>
      <Hinweis art="info">{s.hinweis} Startgerüste tragen nur übliche Überschriften — den Wortlaut bringt ihr selbst ein (Import oder Eingabe).</Hinweis>
      {meldung && <Hinweis art={meldung.art} rolle="alert">{meldung.text}</Hinweis>}
      {sammelOffen && <SammelKarte onSchliessen={() => setSammelOffen(false)} onFertig={async n => { setSammelOffen(false); await daten.laden(); setMeldung({ art: 'gut', text: n === 1 ? 'Eine Vorlage übernommen — ungeprüft.' : `${n} Vorlagen übernommen — ungeprüft.` }); }} />}
      {importOffen && <ImportKarte felderSchon={[]} onAbbrechen={() => setImportOffen(false)} onUebernehmen={v => { setImportOffen(false); setEntwurf({ ...leer(), titel: v.titel, paragraphen: v.paragraphen, felder: v.felder }); }} />}
      <Karte>
        <Ueberschrift rechts={!s.nurLesen && (
          <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
            <Knopf leise onClick={() => setImportOffen(true)}>Importieren</Knopf>
            {s.sammelImport && <Knopf leise onClick={() => setSammelOffen(true)}>Vorlagen importieren (Datei)</Knopf>}
            <Knopf haupt onClick={() => setEntwurf(leer())}>+ Vorlage</Knopf>
          </span>
        )}>Vorlagen</Ueberschrift>
        <Pillen liste={[{ id: 'aktiv', label: 'Aktiv' }, { id: 'archiv', label: 'Archiv' }]} aktiv={archiv ? 'archiv' : 'aktiv'} onWahl={x => setArchiv(x === 'archiv')} />
        {!liste.length ? (
          <Leerzustand symbol={<FileText size={22} />} titel={archiv ? 'Archiv ist leer' : 'Noch keine Vorlage'}>
            {archiv ? 'Archivierte Vorlagen erscheinen hier.' : 'Lege eine Vorlage aus einem Gerüst an oder importiere euren eigenen Vertrag (DOCX, PDF, Text).'}
          </Leerzustand>
        ) : (
          <Liste>
            {liste.map(v => (
              <Zeile key={v.id} onClick={() => oeffnen(v.id)} titel={v.titel} unter={`${artLabel(v.art, s.arten as never)} · Fassung ${v.fassung} · ${v.paragraphen.length} Paragraphen`}
                rechts={<Chip farbe={v.ampel.ampel === 'gruen' ? LEUCHT.gut : LEUCHT.business}>{v.ampel.stufe === 'geprueft' ? 'geprüft' : v.ampel.stufe === 'geaendert' ? 'geändert seit Prüfung' : 'ungeprüft'}</Chip>} />
            ))}
          </Liste>
        )}
      </Karte>
      {!s.nurLesen && !archiv && (
        <Karte>
          <Ueberschrift>Aus einem Gerüst</Ueberschrift>
          <div style={klein}>Nur übliche Überschriften, kein Vertragstext — jeder Paragraph startet leer.</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {s.geruest.map(g => <Knopf key={g.id} leise onClick={async () => {
              const r = await senden<{ vorlage: VorlageMitStand }>('/api/vertraege/vorlagen', { aktion: 'geruest', start: g.id });
              if (r.ok) { daten.uebernehmen(r.d.vorlage); oeffnen(r.d.vorlage.id); } else setMeldung({ art: 'kritisch', text: r.d.fehler ?? 'Nicht angelegt.' });
            }}>{g.titel.replace(/\s*\(Gerüst\)$/, '')}</Knopf>)}
          </div>
        </Karte>
      )}
    </>
  );
}

const ZUSTAND: Record<SammelZustand, { label: string; farbe: string }> = {
  neu: { label: 'neu', farbe: LEUCHT.gut }, vorhanden: { label: 'gibt es schon', farbe: LEUCHT.business }, doppelt: { label: 'doppelt in der Datei', farbe: LEUCHT.business }, fehler: { label: 'Fehler', farbe: LEUCHT.kritisch },
};

/** Sammel-Import: JSON-Datei → Vorschau je Vorlage → Übernahme nur per Klick (nur neue, nie überschreiben, ungeprüft). */
function SammelKarte({ onSchliessen, onFertig }: { onSchliessen: () => void; onFertig: (n: number) => void | Promise<void> }) {
  const [inhalt, setInhalt] = useState<string | null>(null);
  const [vorschau, setVorschau] = useState<SammelVorschau | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const lesen = async (f: File) => {
    setVorschau(null); setInhalt(null);
    if (f.size > SAMMEL_MAX_BYTES) { setFehler('Datei zu groß (höchstens 2 MB).'); return; }
    const t = await f.text();
    const r = await sammelSenden('vorschau', t);
    if (!r.ok) { setFehler(r.fehler); return; }
    setFehler(null); setInhalt(t); setVorschau(r.d);
  };
  return (
    <Karte>
      <Ueberschrift rechts={<Knopf leise onClick={onSchliessen}>Schließen</Knopf>}>Vorlagen importieren (Datei)</Ueberschrift>
      <div style={klein}>JSON-Datei im Format „make-os-vertragsvorlagen“. Erst die Vorschau — übernommen wird nur, was es mit Titel und Art noch nicht gibt; jede Vorlage startet ungeprüft.</div>
      <Feldzeile label="Datei (JSON, höchstens 2 MB)"><input aria-label="Datei" type="file" accept=".json,application/json" style={eingabe} onChange={e => { const f = e.target.files?.[0]; if (f) void lesen(f); }} /></Feldzeile>
      {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
      {vorschau && (
        <>
          <div style={klein}>{vorschau.neu} neu · {vorschau.vorhanden} gibt es schon · {vorschau.fehlerhaft} mit Fehlern{vorschau.neueArten.length ? ` · neue Arten: ${vorschau.neueArten.map(a => a.label).join(', ')}` : ''}</div>
          <Liste>
            {vorschau.zeilen.map(z => (
              <Zeile key={z.nr} titel={z.titel || `Vorlage ${z.nr}`} unter={[`${z.artLabel} · ${z.paragraphen} Paragraphen · ${z.felder} Felder`, ...(z.geprueftAm ? [`als geprüft übernommen (${z.geprueftAm.split('-').reverse().join('.')})`] : []), ...z.fehler].join(' · ')}
                rechts={<Chip farbe={ZUSTAND[z.zustand].farbe}>{ZUSTAND[z.zustand].label}</Chip>} />
            ))}
          </Liste>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <Knopf haupt aus={!vorschau.neu || !inhalt} onClick={async () => {
              if (!inhalt) return;
              const r = await sammelSenden('uebernehmen', inhalt);
              if (!r.ok) { setFehler(r.fehler); return; }
              await onFertig(r.d.uebernommen.length);
            }}>{vorschau.neu === 1 ? 'Eine Vorlage übernehmen' : `${vorschau.neu} Vorlagen übernehmen`}</Knopf>
          </div>
        </>
      )}
    </Karte>
  );
}

/** Import: Datei bzw. eingefügter Text → Vorschau → Werte als Felder markieren → übernehmen (gespeichert wird erst in „Bearbeiten“). */
function ImportKarte({ felderSchon, onAbbrechen, onUebernehmen }: { felderSchon: string[]; onAbbrechen: () => void; onUebernehmen: (v: { titel: string; paragraphen: VorlageParagraph[]; felder: VorlageFeld[] }) => void }) {
  const [text, setText] = useState('');
  const [vorschau, setVorschau] = useState<VorlageImport | null>(null);
  const [paragraphen, setParagraphen] = useState<VorlageParagraph[]>([]);
  const [felder, setFelder] = useState<VorlageFeld[]>([]);
  const [markiert, setMarkiert] = useState('');
  const [label, setLabel] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const lesen = async (datei: File | null) => {
    const r = await importLesen(datei, datei ? undefined : text);
    if (!r.ok) { setFehler(r.fehler); return; }
    setFehler(null); setVorschau(r.vorschau);
    setParagraphen(r.vorschau.paragraphen.map((p, i) => ({ id: `p-${i + 1}`, nr: p.nr, titel: p.titel, text: p.text, optional: false })));
  };
  const markieren = (wert: string, name: string) => {
    if (!wert.trim() || !name.trim()) return;
    const schluessel = schluesselAus(name, [...felderSchon, ...felder.map(f => f.schluessel)]);
    const r = wertAlsPlatzhalter(paragraphen, wert, schluessel);
    if (!r.ersetzt) { setFehler(`„${wert}“ steht so nicht im Text.`); return; }
    setParagraphen(r.paragraphen); setFelder([...felder, { schluessel, label: name.trim(), typ: 'text', pflicht: true }]); setMarkiert(''); setLabel(''); setFehler(null);
  };
  return (
    <Karte>
      <Ueberschrift rechts={<Knopf leise onClick={onAbbrechen}>Schließen</Knopf>}>Vorlage importieren</Ueberschrift>
      <div style={klein}>Liest den Text und schlägt Paragraphen vor — gespeichert wird nichts, bis du die Vorlage speicherst.</div>
      {!vorschau && (
        <>
          <Feldzeile label="Datei (DOCX, PDF, TXT)"><input aria-label="Datei" type="file" accept=".docx,.pdf,.txt,.md" style={eingabe} onChange={e => { const f = e.target.files?.[0]; if (f) void lesen(f); }} /></Feldzeile>
          <Feldzeile label="… oder Text einfügen"><textarea aria-label="Text" style={{ ...eingabe, minHeight: 120 }} value={text} onChange={e => setText(e.target.value)} /></Feldzeile>
          <Knopf aus={!text.trim()} onClick={() => lesen(null)}>Vorschau</Knopf>
        </>
      )}
      {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
      {vorschau && (
        <>
          {vorschau.hinweis && <Hinweis art="achtung">{vorschau.hinweis}</Hinweis>}
          <div style={klein}>{paragraphen.length} Paragraphen erkannt{vorschau.titel ? ` · Titel „${vorschau.titel}“` : ''}.</div>
          {vorschau.kandidaten.length > 0 && (
            <>
              <div style={{ ...klein, marginTop: 8 }}>Werte, die vermutlich je Vertrag anders sind — antippen, Namen geben, als Feld übernehmen:</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {vorschau.kandidaten.map(k => <Knopf key={k.wert} leise onClick={() => setMarkiert(k.wert)}>{`${k.wert}${k.anzahl > 1 ? ` (${k.anzahl}×)` : ''}`}</Knopf>)}
              </div>
            </>
          )}
          <Feldzeile label="Wert aus dem Text (genau wie dort)"><input aria-label="Wert" style={eingabe} value={markiert} onChange={e => setMarkiert(e.target.value)} /></Feldzeile>
          <Feldzeile label="Name des Feldes"><input aria-label="Name des Feldes" style={eingabe} value={label} onChange={e => setLabel(e.target.value)} /></Feldzeile>
          <Knopf leise aus={!markiert.trim() || !label.trim()} onClick={() => markieren(markiert, label)}>Als Feld markieren</Knopf>
          {felder.length > 0 && <div style={{ ...klein, marginTop: 6 }}>Felder: {felder.map(f => `${f.label} {{${f.schluessel}}}`).join(' · ')}</div>}
          <Liste>
            {paragraphen.map(p => <div key={p.id} style={{ padding: '6px 0', borderBottom: `1px solid ${C.linie}` }}><b style={{ fontSize: TYP.bedien, color: C.ink }}>{[p.nr, p.titel].filter(Boolean).join(' ') || 'Absatz'}</b><div style={{ ...klein, whiteSpace: 'pre-wrap' }}>{p.text.slice(0, 600)}{p.text.length > 600 ? ' …' : ''}</div></div>)}
          </Liste>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Knopf haupt onClick={() => onUebernehmen({ titel: vorschau.titel, paragraphen, felder })}>Weiter zum Bearbeiten</Knopf>
            <Knopf leise onClick={() => setVorschau(null)}>Neu lesen</Knopf>
          </div>
        </>
      )}
    </Karte>
  );
}

function Bearbeiten({ start, vorlage, daten, nurLesen, fertig }: { start: Entwurf; vorlage?: VorlageMitStand; daten: ReturnType<typeof useVorlagen>; nurLesen: boolean; fertig: (id?: string) => void }) {
  const [e, setE] = useState<Entwurf>(start);
  const [meldung, setMeldung] = useState<{ art: 'kritisch' | 'gut'; text: string } | null>(null);
  const [geprueftAm, setGeprueftAm] = useState(localDay());
  const [neueArt, setNeueArt] = useState('');
  const s = daten.stand!;
  const typen: { id: FeldTyp; label: string }[] = s.feldTypen;
  const setP = (i: number, x: Partial<VorlageParagraph>) => setE({ ...e, paragraphen: e.paragraphen.map((p, j) => (j === i ? { ...p, ...x } : p)) });
  const setF = (i: number, x: Partial<VorlageFeld>) => setE({ ...e, felder: e.felder.map((f, j) => (j === i ? { ...f, ...x } : f)) });
  const hilfe = useMemo(() => [...s.feste.map(f => `{{${f.schluessel}}}`), ...s.standard.map(f => `{{${f.schluessel}}}`), ...e.felder.map(f => `{{${f.schluessel}}}`)].join('  '), [s, e.felder]);
  const speichern = async () => {
    const { id, stand, ...felder } = e;
    const r = await senden<{ vorlage: VorlageMitStand }>('/api/vertraege/vorlagen', { aktion: 'speichern', ...(id ? { id, stand } : {}), felder });
    if (r.ok) { daten.uebernehmen(r.d.vorlage); setE(ausVorlage(r.d.vorlage)); setMeldung({ art: 'gut', text: 'Gespeichert.' }); if (!id) fertig(r.d.vorlage.id); }
    else setMeldung({ art: 'kritisch', text: `${r.d.fehler ?? 'Nicht gespeichert.'} Nichts gespeichert.` });
  };
  const aktion = async (body: Record<string, unknown>) => {
    if (!vorlage) return;
    const r = await senden<{ vorlage: VorlageMitStand }>('/api/vertraege/vorlagen', { id: vorlage.id, stand: e.stand ?? vorlage.stand, ...body });
    if (r.ok) { daten.uebernehmen(r.d.vorlage); setE(ausVorlage(r.d.vorlage)); setMeldung(null); } else setMeldung({ art: 'kritisch', text: r.d.fehler ?? 'Nicht gespeichert.' });
  };
  const aktuell = vorlage ? s.vorlagen.find(v => v.id === vorlage.id) ?? vorlage : undefined;
  return (
    <>
      <Karte>
        <Ueberschrift rechts={<Knopf leise onClick={() => fertig()}>Alle Vorlagen</Knopf>}>{e.titel || 'Neue Vorlage'}</Ueberschrift>
        <Hinweis art={aktuell?.ampel.ampel === 'gruen' ? 'info' : 'achtung'}>{aktuell ? aktuell.ampel.satz : 'Neue Vorlage — noch nicht geprüft.'} {VERTRAG_HINWEIS}</Hinweis>
        {meldung && <Hinweis art={meldung.art} rolle="alert">{meldung.text}</Hinweis>}
        <Feldzeile label="Titel"><input aria-label="Titel" style={eingabe} value={e.titel} disabled={nurLesen} onChange={x => setE({ ...e, titel: x.target.value })} /></Feldzeile>
        <Feldzeile label="Art"><Pillen liste={s.arten.map(a => ({ id: a.id, label: a.label }))} aktiv={e.art} onWahl={a => setE({ ...e, art: a })} /></Feldzeile>
        {!nurLesen && (
          <Feldzeile label="Eigene Art anlegen">
            <span style={{ display: 'flex', gap: 8 }}>
              <input aria-label="Eigene Art" style={eingabe} value={neueArt} onChange={x => setNeueArt(x.target.value)} />
              <Knopf leise aus={neueArt.trim().length < 2} onClick={async () => {
                const r = await senden<{ art: { id: string } }>('/api/vertraege/vorlagen', { aktion: 'art', label: neueArt });
                if (r.ok) { await daten.laden(); setE({ ...e, art: r.d.art.id }); setNeueArt(''); } else setMeldung({ art: 'kritisch', text: r.d.fehler ?? 'Nicht angelegt.' });
              }}>Anlegen</Knopf>
            </span>
          </Feldzeile>
        )}
        <Feldzeile label="Fassung"><input aria-label="Fassung" style={eingabe} value={e.fassung} disabled={nurLesen} onChange={x => setE({ ...e, fassung: x.target.value })} /></Feldzeile>
        <Feldzeile label="Anrede"><Pillen liste={[{ id: 'Sie', label: 'Sie' }, { id: 'Du', label: 'Du' }]} aktiv={e.anrede} onWahl={a => setE({ ...e, anrede: a })} /></Feldzeile>
      </Karte>
      <Karte>
        <Ueberschrift rechts={!nurLesen && <Knopf leise onClick={() => setE({ ...e, felder: [...e.felder, { schluessel: schluesselAus(`feld ${e.felder.length + 1}`, e.felder.map(f => f.schluessel)), label: `Feld ${e.felder.length + 1}`, typ: 'text', pflicht: false }] })}>+ Feld</Knopf>}>Eigene Felder</Ueberschrift>
        {!e.felder.length && <div style={klein}>Feste Platzhalter (Absender, Vertragspartner, Leistung, Vergütung, Beginn, Laufzeit, Kündigungsfrist, Ort, Datum) gibt es immer — eigene Felder nur für das, was eure Vorlage zusätzlich braucht.</div>}
        {e.felder.map((f, i) => (
          <div key={i} style={{ display: 'grid', gap: 6, padding: '6px 0', borderBottom: `1px solid ${C.linie}` }}>
            <Feldzeile label={`Name · {{${f.schluessel}}}`}><input aria-label="Name des Feldes" style={eingabe} value={f.label} disabled={nurLesen} onChange={x => setF(i, { label: x.target.value })} /></Feldzeile>
            <Pillen liste={typen} aktiv={f.typ} onWahl={t => setF(i, { typ: t })} />
            {f.typ === 'auswahl' && <Feldzeile label="Werte (durch Komma)"><input aria-label="Werte" style={eingabe} value={(f.optionen ?? []).join(', ')} onChange={x => setF(i, { optionen: x.target.value.split(',').map(y => y.trim()).filter(Boolean) })} /></Feldzeile>}
            <Schalter an={f.pflicht} onChange={an => setF(i, { pflicht: an })} erklaerung="vertraege.pflichtfeld">Pflichtfeld</Schalter>
            {!nurLesen && <Knopf leise onClick={() => setE({ ...e, felder: e.felder.filter((_, j) => j !== i) })}>Feld entfernen</Knopf>}
          </div>
        ))}
      </Karte>
      <Karte>
        <Ueberschrift rechts={!nurLesen && <Knopf leise onClick={() => setE({ ...e, paragraphen: [...e.paragraphen, { id: `p-n${e.paragraphen.length + 1}`, nr: `§ ${e.paragraphen.length + 1}`, titel: '', text: '', optional: false }] })}>+ Paragraph</Knopf>}>Paragraphen</Ueberschrift>
        <div style={{ ...klein, wordBreak: 'break-word' }}>Platzhalter: {hilfe}</div>
        {e.paragraphen.map((p, i) => (
          <div key={p.id} style={{ display: 'grid', gap: 6, padding: '8px 0', borderBottom: `1px solid ${C.linie}` }}>
            <span style={{ display: 'flex', gap: 8 }}>
              <input aria-label="Nummer" style={{ ...eingabe, maxWidth: 90 }} value={p.nr} disabled={nurLesen} onChange={x => setP(i, { nr: x.target.value })} />
              <input aria-label="Überschrift" style={eingabe} value={p.titel} disabled={nurLesen} onChange={x => setP(i, { titel: x.target.value })} />
            </span>
            <textarea aria-label={`Text ${p.nr}`} style={{ ...eingabe, minHeight: 110 }} value={p.text} disabled={nurLesen} onChange={x => setP(i, { text: x.target.value })} />
            <Schalter an={p.optional} onChange={an => setP(i, { optional: an })} erklaerung="vertraege.optional">Optional (im Vertrag abwählbar)</Schalter>
            <Feldzeile label="Nur, wenn dieses Feld gefüllt ist (Schlüssel, leer = immer)"><input aria-label="Bedingung" style={eingabe} value={p.bedingung ?? ''} disabled={nurLesen} onChange={x => setP(i, { bedingung: x.target.value || undefined })} /></Feldzeile>
            {!nurLesen && <Knopf leise onClick={() => setE({ ...e, paragraphen: e.paragraphen.filter((_, j) => j !== i) })}>Paragraph entfernen</Knopf>}
          </div>
        ))}
        {!e.paragraphen.length && <Leer>Noch kein Paragraph.</Leer>}
        {!nurLesen && <div style={{ marginTop: 10 }}><Knopf haupt onClick={speichern}>Vorlage speichern</Knopf></div>}
      </Karte>
      {vorlage && !nurLesen && (
        <Karte>
          <Ueberschrift>Anwaltliche Prüfung</Ueberschrift>
          <div style={klein}>Vermerkt, wann die Vorlage geprüft wurde. Ändert sich danach ein Paragraph, steht die Vorlage wieder auf gelb.</div>
          <Feldzeile label="Geprüft am"><input aria-label="Geprüft am" type="date" style={eingabe} value={geprueftAm} onChange={x => setGeprueftAm(x.target.value)} /></Feldzeile>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Knopf leise onClick={() => aktion({ aktion: 'pruefung', am: geprueftAm })}>Als geprüft vermerken</Knopf>
            {aktuell?.pruefung.anwaltlichGeprueftAm && <Knopf leise onClick={() => aktion({ aktion: 'pruefung', loeschen: true })}>Vermerk entfernen</Knopf>}
            <Knopf leise onClick={() => aktion({ aktion: 'archiv', zurueck: !!aktuell?.archiviert })}>{aktuell?.archiviert ? 'Aus dem Archiv holen' : 'Archivieren'}</Knopf>
          </div>
        </Karte>
      )}
    </>
  );
}
