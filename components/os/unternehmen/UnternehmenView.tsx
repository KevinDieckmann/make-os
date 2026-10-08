'use client';

// ─── Unternehmen — das Gesellschafts-Register (/os/unternehmen, 04.10.) ─────────────────────────────────────────
// Kevin 04.10.: „Kriegen wir dort jetzt alles sauber geplant?“ — eigene Gesellschaften als offene Liste, Steckbrief,
// Cap-Table, Beteiligungen, Verträge mit Fristen, Unterlagen. Leitregel 80/20: klar, seriös, investor-tauglich.
//   Übersicht   Reiter Gesellschaften · Struktur („wer hält wen“) · Archiv (ruhend/aufgelöst) · Papierkorb
//   Detail      ?g=<kennung>&r=<reiter> (Detail.tsx)
//   Ablage      ?ablage=<kennung>[&v=<vertrag>] (DSGVO-Nachtrag 04.10.): Unterlagen einer Gesellschaft bzw. eines Vertrags — auch
//               nach dem endgültigen Löschen (Aufbewahrung § 257 HGB); der Bezug steht dann als „„Name“ (gelöscht)“ da.
// Löschen/Archivieren über den gemeinsamen Baustein ZeileAktionen (Handy wischen, Rechner Knöpfe am Rand), Rückfrage statt
// window.confirm, „Rückgängig“ für 10 s. Daten: GET/POST/PATCH /api/gesellschaften (nur Haushalt des Inhabers).

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, FileText, Network, Trash2 } from 'lucide-react';
import { FARBE as C, TYP, LEUCHT, SCHRIFT, RAND } from '@/lib/make-one/design';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Knopf, Chip, Hinweis, Leerzustand, Leer, Reiter, Pillen, Feldzeile, eingabe, ZeileAktionen, useRueckgaengig, useRueckfrage } from '../ui';
import { zufallsUuid } from '@/lib/kennung';
import { WEG } from '@/lib/wege';
import { istGesellschaft, gehoertZuPrivat } from '@/lib/einheiten';
import { gesellschaftenGeaendert } from '@/lib/gesellschaften/client';
import {
  GES_STATUS, RECHTSFORMEN, istArchiviertStatus, statusLabel, rechtsformLabel, strukturBaum, gesellschafterKurz, verweiseAnzahl, verweiseSatz,
  geloeschterBezug, geloeschtText,
  type GesStatus, type Rechtsform, type StrukturKnoten,
} from '@/lib/gesellschaften/modell';
import type { DateiEintrag } from '@/lib/dateien/regeln';
import { bezugName, klein, tagText, UnterlagenBleiben, type GAnzeige, type RegisterDaten } from './teile';
import { Detail } from './Detail';

type Sicht = 'liste' | 'struktur' | 'archiv' | 'papierkorb';
const SICHTEN: { id: Sicht; label: string }[] = [{ id: 'liste', label: 'Gesellschaften' }, { id: 'struktur', label: 'Struktur' }, { id: 'archiv', label: 'Archiv' }, { id: 'papierkorb', label: 'Papierkorb' }];

/** Status → Farbe der Pille: Zustand, keine Deko. */
export const STATUS_FARBE: Record<GesStatus, string> = { geplant: C.inkDim, gruendung: LEUCHT.achtung, eingetragen: LEUCHT.gut, ruhend: C.inkLeise, aufgeloest: C.inkLeise };
export const StatusPille = ({ s }: { s?: GesStatus }) => <Chip farbe={s ? STATUS_FARBE[s] : C.inkLeise}>{statusLabel(s)}</Chip>;

export function UnternehmenView() {
  const router = useRouter();
  const params = useSearchParams();
  const offen = params.get('g');
  const sicht: Sicht = (SICHTEN.find(s => s.id === params.get('s'))?.id) ?? 'liste';
  const [daten, setDaten] = useState<RegisterDaten | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [neu, setNeu] = useState(false);

  const laden = useCallback(async () => {
    try {
      const r = await fetch('/api/gesellschaften?papierkorb=1', { cache: 'no-store' });
      const d = await r.json().catch(() => null);
      if (d?.ok) { setDaten({ gesellschaften: d.gesellschaften, personen: d.personen, namen: d.namen, geloescht: d.geloescht ?? [] }); setFehler(null); }
      else setFehler(d?.fehler ?? `Antwort ${r.status}.`);
    } catch { setFehler('Keine Verbindung.'); }
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  const geh = (q: { g?: string; s?: Sicht; r?: string }) => {
    const u = new URLSearchParams();
    if (q.g) u.set('g', q.g);
    if (q.r) u.set('r', q.r);
    if (q.s && q.s !== 'liste') u.set('s', q.s);
    router.push(`/os/unternehmen${u.size ? `?${u}` : ''}`, { scroll: false });
  };
  const ersetzen = (g: GAnzeige) => setDaten(d => (d ? { ...d, gesellschaften: d.gesellschaften.map(x => (x.id === g.id ? g : x)) } : d));

  if (!daten) {
    return (
      <Seite titel="Unternehmen" unter="Eigene Gesellschaften, Anteile und Verträge — eine Quelle.">
        {fehler ? <Hinweis art="kritisch" rolle="alert" titel="Register nicht geladen" aktion={<Knopf leise onClick={() => void laden()}>Noch einmal versuchen</Knopf>}>{fehler}</Hinweis> : <Karte><Leer>lädt …</Leer></Karte>}
      </Seite>
    );
  }

  const ablage = params.get('ablage');
  if (ablage) return <AblageAnsicht key={`${ablage}:${params.get('v') ?? ''}`} gesellschaftId={ablage} vertragId={params.get('v') ?? undefined} zurueck={() => geh({ s: sicht })} />;

  const g = offen ? daten.gesellschaften.find(x => x.id === offen) : undefined;
  const weg = offen && !g ? geloeschterBezug(daten, 'gesellschaft', offen) : undefined;
  if (offen && g) return <Detail key={g.id} g={g} daten={daten} reiter={params.get('r') ?? 'steckbrief'} onReiter={r => geh({ g: g.id, r })} zurueck={() => geh({ s: sicht })} onNeu={ersetzen} neuLaden={laden} oeffne={id => geh({ g: id })} />;

  return (
    // Mandate & Unternehmen (08.10.): EIN Punkt in der Leiste — er öffnet die Mandate; von hier geht es einen Klick zurück.
    <Seite titel="Unternehmen" unter={<>Eigene Gesellschaften, Anteile und Verträge — eine Quelle für Planung, Finanzen und Markttraktion. · <Link href={WEG.mandat()} style={{ color: C.inkDim }}>Mandate & Produkte ›</Link></>}
      rechts={!neu && <Knopf haupt onClick={() => setNeu(true)}>+ Gesellschaft</Knopf>}>
      {offen && !g && (weg
        ? <Hinweis art="info" titel={geloeschtText(weg)}>Diese Gesellschaft wurde endgültig gelöscht. <UnterlagenBleiben href={WEG.unterlagen(weg.id)} /></Hinweis>
        : <Hinweis art="info" titel="Nicht gefunden">Diese Gesellschaft gibt es im Register nicht (mehr).</Hinweis>)}
      {neu && <Anlegen onFertig={async id => { setNeu(false); await laden(); if (id) geh({ g: id }); }} />}
      <div className="ui-reiter-zeile"><Reiter liste={SICHTEN} aktiv={sicht} onWahl={s => geh({ s })} ariaLabel="Ansicht" /></div>
      {sicht === 'struktur' ? <Struktur daten={daten} oeffne={id => geh({ g: id })} /> : <Uebersicht daten={daten} sicht={sicht} oeffne={id => geh({ g: id })} neuLaden={laden} />}
    </Seite>
  );
}

/** Neue Gesellschaft: Name, Rechtsform, Status — der Rest im Steckbrief. */
function Anlegen({ onFertig }: { onFertig: (id?: string) => void | Promise<void> }) {
  const [name, setName] = useState('');
  const [rechtsform, setRechtsform] = useState<Rechtsform>('gmbh');
  const [status, setStatus] = useState<GesStatus>('gruendung');
  const [fehler, setFehler] = useState<string | null>(null);
  const [anfrageId] = useState(() => `ges-${zufallsUuid()}`);
  const speichern = async () => {
    setFehler(null);
    const r = await fetch('/api/gesellschaften', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anfrageId, felder: { name, rechtsform, status } }) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung — nichts gespeichert.' }));
    if (!r.ok) { setFehler(r.fehler ?? 'Nicht gespeichert.'); return; }
    gesellschaftenGeaendert();
    await onFertig(r.gesellschaft?.id);
  };
  return (
    <Karte>
      <Ueberschrift>Neue Gesellschaft</Ueberschrift>
      <form onSubmit={e => { e.preventDefault(); void speichern(); }} style={{ display: 'grid', gap: 14 }}>
        <Feldzeile label="Name"><input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="z. B. Musterfirma GmbH" style={eingabe} /></Feldzeile>
        <Feldzeile label="Rechtsform"><Pillen liste={RECHTSFORMEN.map(x => ({ id: x.id, label: x.label }))} aktiv={rechtsform} onWahl={setRechtsform} /></Feldzeile>
        <Feldzeile label="Status"><Pillen liste={GES_STATUS.filter(s => !istArchiviertStatus(s.id)).map(s => ({ id: s.id, label: s.label }))} aktiv={status} onWahl={setStatus} /></Feldzeile>
        {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Knopf typ="submit" aus={name.trim().length < 2}>Anlegen</Knopf>
          <Knopf leise onClick={() => onFertig()}>Abbrechen</Knopf>
        </div>
      </form>
    </Karte>
  );
}

/** Gesellschaften · Archiv · Papierkorb — Zeilen mit ZeileAktionen. */
function Uebersicht({ daten, sicht, oeffne, neuLaden }: { daten: RegisterDaten; sicht: Exclude<Sicht, 'struktur'>; oeffne: (id: string) => void; neuLaden: () => Promise<void> }) {
  const { melden, hinweis } = useRueckgaengig();
  const { fragen, dialog } = useRueckfrage();
  const [fehler, setFehler] = useState<string | null>(null);
  const alle = daten.gesellschaften;
  const liste = alle.filter(g => (sicht === 'papierkorb' ? !!g.geloeschtAm : !g.geloeschtAm && (sicht === 'archiv' ? istArchiviertStatus(g.status) : !istArchiviertStatus(g.status))));
  const name = (b: Parameters<typeof bezugName>[0]) => bezugName(b, daten.namen);

  const handeln = async (g: GAnzeige, aktion: string, extra: Record<string, unknown> = {}) => {
    setFehler(null);
    const r = await fetch('/api/gesellschaften', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: g.id, stand: g.stand, aktion, ...extra }) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung — nichts geändert.' }));
    await neuLaden(); gesellschaftenGeaendert();
    if (!r.ok) { setFehler(r.fehler ?? 'Nicht geändert.'); return false; }
    return true;
  };
  // Nach dem Neuladen gilt der neue Stand — „Rückgängig“ holt ihn frisch.
  const frisch = async (id: string) => { const d = await fetch('/api/gesellschaften?papierkorb=1', { cache: 'no-store' }).then(r => r.json()).catch(() => null); return (d?.gesellschaften as GAnzeige[] | undefined)?.find(x => x.id === id); };
  const archivieren = (g: GAnzeige) => fragen({
    titel: `„${g.name}“ archivieren?`, text: 'Archiviert heißt: ruhend oder aufgelöst. Sie bleibt mit allen Angaben erhalten und lässt sich jederzeit zurückholen.',
    wahl: [
      { label: 'Ruhend stellen', tun: async () => { if (await handeln(g, 'archivieren', { ziel: 'ruhend' })) melden(`„${g.name}“ ruht jetzt`, async () => { const f = await frisch(g.id); if (f) await handeln(f, 'zurueckholen'); }); } },
      { label: 'Als aufgelöst markieren', ton: 'leise', tun: async () => { if (await handeln(g, 'archivieren', { ziel: 'aufgeloest' })) melden(`„${g.name}“ als aufgelöst markiert`, async () => { const f = await frisch(g.id); if (f) await handeln(f, 'zurueckholen'); }); } },
    ],
  });
  const zurueckholen = async (g: GAnzeige) => { if (await handeln(g, 'zurueckholen')) melden(`„${g.name}“ ist zurück`); };
  const loeschen = (g: GAnzeige) => {
    const weg = async () => { if (await handeln(g, 'loeschen')) melden(`„${g.name}“ im Papierkorb`, async () => { const f = await frisch(g.id); if (f) await handeln(f, 'wiederherstellen'); }); };
    const n = verweiseAnzahl(g.verweise);
    if (!n) return void weg();
    fragen({
      titel: `„${g.name}“ löschen?`, text: `${verweiseSatz(g.verweise)} Im Papierkorb bleibt sie 30 Tage wiederherstellbar; endgültig gelöscht wird sie erst, wenn nichts mehr an ihr hängt. Archivieren ist meist der bessere Weg.`,
      wahl: [{ label: 'Stattdessen archivieren', tun: () => archivieren(g) }, { label: 'In den Papierkorb', ton: 'gefahr', tun: weg }],
    });
  };
  const endgueltig = (g: GAnzeige) => fragen({
    titel: `„${g.name}“ endgültig löschen?`, text: <>Das lässt sich nicht rückgängig machen. <UnterlagenBleiben href={WEG.unterlagen(g.id)} /></>,
    wahl: [{ label: 'Endgültig löschen', ton: 'gefahr', tun: async () => { if (await handeln(g, 'endgueltig')) melden(`„${g.name}“ endgültig gelöscht`); } }],
  });

  const leer = sicht === 'liste'
    ? <Leerzustand symbol={<Building2 size={22} />} titel="Noch keine Gesellschaft">Lege die erste Gesellschaft mit „+ Gesellschaft“ an.</Leerzustand>
    : <Leer symbol={sicht === 'papierkorb' ? <Trash2 size={16} /> : undefined}>{sicht === 'archiv' ? 'Keine ruhende oder aufgelöste Gesellschaft.' : 'Der Papierkorb ist leer. Gelöschtes bleibt hier 30 Tage.'}</Leer>;

  return (
    <>
      {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
      <Karte>
        {!liste.length ? leer : (
          <Liste>
            {liste.map(g => {
              // 05.10.: eine Privat-Einheit (Selbstständigkeit) steht im Register (Struktur), gehört aber zum Privat-Bereich — sagen.
              const unter = [rechtsformLabel(g.rechtsform), g.sitz || g.ort, gesellschafterKurz(g, name), gehoertZuPrivat(g.id) ? 'gehört zu Privat' : null].filter(Boolean).join(' · ') || 'Steckbrief noch leer';
              const fest = istGesellschaft(g.id);
              const zeile = <Zeile titel={g.name} unter={unter} onClick={() => oeffne(g.id)} rechts={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>{!!g.luecken.length && sicht === 'liste' && <span style={klein} title={`Fehlt: ${g.luecken.join(', ')}`}>{g.luecken.length} offen</span>}<StatusPille s={g.status} /><span aria-hidden style={{ color: C.inkLeise }}>›</span></span>} />;
              if (sicht === 'papierkorb') {
                return <Zeile key={g.id} titel={g.name} unter={`gelöscht am ${g.geloeschtAm?.slice(8, 10)}.${g.geloeschtAm?.slice(5, 7)}. · ${verweiseAnzahl(g.verweise) ? verweiseSatz(g.verweise) : 'nichts hängt daran'}`}
                  rechts={<span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}><Knopf leise onClick={() => handeln(g, 'wiederherstellen').then(x => { if (x) melden(`„${g.name}“ wiederhergestellt`); })}>Wiederherstellen</Knopf>{!verweiseAnzahl(g.verweise) && <Knopf leise onClick={() => endgueltig(g)}>Endgültig löschen</Knopf>}</span>} />;
              }
              return (
                <ZeileAktionen key={g.id} titel={g.name} archiviert={sicht === 'archiv'} onArchivieren={() => (sicht === 'archiv' ? zurueckholen(g) : archivieren(g))} onLoeschen={fest ? undefined : () => loeschen(g)}>
                  {zeile}
                </ZeileAktionen>
              );
            })}
          </Liste>
        )}
      </Karte>
      {sicht === 'liste' && <div style={klein}>Die drei festen Gesellschaften kommen aus den Einstellungen und lassen sich nur archivieren. Weitere legst du mit „+ Gesellschaft“ an — z. B. eine Gesellschaft in Gründung oder eine, aus der eine andere hervorgeht.</div>}
      {dialog}
      {hinweis}
    </>
  );
}

/**
 * Unterlagen einer Gesellschaft bzw. eines Vertrags aus der Ablage (DSGVO-Nachtrag 04.10.) — auch nach dem endgültigen Löschen:
 * die Unterlagen bleiben (Aufbewahrungspflicht), der Bezug steht lesbar als „„Name“ (gelöscht)“ statt eines toten Links.
 */
function AblageAnsicht({ gesellschaftId, vertragId, zurueck }: { gesellschaftId: string; vertragId?: string; zurueck: () => void }) {
  type Bezug = { gesellschaft: { name: string; geloescht: boolean } | null; vertrag?: { titel: string; geloescht: boolean } };
  const [stand, setStand] = useState<{ eintraege: DateiEintrag[]; bezug: Bezug } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => {
    const u = new URLSearchParams({ id: gesellschaftId, ...(vertragId ? { vertrag: vertragId } : {}) });
    void fetch(`/api/gesellschaften/unterlagen?${u}`, { cache: 'no-store' }).then(r => r.json()).catch(() => null)
      .then(d => { if (d?.ok) { setStand({ eintraege: d.eintraege, bezug: d.bezug }); setFehler(null); } else setFehler(d?.fehler ?? 'Ablage nicht erreichbar.'); });
  }, [gesellschaftId, vertragId]);
  const b = stand?.bezug;
  const gText = !b?.gesellschaft ? 'Gesellschaft (gelöscht)' : b.gesellschaft.geloescht ? geloeschtText({ titel: b.gesellschaft.name }) : b.gesellschaft.name;
  return (
    <Seite titel="Unterlagen" unter="Aus der Dateiablage des Haushalts — verschlüsselt, nur der Haushalt des Inhabers."
      rechts={<Knopf leise onClick={zurueck}>Zum Register</Knopf>}>
      {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
      <Karte>
        <Ueberschrift>Bezug</Ueberschrift>
        <div style={{ display: 'grid', gap: 6, fontSize: TYP.body, color: C.ink }}>
          <span>Gesellschaft: {b?.gesellschaft && !b.gesellschaft.geloescht
            ? <Link href={WEG.unternehmen(gesellschaftId, 'unterlagen')} style={{ color: 'inherit' }}>{gText} ›</Link>
            : <span style={{ color: C.inkDim }}>{stand ? gText : '…'}</span>}</span>
          {vertragId && <span>Vertrag: {b?.vertrag && !b.vertrag.geloescht && b.gesellschaft && !b.gesellschaft.geloescht
            ? <Link href={WEG.unternehmen(gesellschaftId, 'vertraege')} style={{ color: 'inherit' }}>„{b.vertrag.titel}“ ›</Link>
            : <span style={{ color: C.inkDim }}>{b?.vertrag ? (b.vertrag.geloescht ? geloeschtText(b.vertrag) : `„${b.vertrag.titel}“`) : '…'}</span>}</span>}
        </div>
      </Karte>
      <Karte>
        <Ueberschrift>Unterlagen</Ueberschrift>
        {!stand ? <Leer>{fehler ? 'nicht geladen' : 'lädt …'}</Leer> : !stand.eintraege.length ? <Leer symbol={<FileText size={16} />}>Keine Unterlagen in der Ablage.</Leer> : (
          <Liste>{stand.eintraege.map(e => (
            <a key={e.id} href={`/api/crm/dateien?id=${encodeURIComponent(e.id)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <Zeile titel={e.titel || e.datei?.name || 'Unterlage'} unter={[e.art === 'vertrag' ? 'Vertrag' : 'Unterlage', tagText(e.hochgeladenAm.slice(0, 10)), e.datei?.name].filter(Boolean).join(' · ')} rechts={<span style={klein}>herunterladen ›</span>} />
            </a>
          ))}</Liste>
        )}
        <div style={{ ...klein, marginTop: 8 }}>Aufbewahrungspflicht: Unterlagen bleiben auch nach dem endgültigen Löschen einer Gesellschaft oder eines Vertrags in der Ablage (§ 257 HGB, § 147 AO — 6 bzw. 10 Jahre).</div>
      </Karte>
    </Seite>
  );
}

/** Struktur: „wer hält wen“ als ruhiger Baum mit Linien — ohne Effekt. */
function Struktur({ daten, oeffne }: { daten: RegisterDaten; oeffne: (id: string) => void }) {
  const baum = strukturBaum(daten.gesellschaften);
  const hatBeziehung = baum.some(k => k.kinder.length || k.fremde.length);
  return (
    <Karte>
      <Ueberschrift>Wer hält wen</Ueberschrift>
      {!hatBeziehung && <Leerzustand symbol={<Network size={22} />} titel="Noch keine Beteiligungen">Trage bei einer Gesellschaft unter „Gesellschafter“ eine andere eigene Gesellschaft ein — dann steht hier der Baum.</Leerzustand>}
      {hatBeziehung && <ul role="tree" aria-label="Beteiligungsstruktur" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>{baum.map(k => <Knoten key={k.id} k={k} daten={daten} oeffne={oeffne} tiefe={0} />)}</ul>}
      <div style={{ ...klein, marginTop: 10 }}>Abgeleitet aus den Gesellschafter-Einträgen — es wird nichts doppelt gespeichert. Fremde Beteiligungen stehen kursiv.</div>
    </Karte>
  );
}

function Knoten({ k, daten, oeffne, tiefe }: { k: StrukturKnoten; daten: RegisterDaten; oeffne: (id: string) => void; tiefe: number }) {
  const linie = tiefe ? { borderLeft: `1px solid ${RAND.stark}`, marginLeft: 10, paddingLeft: 14 } : {};
  return (
    <li role="treeitem" aria-selected={false} style={{ ...linie, display: 'grid', gap: 6 }}>
      <button type="button" onClick={() => oeffne(k.id)} className="fassbar" style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44, padding: '6px 10px', borderRadius: 12, border: `1px solid ${RAND.flaeche}`, background: 'rgba(255,255,255,.03)', color: C.ink, cursor: 'pointer', textAlign: 'left', fontFamily: SCHRIFT.text }}>
        {k.prozent !== undefined && <span style={{ fontSize: TYP.bedien, color: C.inkDim, fontVariantNumeric: 'tabular-nums', minWidth: 64 }}>{k.prozent.toLocaleString('de-DE', { maximumFractionDigits: 2 })} %</span>}
        <span style={{ fontSize: TYP.body, fontWeight: 600, flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{k.name}{k.schonGezeigt ? ' (siehe oben)' : ''}</span>
        <StatusPille s={k.status} />
      </button>
      {(k.kinder.length > 0 || k.fremde.length > 0) && (
        <ul role="group" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
          {k.kinder.map(x => <Knoten key={`${k.id}-${x.id}`} k={x} daten={daten} oeffne={oeffne} tiefe={tiefe + 1} />)}
          {k.fremde.map(f => (
            <li key={`${k.id}-f-${f.firmaId}`} role="treeitem" aria-selected={false} style={{ borderLeft: `1px solid ${RAND.stark}`, marginLeft: 10, paddingLeft: 14 }}>
              <span style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 40, padding: '6px 10px', fontSize: TYP.bedien, color: C.inkDim, fontStyle: 'italic' }}>
                {f.anteilProzent !== undefined && <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 64 }}>{f.anteilProzent.toLocaleString('de-DE')} %</span>}
                <Link href={WEG.firma(f.firmaId)} style={{ color: 'inherit' }}>{bezugName({ art: 'firma', id: f.firmaId }, daten.namen)}</Link>
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

