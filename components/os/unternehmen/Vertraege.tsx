'use client';

// ─── Unternehmen › Beteiligungen · Verträge · Unterlagen (04.10.) ──────────────────────────────────────────────
// Beteiligungen: „hält“ an eigenen Gesellschaften ist ABGELEITET (aus deren Gesellschafter-Einträgen, nichts doppelt);
// gespeichert werden nur Beteiligungen an fremden Firmen (CRM-Firma, Anteil, Erwerb). Verträge: Art, Parteien, Status,
// Laufzeit, Kündigungsfrist + „kündigen bis“, Stichtage (Option, Cliff …) — alle Stichtage erscheinen im Kalender
// (Fristen-Ebene, lib/kalender/fristen-server.ts). Unterlagen: die bestehende Dateiablage mit Bezug auf die Gesellschaft.
// Archiv = beendet, Löschen = Papierkorb 30 Tage (ZeileAktionen, Rückgängig 10 s).

import { useCallback, useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Knopf, Hinweis, Leer, Pillen, Chip, LEUCHT, ZeileAktionen, useRueckgaengig, useRueckfrage, feld } from '../ui';
import { neueKennung } from '@/lib/kennung';
import { gesellschaftenGeaendert } from '@/lib/gesellschaften/client';
import { haelt, centAus, ERINNERUNG_VORGABE_TAGE, VERTRAG_ARTEN, VERTRAG_STATUS, vertragArtLabel, vertragStatusLabel, type Bezug, type FremdBeteiligung, type Vertrag, type VertragArt, type VertragStatus, type VertragFrist } from '@/lib/gesellschaften/modell';
import type { DateiEintrag } from '@/lib/dateien/regeln';
import { ANNEHMEN } from '@/lib/dateien/regeln';
import { BezugWahl, Auswahl, Felder, Feldzeile, bezugName, centEingabe, centText, klein, tagText, type GAnzeige, type RegisterDaten, type useSchreiber } from './teile';
import { Papierkorb } from './Gesellschafter';

type Schreibe = ReturnType<typeof useSchreiber>['schreibe'];
type Was = 'archivieren' | 'zurueckholen' | 'loeschen' | 'wiederherstellen' | 'endgueltig';
const STATUS_FARBE: Record<VertragStatus, string> = { entwurf: C.inkDim, verhandlung: LEUCHT.achtung, unterschrieben: LEUCHT.gut, beurkundet: LEUCHT.gut, beendet: C.inkLeise };

// ── Beteiligungen ──────────────────────────────────────────────────────────────────────────────────────────────

export function BeteiligungenReiter({ g, daten, schreibe, oeffne }: { g: GAnzeige; daten: RegisterDaten; schreibe: Schreibe; oeffne: (id: string) => void }) {
  const { melden, hinweis } = useRueckgaengig();
  const { fragen, dialog } = useRueckfrage();
  const [form, setForm] = useState<FremdBeteiligung | 'neu' | null>(null);
  const eigen = haelt(g.id, daten.gesellschaften);
  const alle = g.beteiligungen ?? [];
  const laufend = alle.filter(b => !b.geloeschtAm && !b.beendetAm);
  const beendet = alle.filter(b => !b.geloeschtAm && b.beendetAm);
  const korb = alle.filter(b => b.geloeschtAm);
  const firma = (id: string) => bezugName({ art: 'firma', id }, daten.namen);
  const aktion = async (b: FremdBeteiligung, was: Was) => (await schreibe({ liste: 'beteiligungen', eintragId: b.id, aktion: was })).ok;
  const unter = (b: FremdBeteiligung) => [b.anteilProzent !== undefined ? `${b.anteilProzent.toLocaleString('de-DE')} %` : undefined, b.nennbetragCent !== undefined ? `Nennbetrag ${centText(b.nennbetragCent)}` : undefined, b.erwerbAm ? `seit ${tagText(b.erwerbAm)}` : undefined, b.preisCent !== undefined ? `Preis ${centText(b.preisCent)}` : undefined].filter(Boolean).join(' · ') || 'ohne Angaben';
  return (
    <>
      <Karte>
        <Ueberschrift>Hält an eigenen Gesellschaften</Ueberschrift>
        {!eigen.length ? <Leer>Keine — eingetragen wird das bei der gehaltenen Gesellschaft unter „Gesellschafter“.</Leer> : (
          <Liste>{eigen.map(h => { const x = daten.gesellschaften.find(y => y.id === h.an); return <Zeile key={h.an} titel={x?.name ?? 'Gesellschaft'} unter={`Nennbetrag ${centText(h.nennbetragCent)}`} onClick={() => oeffne(h.an)} rechts={<span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{h.prozent.toLocaleString('de-DE', { maximumFractionDigits: 2 })} %</span>} />; })}</Liste>
        )}
        <div style={{ ...klein, marginTop: 8 }}>Abgeleitet aus den Gesellschafter-Einträgen — eine Quelle, nichts doppelt.</div>
      </Karte>
      <Karte>
        <Ueberschrift rechts={!form && <Knopf leise onClick={() => setForm('neu')}>+ Beteiligung</Knopf>}>An fremden Firmen</Ueberschrift>
        {!laufend.length ? <Leer aktion={!form ? <Knopf leise onClick={() => setForm('neu')}>Beteiligung eintragen</Knopf> : undefined}>Keine Beteiligung an einer Firma außerhalb des Registers.</Leer> : (
          <Liste>{laufend.map(b => (
            <ZeileAktionen key={b.id} titel={firma(b.firmaId)} onArchivieren={async () => { if (await aktion(b, 'archivieren')) melden(`„${firma(b.firmaId)}“ als beendet markiert`, () => void aktion(b, 'zurueckholen')); }} onLoeschen={async () => { if (await aktion(b, 'loeschen')) melden(`„${firma(b.firmaId)}“ im Papierkorb`, () => void aktion(b, 'wiederherstellen')); }}>
              <Zeile titel={firma(b.firmaId)} unter={unter(b)} onClick={() => setForm(b)} />
            </ZeileAktionen>
          ))}</Liste>
        )}
      </Karte>
      {form && <BeteiligungForm key={form === 'neu' ? 'neu' : form.id} daten={daten} alt={form === 'neu' ? undefined : form} schreibe={schreibe} fertig={() => setForm(null)} />}
      {beendet.length > 0 && (
        <Karte flach><Ueberschrift>Beendet</Ueberschrift>
          <Liste>{beendet.map(b => <ZeileAktionen key={b.id} titel={firma(b.firmaId)} archiviert onArchivieren={() => void aktion(b, 'zurueckholen')} onLoeschen={() => void aktion(b, 'loeschen')}><Zeile titel={firma(b.firmaId)} unter={`${unter(b)} · beendet am ${tagText(b.beendetAm)}`} /></ZeileAktionen>)}</Liste>
        </Karte>
      )}
      {korb.length > 0 && <Papierkorb eintraege={korb.map(b => ({ id: b.id, titel: firma(b.firmaId), geloeschtAm: b.geloeschtAm! }))} wiederherstellen={id => void aktion(korb.find(b => b.id === id)!, 'wiederherstellen')}
        endgueltig={id => { const b = korb.find(x => x.id === id)!; fragen({ titel: `„${firma(b.firmaId)}“ endgültig löschen?`, text: 'Das lässt sich nicht rückgängig machen.', wahl: [{ label: 'Endgültig löschen', ton: 'gefahr', tun: () => aktion(b, 'endgueltig') }] }); }} />}
      {dialog}
      {hinweis}
    </>
  );
}

function BeteiligungForm({ daten, alt, schreibe, fertig }: { daten: RegisterDaten; alt?: FremdBeteiligung; schreibe: Schreibe; fertig: () => void }) {
  const [firma, setFirma] = useState<Bezug | null>(alt ? { art: 'firma', id: alt.firmaId } : null);
  const [anteil, setAnteil] = useState(alt?.anteilProzent !== undefined ? String(alt.anteilProzent).replace('.', ',') : '');
  const [nennbetrag, setNennbetrag] = useState(centEingabe(alt?.nennbetragCent));
  const [erwerbAm, setErwerbAm] = useState(alt?.erwerbAm ?? '');
  const [preis, setPreis] = useState(centEingabe(alt?.preisCent));
  const [notiz, setNotiz] = useState(alt?.notiz ?? '');
  const [fehler, setFehler] = useState<string | null>(null);
  const speichern = async () => {
    if (!firma) { setFehler('Bitte eine Firma aus dem CRM wählen.'); return; }
    const r = await schreibe({ liste: 'beteiligungen', eintrag: { firmaId: firma.id, anteilProzent: anteil || null, nennbetragCent: nennbetrag || null, erwerbAm: erwerbAm || null, preisCent: preis || null, notiz }, ...(alt ? { eintragId: alt.id } : {}) });
    if (r.ok) fertig(); else setFehler(r.fehler ?? 'Nicht gespeichert.');
  };
  return (
    <Karte>
      <Ueberschrift>{alt ? 'Beteiligung ändern' : 'Beteiligung eintragen'}</Ueberschrift>
      <form onSubmit={e => { e.preventDefault(); void speichern(); }} style={{ display: 'grid', gap: 14 }}>
        <Feldzeile label="Firma (CRM)"><BezugWahl daten={daten} wert={firma} arten={['firma']} onWahl={b => setFirma(b)} /></Feldzeile>
        <Felder>
          <Feldzeile label="Anteil (%)"><input value={anteil} onChange={e => setAnteil(e.target.value)} inputMode="decimal" aria-label="Anteil in Prozent" style={feld} /></Feldzeile>
          <Feldzeile label="Nennbetrag (€)"><input value={nennbetrag} onChange={e => setNennbetrag(e.target.value)} inputMode="decimal" aria-label="Nennbetrag in Euro" style={feld} /></Feldzeile>
          <Feldzeile label="Erworben am"><input type="date" value={erwerbAm} onChange={e => setErwerbAm(e.target.value)} aria-label="Erworben am" style={feld} /></Feldzeile>
          <Feldzeile label="Kaufpreis (€, optional)" fehler={preis && centAus(preis) === 'fehler' ? 'Betrag nicht lesbar.' : undefined}><input value={preis} onChange={e => setPreis(e.target.value)} inputMode="decimal" aria-label="Kaufpreis in Euro" style={feld} /></Feldzeile>
        </Felder>
        <Feldzeile label="Notiz"><textarea value={notiz} onChange={e => setNotiz(e.target.value)} aria-label="Notiz" rows={3} style={{ ...feld, resize: 'vertical', lineHeight: 1.5 }} /></Feldzeile>
        {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Knopf typ="submit" aus={!firma}>{alt ? 'Speichern' : 'Eintragen'}</Knopf><Knopf leise onClick={fertig}>Abbrechen</Knopf></div>
      </form>
    </Karte>
  );
}

// ── Unterlagen (Dateiablage) ───────────────────────────────────────────────────────────────────────────────────

function useUnterlagen(id: string) {
  const [liste, setListe] = useState<DateiEintrag[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const laden = useCallback(async () => {
    const d = await fetch(`/api/gesellschaften/unterlagen?id=${encodeURIComponent(id)}`, { cache: 'no-store' }).then(r => r.json()).catch(() => null);
    if (d?.ok) { setListe(d.eintraege); setFehler(null); } else setFehler(d?.fehler ?? 'Ablage nicht erreichbar.');
  }, [id]);
  useEffect(() => { void laden(); }, [laden]);
  const hochladen = async (datei: File, art: 'vertrag' | 'sonstig', titel?: string): Promise<DateiEintrag | null> => {
    const f = new FormData();
    f.set('id', id); f.set('datei', datei); f.set('art', art); if (titel) f.set('titel', titel);
    const r = await fetch('/api/gesellschaften/unterlagen', { method: 'POST', body: f }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung — nicht hochgeladen.' }));
    if (!r.ok) { setFehler(r.fehler ?? 'Nicht hochgeladen.'); return null; }
    await laden();
    return r.eintrag as DateiEintrag;
  };
  return { liste, fehler, hochladen };
}

const dateiLink = (e: DateiEintrag) => `/api/crm/dateien?id=${encodeURIComponent(e.id)}`;

export function UnterlagenReiter({ g }: { g: GAnzeige }) {
  const u = useUnterlagen(g.id);
  return (
    <Karte>
      <Ueberschrift rechts={<label className="ui-knopf fassbar" style={{ cursor: 'pointer', border: `1px solid ${C.linie}`, borderRadius: 14, padding: '0 14px', display: 'inline-flex', alignItems: 'center', fontSize: TYP.bedien, color: C.ink }}>
        + Unterlage<input type="file" accept={ANNEHMEN} aria-label="Unterlage hochladen" onChange={e => { const d = e.target.files?.[0]; if (d) void u.hochladen(d, 'sonstig'); e.target.value = ''; }} style={{ display: 'none' }} />
      </label>}>Unterlagen</Ueberschrift>
      {u.fehler && <Hinweis art="kritisch" rolle="alert">{u.fehler}</Hinweis>}
      {u.liste === null ? <Leer>lädt …</Leer> : !u.liste.length ? <Leer symbol={<FileText size={16} />}>Noch keine Unterlage — z. B. Gesellschaftsvertrag, Handelsregisterauszug, Gesellschafterliste (PDF, PNG, JPG, DOCX bis 15 MB).</Leer> : (
        <Liste>{u.liste.map(e => (
          <a key={e.id} href={dateiLink(e)} style={{ textDecoration: 'none', color: 'inherit' }}>
            <Zeile titel={e.titel || e.datei?.name || 'Unterlage'} unter={[e.art === 'vertrag' ? 'Vertrag' : e.id === g.logoDateiId ? 'Logo' : 'Unterlage', tagText(e.hochgeladenAm.slice(0, 10)), e.datei?.name].filter(Boolean).join(' · ')} rechts={<span style={klein}>herunterladen ›</span>} />
          </a>
        ))}</Liste>
      )}
      <div style={{ ...klein, marginTop: 8 }}>Verschlüsselt in der Dateiablage des Haushalts. Löschen von Unterlagen kommt mit dem Papierkorb der Ablage.</div>
    </Karte>
  );
}

// ── Verträge ───────────────────────────────────────────────────────────────────────────────────────────────────

export function VertraegeReiter({ g, daten, schreibe }: { g: GAnzeige; daten: RegisterDaten; schreibe: Schreibe }) {
  const { melden, hinweis } = useRueckgaengig();
  const { fragen, dialog } = useRueckfrage();
  const [form, setForm] = useState<Vertrag | 'neu' | null>(null);
  const alle = g.vertraege ?? [];
  const laufend = alle.filter(v => !v.geloeschtAm && v.status !== 'beendet').sort((a, b) => (a.kuendigenBis ?? a.ende ?? '9').localeCompare(b.kuendigenBis ?? b.ende ?? '9'));
  const beendet = alle.filter(v => !v.geloeschtAm && v.status === 'beendet');
  const korb = alle.filter(v => v.geloeschtAm);
  const aktion = async (v: Vertrag, was: Was) => (await schreibe({ liste: 'vertraege', eintragId: v.id, aktion: was })).ok;
  const unter = (v: Vertrag) => [vertragArtLabel(v.art), v.parteien.length ? v.parteien.map(p => bezugName(p, daten.namen)).join(', ') : undefined,
    v.beginn || v.ende ? `${v.beginn ? tagText(v.beginn) : '…'} – ${v.ende ? tagText(v.ende) : 'unbefristet'}` : undefined,
    v.kuendigenBis ? `kündigen bis ${tagText(v.kuendigenBis)}` : undefined, v.dateiIds?.length ? `${v.dateiIds.length} Unterlage${v.dateiIds.length === 1 ? '' : 'n'}` : undefined].filter(Boolean).join(' · ');
  return (
    <>
      <Karte>
        <Ueberschrift rechts={!form && <Knopf leise onClick={() => setForm('neu')}>+ Vertrag</Knopf>}>Verträge</Ueberschrift>
        {!laufend.length ? <Leer symbol={<FileText size={16} />} aktion={!form ? <Knopf leise onClick={() => setForm('neu')}>Vertrag eintragen</Knopf> : undefined}>Noch kein Vertrag — Gesellschaftsvertrag, Geschäftsführervertrag, Darlehen …</Leer> : (
          <Liste>{laufend.map(v => (
            <ZeileAktionen key={v.id} titel={v.titel} onArchivieren={async () => { if (await aktion(v, 'archivieren')) melden(`„${v.titel}“ als beendet markiert`, () => void aktion(v, 'zurueckholen')); }} onLoeschen={async () => { if (await aktion(v, 'loeschen')) melden(`„${v.titel}“ im Papierkorb`, () => void aktion(v, 'wiederherstellen')); }}>
              <Zeile titel={v.titel} unter={unter(v)} onClick={() => setForm(v)} rechts={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Chip farbe={STATUS_FARBE[v.status]}>{vertragStatusLabel(v.status)}</Chip><span aria-hidden style={{ color: C.inkLeise }}>›</span></span>} />
            </ZeileAktionen>
          ))}</Liste>
        )}
        <div style={{ ...klein, marginTop: 8 }}>Beginn, Ende, „kündigen bis“ und jeder Stichtag stehen automatisch im Kalender (Ebene Fristen). Vor „kündigen bis“ kommt rechtzeitig eine Erinnerung in die Glocke und als Aufgabe.</div>
      </Karte>
      {form && <VertragForm key={form === 'neu' ? 'neu' : form.id} g={g} daten={daten} alt={form === 'neu' ? undefined : form} schreibe={schreibe} fertig={() => setForm(null)} />}
      {beendet.length > 0 && (
        <Karte flach><Ueberschrift>Beendet</Ueberschrift>
          <Liste>{beendet.map(v => <ZeileAktionen key={v.id} titel={v.titel} archiviert onArchivieren={() => void aktion(v, 'zurueckholen')} onLoeschen={() => void aktion(v, 'loeschen')}><Zeile titel={v.titel} unter={unter(v)} onClick={() => setForm(v)} /></ZeileAktionen>)}</Liste>
        </Karte>
      )}
      {korb.length > 0 && <Papierkorb eintraege={korb.map(v => ({ id: v.id, titel: v.titel, geloeschtAm: v.geloeschtAm! }))} wiederherstellen={id => void aktion(korb.find(v => v.id === id)!, 'wiederherstellen')}
        endgueltig={id => { const v = korb.find(x => x.id === id)!; fragen({ titel: `„${v.titel}“ endgültig löschen?`, text: 'Die Angaben zum Vertrag verschwinden; Unterlagen in der Ablage bleiben. Das lässt sich nicht rückgängig machen.', wahl: [{ label: 'Endgültig löschen', ton: 'gefahr', tun: () => aktion(v, 'endgueltig') }] }); }} />}
      {dialog}
      {hinweis}
    </>
  );
}

function VertragForm({ g, daten, alt, schreibe, fertig }: { g: GAnzeige; daten: RegisterDaten; alt?: Vertrag; schreibe: Schreibe; fertig: () => void }) {
  const [art, setArt] = useState<VertragArt>(alt?.art ?? 'gesellschaftsvertrag');
  const [titel, setTitel] = useState(alt?.titel ?? '');
  const [status, setStatus] = useState<VertragStatus>(alt?.status ?? 'entwurf');
  const [parteien, setParteien] = useState<Bezug[]>(alt?.parteien ?? [{ art: 'gesellschaft', id: g.id }]);
  const [beginn, setBeginn] = useState(alt?.beginn ?? '');
  const [ende, setEnde] = useState(alt?.ende ?? '');
  const [kuendigungsfrist, setKuendigungsfrist] = useState(alt?.kuendigungsfrist ?? '');
  const [kuendigenBis, setKuendigenBis] = useState(alt?.kuendigenBis ?? '');
  const [erinnerung, setErinnerung] = useState(String(alt?.erinnerungTage ?? ERINNERUNG_VORGABE_TAGE));
  const [fristen, setFristen] = useState<VertragFrist[]>(alt?.fristen ?? []);
  const [dateiIds, setDateiIds] = useState<string[]>(alt?.dateiIds ?? []);
  const [notiz, setNotiz] = useState(alt?.notiz ?? '');
  const [neuePartei, setNeuePartei] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  // Namen neu gewählter Parteien (CRM-Treffer), bis der Server sie beim nächsten Laden mitliefert.
  const [extraNamen, setExtraNamen] = useState<Record<string, string>>({});
  const namen = { ...daten.namen, ...extraNamen };
  const u = useUnterlagen(g.id);
  const speichern = async () => {
    setFehler(null);
    const eintrag = { art, titel: titel || vertragArtLabel(art), status, parteien, beginn: beginn || null, ende: ende || null, kuendigungsfrist, kuendigenBis: kuendigenBis || null, erinnerungTage: erinnerung === '' ? null : Number(erinnerung), fristen, dateiIds, notiz };
    const r = await schreibe({ liste: 'vertraege', eintrag, ...(alt ? { eintragId: alt.id } : {}) });
    if (r.ok) { gesellschaftenGeaendert(); fertig(); } else setFehler(r.fehler ?? 'Nicht gespeichert.');
  };
  return (
    <Karte>
      <Ueberschrift>{alt ? 'Vertrag ändern' : 'Vertrag eintragen'}</Ueberschrift>
      <form onSubmit={e => { e.preventDefault(); void speichern(); }} style={{ display: 'grid', gap: 14 }}>
        <Felder>
          <Feldzeile label="Art"><Auswahl label="Art des Vertrags" wert={art} liste={VERTRAG_ARTEN} onWahl={v => { if (v) setArt(v); }} /></Feldzeile>
          <Feldzeile label="Titel"><input value={titel} onChange={e => setTitel(e.target.value)} placeholder={vertragArtLabel(art)} aria-label="Titel" style={feld} /></Feldzeile>
          <Feldzeile label="Beginn"><input type="date" value={beginn} onChange={e => setBeginn(e.target.value)} aria-label="Beginn" style={feld} /></Feldzeile>
          <Feldzeile label="Laufzeit bis"><input type="date" value={ende} onChange={e => setEnde(e.target.value)} aria-label="Laufzeit bis" style={feld} /></Feldzeile>
          <Feldzeile label="Kündigungsfrist"><input value={kuendigungsfrist} onChange={e => setKuendigungsfrist(e.target.value)} placeholder="z. B. 6 Monate zum Jahresende" aria-label="Kündigungsfrist" style={feld} /></Feldzeile>
          <Feldzeile label="Kündigen bis"><input type="date" value={kuendigenBis} onChange={e => setKuendigenBis(e.target.value)} aria-label="Kündigen bis" style={feld} /></Feldzeile>
          {kuendigenBis && <Feldzeile label="Erinnerung (Tage vorher, 0 = keine)"><input value={erinnerung} onChange={e => setErinnerung(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" aria-label="Erinnerung Tage vorher" style={feld} /></Feldzeile>}
        </Felder>
        <Feldzeile label="Status"><Pillen liste={VERTRAG_STATUS.map(s => ({ id: s.id, label: s.label }))} aktiv={status} onWahl={setStatus} /></Feldzeile>
        <div style={{ display: 'grid', gap: 8 }}>
          <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim }}>Parteien</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {parteien.map(p => <Knopf key={`${p.art}:${p.id}`} leise ariaLabel={`Partei ${bezugName(p, namen)} entfernen`} onClick={() => setParteien(l => l.filter(x => !(x.art === p.art && x.id === p.id)))}>{bezugName(p, namen)} ×</Knopf>)}
            {!neuePartei && <Knopf leise onClick={() => setNeuePartei(true)}>+ Partei</Knopf>}
          </div>
          {neuePartei && <BezugWahl daten={daten} wert={null} onWahl={(b, name) => { setExtraNamen(n => ({ ...n, [`${b.art}:${b.id}`]: name })); setParteien(l => (l.some(x => x.art === b.art && x.id === b.id) ? l : [...l, b])); setNeuePartei(false); }} />}
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim }}>Weitere Stichtage (Option, Cliff, Zinstermin …)</span>
          {fristen.map((f, i) => (
            <div key={f.id} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="date" value={f.datum} aria-label="Datum des Stichtags" onChange={e => setFristen(l => l.map((x, j) => (j === i ? { ...x, datum: e.target.value } : x)))} style={{ ...feld, width: 'auto', flex: '0 1 180px' }} />
              <input value={f.text} aria-label="Was ist an dem Tag?" placeholder="z. B. Option ziehen" onChange={e => setFristen(l => l.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} style={{ ...feld, width: 'auto', flex: '1 1 200px' }} />
              <Knopf leise ariaLabel="Stichtag entfernen" onClick={() => setFristen(l => l.filter((_, j) => j !== i))}>×</Knopf>
            </div>
          ))}
          <div><Knopf leise onClick={() => setFristen(l => [...l, { id: neueKennung('f'), datum: '', text: '' }])}>+ Stichtag</Knopf></div>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim }}>Unterlagen</span>
          {(u.liste ?? []).map(e => (
            <label key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44, fontSize: TYP.body, color: C.ink, cursor: 'pointer' }}>
              <input type="checkbox" checked={dateiIds.includes(e.id)} onChange={x => setDateiIds(l => (x.target.checked ? [...l, e.id] : l.filter(y => y !== e.id)))} style={{ width: 20, height: 20 }} />
              {e.titel || e.datei?.name || 'Unterlage'}
            </label>
          ))}
          <label style={{ fontSize: TYP.bedien, color: C.inkDim }}>
            Neue Datei an diesen Vertrag: <input type="file" accept={ANNEHMEN} aria-label="Vertragsdatei hochladen" onChange={async e => { const d = e.target.files?.[0]; e.target.value = ''; if (!d) return; const neu = await u.hochladen(d, 'vertrag', titel || vertragArtLabel(art)); if (neu) setDateiIds(l => [...l, neu.id]); }} />
          </label>
          {u.fehler && <Hinweis art="kritisch" rolle="alert">{u.fehler}</Hinweis>}
        </div>
        <Feldzeile label="Notiz"><textarea value={notiz} onChange={e => setNotiz(e.target.value)} aria-label="Notiz" rows={3} style={{ ...feld, resize: 'vertical', lineHeight: 1.5 }} /></Feldzeile>
        {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Knopf typ="submit">{alt ? 'Speichern' : 'Eintragen'}</Knopf><Knopf leise onClick={fertig}>Abbrechen</Knopf></div>
      </form>
    </Karte>
  );
}
