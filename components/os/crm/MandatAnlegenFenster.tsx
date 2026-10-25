'use client';

// ─── „Mandat anlegen“ — erst prüfen, dann anlegen (24.10., Bau-Test; Branch `kern-preise`) ─────────────────────────────────────────────────────
// Vorher legte „Mandat anlegen“ (gewonnener Deal, angenommenes Angebot) das Mandat sofort an — Start „heute“, ohne Vorbelegung zum Prüfen. Jetzt öffnet EIN
// Fenster die Vorbelegung, wie der Server sie bauen würde (`/api/crm/lead` aktion „mandat“, `vorschau: true` — schreibt nichts; lib/crm/mandat-aus-deal.ts):
// Hauptprodukt mit Honorar, Zusatzmodule (die weiteren Preis-Teile einer Kombination), Laufzeit, offene Punkte — Start wählbar (Vorgabe: erster Tag des
// Folgemonats). Erst „Anlegen“ schreibt (derselbe Aufruf mit `start`). `useMandatAnlegen` gibt den Aufrufern ein Versprechen: Ergebnis oder null (abgebrochen).
// 25.10. (Kern-Reste 1): JEDER Klick, der ein Mandat aus einem Deal anlegt, öffnet dieses Fenster — auch Fulfillment › Heute (dort ohne CRM-Daten im Browser:
// die Namen von Produkt und Zusatzmodulen kommen mit der Vorschau vom Server, `namen`).

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Knopf, LEUCHT, Hinweis, feld, Pillen } from '../ui';
import { Fenster } from '../Fenster';
import type { CrmApi } from './daten';
import type { Mandat } from '@/lib/crm/typen';
import { honorarText, zusatzBeschreibung, zusatzName } from '@/lib/crm/mandat-zusatz';
import { endeText, laufzeitEnde } from '@/lib/crm/mandat-laufzeit';

export interface MandatAnlegenErgebnis { ok: boolean; mandatId?: string; text?: string; fehler?: string; hinweis?: string; /** Der gewählte Start (25.10.) — Vorgabe für „Fall starten“. */ start?: string }
interface Vorschau {
  mandat: Mandat; quelle: 'angebot' | 'produkt' | 'deal'; angebot?: { id: string; nummer?: string }; startVorschlag: string;
  /** Namen aus dem Katalog des Servers (Produkt, je Zusatzmodul Name + Beschreibung) — fehlen bei einem älteren Server, dann der Katalog des Browsers. */
  namen?: { produkt?: string; zusatz: { id: string; name: string; beschreibung: string }[] };
  /** Wählbare Laufzeiten des Produkts (25.10.) — nur mit mehr als einer. */
  laufzeiten?: number[];
}

const klein = { fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5 } as const;
const QUELLE: Record<Vorschau['quelle'], string> = { angebot: 'aus dem angenommenen Angebot', produkt: 'aus dem Produkt', deal: 'aus dem Deal' };

async function postMandat(body: Record<string, unknown>): Promise<Record<string, unknown> & { ok?: boolean; fehler?: string }> {
  try {
    const r = await fetch('/api/crm/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'mandat', ...body }) });
    return await r.json().catch(() => ({ ok: false, fehler: `Antwort ${r.status}` }));
  } catch { return { ok: false, fehler: 'Keine Verbindung — nichts angelegt.' }; }
}

/**
 * Das Fenster als Haken: `oeffnen(dealId)` zeigt die Vorbelegung und löst auf mit dem Ergebnis von „Anlegen“ (bzw. null, wenn abgebrochen). `fenster` an
 * beliebiger Stelle rendern.
 */
export function useMandatAnlegen(api?: Pick<CrmApi, 'crm'> | null): { oeffnen: (chanceId: string) => Promise<MandatAnlegenErgebnis | null>; fenster: ReactNode } {
  const [offen, setOffen] = useState<string | null>(null);
  const fertig = useRef<((r: MandatAnlegenErgebnis | null) => void) | null>(null);
  const oeffnen = useCallback((chanceId: string) => new Promise<MandatAnlegenErgebnis | null>(res => { fertig.current?.(null); fertig.current = res; setOffen(chanceId); }), []);
  const schliessen = useCallback((r: MandatAnlegenErgebnis | null) => { const f = fertig.current; fertig.current = null; setOffen(null); f?.(r); }, []);
  return { oeffnen, fenster: offen ? <MandatAnlegenFenster api={api} chanceId={offen} onFertig={schliessen} /> : null };
}

function MandatAnlegenFenster({ api, chanceId, onFertig }: { api?: Pick<CrmApi, 'crm'> | null; chanceId: string; onFertig: (r: MandatAnlegenErgebnis | null) => void }) {
  const katalog = api?.crm?.stand.leistungen ?? [];
  const [v, setV] = useState<Vorschau | null>(null);
  const [start, setStart] = useState('');
  // Laufzeit wählbar (25.10.): leer = die vorbelegte (Angebot, Deal bzw. Produkt).
  const [laufzeit, setLaufzeit] = useState<number | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const laden = useCallback(async (s?: string, lz?: number | null) => {
    const r = await postMandat({ chanceId, vorschau: true, ...(s ? { start: s } : {}), ...(lz ? { laufzeitMonate: lz } : {}) });
    if (!r.ok || !r.mandat) { setFehler(r.fehler ?? 'Vorbelegung nicht geladen.'); return; }
    setFehler(null);
    const neu = r as unknown as Vorschau;
    setV(neu);
    setStart(x => x || neu.mandat.start || neu.startVorschlag);
  }, [chanceId]);
  useEffect(() => { void laden(); }, [laden]);
  const m = v?.mandat;
  const laeuft = useRef(false);
  const anlegen = async () => {
    if (laeuft.current || !start) return;
    laeuft.current = true;
    const r = await postMandat({ chanceId, start, ...(laufzeit ? { laufzeitMonate: laufzeit } : {}) });
    laeuft.current = false;
    if (!r.ok) { setFehler(r.fehler ?? 'Mandat nicht angelegt.'); return; }
    onFertig({ ok: true, start, ...(typeof r.mandatId === 'string' ? { mandatId: r.mandatId } : {}), ...(typeof r.text === 'string' ? { text: r.text } : {}), ...(typeof r.hinweis === 'string' ? { hinweis: r.hinweis } : {}) });
  };
  // Das Ende der Laufzeit (letzter Tag) — dieselbe Regel und dasselbe Format wie im Mandat (`laufzeitEnde`, `endeText`, 25.10.).
  const ende = m ? laufzeitEnde({ ...m, start, verlaengerung: undefined }, start) : null;
  const produktName = v?.namen?.produkt ?? (m?.leistungId ? katalog.find(l => l.id === m.leistungId)?.name : undefined);
  const zusatzText = (z: NonNullable<Mandat['zusatz']>[number]) => {
    const n = v?.namen?.zusatz.find(x => x.id === z.id);
    return n ? `${n.name} — ${n.beschreibung}` : `${zusatzName(z, katalog)} — ${zusatzBeschreibung(z, katalog)}`;
  };
  return (
    <Fenster titel={m ? `Mandat anlegen: ${m.kunde}` : 'Mandat anlegen'} onZu={() => onFertig(null)} breit={560}>
      {!m && !fehler && <span style={klein}>Vorbelegung lädt …</span>}
      {fehler && <Hinweis art="achtung">{fehler}</Hinweis>}
      {m && v && (
        <form onSubmit={e => { e.preventDefault(); void anlegen(); }} style={{ display: 'grid', gap: 12 }}>
          <span style={klein}>Vorbelegt {QUELLE[v.quelle]}{v.angebot?.nummer ? ` ${v.angebot.nummer}` : ''} — prüfen, Start wählen, dann anlegen. Alles bleibt am Mandat änderbar.</span>
          <div style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: TYP.bedien, fontWeight: 700, color: C.ink }}>{m.titel}</span>
            <span style={{ ...klein, color: C.inkDim }}>{produktName ? `${produktName}: ` : ''}{honorarText(m)}</span>
          </div>
          {!!m.zusatz?.length && (
            <div style={{ display: 'grid', gap: 4 }}>
              <span style={{ ...klein, textTransform: 'uppercase', letterSpacing: '.08em', fontSize: TYP.mikro }}>Zusatzmodule</span>
              {m.zusatz.map(z => (
                <span key={z.id} style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>• {zusatzText(z)}</span>
              ))}
            </div>
          )}
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ ...klein, textTransform: 'uppercase', letterSpacing: '.08em', fontSize: TYP.mikro }}>Start</span>
            <input type="date" value={start} onChange={e => { const s = e.target.value; setStart(s); if (s) void laden(s, laufzeit); }} aria-label="Start des Mandats" style={{ ...feld, fontSize: 16, maxWidth: 200, colorScheme: 'dark' }} />
          </label>
          {(v.laufzeiten?.length ?? 0) > 1 && (
            <div style={{ display: 'grid', gap: 4 }}>
              <span style={{ ...klein, textTransform: 'uppercase', letterSpacing: '.08em', fontSize: TYP.mikro }}>Laufzeit</span>
              <Pillen<string> liste={v.laufzeiten!.map(n => ({ id: String(n), label: `${n} Monate` }))} aktiv={String(m.mindestlaufzeitMonate ?? '')} onWahl={x => { const n = Number(x); setLaufzeit(n); void laden(start || undefined, n); }} />
            </div>
          )}
          <span style={klein}>
            {m.mindestlaufzeitMonate ? `${m.mindestlaufzeitMonate} Monate Mindestlaufzeit${ende ? ` · bis ${endeText(ende)}` : ''}` : 'ohne Mindestlaufzeit'} · Rechnung {m.rechnungsrhythmus === 'quartal' ? 'je Quartal' : m.rechnungsrhythmus} · Zahlungsziel {m.zahlungszielTage} Tage · {m.ustSatz} % USt
          </span>
          {!!m.leistungen.length && <span style={klein}>Leistungen: {m.leistungen.join(' · ')}</span>}
          {!!m.offen.length && <span style={klein}>Offen: {m.offen.join(' · ')}</span>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Knopf leise onClick={() => onFertig(null)}>Abbrechen</Knopf>
            <Knopf haupt farbe={LEUCHT.gut} typ="submit" aus={!start}>Anlegen</Knopf>
          </div>
        </form>
      )}
    </Fenster>
  );
}
