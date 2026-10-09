'use client';
// ─── Aufgaben-Navigation wie in der Markttraktion (Kevin 28.09. ~22:30) ─────
// Oben die Leiste: Überblick · Privat · Firmen ▾ · Mandanten ▾ · Archiv (Firmen/Mandanten als Auswahl mit Suche —
// dieselbe `Wahl` wie im CRM). Im Space die Brotkrumen Space ▾ › Projekt ▾ › Liste ▾ (seit 06.10. ohne Gruppe): jede Stufe springt
// direkt zu einem Geschwister. Mandanten-Space: Kopf mit Firma (→ Firmenakte), Mandat (→ Mandat) und Zuständig.
// Jeder Zustand steckt in der Adresse (lib/aufgaben/adresse.ts, `WEG.aufgaben`).

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Wahl, type WahlEintrag } from '../crm/Wahl';
import { firmaVonSpace, sonstigeProjektId, type AufgabenSpace } from '@/lib/aufgaben/struktur';
import type { AufgabenAdresse } from '@/lib/aufgaben/adresse';
import { WEG } from '@/lib/wege';
import type { TasksState } from '@/types/tasks';
import { useCrmVerweise, projekteImSpace, ownerLabel, type Person } from './hilfe';

type Gehe = (z: Partial<AufgabenAdresse>) => void;
const ALLE = '__alle__';

const reiterStil = (an: boolean): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', minHeight: 40, borderRadius: 10, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
  fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600, transition: 'background .2s ease, color .2s ease',
  background: an ? C.ink : 'transparent', color: an ? C.grund : C.inkDim,
});

/**
 * Die Leiste oben: Überblick · Privat · (Privat-Einheiten, z. B. Selbstständigkeit) · Firmen ▾ · Mandanten ▾ · Archiv.
 * 05.10. (Kevin: „Ja, überall unter Privat“): Firmen-Spaces im Privat-Bereich (`bereich: 'privat'`, lib/einheiten.ts `bereichVon`)
 * stehen als eigene Reiter neben Privat; „Firmen ▾“ zeigt nur die Business-Firmen.
 */
export function AufgabenLeiste({ adresse, spaces, offenJe, gehe }: { adresse: AufgabenAdresse; spaces: readonly AufgabenSpace[]; offenJe: ReadonlyMap<string, number>; gehe: Gehe }) {
  const raum = adresse.ansicht === 'space' ? spaces.find(s => s.id === adresse.s) : undefined;
  const firmen = spaces.filter(s => s.art === 'firma' && s.bereich === 'business');
  const privatFirmen = spaces.filter(s => s.art === 'firma' && s.bereich === 'privat');
  const privatDa = spaces.some(s => s.id === 'privat');
  const mandanten = spaces.filter(s => s.art === 'mandant' && !s.archiv);
  const archivZahl = spaces.filter(s => s.art === 'mandant' && s.archiv).length;
  const eintrag = (s: AufgabenSpace): WahlEintrag<string> => ({ id: s.id, label: s.label, punkt: s.farbe, ...(offenJe.get(s.id) ? { hinweis: `${offenJe.get(s.id)} offen` } : {}) });
  const zuSpace = (id: string) => gehe({ ansicht: 'space', s: id });
  return (
    <nav aria-label="Aufgaben" style={{ display: 'flex', gap: 10, alignItems: 'center', overflowX: 'auto', scrollbarWidth: 'none', padding: '8px 2px', marginBottom: 6 }}>
      <div role="tablist" style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,.06)', borderRadius: 12, padding: 3, flex: '0 0 auto', alignItems: 'center' }}>
        <button role="tab" aria-selected={adresse.ansicht === 'ueberblick'} onClick={() => gehe({ ansicht: 'ueberblick' })} style={reiterStil(adresse.ansicht === 'ueberblick')}>Überblick</button>
        {/* Nur, wenn der Server den Space liefert — ein Konto „nur Business“ bekommt den Privat-Bereich gar nicht (09.10., E4). */}
        {privatDa && (
          <button role="tab" aria-selected={raum?.id === 'privat'} onClick={() => zuSpace('privat')} style={reiterStil(raum?.id === 'privat')}>
            Privat{offenJe.get('privat') ? <span style={{ opacity: .6, fontVariantNumeric: 'tabular-nums' }}>{offenJe.get('privat')}</span> : null}
          </button>
        )}
        {privatFirmen.map(s => (
          <button key={s.id} role="tab" aria-selected={raum?.id === s.id} onClick={() => zuSpace(s.id)} style={reiterStil(raum?.id === s.id)}>
            {s.label}{offenJe.get(s.id) ? <span style={{ opacity: .6, fontVariantNumeric: 'tabular-nums' }}>{offenJe.get(s.id)}</span> : null}
          </button>
        ))}
        <span style={{ padding: '0 4px', display: 'inline-flex' }}>
          <Wahl klein label="Firmen" leer="Firmen ▾" liste={firmen.map(eintrag)} wert={raum?.art === 'firma' && raum.bereich === 'business' ? raum.id : null} farbe={raum?.art === 'firma' && raum.bereich === 'business' ? raum.farbe : C.aktiv} onWahl={zuSpace} />
        </span>
        <span style={{ padding: '0 4px 0 0', display: 'inline-flex' }}>
          <Wahl klein label="Mandanten" leer={mandanten.length ? `Mandanten (${mandanten.length}) ▾` : 'Mandanten ▾'} liste={mandanten.map(eintrag)} wert={raum?.art === 'mandant' && !raum.archiv ? raum.id : null} farbe={raum?.farbe ?? C.aktiv} onWahl={zuSpace} />
        </span>
      </div>
      <span aria-hidden style={{ flex: '1 0 8px' }} />
      <div role="tablist" style={{ display: 'flex', gap: 2, border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 3, flex: '0 0 auto' }}>
        <button role="tab" aria-selected={adresse.ansicht === 'archiv' || !!raum?.archiv} onClick={() => gehe({ ansicht: 'archiv' })} style={reiterStil(adresse.ansicht === 'archiv' || !!raum?.archiv)}>
          Archiv{archivZahl ? <span style={{ opacity: .6, fontVariantNumeric: 'tabular-nums' }}>{archivZahl}</span> : null}
        </button>
      </div>
    </nav>
  );
}

/** Brotkrumen im Space: Space ▾ › Projekt ▾ › Liste ▾ — jede Stufe springt zu einem Geschwister. */
export function Brotkrumen({ adresse, state, spaces, gehe }: { adresse: AufgabenAdresse; state: TasksState; spaces: readonly AufgabenSpace[]; gehe: Gehe }) {
  const sid = adresse.s ?? 'privat';
  const raum = spaces.find(s => s.id === sid);
  const spaceWahl: WahlEintrag<string>[] = spaces.filter(s => !s.archiv || s.id === sid).map(s => ({ id: s.id, label: s.label, punkt: s.farbe, hinweis: s.art === 'privat' ? 'Privat' : s.art === 'firma' ? (s.bereich === 'privat' ? 'Privat · Firma' : 'Firma') : 'Mandant' }));
  const projekte = projekteImSpace(state, sid);
  const projektWahl: WahlEintrag<string>[] = [{ id: ALLE, label: 'Alle Projekte' }, ...projekte.map(p => ({ id: p.id, label: p.title, punkt: p.color, ...(p.status && p.status !== 'aktiv' ? { hinweis: p.status } : {}) })), { id: sonstigeProjektId(sid), label: 'Sonstige' }];
  const p = adresse.p;
  const listen = p ? (state.listen ?? []).filter(l => l.projektId === p && !l.archiviert).sort((a, b) => a.sortOrder - b.sortOrder) : [];
  const trenner = <span aria-hidden style={{ color: C.inkLeise }}>›</span>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', margin: '2px 0 12px', fontSize: TYP.bedien }}>
      <Wahl klein label="Space" liste={spaceWahl} wert={sid} farbe={raum?.farbe ?? C.aktiv} onWahl={id => gehe({ ansicht: 'space', s: id })} />
      {trenner}
      <Wahl klein label="Projekt" liste={projektWahl} wert={p ?? ALLE} farbe={p ? state.projects.find(x => x.id === p)?.color ?? C.inkDim : C.inkDim}
        onWahl={id => gehe({ ansicht: 'space', s: sid, ...(id === ALLE ? {} : { p: id }) })} />
      {p && listen.length > 0 && <>
        {trenner}
        <Wahl klein label="Liste" liste={[{ id: ALLE, label: 'Alle Listen' }, ...listen.map(l => ({ id: l.id, label: l.titel, ...(l.farbe ? { punkt: l.farbe } : {}) }))]}
          wert={adresse.l ?? ALLE} farbe={listen.find(l => l.id === adresse.l)?.farbe ?? C.inkDim}
          onWahl={id => gehe({ ansicht: 'space', s: sid, p, t: adresse.t, ...(id === ALLE ? {} : { l: id }) })} />
      </>}
    </div>
  );
}

/** Kopf eines Mandanten-Space: Firma → Firmenakte, Mandat(e) → Mandat, Zuständig. */
export function MandantKopf({ space, personen }: { space: AufgabenSpace; personen: readonly Person[] }) {
  const firmaId = firmaVonSpace(space.id);
  const v = useCrmVerweise(!!firmaId);
  if (!firmaId) return null;
  const firma = v?.firmen.find(f => f.id === firmaId);
  const mandate = (v?.mandate ?? []).filter(m => m.firmaId === firmaId).sort((a, b) => (a.status === 'aktiv' ? 0 : 1) - (b.status === 'aktiv' ? 0 : 1));
  const zeige = mandate.some(m => m.status === 'aktiv') ? mandate.filter(m => m.status === 'aktiv') : mandate.slice(0, 1);
  const zustaendig = Array.from(new Set(zeige.map(m => m.zustaendig).filter((z): z is string => !!z)));
  const mikro: CSSProperties = { fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise };
  const link: CSSProperties = { color: space.farbe, textDecoration: 'none', fontWeight: 600 };
  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'baseline', flexWrap: 'wrap', margin: '0 0 12px', padding: '10px 14px', borderRadius: 12, border: `1px solid ${space.farbe}33`, background: `${space.farbe}0F`, fontSize: TYP.bedien }}>
      <span style={{ display: 'inline-flex', gap: 8, alignItems: 'baseline' }}><span style={mikro}>Firma</span><Link href={WEG.firma(firmaId)} style={link}>{firma?.name ?? space.label} ›</Link></span>
      {zeige.length > 0 && <span style={{ display: 'inline-flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}><span style={mikro}>{zeige.length === 1 ? 'Mandat' : 'Mandate'}</span>
        {zeige.map(m => <Link key={m.id} href={WEG.mandat(m.id)} style={link}>{m.titel}{m.status !== 'aktiv' ? ` (${m.status})` : ''} ›</Link>)}</span>}
      {zustaendig.length > 0 && <span style={{ display: 'inline-flex', gap: 8, alignItems: 'baseline' }}><span style={mikro}>Zuständig</span><span style={{ color: C.ink }}>{zustaendig.map(z => (z === 'beide' ? 'Beide' : ownerLabel(z, personen))).join(', ')}</span></span>}
      {!v && <span style={{ color: C.inkLeise }}>lade …</span>}
    </div>
  );
}
