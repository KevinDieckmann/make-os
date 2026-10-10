'use client';

// ─── Unternehmen › Dokumente: Firmen-Akte (Soll-Liste je Rechtsform) und Vorlagen (10.10.) ────────────────────────────
// Kevin 10.10.: Pflichtdokumente „in MAKE OS verschlüsselt“ — Upload je Gesellschaft mit Prüf-/Ablaufdatum und Ampel. Die Soll-Liste rechnet
// lib/gesellschaften/schild/dokumente.ts (Pflicht/empfohlen, Norm, Aufbewahrung); die Datei geht in die vorhandene, verschlüsselte Ablage
// (POST /api/gesellschaften/unterlagen), hier steht nur ihre Kennung. Vorlagen → Entwurf je Gesellschaft (nichts verlässt das System).

import Link from 'next/link';
import { useState } from 'react';
import { FileText } from 'lucide-react';
import { FARBE as C, TYP, LEUCHT, SCHRIFT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Knopf, Hinweis, Leer, Chip, Pillen, Klappbar, ZeileAktionen, useRueckgaengig, eingabe, feld } from '../../ui';
import { ANNEHMEN } from '@/lib/dateien/regeln';
import { WEG } from '@/lib/wege';
import { DOK_QUELLEN, DOK_STATUS, type Dokument, type DokStatus, type DokQuelle } from '@/lib/gesellschaften/schild/typen';
import { DOK_GRUPPEN, DOK_ZUSTAND_TEXT, DOKUMENT_KATALOG, dokSchwere, katalogVon, type DokSoll } from '@/lib/gesellschaften/schild/dokumente';
import { VORLAGEN, VORLAGE_HINWEIS } from '@/lib/gesellschaften/schild/vorlagen';
import type { GesellschaftLage } from '@/lib/gesellschaften/schild/ampel';
import { Felder, Feldzeile } from '../teile';
import { unterlageHochladen, dateiLink, type SEintrag, type Schreiben } from './daten';
import { AMPEL_FARBE, SchildFuss, datum, klein } from './teile';

const ZUSTAND_FARBE = (z: DokSoll) => { const s = dokSchwere(z); return s === 'rot' ? AMPEL_FARBE.rot : s === 'gelb' ? AMPEL_FARBE.gelb : z.zustand === 'vorhanden' ? AMPEL_FARBE.gruen : C.inkDim; };
const aufbewahrung = (z: DokSoll) => (!z.aufbewahrenBis ? undefined : z.aufbewahrenBis === 'dauerhaft' ? 'aufbewahren: dauerhaft' : `aufbewahren bis ${datum(z.aufbewahrenBis)}`);

export function Dokumente({ lage, e, sw }: { lage: GesellschaftLage; e: SEintrag; sw: Schreiben }) {
  const [offen, setOffen] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<{ art: string; dok?: Dokument } | null>(null);
  const nachGruppe = DOK_GRUPPEN.map(g => ({ ...g, l: lage.dokumente.filter(d => d.katalog.gruppe === g.id) })).filter(g => g.l.length);
  const fehlend = lage.dokumente.filter(d => dokSchwere(d) === 'rot').length;
  return (
    <>
      {fehlend > 0 && <Hinweis art="kritisch" titel={`${fehlend} Pflichtdokument${fehlend === 1 ? '' : 'e'} fehlen oder sind abgelaufen`}>Unten rot markiert — erfassen, Datei ablegen oder mit Grund „nicht nötig“ vermerken.</Hinweis>}
      {form && <DokForm key={`${form.art}-${form.dok?.id ?? 'neu'}`} art={form.art} dok={form.dok} lage={lage} sw={sw} fertig={() => setForm(null)} />}
      {nachGruppe.map(g => (
        <Karte key={g.id}>
          <Klappbar id={`dok-${g.id}`} titel={g.label} zaehler={g.l.filter(d => dokSchwere(d) !== 'ok').length} offen={offen[g.id] ?? true} umschalten={() => setOffen(o => ({ ...o, [g.id]: !(o[g.id] ?? true) }))}>
            <Liste>{g.l.map(z => <DokZeile key={z.katalog.art} z={z} lage={lage} onBearbeiten={dok => setForm({ art: z.katalog.art, dok })} />)}</Liste>
          </Klappbar>
        </Karte>
      ))}
      <Karte>
        <Ueberschrift rechts={!form && <Knopf leise onClick={() => setForm({ art: 'sonstiges' })}>+ Unterlage</Knopf>}>Weitere Unterlagen</Ueberschrift>
        <div style={klein}>Steuerbescheide, wesentliche Verträge, Gesellschafterdarlehen und alles Übrige der Firmen-Akte — mit Fassung, Ablauf und Datei.</div>
        <Liste>{(e.dokumente ?? []).filter(d => !d.geloeschtAm && !lage.dokumente.some(z => z.katalog.art === d.art)).map(d => (
          <Zeile key={d.id} titel={d.titel || katalogVon(d.art)?.titel || 'Unterlage'} unter={[katalogVon(d.art)?.titel, d.fassungVom ? `vom ${datum(d.fassungVom)}` : undefined].filter(Boolean).join(' · ')} onClick={() => setForm({ art: d.art, dok: d })} />
        ))}</Liste>
      </Karte>
      <Vorlagen lage={lage} e={e} sw={sw} />
      <SchildFuss>Unterlagen liegen verschlüsselt in der Ablage des Haushalts; Aufbewahrung ab Ende des Kalenderjahres (§ 257 HGB, § 147 AO).</SchildFuss>
    </>
  );
}

function DokZeile({ z, lage, onBearbeiten }: { z: DokSoll; lage: GesellschaftLage; onBearbeiten: (d?: Dokument) => void }) {
  const unter = [z.katalog.norm, z.dok?.fassungVom ? `Fassung ${datum(z.dok.fassungVom)}` : undefined, z.dok?.gueltigBis ? `gültig bis ${datum(z.dok.gueltigBis)}` : undefined,
    z.pruefenAm && z.zustand === 'vorhanden' ? `prüfen ab ${datum(z.pruefenAm)}` : undefined, aufbewahrung(z)].filter(Boolean).join(' · ');
  return (
    <div style={{ display: 'grid', gap: 4, padding: '4px 0' }}>
      <Zeile umbrechen titel={<>{z.katalog.titel}{' '}<span style={{ color: z.stufe === 'pflicht' ? LEUCHT.achtung : C.inkLeise, fontSize: TYP.bedien, fontWeight: 600 }}>{z.stufe === 'pflicht' ? 'Pflicht' : 'empfohlen'}</span></>}
        unter={unter} onClick={() => onBearbeiten(z.dok)}
        rechts={<Chip farbe={ZUSTAND_FARBE(z)}>{DOK_ZUSTAND_TEXT[z.zustand]}</Chip>} />
      {(z.grund || z.ausRegister || (z.dok?.dateiIds?.length ?? 0) > 0) && (
        <div style={{ ...klein, paddingLeft: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {z.grund && <span>{z.grund}</span>}
          {z.ausRegister && <Link href={WEG.unternehmen(lage.id, z.katalog.art === 'beschluesse' ? 'organe' : 'vertraege')} style={{ color: C.ink }}>im Register ansehen ›</Link>}
          {z.dok?.dateiIds?.map((d, i) => <a key={d} href={dateiLink(d)} style={{ color: C.ink }}>Datei {i + 1} herunterladen</a>)}
        </div>
      )}
    </div>
  );
}

/** Erfassen/Ändern eines Dokuments: Status, Fassung, Ablauf, Geschäftsjahr, Quelle, Datei (verschlüsselte Ablage), Notiz. */
function DokForm({ art, dok, lage, sw, fertig }: { art: string; dok?: Dokument; lage: GesellschaftLage; sw: Schreiben; fertig: () => void }) {
  const kat = katalogVon(art);
  const [w, setW] = useState({ art, titel: dok?.titel ?? '', status: (dok?.status ?? 'vorhanden') as DokStatus, fassungVom: dok?.fassungVom ?? '', gueltigBis: dok?.gueltigBis ?? '', geschaeftsjahr: dok?.geschaeftsjahr ? String(dok.geschaeftsjahr) : '', quelle: (dok?.quelle ?? '') as DokQuelle | '', notiz: dok?.notiz ?? '', grund: dok?.grund ?? '' });
  const [dateiIds, setDateiIds] = useState<string[]>(dok?.dateiIds ?? []);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laed, setLaed] = useState(false);
  const { melden, hinweis } = useRueckgaengig();
  const setze = (k: keyof typeof w, v: string) => setW(x => ({ ...x, [k]: v }));
  const speichern = async () => {
    setFehler(null);
    const eintrag = { art: w.art, titel: w.titel || null, status: w.status, fassungVom: w.fassungVom || null, gueltigBis: w.gueltigBis || null, geschaeftsjahr: w.geschaeftsjahr || null, quelle: w.quelle || null, notiz: w.notiz || null, grund: w.grund || null, dateiIds };
    const r = await sw.schreibe({ liste: 'dokumente', eintrag, ...(dok ? { eintragId: dok.id } : {}) });
    if (r.ok) fertig(); else setFehler(r.fehler ?? 'Nicht gespeichert.');
  };
  const hoch = async (f: File) => { setLaed(true); const r = await unterlageHochladen(lage.id, f, w.titel || kat?.titel); setLaed(false); if (r.eintrag) setDateiIds(l => [...l, r.eintrag!.id]); else setFehler(r.fehler ?? 'Nicht hochgeladen.'); };
  const loeschen = async () => { if (!dok) return; const r = await sw.schreibe({ liste: 'dokumente', eintragId: dok.id, aktion: 'loeschen' }); if (r.ok) { melden('Dokument im Papierkorb', () => void sw.schreibe({ liste: 'dokumente', eintragId: dok.id, aktion: 'wiederherstellen' })); fertig(); } };
  const arten = DOKUMENT_KATALOG.filter(k => k.gilt(lage.kontext) || k.art === art);
  return (
    <Karte>
      <Ueberschrift rechts={<Knopf leise onClick={fertig}>Schließen</Knopf>}>{dok ? 'Dokument bearbeiten' : 'Dokument erfassen'}</Ueberschrift>
      {kat && <div style={{ ...klein, marginBottom: 10 }}>{kat.hinweis} ({kat.norm})</div>}
      <form onSubmit={x => { x.preventDefault(); void speichern(); }} style={{ display: 'grid', gap: 12 }}>
        {!dok && art === 'sonstiges' && (
          <Feldzeile label="Art">
            <select value={w.art} onChange={x => setze('art', x.target.value)} aria-label="Art des Dokuments" style={{ ...feld, width: '100%' }}>{arten.map(k => <option key={k.art} value={k.art}>{k.titel}</option>)}</select>
          </Feldzeile>
        )}
        <Feldzeile label="Status"><Pillen liste={DOK_STATUS.map(s => ({ id: s.id, label: s.label }))} aktiv={w.status} onWahl={(s: DokStatus) => setze('status', s)} /></Feldzeile>
        {w.status === 'nicht-noetig' && <Feldzeile label="Warum nicht nötig?"><input value={w.grund} onChange={x => setze('grund', x.target.value)} aria-label="Grund" style={eingabe} /></Feldzeile>}
        <Felder>
          <Feldzeile label="Titel (optional)"><input value={w.titel} onChange={x => setze('titel', x.target.value)} aria-label="Titel" placeholder={kat?.titel} style={eingabe} /></Feldzeile>
          <Feldzeile label="Fassung vom / geprüft am"><input type="date" value={w.fassungVom} onChange={x => setze('fassungVom', x.target.value)} aria-label="Fassung vom" style={eingabe} /></Feldzeile>
          {kat?.ablauf && <Feldzeile label="Gültig bis"><input type="date" value={w.gueltigBis} onChange={x => setze('gueltigBis', x.target.value)} aria-label="Gültig bis" style={eingabe} /></Feldzeile>}
          {kat?.jeGeschaeftsjahr && <Feldzeile label="Geschäftsjahr (Jahr des Stichtags)"><input inputMode="numeric" value={w.geschaeftsjahr} onChange={x => setze('geschaeftsjahr', x.target.value.replace(/\D/g, '').slice(0, 4))} aria-label="Geschäftsjahr" placeholder="z. B. 2025" style={eingabe} /></Feldzeile>}
          <Feldzeile label="Quelle">
            <select value={w.quelle} onChange={x => setze('quelle', x.target.value)} aria-label="Quelle" style={{ ...feld, width: '100%' }}><option value="">—</option>{DOK_QUELLEN.map(q => <option key={q.id} value={q.id}>{q.label}</option>)}</select>
          </Feldzeile>
        </Felder>
        <Feldzeile label="Notiz"><input value={w.notiz} onChange={x => setze('notiz', x.target.value)} aria-label="Notiz" style={eingabe} /></Feldzeile>
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim }}>Dateien (verschlüsselte Ablage)</span>
          {dateiIds.length ? <Liste>{dateiIds.map((d, i) => <Zeile key={d} titel={`Datei ${i + 1}`} rechts={<span style={{ display: 'inline-flex', gap: 8 }}><a href={dateiLink(d)} style={{ color: C.ink, fontSize: TYP.bedien }}>herunterladen</a><Knopf leise onClick={() => setDateiIds(l => l.filter(x => x !== d))}>lösen</Knopf></span>} />)}</Liste> : <Leer symbol={<FileText size={16} />}>Noch keine Datei.</Leer>}
          <label className="fassbar" style={{ ...klein, color: C.ink, cursor: 'pointer', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
            {laed ? 'lädt hoch …' : '+ Datei ablegen (PDF, PNG, JPG, DOCX)'}
            <input type="file" accept={ANNEHMEN} aria-label="Datei ablegen" style={{ display: 'none' }} onChange={x => { const f = x.target.files?.[0]; x.target.value = ''; if (f) void hoch(f); }} />
          </label>
        </div>
        {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Knopf typ="submit" aus={laed}>Speichern</Knopf>
          {dok && <Knopf leise onClick={() => void loeschen()}>In den Papierkorb</Knopf>}
        </div>
      </form>
      {hinweis}
    </Karte>
  );
}

function Vorlagen({ lage, e, sw }: { lage: GesellschaftLage; e: SEintrag; sw: Schreiben }) {
  const { melden, hinweis } = useRueckgaengig();
  const [offen, setOffen] = useState<string | null>(null);
  const passend = VORLAGEN.filter(v => !v.nurKapital || lage.kontext.kapital);
  const entwuerfe = (e.entwuerfe ?? []).filter(x => !x.geloeschtAm).sort((a, b) => b.am.localeCompare(a.am));
  const anlegen = async (id: string) => { const r = await sw.schreibe({ vorlage: id }); if (r.ok && typeof r.extra?.entwurfId === 'string') setOffen(r.extra.entwurfId); };
  const weg = async (id: string) => { const r = await sw.schreibe({ liste: 'entwuerfe', eintragId: id, aktion: 'loeschen' }); if (r.ok) melden('Entwurf im Papierkorb', () => void sw.schreibe({ liste: 'entwuerfe', eintragId: id, aktion: 'wiederherstellen' })); };
  const aktiv = entwuerfe.find(x => x.id === offen);
  return (
    <Karte>
      <Ueberschrift>Vorlagen</Ueberschrift>
      <div style={{ ...klein, marginBottom: 8 }}>{VORLAGE_HINWEIS} Gefüllt wird nur, was im Steckbrief steht; der Rest bleibt „[…]“. Nichts verlässt das System.</div>
      <Liste>{passend.map(v => <Zeile key={v.id} umbrechen titel={v.titel} unter={`${v.wofuer} (${v.norm})`} rechts={<Knopf leise onClick={() => void anlegen(v.id)}>Entwurf</Knopf>} />)}</Liste>
      {entwuerfe.length > 0 && (
        <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
          <span style={{ fontSize: TYP.bedien, fontWeight: 700, color: C.inkDim }}>Entwürfe dieser Gesellschaft</span>
          <Liste>{entwuerfe.map(x => (
            <ZeileAktionen key={x.id} titel={x.titel} onLoeschen={() => weg(x.id)}>
              <Zeile titel={x.titel} unter={`angelegt ${datum(x.am.slice(0, 10))}${x.geaendert ? ` · geändert ${datum(x.geaendert.slice(0, 10))}` : ''}`} onClick={() => setOffen(o => (o === x.id ? null : x.id))} aktiv={offen === x.id} />
            </ZeileAktionen>
          ))}</Liste>
        </div>
      )}
      {aktiv && <EntwurfEditor key={aktiv.id} id={aktiv.id} text={aktiv.text} sw={sw} />}
      {hinweis}
    </Karte>
  );
}

function EntwurfEditor({ id, text, sw }: { id: string; text: string; sw: Schreiben }) {
  const [t, setT] = useState(text);
  const [kopiert, setKopiert] = useState(false);
  const speichern = () => { if (t !== text) void sw.schreibe({ liste: 'entwuerfe', eintragId: id, eintrag: { text: t } }); };
  const kopieren = async () => { try { await navigator.clipboard.writeText(t); setKopiert(true); setTimeout(() => setKopiert(false), 2000); } catch { /* ohne Zwischenablage bleibt Markieren */ } };
  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
      <textarea value={t} onChange={x => setT(x.target.value)} onBlur={speichern} aria-label="Entwurf" rows={18} style={{ ...feld, fontFamily: SCHRIFT.mono, lineHeight: 1.5, resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Knopf leise onClick={() => void kopieren()}>{kopiert ? 'Kopiert ✓' : 'Text kopieren'}</Knopf>
        <span style={klein}>Speichert beim Verlassen des Feldes.</span>
      </div>
    </div>
  );
}
