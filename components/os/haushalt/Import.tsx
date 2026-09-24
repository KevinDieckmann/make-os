'use client';

// Kontoauszug einlesen — N26-PDF, CSV oder eingefügter Text. Erst prüfen
// (nichts wird geschrieben), dann übernehmen. Wichtigster Teil des Berichts:
// die Kontrollsumme. Ein Import, den niemand gegengerechnet hat, ist nur eine
// Hoffnung (Malin).
//
// Das PDF wird im Browser gelesen, mit pdf.js aus dem eigenen Server (kein
// CDN), ohne Skriptausführung aus der PDF (isEvalSupported: false) — und erst
// geladen, wenn jemand wirklich eine PDF wählt.

import { useState } from 'react';
import { FARBE as C } from '@/lib/make-one/design';
import { eur } from '@/lib/finanzen/haushalt/typen';
import { zeilenAusTextItems } from '@/lib/finanzen/haushalt/import';
import { datumDe } from '@/lib/finanzen/haushalt/monat';
import { Knopf, feld, LEUCHT } from '../schlank';
import { Dialog, Feld, auswahl, type HaushaltDaten } from './gemeinsam';

interface Vorschau {
  ok: boolean; fehler?: string; text?: string;
  gefunden: number; neu: number; schonVorhanden: number; zugeordnet: number; umbuchungen: number; uebernommen: number | null;
  pruefung: { ein: number; aus: number; sollEin: number | null; sollAus: number | null; stimmt: boolean | null; abweichung: { ein: number; aus: number } | null };
  zeitraum: { von: string; bis: string } | null;
  beispiele: { datum: string; empfaenger: string; betrag: number }[];
}

async function pdfZeilen(datei: File, fortschritt: (s: string) => void): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const dok = await pdfjs.getDocument({ data: new Uint8Array(await datei.arrayBuffer()), isEvalSupported: false }).promise;
  const alle: string[] = [];
  for (let s = 1; s <= dok.numPages; s++) {
    fortschritt(`Seite ${s} von ${dok.numPages} …`);
    const seite = await dok.getPage(s);
    const inhalt = await seite.getTextContent();
    alle.push(...zeilenAusTextItems(inhalt.items.filter((i): i is { str: string; transform: number[] } & typeof i => 'str' in i) as { str: string; transform: number[] }[]));
  }
  try { await dok.destroy(); } catch { /* egal */ }
  return alle;
}

export function ImportDialog({ h, aktion, laden, melde, onZu }: {
  h: HaushaltDaten;
  aktion: <T = Record<string, unknown>>(b: Record<string, unknown>) => Promise<(T & { ok: boolean; fehler?: string }) | null>;
  laden: () => Promise<void>;
  melde: (art: 'ok' | 'fehler' | 'info', titel: string, text?: string) => void;
  onZu: () => void;
}) {
  const [konto, setKonto] = useState(h.stamm.konten[0]?.id ?? '');
  const [datei, setDatei] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [stand, setStand] = useState('');
  const [v, setV] = useState<Vorschau | null>(null);
  const [nutzlast, setNutzlast] = useState<Record<string, unknown> | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function pruefen() {
    if (!konto) { melde('fehler', 'Kein Konto gewählt', h.stamm.konten.length ? 'Bitte auswählen, auf welches Konto der Auszug gehört.' : 'Es ist noch kein Konto angelegt.'); return; }
    setLaeuft(true); setV(null);
    try {
      let last: Record<string, unknown>;
      if (datei && /\.pdf$/i.test(datei.name)) {
        setStand('PDF wird gelesen …');
        const zeilen = await pdfZeilen(datei, setStand);
        last = { aktion: 'import', konto_id: konto, zeilen, dateiName: datei.name };
      } else if (datei) {
        last = { aktion: 'import', konto_id: konto, text: await datei.text(), dateiName: datei.name };
      } else if (text.trim()) {
        last = { aktion: 'import', konto_id: konto, text, dateiName: 'Einfügung' };
      } else { melde('fehler', 'Nichts zu tun', 'Weder Datei noch Text vorhanden.'); setLaeuft(false); return; }
      setStand('Wird geprüft …');
      const d = await aktion<Vorschau>({ ...last, vorschau: true });
      if (d?.ok) { setV(d as Vorschau); setNutzlast(last); }
    } catch (e) {
      melde('fehler', 'Datei konnte nicht gelesen werden', e instanceof Error ? e.message : String(e));
    }
    setStand(''); setLaeuft(false);
  }

  async function uebernehmen() {
    if (!nutzlast) return;
    setLaeuft(true);
    const d = await aktion<Vorschau>({ ...nutzlast, vorschau: false });
    setLaeuft(false);
    if (!d?.ok) return;
    const p = (d as Vorschau).pruefung;
    const text = `${d.gefunden} Buchungen gelesen · ${d.uebernommen} neu übernommen · ${d.schonVorhanden} waren schon da.`;
    if (p.stimmt === false) melde('fehler', 'Übernommen — aber die Summen stimmen nicht', `${text}\nDer Auszug nennt ${eur(p.sollEin)} Eingänge und ${eur(p.sollAus)} Ausgänge, gelesen wurden ${eur(p.ein)} und ${eur(p.aus)}. Da fehlt etwas.`);
    else melde('ok', p.stimmt ? 'Geprüft und übernommen' : 'Übernommen', p.stimmt ? `${text}\n✓ Summen stimmen mit den Kontrollsummen des Auszugs.` : `${text}\nDiese Datei hat keine Kontrollsummen — gegenrechnen war nicht möglich.`);
    await laden(); onZu();
  }

  return (
    <Dialog titel="Kontoauszug einlesen" onZu={onZu} aktionen={v ? <Knopf farbe={LEUCHT.geld} aus={laeuft || v.neu === 0} onClick={() => void uebernehmen()}>{v.neu ? `${v.neu} Buchungen übernehmen` : 'Nichts Neues'}</Knopf> : <Knopf farbe={LEUCHT.geld} aus={laeuft} onClick={() => void pruefen()}>Prüfen</Knopf>}>
      <Feld label="Auf welches Konto?"><select value={konto} onChange={e => { setKonto(e.target.value); setV(null); }} style={auswahl}>{h.stamm.konten.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}</select></Feld>
      <Feld label="Datei — N26-PDF oder CSV"><input type="file" accept=".pdf,.csv,.txt" onChange={e => { setDatei(e.target.files?.[0] ?? null); setV(null); }} style={{ color: C.inkDim }} /></Feld>
      {!datei && <Feld label="…oder Text aus dem PDF einfügen"><textarea rows={3} value={text} onChange={e => { setText(e.target.value); setV(null); }} placeholder="Beschreibung 01.09.2026 -12,34€" style={{ ...feld, resize: 'vertical' }} /></Feld>}
      {stand && <div style={{ color: LEUCHT.achtung }}>{stand}</div>}
      {!v && !stand && <div style={{ fontSize: 12.5, color: C.inkLeise }}>Bereits vorhandene Buchungen werden erkannt und nicht doppelt angelegt. Zuerst wird nur geprüft — geschrieben wird erst nach „übernehmen“.</div>}
      {v && (
        <div style={{ display: 'grid', gap: 6, fontSize: 13.5, fontVariantNumeric: 'tabular-nums' }}>
          <div>{v.gefunden} Buchungen gelesen{v.zeitraum ? ` (${datumDe(v.zeitraum.von)} bis ${datumDe(v.zeitraum.bis)})` : ''}.</div>
          <div><strong style={{ color: LEUCHT.gut }}>{v.neu} neu</strong> · {v.schonVorhanden} schon vorhanden · {v.zugeordnet} automatisch zugeordnet · {v.umbuchungen} als Umbuchung erkannt</div>
          {v.pruefung.stimmt === true && <div style={{ color: LEUCHT.gut }}>✓ Summen stimmen mit dem Auszug ({eur(v.pruefung.sollEin)} ein, {eur(v.pruefung.sollAus)} aus).</div>}
          {v.pruefung.stimmt === false && <div style={{ color: LEUCHT.kritisch }}>✕ Summen weichen ab: Auszug {eur(v.pruefung.sollEin)} / {eur(v.pruefung.sollAus)}, gelesen {eur(v.pruefung.ein)} / {eur(v.pruefung.aus)}. Bitte nicht blind übernehmen.</div>}
          {v.pruefung.stimmt === null && <div style={{ color: C.inkLeise }}>Keine Kontrollsummen in der Datei — gegenrechnen nicht möglich.</div>}
          {v.beispiele.length > 0 && <div style={{ marginTop: 6, color: C.inkDim }}>{v.beispiele.map((b, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{datumDe(b.datum)} · {b.empfaenger}</span><span>{eur(b.betrag)}</span></div>)}{v.neu > v.beispiele.length && <div>… und {v.neu - v.beispiele.length} weitere</div>}</div>}
        </div>
      )}
    </Dialog>
  );
}
