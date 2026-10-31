'use client';

// ─── Haushalt → Finanzplanung: Karte über den Blättern (31.10.) ─────────────────────────────────────────────────────────────────────────────
// Zeigt, was aus dem Haushalt kommt, und legt den Schalter je Haushalt um (`/haushaltBruecke`). Im Altbestand (noch nicht entschieden) die
// Vorschau „das würde sich ändern“ mit „Übernehmen“ — vorher ändert sich keine Zahl. Nur Privat (der Server liefert `haushaltQuelle` nur dort).
// Regeln und Rechnung: lib/finanzen/plan/haushalt-bruecke.ts.

import Link from 'next/link';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Hinweis, Knopf } from '../ui';
import { WEG } from '@/lib/wege';
import { eur } from '@/lib/finanzen/plan/hilfen';
import type { Eckwerte, HaushaltQuelle } from '@/lib/finanzen/plan/haushalt-bruecke';
import { usePlan } from './daten';
import { Geld } from './teile';

const ZEIGEN = 6;
const linkStil = { color: C.aktiv, textDecoration: 'none' } as const;

/** Monat „JJJJ-MM“ → „Okt 26“. */
const monatKurz = (m: string) => { const [j, mo] = m.split('-').map(Number); return `${['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'][mo - 1] ?? m} ${String(j).slice(2)}`; };

function Umfang({ q }: { q: HaushaltQuelle }) {
  const teile: { text: string; weg: string }[] = [];
  if (q.umfang.fixkosten) teile.push({ text: `${q.umfang.fixkosten} Fixkosten`, weg: WEG.privat('fixkosten') });
  if (q.umfang.kredite) teile.push({ text: `${q.umfang.kredite} ${q.umfang.kredite === 1 ? 'Kredit' : 'Kredite'}`, weg: WEG.privat('schulden') });
  if (q.umfang.monate) teile.push({ text: `Ist aus ${q.umfang.monate} ${q.umfang.monate === 1 ? 'Monat' : 'Monaten'} (${q.umfang.buchungen} Buchungen)`, weg: WEG.privat('buchungen') });
  if (q.konten) teile.push({ text: 'Kontostände', weg: q.konten });
  if (!teile.length) return <span>noch nichts</span>;
  return <>{teile.map((t, i) => <span key={t.text}>{i ? ' · ' : ''}<Link href={t.weg} style={linkStil}>{t.text}</Link></span>)}</>;
}

function Vergleich({ vorher, nachher }: { vorher: Eckwerte; nachher: Eckwerte }) {
  const zeilen: { name: string; a: number; b: number; geld: boolean }[] = [
    { name: `Bedarf ${vorher.monat}`, a: vorher.bedarf, b: nachher.bedarf, geld: true },
    { name: `Schulden ${vorher.monat}`, a: vorher.schulden, b: nachher.schulden, geld: true },
    { name: `Luft ${vorher.monat}`, a: vorher.luft, b: nachher.luft, geld: true },
    { name: 'Angespart am Planende', a: vorher.angespart, b: nachher.angespart, geld: true },
    { name: 'Monate mit Ist', a: vorher.istMonate, b: nachher.istMonate, geld: false },
  ];
  return (
    <table className="ui-tabelle" style={{ width: '100%', fontSize: TYP.bedien, marginTop: 8 }}>
      <thead><tr><th style={{ textAlign: 'left' }}></th><th style={{ textAlign: 'right' }}>heute</th><th style={{ textAlign: 'right' }}>mit Haushalt</th></tr></thead>
      <tbody>{zeilen.map(z => (
        <tr key={z.name} style={{ color: z.a === z.b ? C.inkDim : C.ink }}>
          <td>{z.name}</td>
          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{z.geld ? <Geld v={z.a} einheit=" €" farbe={C.inkDim} /> : z.a}</td>
          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: z.a === z.b ? 400 : 700 }}>{z.geld ? <Geld v={z.b} einheit=" €" farbe={z.a === z.b ? C.inkDim : C.ink} /> : z.b}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}

function Liste<T>({ titel, liste, zeile }: { titel: string; liste: T[]; zeile: (x: T) => string }) {
  if (!liste.length) return null;
  return (
    <div style={{ marginTop: 8, fontSize: TYP.bedien }}>
      <b style={{ color: C.ink }}>{titel}</b>
      <div style={{ color: C.inkDim, lineHeight: 1.5 }}>{liste.slice(0, ZEIGEN).map(zeile).join(' · ')}{liste.length > ZEIGEN ? ` · +${liste.length - ZEIGEN} weitere` : ''}</div>
    </div>
  );
}

export function HaushaltBruecke() {
  const { d, aendere, sicht, bereich, verbergen } = usePlan();
  /** Beträge in den Listen — beim Verbergen ohne Zahl (wie die übrigen Beträge der Finanzplanung). */
  const betrag = (v: number, nach = ' €') => (verbergen ? '' : ` ${eur(v)}${nach}`);
  const q = d.haushaltQuelle;
  if (!q || sicht === 'business' || bereich === 'business') return null;
  const setze = (an: boolean | null) => aendere([{ pfad: '/haushaltBruecke', alt: d.haushaltBruecke, ...(an === null ? {} : { neu: { an } }) }], an ? 'Haushalt speist die Finanzplanung: an' : an === false ? 'Haushalt speist die Finanzplanung: aus' : 'Haushalt → Finanzplanung zurückgesetzt');

  if (q.fehler) return <Hinweis art="achtung" titel="Haushalt nicht lesbar">{q.fehler}</Hinweis>;

  if (q.zustand === 'an') {
    const hand = q.vonHand.filter(v => v.art !== 'monat').length, monateHand = q.vonHand.filter(v => v.art === 'monat').length;
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim }} role="status">
        <span><b style={{ color: C.ink }}>Aus dem Haushalt:</b> <Umfang q={q} />{hand || monateHand ? <> · von Hand bleibt: {[hand ? `${hand} Posten` : '', monateHand ? `${monateHand} ${monateHand === 1 ? 'Monat' : 'Monate'} Ist` : ''].filter(Boolean).join(', ')}</> : null}</span>
        <Knopf leise onClick={async () => { await setze(false); }} titel="Die Finanzplanung rechnet dann nur mit ihren eigenen Werten">Ausschalten</Knopf>
      </div>
    );
  }

  if (q.zustand === 'aus') {
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim }}>
        <span>Der Haushalt speist die Finanzplanung nicht{q.umfang.fixkosten || q.umfang.kredite || q.umfang.buchungen ? <> — er hätte: <Umfang q={{ ...q, konten: null }} /></> : null}.</span>
        <Knopf leise onClick={async () => { await setze(true); }}>Einschalten</Knopf>
      </div>
    );
  }

  // Noch nicht entschieden (Altbestand): Vorschau, nichts ändert sich bis „Übernehmen“.
  const v = q.vorschau;
  if (!v) {
    return (
      <Hinweis art="info" titel="Haushalt → Finanzplanung" aktion={<Knopf onClick={async () => { await setze(true); }}>Einschalten</Knopf>}>
        Der Haushalt führt das Ist — Buchungen, Fixkosten und Kredite. Sobald dort etwas steht, liest die Finanzplanung daraus, statt doppelt zu pflegen.
      </Hinweis>
    );
  }
  const hand = q.vonHand;
  return (
    <Hinweis art="info" titel="Der Haushalt kann die Finanzplanung speisen" aktion={<span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
      <Knopf haupt onClick={async () => { await setze(true); }}>Übernehmen</Knopf>
      <Knopf leise onClick={async () => { await setze(false); }}>Nicht verwenden</Knopf>
    </span>}>
      <div>Das würde sich ändern — bis du übernimmst, bleibt jede Zahl, wie sie ist. Werte, die hier von Hand stehen, bleiben.</div>
      <Vergleich vorher={v.vorher} nachher={v.nachher} />
      <Liste titel="Neue Fixkosten" liste={v.fixkosten} zeile={f => `${f.name}${betrag(f.proMonat, ' €/Monat')}`} />
      <Liste titel="Neue Kredite" liste={v.kredite} zeile={k => `${k.name}${betrag(k.rate, ' €/Monat')}${k.bis ? ` bis ${k.bis}` : ''}`} />
      <Liste titel="Ist aus dem Haushalt" liste={v.monate} zeile={m => `${monatKurz(m.monat)} (${m.anzahl})`} />
      <Liste titel="Bleibt von Hand" liste={hand} zeile={x => (x.art === 'monat' ? `${monatKurz(x.name)} (eigene Buchungen)` : `${x.name}`)} />
      <div style={{ marginTop: 8 }}><Link href={WEG.privat('fixkosten')} style={linkStil}>Fixkosten im Haushalt</Link> · <Link href={WEG.privat('schulden')} style={linkStil}>Kredite im Haushalt</Link> · <Link href={WEG.privat('buchungen')} style={linkStil}>Buchungen im Haushalt</Link></div>
    </Hinweis>
  );
}
