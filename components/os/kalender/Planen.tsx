'use client';

// ─── Kalender — Modus „Planen“ (29.09., Paket K5) ───────────────────────────
// Kevin 29.09.: „Ein Kalender, Planen als Modus.“ Der frühere Wochenplaner (/os/planung/woche) ist jetzt ein Modus im
// Kalender (`/os/kalender?modus=planen`) — dasselbe Zeitraster, dieselben Termine. Was dazukommt:
//   · Stunden der Woche (h belegt · h Termine · h Blöcke · Aufgaben offen · fällig diese Woche) und je Tag;
//   · Bausteine (Fokus, Reha, Pause, Blockzeit), Routinen, „Aufgaben einplanen“ und „Eigener Block“: antippen →
//     in den Kalender klicken oder aufziehen → der Block entsteht als iCloud-Termin (Art Fokus/Block, lib/planung/
//     bloecke.ts) — ein Block IST ein Termin: verschieben, Dauer, löschen wie jeder Termin (mit ETag);
//   · ZOE belegt die Woche (Vorschlag; „Übernehmen“ legt die Blöcke an — nichts ohne Klick);
//   · Fokus der Woche + Ziele/Meilensteine (Planung gegen Ziele, nicht ins Blaue);
//   · die Übernahme der alten Wochenplan-Blöcke (einmal, mit Vorschau) und ihr Archiv (vergangene Blöcke, nur lesen).
// Tippen statt Ziehen: funktioniert am Handy genauso (HTML-Ziehen gibt es auf Touch nicht).

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Leer, Knopf, Zahl, Segmente, Chip, feld, LEUCHT } from '../schlank';
import { ART_FARBE, type PlanArt } from '@/types/planer';
import { useTasks } from '@/context/TasksContext';
import { einheitKurz } from '@/lib/aufgaben/einheit';
import { SAEULE_VON_PROJEKT, FOKUS_SCHWELLE } from '@/lib/make-one/fokus-data';
import { fokusFuerSpace } from '@/lib/make-one/space-regeln';
import { useSpace } from '@/hooks/useSpace';
import { blockAnfrage, wochenStunden, planArtVon } from '@/lib/planung/bloecke';
import { uebernahmeTexte, type ArchivBlock } from '@/lib/planung/wochenplan-uebernahme';
import { wandAus } from '@/lib/kalender/zeit';
import { ZieleMeilensteine } from '../planung/ZieleMeilensteine';
import { WEG } from '@/lib/wege';
import type { KTermin, Wer } from './teile';

/** Was man gerade platziert (antippen → in den Kalender klicken). */
export interface Baustein { art: PlanArt; titel: string; dauerMin: number; taskId?: string }

const BAUSTEINE: Baustein[] = [
  { art: 'fokus', titel: 'Fokus (Deep Work)', dauerMin: 90 },
  { art: 'reha', titel: 'Reha / Rücken', dauerMin: 30 },
  { art: 'pause', titel: 'Pause', dauerMin: 15 },
  { art: 'block', titel: 'Blockzeit', dauerMin: 60 },
];
const ART_LABEL: Record<PlanArt, string> = { fokus: 'Fokus', reha: 'Reha', routine: 'Routine', pause: 'Pause', aufgabe: 'Aufgabe', block: 'Block' };
const DAUERN = [15, 30, 60, 90, 120].map(d => ({ id: String(d), label: d < 60 ? `${d}m` : `${d / 60}h` }));
const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const fmtH = (min: number) => (min / 60).toFixed(1).replace('.', ',');

interface VorschlagBlock { date: string; startMin: number; dauerMin: number; titel: string; art: PlanArt; taskId?: string }
interface Vorschau { icloud: boolean; offen: number; laeuft: boolean; uebersprungen: number; unterbrochen: boolean; zuruecknehmbar: number; archiv?: string; personen: { person: string; zukuenftig: number; mitApple: number; vergangen: number; schon: number; uebersprungen: number; beispiele: { tag: string; zeit: string; titel: string; art: string }[] }[] }

/** Ein Archiv-Block (alter Wochenplan) als schreibgeschützter Eintrag im Raster — gestrichelt, Klick erklärt. */
export const istArchivTermin = (t: Pick<KTermin, 'id'>) => t.id.startsWith('archiv:');
function archivAlsTermin(b: ArchivBlock): KTermin {
  const wer: Wer = b.wer === 'malin' ? 'malin' : b.wer === 'kevin' ? 'kevin' : 'beide';
  return {
    id: b.id, uid: b.id, titel: b.wartet ? `${b.titel} (wartet auf Übernahme)` : b.titel, start: wandAus(b.date, b.startMin), ende: wandAus(b.date, b.startMin + b.dauerMin),
    ganztags: false, kalender: 'Wochenplan (alt)', wer, serie: false, mitTeilnehmern: false, bearbeitbar: false,
    art: b.art === 'fokus' ? 'fokus' : 'block', beschaeftigt: true, vorlaeufig: true, ...(b.art !== 'fokus' && b.art !== 'block' ? { blockArt: b.art } : {}),
  } as KTermin;
}

/** Farbe eines Blocks (Art/Unterart) — die Palette der Planer-Arten (types/planer.ts). */
export function blockFarbe(t: KTermin & { blockArt?: string }): string | null {
  const a = planArtVon(t);
  return a && a !== 'fokus' ? ART_FARBE[a] : null;
}

export function usePlanen({ aktiv, tage, termine, sicht, laden, melden }: {
  aktiv: boolean; tage: string[]; termine: KTermin[]; sicht: 'alle' | Wer;
  laden: () => Promise<void> | void; melden: (text: string | null) => void;
}) {
  const { state: aufgabenStand } = useTasks();
  const { ausAdresse: spaceAusAdresse } = useSpace();
  const [gewaehlt, setGewaehlt] = useState<Baustein | null>(null);
  const [ich, setIch] = useState<Wer>('kevin');
  const [routinen, setRoutinen] = useState<{ id: string; label: string; dauerMin: number }[]>([]);
  const [regler, setRegler] = useState<Record<string, number>>({});
  const [ziele, setZiele] = useState<{ fokus?: Record<string, string> }>({});
  const [neuTitel, setNeuTitel] = useState('');
  const [neuDauer, setNeuDauer] = useState(60);
  const [neuArt, setNeuArt] = useState<PlanArt>('block');
  const [vorschlag, setVorschlag] = useState<{ begruendung: string; bloecke: VorschlagBlock[]; verworfen: number } | null>(null);
  const [zoeDenkt, setZoeDenkt] = useState(false);
  const [archiv, setArchiv] = useState<ArchivBlock[]>([]);
  const [uebernahme, setUebernahme] = useState<Vorschau | null>(null);
  const [uebernahmeLaeuft, setUebernahmeLaeuft] = useState(false);

  useEffect(() => {
    if (!aktiv) return;
    fetch('/api/konto/ich').then(r => r.json()).then(d => { if (d.ich?.speicher === 'malin') setIch('malin'); }).catch(() => {});
    fetch('/api/state/routinen').then(r => r.json()).then(d => setRoutinen(((d.routinen ?? []) as { id: string; label: string; dauerMin: number; aktiv: boolean }[]).filter(x => x.aktiv))).catch(() => {});
    fetch('/api/state/fokus-regler').then(r => r.json()).then(d => setRegler(d.regler ?? {})).catch(() => {});
    fetch('/api/state/ziele').then(r => r.json()).then(d => setZiele({ fokus: d.fokus ?? {} })).catch(() => {});
  }, [aktiv]);

  // Archiv (alte, nicht übernommene Blöcke) des Zeitraums — nur lesen. Sicht: die eigenen bzw. die der gewählten Person.
  const von = tage[0], bis = tage.length ? wandAus(tage[tage.length - 1], 24 * 60).slice(0, 10) : '';
  const archivLaden = useCallback(async () => {
    if (!aktiv || !von) return;
    const fuer = sicht === 'kevin' || sicht === 'malin' ? sicht : 'alle';
    const d = await fetch(`/api/planung/bloecke?von=${von}&bis=${bis}&fuer=${fuer}`, { cache: 'no-store' }).then(r => r.json()).catch(() => null);
    setArchiv(((d?.bloecke ?? []) as ArchivBlock[]).filter(b => b.quelle === 'archiv' && !b.gespiegelt));
  }, [aktiv, von, bis, sicht]);
  const uebernahmeLaden = useCallback(async () => {
    if (!aktiv) return;
    const d = await fetch('/api/planung/uebernahme', { cache: 'no-store' }).then(r => r.json()).catch(() => null);
    if (d?.ok) setUebernahme(d);
  }, [aktiv]);
  useEffect(() => { void archivLaden(); }, [archivLaden]);
  useEffect(() => { void uebernahmeLaden(); }, [uebernahmeLaden]);

  // Esc bricht das Platzieren ab.
  useEffect(() => {
    if (!gewaehlt) return;
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape') setGewaehlt(null); };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [gewaehlt]);

  /** Wessen Kalender bekommt den Block? Sicht Kevin/Malin → diese Person, sonst die eigene. */
  const wer: Wer = sicht === 'kevin' || sicht === 'malin' ? sicht : ich;

  /** Einen Block als iCloud-Termin anlegen. */
  const blockAnlegen = useCallback(async (b: Baustein, tag: string, startMin: number): Promise<boolean> => {
    const r = await fetch('/api/kalender/termin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(blockAnfrage({ date: tag, startMin, dauerMin: b.dauerMin, titel: b.titel, art: b.art, ...(b.taskId ? { taskId: b.taskId } : {}) }, wer)) })
      .then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    if (!r.ok) { melden(r.fehler ?? 'Block konnte nicht angelegt werden.'); return false; }
    melden(r.hinweis ?? null);
    return true;
  }, [wer, melden]);

  /** Klick/Aufziehen im Raster, während ein Baustein gewählt ist. true = übernommen (kein Termin-Dialog). */
  const platzieren = useCallback((tag: string, startMin: number, endeMin?: number): boolean => {
    if (!aktiv || !gewaehlt) return false;
    const b = { ...gewaehlt, ...(endeMin && endeMin > startMin ? { dauerMin: endeMin - startMin } : {}) };
    setGewaehlt(null);
    void blockAnlegen(b, tag, startMin).then(ok => { if (ok) void laden(); });
    return true;
  }, [aktiv, gewaehlt, blockAnlegen, laden]);

  // ── Zahlen der Woche ──
  const archivTermine = useMemo(() => (aktiv ? archiv.map(archivAlsTermin) : []), [aktiv, archiv]);
  const stunden = useMemo(() => wochenStunden([...termine, ...archivTermine], tage), [termine, archivTermine, tage]);
  const offeneN = aufgabenStand.tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length;
  const faelligWoche = aufgabenStand.tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled' && t.dueDate && t.dueDate.slice(0, 10) >= tage[0] && t.dueDate.slice(0, 10) <= tage[tage.length - 1]).length;
  // Überladen: mehr als 50 h in einer Woche bzw. mehr als 10 h an einem Tag (wie früher im Wochenplaner).
  const ueberladen = stunden.gesamtMin / 60 > (tage.length >= 7 ? 50 : 10 * tage.length);

  // Aufgaben einplanen: offene, noch nicht in dieser Woche geblockte (Bezug aufgabeId am Block), Priorität vor Fokus-Regler.
  const offeneAufgaben = useMemo(() => {
    const rank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const geplant = new Set([...termine.map(t => t.bezug?.aufgabeId).filter(Boolean), ...archiv.map(b => b.taskId).filter(Boolean)]);
    const boost = (t: { projectId?: string }) => regler[SAEULE_VON_PROJEKT[t.projectId ?? ''] ?? ''] ?? 50;
    return aufgabenStand.tasks
      .filter(t => t.status !== 'done' && t.status !== 'cancelled' && !geplant.has(t.id))
      .sort((a, b) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9) || boost(b) - boost(a) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
      .slice(0, 8)
      .map(t => ({ ...t, imFokus: boost(t) >= FOKUS_SCHWELLE }));
  }, [aufgabenStand.tasks, termine, archiv, regler]);

  async function zoeBelegen() {
    setZoeDenkt(true); setVorschlag(null);
    const d = await fetch('/api/planung/vorschlag', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ woche: tage[0] }) }).then(r => r.json()).catch(() => null);
    if (Array.isArray(d?.bloecke)) setVorschlag({ begruendung: d.begruendung ?? '', bloecke: d.bloecke, verworfen: d.verworfen ?? 0 });
    else melden(d?.error ?? d?.fehler ?? 'ZOE konnte gerade nicht planen.');
    setZoeDenkt(false);
  }
  async function vorschlagUebernehmen() {
    if (!vorschlag) return;
    let n = 0;
    for (const b of vorschlag.bloecke) {
      if (await blockAnlegen({ art: b.art, titel: b.titel, dauerMin: b.dauerMin, ...(b.taskId ? { taskId: b.taskId } : {}) }, b.date, b.startMin)) n++;
    }
    setVorschlag(null);
    melden(n ? null : 'Kein Block angelegt.');
    void laden();
  }

  /** Übernahme bzw. „Erneut versuchen“ (U1 M1: übersprungene freigeben, eine unterbrochene fortsetzen). */
  async function uebernehmen(aktion: 'ausfuehren' | 'erneut' = 'ausfuehren') {
    if (!uebernahme) return;
    if (aktion === 'ausfuehren' && (!uebernahme.offen || !window.confirm(uebernahmeTexte(uebernahme.offen).frage))) return;
    setUebernahmeLaeuft(true);
    const r = await fetch('/api/planung/uebernahme', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion }) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    setUebernahmeLaeuft(false);
    melden(r.ok ? (r.uebersprungen ? `${r.uebersprungen} Block/Blöcke ließen sich nicht übernehmen — „Erneut versuchen“ in der Karte.` : null) : `${r.fehler ?? 'Übernahme unterbrochen.'}${r.weiter ? ` ${r.weiter}` : ''}`);
    await Promise.all([uebernahmeLaden(), archivLaden(), laden()]);
  }

  /** „Übernahme zurücknehmen“ (U1 H1, nur für den Rückweg zur alten Version): Probelauf → Rückfrage mit Zahlen → löschen. */
  async function zuruecknehmen() {
    const post = (bestaetigt: boolean) => fetch('/api/planung/uebernahme', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'zuruecknehmen', bestaetigt }) })
      .then(x => x.json() as Promise<{ ok: boolean; termine?: number; gesperrt?: number; geloescht?: number; fehler?: number | string; grund?: string }>).catch(() => ({ ok: false, grund: 'Keine Verbindung.' } as { ok: boolean; grund?: string; termine?: number; gesperrt?: number }));
    const p = await post(false);
    if (!p.ok) { melden(p.grund ?? 'Zurücknehmen geht gerade nicht.'); return; }
    const n = p.termine ?? 0, g = p.gesperrt ?? 0;
    if (!window.confirm(`Übernahme zurücknehmen? ${n} ${n === 1 ? 'Termin' : 'Termine'} aus der Übernahme (${n === 1 ? 'Kennung' : 'Kennungen'} „makeos-wochenplan-…“) werden in iCloud gelöscht${g ? ` — ${g} davon mit Gästen/Serie bleiben stehen` : ''}. Änderungen, die ihr seitdem an diesen Blöcken gemacht habt, gehen verloren. Nur für den Rückweg zur alten Version.`)) return;
    setUebernahmeLaeuft(true);
    const r = await post(true);
    setUebernahmeLaeuft(false);
    melden(r.ok ? null : r.grund ?? `Nicht alles zurückgenommen (${'geloescht' in r ? r.geloescht ?? 0 : 0} gelöscht, ${g} gesperrt).`);
    await Promise.all([uebernahmeLaden(), archivLaden(), laden()]);
  }

  const fokus = fokusFuerSpace(ziele.fokus, spaceAusAdresse);
  const chip = (b: Baustein, farbe: string, inhalt: React.ReactNode, key: string, breit?: number) => {
    const an = gewaehlt?.titel === b.titel && gewaehlt.art === b.art && gewaehlt.taskId === b.taskId;
    return (
      <button key={key} type="button" onClick={() => setGewaehlt(an ? null : b)} aria-pressed={an} className="fassbar"
        style={{ display: 'inline-block', maxWidth: breit ?? '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle', border: `1px solid ${an ? farbe : 'transparent'}`, background: `${farbe}${an ? '40' : '22'}`, color: farbe, borderRadius: 999, padding: '5px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: SCHRIFT.text, boxShadow: an ? `0 0 0 2px ${farbe}33` : undefined }}>{inhalt}</button>
    );
  };

  /** Über dem Raster: Stunden der Woche, je Tag, Hinweis beim Platzieren. */
  const zeitraum = tage.length === 1 ? 'Dieser Tag' : tage.length === 7 ? 'Diese Woche' : `Diese ${tage.length} Tage`;
  const kopf = !aktiv ? null : (
    <div style={{ display: 'grid', gap: 8 }}>
      <Karte i={0} akzent={ueberladen ? LEUCHT.achtung : undefined}>
        <Ueberschrift farbe={ueberladen ? LEUCHT.achtung : LEUCHT.puls} rechts={ueberladen ? <Chip farbe={LEUCHT.achtung}>überladen, Ruhe braucht Luft</Chip> : 'Termine + Blöcke'}>{zeitraum}</Ueberschrift>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12 }}>
          <Zahl wert={stunden.gesamtMin ? fmtH(stunden.gesamtMin) : undefined} label="h belegt" farbe={ueberladen ? LEUCHT.achtung : LEUCHT.puls} />
          <Zahl wert={stunden.terminMin ? fmtH(stunden.terminMin) : undefined} label="h Termine" />
          <Zahl wert={stunden.blockMin ? fmtH(stunden.blockMin) : undefined} label="h Blöcke" />
          <Link href={WEG.aufgaben()} style={{ textDecoration: 'none', color: 'inherit' }}><Zahl wert={offeneN ? String(offeneN) : undefined} label="Aufgaben offen ›" /></Link>
          <Link href={WEG.aufgaben()} style={{ textDecoration: 'none', color: 'inherit' }}><Zahl wert={faelligWoche ? String(faelligWoche) : undefined} label={tage.length === 1 ? 'fällig an diesem Tag ›' : 'fällig im Zeitraum ›'} farbe={faelligWoche ? LEUCHT.achtung : undefined} /></Link>
        </div>
        {tage.length > 1 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {tage.map((tag, i) => { const h = (stunden.jeTag[tag] ?? 0) / 60; const f = h > 10 ? LEUCHT.kritisch : h > 8 ? LEUCHT.achtung : C.inkLeise; return (
              <span key={tag} title={h > 10 ? 'überladen — Ruhe braucht Luft' : h > 8 ? 'voll — Pausen ernst nehmen' : 'Auslastung'} style={{ fontSize: 11.5, color: f, fontVariantNumeric: 'tabular-nums', background: 'rgba(255,255,255,.04)', borderRadius: 8, padding: '3px 8px' }}>{WD[i] ?? tag.slice(8)} {fmtH(h * 60)} h</span>
            ); })}
          </div>
        )}
      </Karte>
      {gewaehlt && (
        <div role="status" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien, color: C.ink, background: `${ART_FARBE[gewaehlt.art]}1c`, border: `1px solid ${ART_FARBE[gewaehlt.art]}55`, borderRadius: 10, padding: '8px 12px' }}>
          <span><b style={{ color: ART_FARBE[gewaehlt.art] }}>{gewaehlt.titel}</b> · {gewaehlt.dauerMin} Min — jetzt in den Kalender klicken (oder aufziehen). Er landet im Kalender {wer === 'malin' ? 'von Malin' : wer === 'kevin' ? 'von Kevin' : 'Gemeinsam'}.</span>
          <button type="button" onClick={() => setGewaehlt(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: SCHRIFT.text }}>Abbrechen (Esc)</button>
        </div>
      )}
    </div>
  );

  /** Linke Leiste: Bausteine, Routinen, Aufgaben, eigener Block, Übernahme. */
  const leiste = !aktiv ? null : (
    <div style={{ display: 'grid', gap: 12 }}>
      {!!uebernahme && !uebernahme.offen && (uebernahme.uebersprungen > 0 || uebernahme.unterbrochen) && (
        <Karte i={1} akzent={LEUCHT.achtung}>
          <Ueberschrift farbe={LEUCHT.achtung}>Alter Wochenplan</Ueberschrift>
          <div style={{ fontSize: 12.5, color: C.inkDim, lineHeight: 1.5 }}>
            {uebernahme.unterbrochen ? 'Die Übernahme wurde unterbrochen (iCloud nicht erreichbar) und läuft von selbst weiter. ' : ''}
            {uebernahme.uebersprungen ? `${uebernahme.uebersprungen} ${uebernahme.uebersprungen === 1 ? 'Block ließ' : 'Blöcke ließen'} sich nicht übernehmen und ${uebernahme.uebersprungen === 1 ? 'bleibt' : 'bleiben'} im Archiv.` : ''}
          </div>
          <div style={{ marginTop: 10 }}>
            <Knopf farbe={LEUCHT.achtung} aus={uebernahmeLaeuft || !uebernahme.icloud || uebernahme.laeuft} onClick={() => uebernehmen('erneut')}>{uebernahmeLaeuft || uebernahme.laeuft ? 'übernimmt …' : 'Erneut versuchen'}</Knopf>
          </div>
        </Karte>
      )}
      {!!uebernahme?.offen && (
        <Karte i={1} akzent={LEUCHT.achtung}>
          <Ueberschrift farbe={LEUCHT.achtung}>Alter Wochenplan</Ueberschrift>
          <div style={{ fontSize: 12.5, color: C.inkDim, lineHeight: 1.5 }}>
            {uebernahmeTexte(uebernahme.offen).karte}
          </div>
          <div role="note" style={{ fontSize: 12.5, color: LEUCHT.achtung, lineHeight: 1.5, marginTop: 8, fontWeight: 600 }}>
            {uebernahmeTexte(uebernahme.offen).warnung}
          </div>
          <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
            {uebernahme.personen.filter(p => p.zukuenftig).map(p => (
              <div key={p.person} style={{ fontSize: 12, color: C.inkDim }}>
                <b style={{ color: C.ink }}>{p.person === 'malin' ? 'Malin' : p.person === 'kevin' ? 'Kevin' : p.person}</b>: {p.zukuenftig} künftig{p.mitApple ? ` (${p.mitApple} schon in Apple)` : ''} · {p.vergangen} vergangen (Archiv)
                <div style={{ color: C.inkLeise }}>{p.beispiele.map(x => `${x.tag.slice(8)}.${x.tag.slice(5, 7)}. ${x.zeit} ${x.titel}`).join(' · ')}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10 }}>
            <Knopf farbe={LEUCHT.achtung} aus={uebernahmeLaeuft || !uebernahme.icloud || uebernahme.laeuft} onClick={() => uebernehmen()}>{uebernahmeLaeuft || uebernahme.laeuft ? 'übernimmt …' : uebernahme.icloud ? 'Jetzt übernehmen' : 'Erst iCloud verbinden'}</Knopf>
            {uebernahme.uebersprungen > 0 && <span style={{ marginLeft: 8, fontSize: 12, color: C.inkLeise }}>{uebernahme.uebersprungen} übersprungen</span>}
          </div>
        </Karte>
      )}
      {!!uebernahme && !uebernahme.offen && !uebernahme.unterbrochen && uebernahme.zuruecknehmbar > 0 && (
        <div style={{ fontSize: 12, color: C.inkLeise, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>Alter Wochenplan übernommen ({uebernahme.zuruecknehmbar} {uebernahme.zuruecknehmbar === 1 ? 'Termin' : 'Termine'}).</span>
          <Knopf leise aus={uebernahmeLaeuft} onClick={() => void zuruecknehmen()}>Übernahme zurücknehmen …</Knopf>
        </div>
      )}
      <Karte i={1}>
        <Ueberschrift rechts={<span style={{ fontSize: 11.5, color: C.inkLeise }}>antippen, dann in den Kalender</span>}>Bausteine</Ueberschrift>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {BAUSTEINE.map(b => chip(b, ART_FARBE[b.art], `${b.titel} · ${b.dauerMin}m`, `b-${b.art}`))}
        </div>
        <div style={{ marginTop: 12 }}>
          <Ueberschrift rechts={<Link href={WEG.routinen()} style={{ fontSize: 12, color: C.aktiv, textDecoration: 'none', fontWeight: 600 }}>planen ›</Link>}>Routinen</Ueberschrift>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {routinen.map(r => chip({ art: 'routine', titel: r.label, dauerMin: r.dauerMin || 30 }, ART_FARBE.routine, r.label, `r-${r.id}`))}
            {!routinen.length && <Leer>Noch keine Routinen — im Routine-Planer anlegen.</Leer>}
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Ueberschrift rechts={<span style={{ fontSize: 11.5, color: C.inkLeise }}>◎ = <Link href="/os/kompass" style={{ color: C.aktiv, textDecoration: 'none' }}>im Fokus</Link></span>}>Aufgaben einplanen</Ueberschrift>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {offeneAufgaben.map(t => chip({ art: 'aufgabe', titel: t.title, dauerMin: 60, taskId: t.id }, t.imFokus ? LEUCHT.schlaf : ART_FARBE.aufgabe,
              <>{t.priority === 'critical' ? '‼ ' : ''}{t.imFokus ? '◎ ' : ''}{t.einheit ? <span style={{ opacity: 0.75 }}>{einheitKurz(t.einheit)} · </span> : null}{t.title}</>, `a-${t.id}`, 240))}
            {!offeneAufgaben.length && <Leer>Alles eingeplant oder erledigt.</Leer>}
          </div>
          <div style={{ fontSize: 11.5, color: C.inkLeise, marginTop: 6, lineHeight: 1.45 }}>Ein Aufgaben-Block reserviert Arbeitszeit — die Deadline der Aufgabe bleibt, wie sie ist.</div>
        </div>
      </Karte>
      <Karte i={2}>
        <Ueberschrift farbe={ART_FARBE[neuArt]}>Eigener Block</Ueberschrift>
        <div style={{ display: 'grid', gap: 8 }}>
          <input value={neuTitel} onChange={e => setNeuTitel(e.target.value)} placeholder="Wofür? z. B. Steuerberater anrufen" aria-label="Titel des eigenen Blocks" style={{ ...feld, fontSize: 13 }} />
          <div style={{ maxWidth: '100%', overflowX: 'auto' }}><Segmente liste={DAUERN} aktiv={String(neuDauer)} onWahl={id => setNeuDauer(Number(id))} /></div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['block', 'fokus', 'reha', 'pause'] as const).map(a => (
              <button key={a} type="button" className="fassbar" onClick={() => setNeuArt(a)} aria-pressed={neuArt === a}
                style={{ fontFamily: SCHRIFT.text, fontSize: 12.5, fontWeight: 700, padding: '6px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', background: neuArt === a ? `${ART_FARBE[a]}26` : 'rgba(255,255,255,.05)', color: neuArt === a ? ART_FARBE[a] : C.inkDim }}>{ART_LABEL[a]}</button>
            ))}
          </div>
          <div><Knopf leise onClick={() => setGewaehlt({ art: neuArt, titel: neuTitel.trim() || (neuArt === 'block' ? 'Blockzeit' : ART_LABEL[neuArt]), dauerMin: neuDauer })}>Platzieren</Knopf></div>
          <div style={{ fontSize: 11.5, color: C.inkLeise, lineHeight: 1.45 }}>Blöcke sind Termine in iCloud (auf allen Geräten), beschäftigt — ziehen verschiebt, im Termin-Fenster „frei“ stellen, wenn er keine Zeit sperren soll.</div>
        </div>
      </Karte>
    </div>
  );

  /** Unter dem Raster: Fokus, Ziele, ZOE. */
  const unten = !aktiv ? null : (
    <div style={{ display: 'grid', gap: 12 }}>
      {(fokus.woche || fokus.monat) && (
        <Karte i={1}>
          <Ueberschrift farbe={LEUCHT.schlaf} rechts={<Link href="/os/planung/monat" style={{ fontSize: 12, color: C.aktiv, textDecoration: 'none', fontWeight: 600 }}>Monatsziele ›</Link>}>Fokus</Ueberschrift>
          <div style={{ fontFamily: SCHRIFT.display, fontSize: 'clamp(16px,2vw,18px)', fontWeight: 600, lineHeight: 1.4 }}><span style={{ color: LEUCHT.schlaf }}>◎</span> {fokus.woche || fokus.monat}</div>
        </Karte>
      )}
      <ZieleMeilensteine horizont="woche" farbe={LEUCHT.schlaf} i={1} kompakt />
      <Karte i={2} akzent={LEUCHT.agenten}>
        <Ueberschrift farbe={LEUCHT.agenten}>ZOE belegt die Woche</Ueberschrift>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Knopf onClick={zoeBelegen} aus={zoeDenkt} farbe={LEUCHT.agenten}>{zoeDenkt ? 'ZOE plant …' : '✨ ZOE belegt die Woche'}</Knopf>
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Reha täglich · Fokus vormittags · Routinen · Aufgaben nach Priorität — um die festen Termine herum. Ein Vorschlag: angelegt wird erst auf deinen Klick.</span>
        </div>
        {vorschlag && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.06)' }}>
            <Ueberschrift farbe={LEUCHT.agenten} rechts={`${vorschlag.bloecke.length} Blöcke${vorschlag.verworfen ? ` · ${vorschlag.verworfen} verworfen (kollidierten mit Terminen)` : ''}`}>ZOE&apos; Vorschlag</Ueberschrift>
            <div style={{ fontSize: TYP.body, color: C.inkDim, lineHeight: 1.5 }}>{vorschlag.begruendung}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <Knopf farbe={LEUCHT.agenten} onClick={() => vorschlagUebernehmen()}>{`${vorschlag.bloecke.length} Blöcke anlegen`}</Knopf>
              <Knopf leise onClick={() => setVorschlag(null)}>Verwerfen</Knopf>
            </div>
          </div>
        )}
      </Karte>
    </div>
  );

  return { kopf, leiste, unten, platzieren, gewaehlt, archivTermine };
}
