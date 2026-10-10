'use client';

// ─── Unternehmen › Beschlüsse & Satzung: das Beschluss-Buch (10.10.) ──────────────────────────────────────────────────────────────────
// Kevin 10.10.: „Unternehmen wird extrem spannend, wenn ich da alle Gesellschafterbeschlüsse, den Gegenstand und alles dazu gesammelt habe.“
// Je Gesellschaft chronologisch und fortlaufend nummeriert (Nummer vom Server), mit Art, Gremium, Beteiligten (Gesellschafter-/Organ-Einträge),
// Abstimmung, Wirkung, Status, Unterlagen, Verweisen und Änderungen an Gegenstand/Satzung; Filter und Suche, PDF des Buchs, Startvorlagen, „Aus
// Dokument übernehmen“ (Regelwerk ohne Modell, erst der Klick übernimmt) und die Folgen eines gefassten Beschlusses (Vorschläge im Stapel).
// Geschrieben wird NUR über das Register (PATCH /api/gesellschaften, eine Kette je Gesellschaft — `useSchreiber`). Regeln rein in
// lib/gesellschaften/beschluesse.ts. Hinweis, keine Rechtsberatung.

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { FileText, Gavel } from 'lucide-react';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Knopf, Hinweis, Leer, Leerzustand, Pillen, Segmente, Chip, Kennzahl, Raster, ZeileAktionen, useRueckgaengig, useRueckfrage, feld } from '../ui';
import { localDay } from '@/lib/zeit';
import { suchPasst } from '@/lib/text/such-norm';
import { WEG } from '@/lib/wege';
import { ANNEHMEN } from '@/lib/dateien/regeln';
import {
  BESCHLUSS_ARTEN, BESCHLUSS_STATUS, GREMIEN, SATZUNG_MERKMALE, STIMMEN, aktiveEintraege, centAus,
  type Beschluss, type BeschlussAenderung, type BeschlussArt, type BeschlussStatus, type BeschlussVerweis, type Gremium, type SatzungMerkmal, type Stimme, type Stimmabgabe,
} from '@/lib/gesellschaften/modell';
import {
  BESCHLUSS_HINWEIS, abstimmungsErgebnis, artLabel, beschlussNummern, beteiligtName, braucheEintragung, buchJahre, buchListe, gremiumLabel, gremiumVon,
  merkmalLabel, nummerText, statusLabelB, type BeschlussFolge,
} from '@/lib/gesellschaften/beschluesse';
import { BESCHLUSS_VORLAGEN, BESCHLUSS_VORLAGE_HINWEIS, beschlussAusVorlage } from '@/lib/gesellschaften/beschluss-vorlagen';
import type { ImportVorschlag, ImportFeld } from '@/lib/gesellschaften/beschluss-import';
import { Auswahl, Felder, Feldzeile, bezugName, centEingabe, klein, tagText, useSchreiber, type GAnzeige, type RegisterDaten } from './teile';
import { useUnterlagen } from './Vertraege';
import { Papierkorb } from './Gesellschafter';
import { SatzungAnsicht } from './Satzung';
import { GesellschaftWahl } from './schild/teile';

type Schreibe = ReturnType<typeof useSchreiber>['schreibe'];
type Was = 'archivieren' | 'zurueckholen' | 'loeschen' | 'wiederherstellen' | 'endgueltig';
export type BuchAnsicht = 'buch' | 'satzung';

/** Farbe = Zustand: gefasst, aber eintragungspflichtig und nicht eingetragen → prüfen (gelb). */
const statusFarbe = (b: Beschluss): string =>
  b.status === 'entwurf' || b.status === 'aufgehoben' ? C.inkLeise : b.status === 'eingetragen' ? LEUCHT.gut : braucheEintragung(b) ? LEUCHT.achtung : LEUCHT.gut;
const pdfWeg = (gid: string, jahr?: number) => `/api/gesellschaften/beschluesse?id=${encodeURIComponent(gid)}&pdf=1${jahr ? `&jahr=${jahr}` : ''}`;

/** Der Bereich „Beschlüsse & Satzung“ (Reiter der Seite Unternehmen): Gesellschaft wählen, Buch bzw. Gegenstand & Satzung. */
export function BeschluesseBereich({ g, daten, liste, waehle, onNeu, risiken, offenId, ansicht, setAnsicht }: {
  g: GAnzeige; daten: RegisterDaten; liste: { id: string; name: string }[]; waehle: (id: string) => void; onNeu: (g: GAnzeige) => void;
  risiken: { id: string; titel: string }[]; offenId?: string; ansicht: BuchAnsicht; setAnsicht: (a: BuchAnsicht) => void;
}) {
  const sw = useSchreiber(g, onNeu);
  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <GesellschaftWahl liste={liste} aktiv={g.id} onWahl={waehle} />
        <span style={{ marginLeft: 'auto' }}><Link href={WEG.unternehmen(g.id)} style={{ ...klein, color: C.ink }}>Steckbrief ›</Link></span>
      </div>
      <Segmente liste={[{ id: 'buch' as const, label: 'Beschluss-Buch' }, { id: 'satzung' as const, label: 'Gegenstand & Satzung' }]} aktiv={ansicht} onWahl={setAnsicht} />
      {sw.meldung && <Hinweis art="achtung" rolle="alert">{sw.meldung}</Hinweis>}
      {sw.unterwegs > 0 && <div role="status" style={klein}>speichert …</div>}
      {ansicht === 'buch'
        ? <BeschlussBuch key={`${g.id}:${offenId ?? ''}`} g={g} daten={daten} schreibe={sw.schreibe} risiken={risiken} offenId={offenId} />
        : <SatzungAnsicht key={g.id} g={g} schreibe={sw.schreibe} />}
    </>
  );
}

interface Entwurf { art: BeschlussArt; gremium?: Gremium; titel: string; inhalt: string; aenderungen: BeschlussAenderung[]; vorlage?: string; datum?: string; dateiIds?: string[] }

/** Das Buch einer Gesellschaft: Filter, Suche, Liste (neueste oben), Formular, Vorlagen, Dokument-Übernahme, Papierkorb. */
export function BeschlussBuch({ g, daten, schreibe, risiken = [], offenId }: { g: GAnzeige; daten: RegisterDaten; schreibe: Schreibe; risiken?: { id: string; titel: string }[]; offenId?: string }) {
  const { melden, hinweis } = useRueckgaengig();
  const { fragen, dialog } = useRueckfrage();
  const heute = localDay();
  const [jahr, setJahr] = useState('alle');
  const [status, setStatus] = useState<'alle' | BeschlussStatus>('alle');
  const [art, setArt] = useState<BeschlussArt | ''>('');
  const [q, setQ] = useState('');
  const offenAnfang = offenId ? aktiveEintraege(g.beschluesse).find(b => b.id === offenId) : undefined;
  const [form, setForm] = useState<{ alt?: Beschluss; entwurf?: Entwurf } | null>(offenAnfang ? { alt: offenAnfang } : null);
  const [neu, setNeu] = useState<'vorlage' | 'import' | null>(null);
  const handeln = async (id: string, was: Was) => (await schreibe({ liste: 'beschluesse', eintragId: id, aktion: was })).ok;
  const nummern = beschlussNummern(g.beschluesse);
  const zeilen = buchListe(g.beschluesse, { ...(jahr !== 'alle' ? { jahr: Number(jahr) } : {}), ...(status !== 'alle' ? { status } : {}), ...(art ? { art } : {}), ...(q.trim() ? { q } : {}) }, suchPasst).reverse();
  const jahre = buchJahre(g.beschluesse);
  const korb = (g.beschluesse ?? []).filter(b => b.geloeschtAm);
  const alle = aktiveEintraege(g.beschluesse);
  const offen = alle.filter(b => b.status === 'gefasst' && braucheEintragung(b)).length;

  return (
    <>
      <Karte>
        <Ueberschrift erklaerung="unternehmen.beschlussNummer" rechts={!form && !neu && (
          <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
            <a href={pdfWeg(g.id, jahr !== 'alle' ? Number(jahr) : undefined)} className="ui-knopf fassbar" style={{ border: `1px solid ${C.linie}`, borderRadius: 14, padding: '0 14px', display: 'inline-flex', alignItems: 'center', fontSize: TYP.bedien, color: C.ink, textDecoration: 'none' }}>PDF</a>
            <Knopf leise onClick={() => setNeu('import')}>Aus Dokument</Knopf>
            <Knopf leise onClick={() => setNeu('vorlage')}>+ Beschluss</Knopf>
          </span>
        )}>Beschluss-Buch</Ueberschrift>
        <Raster min={150}>
          <Kennzahl klein wert={String(alle.filter(b => b.status !== 'entwurf').length)} label="im Buch" />
          <Kennzahl klein wert={String(alle.filter(b => b.status === 'entwurf').length)} label="Entwürfe" />
          <Kennzahl klein wert={String(offen)} label="gefasst, nicht angemeldet" ton={offen ? LEUCHT.achtung : undefined} />
        </Raster>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {jahre.length > 1 && <Pillen liste={[{ id: 'alle', label: 'Alle Jahre' }, ...jahre.map(j => ({ id: String(j), label: String(j) }))]} aktiv={jahr} onWahl={setJahr} />}
          <Pillen liste={[{ id: 'alle' as const, label: 'Alle' }, ...BESCHLUSS_STATUS.map(s => ({ id: s.id, label: s.label }))]} aktiv={status} onWahl={setStatus} />
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))' }}>
            <Auswahl label="Art filtern" wert={art} leer="Alle Arten" liste={BESCHLUSS_ARTEN} onWahl={setArt} />
            <input value={q} onChange={e => setQ(e.target.value)} aria-label="Im Beschluss-Buch suchen" placeholder="Suchen: Titel, Inhalt, Nummer …" style={feld} />
          </div>
        </div>
      </Karte>
      {neu === 'vorlage' && <VorlageWahl g={g} heute={heute} fertig={e => { setNeu(null); if (e) setForm({ entwurf: e }); }} />}
      {neu === 'import' && <ImportKarte g={g} schreibe={schreibe} heute={heute} fertig={e => { setNeu(null); if (e) setForm({ entwurf: e }); }} />}
      {form && <BeschlussForm key={form.alt?.id ?? 'neu'} g={g} daten={daten} alt={form.alt} entwurf={form.entwurf} risiken={risiken} schreibe={schreibe} fertig={() => setForm(null)} />}
      <Karte>
        {!alle.length ? <Leerzustand symbol={<Gavel size={22} />} titel="Noch kein Beschluss" aktion={<Knopf leise onClick={() => setNeu('vorlage')}>Ersten Beschluss eintragen</Knopf>}>Gesellschafterbeschlüsse, Umlaufbeschlüsse, Bestellung der Geschäftsführung, Feststellung des Jahresabschlusses — alles an einer Stelle, fortlaufend nummeriert.</Leerzustand>
          : !zeilen.length ? <Leer>Kein Beschluss passt zu diesem Filter.</Leer> : (
            <Liste>{zeilen.map(({ b, nr }) => {
              const archiv = b.status === 'aufgehoben';
              return (
                <ZeileAktionen key={b.id} titel={b.titel} archiviert={archiv}
                  onArchivieren={async () => { if (await handeln(b.id, archiv ? 'zurueckholen' : 'archivieren')) melden(archiv ? `„${b.titel}“ wieder gültig` : `„${b.titel}“ als aufgehoben markiert`, archiv ? undefined : () => void handeln(b.id, 'zurueckholen')); }}
                  onLoeschen={async () => { if (await handeln(b.id, 'loeschen')) melden(`„${b.titel}“ im Papierkorb`, () => void handeln(b.id, 'wiederherstellen')); }}>
                  <Zeile titel={b.titel} onClick={() => { setNeu(null); setForm({ alt: b }); }}
                    unter={[nr ? `${nummerText(nr)}${nr.abgeleitet ? '*' : ''}` : 'Entwurf', tagText(b.datum), artLabel(b.art), gremiumLabel(gremiumVon(b)), b.dateiIds?.length ? `${b.dateiIds.length} Unterlage${b.dateiIds.length === 1 ? '' : 'n'}` : undefined].filter(Boolean).join(' · ')}
                    rechts={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Chip farbe={statusFarbe(b)}>{statusLabelB(b.status)}</Chip><span aria-hidden style={{ color: C.inkLeise }}>›</span></span>} />
                </ZeileAktionen>
              );
            })}</Liste>
          )}
        <div style={{ ...klein, marginTop: 8 }}>
          {[...nummern.values()].some(n => n.abgeleitet) ? '* Nummer abgeleitet: Ältere Beschlüsse ohne gespeicherte Nummer sind nach Datum gezählt (nur Anzeige). ' : ''}{BESCHLUSS_HINWEIS}
        </div>
      </Karte>
      {korb.length > 0 && <Papierkorb eintraege={korb.map(b => ({ id: b.id, titel: b.titel, geloeschtAm: b.geloeschtAm! }))} wiederherstellen={id => void handeln(id, 'wiederherstellen')}
        endgueltig={id => { const b = korb.find(x => x.id === id)!; fragen({ titel: `„${b.titel}“ endgültig löschen?`, text: 'Das lässt sich nicht rückgängig machen; die Nummer bleibt eine Lücke im Buch. Unterlagen in der Ablage bleiben.', wahl: [{ label: 'Endgültig löschen', ton: 'gefahr', tun: () => handeln(id, 'endgueltig') }] }); }} />}
      {dialog}
      {hinweis}
    </>
  );
}

/** Neuer Beschluss: leer oder aus einer Startvorlage (neutral, Platzhalter, Hinweis). */
function VorlageWahl({ g, heute, fertig }: { g: GAnzeige; heute: string; fertig: (e?: Entwurf) => void }) {
  return (
    <Karte>
      <Ueberschrift erklaerung="unternehmen.beschlussVorlage" rechts={<Knopf leise onClick={() => fertig()}>Abbrechen</Knopf>}>Neuer Beschluss</Ueberschrift>
      <Liste>
        <Zeile titel="Leer beginnen" unter="Alle Felder selbst ausfüllen." onClick={() => fertig({ art: 'gesellschafterbeschluss', titel: '', inhalt: '', aenderungen: [] })} rechts={<span aria-hidden style={{ color: C.inkLeise }}>›</span>} />
        {BESCHLUSS_VORLAGEN.map(v => (
          <Zeile key={v.id} titel={v.titel} unter={`${v.wofuer} (${v.norm})`} onClick={() => { const e = beschlussAusVorlage(v, g, heute); fertig({ ...e }); }} rechts={<span aria-hidden style={{ color: C.inkLeise }}>›</span>} />
        ))}
      </Liste>
      <div style={{ ...klein, marginTop: 8 }}>{BESCHLUSS_VORLAGE_HINWEIS}</div>
    </Karte>
  );
}

const FELD_LABEL: Record<ImportFeld, string> = { datum: 'Datum', art: 'Art', gremium: 'Gremium', titel: 'Titel', gegenstand: 'Gegenstand', stammkapital: 'Stammkapital', sitz: 'Sitz', firmierung: 'Firmierung', abstimmung: 'Abstimmung', beteiligte: 'Beteiligte' };

/**
 * Aus Dokument übernehmen: Beschluss- bzw. Satzungs-PDF in die Unterlagen der Gesellschaft laden (oder eine vorhandene wählen), Text ohne Modell lesen,
 * Vorschlag mit wörtlichen Fundstellen zeigen — „Als Beschluss übernehmen“ füllt nur das Formular; „Als Fassung festhalten“ legt je Änderung eine Fassung an.
 */
function ImportKarte({ g, schreibe, heute, fertig }: { g: GAnzeige; schreibe: Schreibe; heute: string; fertig: (e?: Entwurf) => void }) {
  const u = useUnterlagen(g.id);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [v, setV] = useState<{ vorschlag: ImportVorschlag; datei: { id: string; name: string }; umfang?: string } | null>(null);
  const [ab, setAb] = useState('');
  const [gespeichert, setGespeichert] = useState<string[]>([]);
  const lesen = async (dateiId: string) => {
    setLaeuft(true); setFehler(null);
    const d = await fetch(`/api/gesellschaften/beschluesse?id=${encodeURIComponent(g.id)}&datei=${encodeURIComponent(dateiId)}`, { cache: 'no-store' }).then(r => r.json()).catch(() => null);
    setLaeuft(false);
    if (!d?.ok) { setFehler(d?.fehler ?? 'Nicht gelesen.'); return; }
    setV({ vorschlag: d.vorschlag, datei: d.datei, ...(d.umfang ? { umfang: d.umfang } : {}) });
    setAb(d.vorschlag.felder.datum ?? heute);
  };
  const vs = v?.vorschlag;
  const alsFassung = async (a: BeschlussAenderung) => {
    if (!v) return;
    const r = await schreibe({ liste: 'fassungen', eintrag: { merkmal: a.merkmal, ab, ...(a.text ? { text: a.text } : {}), ...(a.cent !== undefined ? { cent: a.cent } : {}), ...(a.merkmal === 'gegenstand' || a.merkmal === 'satzung' ? { dateiIds: [v.datei.id] } : {}) } });
    if (r.ok) setGespeichert(l => [...l, a.merkmal]); else setFehler(r.fehler ?? 'Nicht gespeichert.');
  };
  return (
    <Karte>
      <Ueberschrift erklaerung="unternehmen.beschlussImport" rechts={<Knopf leise onClick={() => fertig()}>Schließen</Knopf>}>Aus Dokument übernehmen</Ueberschrift>
      {!v ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <label style={{ fontSize: TYP.bedien, color: C.inkDim }}>
            Beschluss- oder Satzungs-PDF hochladen: <input type="file" accept={ANNEHMEN} aria-label="Dokument hochladen" disabled={laeuft} onChange={async e => { const d = e.target.files?.[0]; e.target.value = ''; if (!d) return; const neu = await u.hochladen(d, 'sonstig', d.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 160)); if (neu) await lesen(neu.id); }} />
          </label>
          {(u.liste?.length ?? 0) > 0 && <Auswahl label="Vorhandene Unterlage lesen" wert="" leer="… oder eine vorhandene Unterlage wählen" liste={(u.liste ?? []).map(x => ({ id: x.id, label: x.titel || x.datei?.name || 'Unterlage' }))} onWahl={id => { if (id) void lesen(id); }} />}
          {laeuft && <div role="status" style={klein}>liest …</div>}
          {(fehler || u.fehler) && <Hinweis art="kritisch" rolle="alert">{fehler ?? u.fehler}</Hinweis>}
          <div style={klein}>Gelesen wird ohne KI, nur nach üblichen Wörtern — jede Fundstelle steht wörtlich da. Nichts wird gespeichert, bevor du übernimmst.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={klein}>Gelesen: {v.datei.name}{v.umfang ? ` (${v.umfang})` : ''} · {vs!.zeichen.toLocaleString('de-DE')} Zeichen{vs!.satzung ? ' · sieht aus wie eine Satzung' : ''}</div>
          {vs!.hinweis && <Hinweis art="info">{vs!.hinweis}</Hinweis>}
          <Liste>
            {vs!.felder.datum && <Zeile titel="Datum" unter={tagText(vs!.felder.datum)} />}
            {vs!.felder.art && <Zeile titel="Art" unter={artLabel(vs!.felder.art)} />}
            {vs!.felder.gremium && <Zeile titel="Gremium" unter={gremiumLabel(vs!.felder.gremium)} />}
            {vs!.felder.titel && <Zeile titel="Titel" unter={vs!.felder.titel} />}
            {vs!.aenderungen.map(a => <Zeile key={a.merkmal} umbrechen titel={merkmalLabel(a.merkmal)} unter={a.merkmal === 'stammkapital' ? centEingabe(a.cent) + ' €' : a.text} />)}
          </Liste>
          {vs!.fundstellen.length > 0 && (
            <div style={{ display: 'grid', gap: 6 }}>
              <strong style={{ fontSize: TYP.bedien }}>Fundstellen (wörtlich)</strong>
              {vs!.fundstellen.map((f, i) => <div key={`${f.feld}-${i}`} style={{ ...klein, color: C.ink }}><span style={{ color: C.inkDim }}>{FELD_LABEL[f.feld]}{f.stelle ? ` · ${f.stelle}` : ''}:</span> „{f.zitat}“</div>)}
            </div>
          )}
          {vs!.beteiligteText.length > 0 && (
            <div style={{ display: 'grid', gap: 6 }}>
              <strong style={{ fontSize: TYP.bedien }}>Beteiligte laut Text — nur zur Ansicht</strong>
              {vs!.beteiligteText.map((t, i) => <div key={i} style={klein}>„{t}“</div>)}
              <div style={klein}>Wer beteiligt war, wählst du im Formular aus den Gesellschaftern und Organen — Namen aus dem Dokument werden nicht gespeichert.</div>
            </div>
          )}
          {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Knopf onClick={() => fertig({ art: vs!.felder.art ?? 'gesellschafterbeschluss', ...(vs!.felder.gremium ? { gremium: vs!.felder.gremium } : {}), titel: vs!.felder.titel ?? '', inhalt: '', aenderungen: vs!.satzung ? [] : vs!.aenderungen, ...(vs!.felder.datum ? { datum: vs!.felder.datum } : {}), dateiIds: [v.datei.id] })}>Als Beschluss übernehmen</Knopf>
            <Knopf leise onClick={() => { setV(null); setGespeichert([]); }}>Anderes Dokument</Knopf>
          </div>
          {vs!.aenderungen.length > 0 && (
            <div style={{ display: 'grid', gap: 8, borderTop: `1px solid ${C.linie}`, paddingTop: 12 }}>
              <Feldzeile label="Als Fassung festhalten — gültig ab" erklaerung="unternehmen.fassung"><input type="date" value={ab} onChange={e => setAb(e.target.value)} aria-label="Gültig ab" style={feld} /></Feldzeile>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {vs!.aenderungen.map(a => gespeichert.includes(a.merkmal)
                  ? <Chip key={a.merkmal} farbe={LEUCHT.gut}>{merkmalLabel(a.merkmal)} festgehalten</Chip>
                  : <Knopf key={a.merkmal} leise aus={!ab} onClick={() => alsFassung(a)}>{merkmalLabel(a.merkmal)} als Fassung</Knopf>)}
              </div>
            </div>
          )}
        </div>
      )}
    </Karte>
  );
}

/** Ein Beschluss anlegen bzw. ändern — alle Felder; die Nummer vergibt der Server. */
function BeschlussForm({ g, daten, alt, entwurf, risiken, schreibe, fertig }: { g: GAnzeige; daten: RegisterDaten; alt?: Beschluss; entwurf?: Entwurf; risiken: { id: string; titel: string }[]; schreibe: Schreibe; fertig: () => void }) {
  const heute = localDay();
  const [datum, setDatum] = useState(alt?.datum ?? entwurf?.datum ?? heute);
  const [art, setArt] = useState<BeschlussArt>(alt?.art ?? entwurf?.art ?? 'gesellschafterbeschluss');
  const [gremium, setGremium] = useState<Gremium | ''>(alt?.gremium ?? entwurf?.gremium ?? '');
  const [titel, setTitel] = useState(alt?.titel ?? entwurf?.titel ?? '');
  const [inhalt, setInhalt] = useState(alt?.inhalt ?? entwurf?.inhalt ?? '');
  const [status, setStatus] = useState<BeschlussStatus>(alt?.status ?? (entwurf?.vorlage ? 'entwurf' : 'gefasst'));
  const [wirkungAb, setWirkungAb] = useState(alt?.wirkungAb ?? '');
  const [angemeldetAm, setAngemeldetAm] = useState(alt?.angemeldetAm ?? '');
  const [eingetragenAm, setEingetragenAm] = useState(alt?.eingetragenAm ?? '');
  const [beteiligte, setBeteiligte] = useState<string[]>(alt?.beteiligte ?? []);
  const [stimmen, setStimmen] = useState<Record<string, Stimme>>(Object.fromEntries((alt?.abstimmung ?? []).map(s => [s.id, s.stimme])));
  const [aenderungen, setAenderungen] = useState<{ merkmal: SatzungMerkmal; text: string }[]>((alt?.aenderungen ?? entwurf?.aenderungen ?? []).map(a => ({ merkmal: a.merkmal, text: a.merkmal === 'stammkapital' ? centEingabe(a.cent) : a.text ?? '' })));
  const [verweise, setVerweise] = useState<BeschlussVerweis[]>(alt?.verweise ?? []);
  const [dateiIds, setDateiIds] = useState<string[]>(alt?.dateiIds ?? entwurf?.dateiIds ?? []);
  const [fehler, setFehler] = useState<string | null>(null);
  const u = useUnterlagen(g.id);
  const nr = alt ? beschlussNummern(g.beschluesse).get(alt.id) : undefined;

  // Wer kann beteiligt sein: Gesellschafter und Organe dieser Gesellschaft (aktive; schon beteiligte bleiben sichtbar, auch wenn ausgeschieden).
  const kandidaten = [
    ...aktiveEintraege(g.gesellschafter).filter(x => !x.ausgeschiedenAm || beteiligte.includes(x.id)).map(x => ({ id: x.id, name: bezugName(x.wer, daten.namen), rolle: `Gesellschafter${x.ohneStimmrecht ? ' (ohne Stimmrecht)' : ''}` })),
    ...aktiveEintraege(g.organe).filter(x => !x.bis || x.bis > heute || beteiligte.includes(x.id)).map(x => ({ id: x.id, name: bezugName(x.wer, daten.namen), rolle: 'Organ' })),
  ];
  // Vorschau des Ergebnisses wie der Server: Gewicht aus der früheren Abstimmung, sonst der heutige Nennbetrag.
  const abstimmung: Stimmabgabe[] = beteiligte.filter(id => stimmen[id]).map(id => {
    const vorher = alt?.abstimmung?.find(s => s.id === id);
    const gs = aktiveEintraege(g.gesellschafter).find(x => x.id === id);
    const gewichtCent = vorher?.gewichtCent ?? gs?.nennbetragCent;
    const ohne = vorher ? vorher.ohneStimmrecht : gs?.ohneStimmrecht;
    return { id, stimme: stimmen[id], ...(gewichtCent !== undefined ? { gewichtCent } : {}), ...(ohne ? { ohneStimmrecht: true as const } : {}) };
  });
  const aenderungenRoh: BeschlussAenderung[] = aenderungen.map(a => (a.merkmal === 'stammkapital' ? { merkmal: a.merkmal, cent: typeof centAus(a.text) === 'number' ? centAus(a.text) as number : undefined } : { merkmal: a.merkmal, text: a.text }));
  const ergebnis = abstimmungsErgebnis({ abstimmung, art, aenderungen: aenderungenRoh });
  const freieMerkmale = SATZUNG_MERKMALE.filter(m => !aenderungen.some(a => a.merkmal === m.id));
  const vertraege = aktiveEintraege(g.vertraege);

  const speichern = async () => {
    setFehler(null);
    const eintrag = {
      datum, art, gremium: gremium || null, titel, inhalt, status, wirkungAb: wirkungAb || null, angemeldetAm: angemeldetAm || null, eingetragenAm: eingetragenAm || null,
      beteiligte, abstimmung: abstimmung.map(s => ({ id: s.id, stimme: s.stimme })), verweise, dateiIds,
      aenderungen: aenderungen.map(a => (a.merkmal === 'stammkapital' ? { merkmal: a.merkmal, cent: a.text } : { merkmal: a.merkmal, text: a.text })),
      ...(entwurf?.vorlage ? { vorlage: entwurf.vorlage } : {}),
    };
    const r = await schreibe({ liste: 'beschluesse', eintrag, ...(alt ? { eintragId: alt.id } : {}) });
    if (r.ok) fertig(); else setFehler(r.fehler ?? 'Nicht gespeichert.');
  };

  return (
    <>
      <Karte>
        <Ueberschrift rechts={nr && <Chip farbe={C.inkDim}>{nummerText(nr)}{nr.abgeleitet ? ' (abgeleitet)' : ''}</Chip>}>{alt ? 'Beschluss ändern' : 'Beschluss eintragen'}</Ueberschrift>
        <form onSubmit={e => { e.preventDefault(); void speichern(); }} style={{ display: 'grid', gap: 14 }}>
          {entwurf?.vorlage && <Hinweis art="info">{BESCHLUSS_VORLAGE_HINWEIS} Die Platzhalter „[…]“ füllst du im Inhalt aus.</Hinweis>}
          <Felder>
            <Feldzeile label="Datum"><input type="date" value={datum} onChange={e => setDatum(e.target.value)} aria-label="Datum des Beschlusses" style={feld} /></Feldzeile>
            <Feldzeile label="Art"><Auswahl label="Art des Beschlusses" wert={art} liste={BESCHLUSS_ARTEN} onWahl={v => { if (v) setArt(v); }} /></Feldzeile>
            <Feldzeile label="Gremium"><Auswahl label="Gremium" wert={gremium} leer={`aus der Art: ${gremiumLabel(gremiumVon({ art }))}`} liste={GREMIEN} onWahl={setGremium} /></Feldzeile>
            <Feldzeile label="Wirkung ab (leer = Beschlusstag)" erklaerung="unternehmen.beschlussWirkung"><input type="date" value={wirkungAb} onChange={e => setWirkungAb(e.target.value)} aria-label="Wirkung ab" style={feld} /></Feldzeile>
          </Felder>
          <Feldzeile label="Titel"><input value={titel} onChange={e => setTitel(e.target.value)} aria-label="Titel des Beschlusses" placeholder="z. B. Bestellung der Geschäftsführung" style={feld} /></Feldzeile>
          <Feldzeile label="Status" erklaerung="unternehmen.beschlussStatus"><Pillen liste={BESCHLUSS_STATUS.map(s => ({ id: s.id, label: s.label }))} aktiv={status} onWahl={setStatus} /></Feldzeile>
          {(status === 'angemeldet' || status === 'eingetragen' || angemeldetAm || eingetragenAm) && (
            <Felder>
              <Feldzeile label="Angemeldet am"><input type="date" value={angemeldetAm} onChange={e => setAngemeldetAm(e.target.value)} aria-label="Angemeldet am" style={feld} /></Feldzeile>
              <Feldzeile label="Eingetragen am"><input type="date" value={eingetragenAm} onChange={e => setEingetragenAm(e.target.value)} aria-label="Eingetragen am" style={feld} /></Feldzeile>
            </Felder>
          )}

          <div style={{ display: 'grid', gap: 8 }}>
            <Feldzeile label="Beteiligte und Abstimmung" erklaerung="unternehmen.abstimmung">
              {!kandidaten.length ? <span style={klein}>Noch keine Gesellschafter oder Organe eingetragen — erst unter „Gesellschafter“ bzw. „Organe“ anlegen.</span> : (
                <div style={{ display: 'grid', gap: 6 }}>
                  {kandidaten.map(k => {
                    const dabei = beteiligte.includes(k.id);
                    return (
                      <div key={k.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', minHeight: 44 }}>
                        <label style={{ display: 'inline-flex', gap: 10, alignItems: 'center', fontSize: TYP.body, color: C.ink, cursor: 'pointer', flex: '1 1 200px' }}>
                          <input type="checkbox" checked={dabei} onChange={e => { const an = e.target.checked; setBeteiligte(l => (an ? [...l, k.id] : l.filter(x => x !== k.id))); if (!an) setStimmen(s => { const n = { ...s }; delete n[k.id]; return n; }); }} style={{ width: 20, height: 20 }} />
                          <span>{k.name} <span style={{ color: C.inkDim, fontSize: TYP.bedien }}>· {k.rolle}</span></span>
                        </label>
                        {dabei && <Segmente liste={[{ id: '', label: '—' }, ...STIMMEN.map(s => ({ id: s.id, label: s.label }))]} aktiv={stimmen[k.id] ?? ''} onWahl={(s: Stimme | '') => setStimmen(x => { const n = { ...x }; if (s) n[k.id] = s; else delete n[k.id]; return n; })} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </Feldzeile>
            {ergebnis && <Hinweis art={ergebnis.angenommen === false ? 'achtung' : ergebnis.angenommen ? 'gut' : 'info'} titel="Ergebnis">{ergebnis.text}. Hinweis, keine Rechtsberatung — die Satzung kann andere Mehrheiten vorsehen.</Hinweis>}
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <Feldzeile label="Ändert Gegenstand oder Satzung" erklaerung="unternehmen.fassung">
              <div style={{ display: 'grid', gap: 8 }}>
                {aenderungen.map((a, i) => (
                  <div key={a.merkmal} style={{ display: 'grid', gap: 6 }}>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim }}>{merkmalLabel(a.merkmal)}<Knopf leise ariaLabel={`Änderung ${merkmalLabel(a.merkmal)} entfernen`} onClick={() => setAenderungen(l => l.filter((_, j) => j !== i))}>×</Knopf></span>
                    {a.merkmal === 'gegenstand' || a.merkmal === 'satzung'
                      ? <textarea value={a.text} onChange={e => setAenderungen(l => l.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} aria-label={`Neuer Wortlaut: ${merkmalLabel(a.merkmal)}`} placeholder={a.merkmal === 'satzung' ? 'z. B. Neufassung des Gesellschaftsvertrags' : 'Gegenstand des Unternehmens ist …'} rows={3} style={{ ...feld, resize: 'vertical', lineHeight: 1.5 }} />
                      : <input value={a.text} onChange={e => setAenderungen(l => l.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} aria-label={`Neuer Wert: ${merkmalLabel(a.merkmal)}`} inputMode={a.merkmal === 'stammkapital' ? 'decimal' : undefined} placeholder={a.merkmal === 'stammkapital' ? 'neues Stammkapital, z. B. 50.000' : ''} style={feld} />}
                  </div>
                ))}
                {freieMerkmale.length > 0 && <Auswahl label="Änderung hinzufügen" wert="" leer="+ Änderung hinzufügen …" liste={freieMerkmale} onWahl={m => { if (m) setAenderungen(l => [...l, { merkmal: m, text: '' }]); }} />}
              </div>
            </Feldzeile>
          </div>

          <Feldzeile label="Inhalt (Wortlaut)"><textarea value={inhalt} onChange={e => setInhalt(e.target.value)} aria-label="Inhalt" rows={inhalt.length > 400 ? 12 : 4} style={{ ...feld, resize: 'vertical', lineHeight: 1.5 }} /></Feldzeile>

          <div style={{ display: 'grid', gap: 8 }}>
            <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim }}>Verweise</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {verweise.map(v => {
                const t = v.art === 'vertrag' ? `Vertrag: ${vertraege.find(x => x.id === v.id)?.titel ?? 'nicht mehr vorhanden'}` : v.art === 'gesellschafter' ? `Gesellschafter: ${beteiligtName(v.id, g, daten.namen)}` : `Risiko: ${risiken.find(x => x.id === v.id)?.titel ?? 'im Schild'}`;
                return <Knopf key={`${v.art}:${v.id}`} leise ariaLabel={`Verweis ${t} entfernen`} onClick={() => setVerweise(l => l.filter(x => !(x.art === v.art && x.id === v.id)))}>{t} ×</Knopf>;
              })}
            </div>
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))' }}>
              {vertraege.length > 0 && <Auswahl label="Vertrag verknüpfen" wert="" leer="+ Vertrag …" liste={vertraege.map(x => ({ id: x.id, label: x.titel }))} onWahl={id => { if (id) setVerweise(l => (l.some(x => x.id === id) ? l : [...l, { art: 'vertrag', id }])); }} />}
              {aktiveEintraege(g.gesellschafter).length > 0 && <Auswahl label="Gesellschafter verknüpfen" wert="" leer="+ Gesellschafter …" liste={aktiveEintraege(g.gesellschafter).map(x => ({ id: x.id, label: bezugName(x.wer, daten.namen) }))} onWahl={id => { if (id) setVerweise(l => (l.some(x => x.id === id) ? l : [...l, { art: 'gesellschafter', id }])); }} />}
              {risiken.length > 0 && <Auswahl label="Risiko verknüpfen" wert="" leer="+ Risiko …" liste={risiken.map(x => ({ id: x.id, label: x.titel }))} onWahl={id => { if (id) setVerweise(l => (l.some(x => x.id === id) ? l : [...l, { art: 'risiko', id }])); }} />}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim }}>Unterlagen (Niederschrift, Protokoll, Notarurkunde)</span>
            {(u.liste ?? []).map(e => (
              <label key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44, fontSize: TYP.body, color: C.ink, cursor: 'pointer' }}>
                <input type="checkbox" checked={dateiIds.includes(e.id)} onChange={x => setDateiIds(l => (x.target.checked ? [...l, e.id] : l.filter(y => y !== e.id)))} style={{ width: 20, height: 20 }} />
                {e.titel || e.datei?.name || 'Unterlage'}
              </label>
            ))}
            <label style={{ fontSize: TYP.bedien, color: C.inkDim }}>
              Neue Datei an diesen Beschluss: <input type="file" accept={ANNEHMEN} aria-label="Unterlage zum Beschluss hochladen" onChange={async e => { const d = e.target.files?.[0]; e.target.value = ''; if (!d) return; const neu = await u.hochladen(d, 'sonstig', titel || artLabel(art)); if (neu) setDateiIds(l => [...l, neu.id]); }} />
            </label>
            {u.fehler && <Hinweis art="kritisch" rolle="alert">{u.fehler}</Hinweis>}
          </div>

          {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Knopf typ="submit" aus={titel.trim().length < 2}>{alt ? 'Speichern' : 'Eintragen'}</Knopf><Knopf leise onClick={fertig}>Abbrechen</Knopf></div>
          {status === 'gefasst' && (!alt || alt.status === 'entwurf') && <div style={klein}>Beim Speichern als „gefasst“ vergibt MAKE OS die Nummer und legt die Folgen (Pflichten, Fassung, Cap-Table) als Vorschläge in die Freigaben.</div>}
        </form>
      </Karte>
      {alt && alt.status !== 'entwurf' && alt.status !== 'aufgehoben' && <FolgenKarte g={g} b={alt} />}
    </>
  );
}

/** Folgen eines Beschlusses — was MAKE OS vorschlägt und ob es schon in den Freigaben liegt; „In die Freigaben legen“ für Altbestand. */
function FolgenKarte({ g, b }: { g: GAnzeige; b: Beschluss }) {
  const [d, setD] = useState<{ folgen: (BeschlussFolge & { imStapel: boolean })[]; hinweise: string[] } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const laden = useCallback(async () => {
    const r = await fetch(`/api/gesellschaften/beschluesse?id=${encodeURIComponent(g.id)}&b=${encodeURIComponent(b.id)}`, { cache: 'no-store' }).then(x => x.json()).catch(() => null);
    if (r?.ok) { setD({ folgen: r.folgen, hinweise: r.hinweise }); setFehler(null); } else setFehler(r?.fehler ?? 'Nicht geladen.');
  }, [g.id, b.id]);
  useEffect(() => { void laden(); }, [laden, b.status, b.aenderungen?.length]);
  const legen = async () => {
    const r = await fetch('/api/gesellschaften/beschluesse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'folgen', id: g.id, beschlussId: b.id }) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    if (!r.ok) setFehler(r.fehler ?? 'Nicht gelegt.');
    await laden();
  };
  const offen = d?.folgen.filter(f => !f.imStapel).length ?? 0;
  return (
    <Karte>
      <Ueberschrift erklaerung="unternehmen.beschlussFolgen" rechts={<Knopf leise href={WEG.freigaben(undefined, 'business')}>Freigaben ›</Knopf>}>Folgen des Beschlusses</Ueberschrift>
      {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
      {!d ? <Leer>lädt …</Leer> : !d.folgen.length ? <Leer symbol={<FileText size={16} />}>Keine offenen Folgen — nichts anzumelden oder festzuhalten.</Leer> : (
        <Liste>{d.folgen.map(f => <Zeile key={f.schluessel} umbrechen titel={f.titel} unter={f.text} rechts={<Chip farbe={f.imStapel ? LEUCHT.gut : C.inkDim}>{f.imStapel ? 'in den Freigaben' : 'noch nicht'}</Chip>} />)}</Liste>
      )}
      {d?.hinweise.map(h => <div key={h} style={{ ...klein, marginTop: 6 }}>{h}</div>)}
      {offen > 0 && <div style={{ marginTop: 10 }}><Knopf onClick={legen}>In die Freigaben legen ({offen})</Knopf></div>}
      <div style={{ ...klein, marginTop: 8 }}>Nichts geschieht ohne deinen Klick in den Freigaben. {BESCHLUSS_HINWEIS}</div>
    </Karte>
  );
}

/** Kompakt für den Reiter „Organe & Beschlüsse“ einer Gesellschaft: die letzten Beschlüsse und der Weg ins Buch (eine Quelle, eine Stelle zum Pflegen). */
export function BeschluesseKurz({ g }: { g: GAnzeige }) {
  const l = buchListe(g.beschluesse).reverse().slice(0, 5);
  return (
    <Karte>
      <Ueberschrift rechts={<Knopf leise href={WEG.beschluss(g.id)}>Beschluss-Buch ›</Knopf>}>Beschlüsse</Ueberschrift>
      {!l.length ? <Leer symbol={<Gavel size={16} />} aktion={<Knopf leise href={WEG.beschluss(g.id)}>Beschluss eintragen</Knopf>}>Noch kein Beschluss — das Beschluss-Buch führt sie fortlaufend nummeriert.</Leer> : (
        <Liste>{l.map(({ b, nr }) => (
          <Link key={b.id} href={WEG.beschluss(g.id, b.id)} style={{ textDecoration: 'none', color: 'inherit' }}>
            <Zeile titel={b.titel} unter={[nr ? nummerText(nr) : 'Entwurf', tagText(b.datum), artLabel(b.art)].join(' · ')} rechts={<Chip farbe={statusFarbe(b)}>{statusLabelB(b.status)}</Chip>} />
          </Link>
        ))}</Liste>
      )}
    </Karte>
  );
}
