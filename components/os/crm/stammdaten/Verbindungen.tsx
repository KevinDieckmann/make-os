'use client';

// ─── Stammdaten › Datenqualität · Verbindungen (28.09.) ─────────────────────
// Kevin: „Einmal nochmal alle Verbindungen im Hintergrund prüfen.“ Die Karte zeigt
// die Ampel und die Befunde aus /api/crm/verbindungen, nach Schwere gruppiert —
// je Befund Satz, Anzahl und bis zu fünf Beispiele als Links. „Reparieren“ gibt es
// nur für sichere Fälle und immer erst mit Vorschau (POST vorschau:true schreibt nichts).
// F3 (29.09.): Überschrift nach Schwere (auch offene Hinweise — nicht mehr „sauber“), Beispiele mit Namen/Titel statt
// roher Kennung, wo auflösbar (`namen`, lib/crm/verbindungen-namen.ts); die Kennung steht im Tooltip.

import Link from 'next/link';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Leer, Knopf, Chip, Punkt, LEUCHT } from '../../schlank';
import { Fenster } from '../../Fenster';
import { WEG } from '@/lib/wege';
import { markttraktion } from '@/lib/crm/adresse';
import type { Aenderung, BeispielArt, Schwere, VerbindungsBefund } from '@/lib/crm/verbindungen';
import { verbindungsUeberschrift } from '@/lib/crm/verbindungen-namen';

interface Antwort { ok: boolean; ampel: 'rot' | 'gelb' | 'gruen'; befunde: VerbindungsBefund[]; namen?: Record<string, string>; geprueft: number; fehler?: string }
interface Vorschau { ids: string[]; aenderungen: Aenderung[] }

/** Farbe der Überschrift je schwerster Schwere (ohne Befund: grün). */
const FARBE_SCHWERE: Record<Schwere, string> = { fehler: LEUCHT.kritisch, warnung: LEUCHT.achtung, hinweis: C.inkDim };
const GRUPPEN: { schwere: Schwere; label: string; farbe: string }[] = [
  { schwere: 'fehler', label: 'Fehler', farbe: LEUCHT.kritisch },
  { schwere: 'warnung', label: 'Warnungen', farbe: LEUCHT.achtung },
  { schwere: 'hinweis', label: 'Hinweise', farbe: C.inkDim },
];

/** Wohin eine Beispiel-Kennung führt — ohne Ziel bleibt sie Text. */
function ziel(art: BeispielArt | undefined, id: string): string | null {
  switch (art) {
    case 'kontakt': return WEG.akte(id);
    case 'firma': return WEG.firma(id);
    case 'deal': return WEG.deal(id);
    case 'mandat': return WEG.mandat(id);
    case 'rechnung': return WEG.rechnung(id);
    case 'event': return WEG.event(id);
    case 'kampagne': return WEG.kampagne(id);
    case 'segment': return WEG.marketing('segmente', id);
    case 'aufgabe': return WEG.aufgabe(id);
    case 'antrag': return WEG.stammdaten('datenschutz');
    case 'followup': return WEG.followup();
    case 'angebot': return WEG.angebot({ angebotId: id });
    case 'produkt': return WEG.produkt(id);
    default: return null;
  }
}

/** Ein weiterführender Weg je Befund, wo es einen gibt. */
const WEITER: Partial<Record<string, { label: string; href: string }>> = {
  'kontakt-email-doppelt': { label: 'Dubletten öffnen', href: markttraktion('kontakte', 'dubletten') },
  'konflikt-veraltet': { label: 'Import-Konflikte', href: WEG.stammdaten('austausch') },
  'mandat-ohne-rechnung': { label: 'Rechnungen', href: WEG.rechnungen() },
  'rechnung-bezahlt-ohne-datum': { label: 'Rechnungen', href: WEG.rechnungen() },
  'werte-ausserhalb-wertelisten': { label: 'Wertelisten', href: markttraktion('stammdaten', 'wertelisten') },
};

const kennung: CSSProperties = { fontSize: 12, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: C.inkDim, padding: '2px 8px', borderRadius: 8, background: 'rgba(255,255,255,.04)', textDecoration: 'none', whiteSpace: 'nowrap' };

export function Verbindungen({ i = 0, onGeaendert }: { i?: number; onGeaendert?: () => void }) {
  const [d, setD] = useState<Antwort | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [vorschau, setVorschau] = useState<Vorschau | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState('');

  const laden = useCallback(async () => {
    setFehler(null);
    try {
      const r = await fetch('/api/crm/verbindungen', { cache: 'no-store' });
      const x = (await r.json().catch(() => null)) as Antwort | null;
      if (x?.ok) setD(x); else setFehler(x?.fehler ?? `Antwort ${r.status}.`);
    } catch { setFehler('Keine Verbindung.'); }
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  const post = async (ids: string[], nurVorschau: boolean) => {
    setLaeuft(true);
    const r = await fetch('/api/crm/verbindungen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, vorschau: nurVorschau }) })
      .then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' })) as { ok: boolean; aenderungen?: Aenderung[]; fehler?: string };
    setLaeuft(false);
    return r;
  };
  const zeigeVorschau = async (ids: string[]) => {
    setMeldung('');
    const r = await post(ids, true);
    if (r.ok) setVorschau({ ids, aenderungen: r.aenderungen ?? [] }); else setMeldung(r.fehler ?? 'Vorschau nicht möglich.');
  };
  const reparieren = async () => {
    if (!vorschau) return;
    const r = await post(vorschau.ids, false);
    setVorschau(null);
    setMeldung(r.ok ? `Repariert: ${(r.aenderungen ?? []).map(a => a.text).join(' · ') || 'nichts zu tun'}.` : `Nicht repariert${r.fehler ? `: ${r.fehler}` : '.'}`);
    await laden();
    onGeaendert?.();
  };

  if (!d) return <Karte i={i}><Ueberschrift>Verbindungen</Ueberschrift><Leer>{fehler ? `Prüfung nicht geladen — ${fehler}` : 'Prüfe alle Verbindungen …'}</Leer></Karte>;
  const kopf = verbindungsUeberschrift(d.befunde);
  const a = { farbe: kopf.schwere ? FARBE_SCHWERE[kopf.schwere] : LEUCHT.gut, text: kopf.text };
  const reparierbar = d.befunde.filter(b => b.reparierbar).map(b => b.id);

  return (
    <Karte i={i} akzent={kopf.schwere === 'fehler' || kopf.schwere === 'warnung' ? a.farbe : undefined}>
      <Ueberschrift rechts={reparierbar.length ? <Knopf leise aus={laeuft} onClick={() => void zeigeVorschau(reparierbar)}>Alle reparierbaren ({reparierbar.length})</Knopf> : undefined}>Verbindungen</Ueberschrift>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px 10px', marginBottom: 10, flexWrap: 'wrap' }}>
        <Punkt farbe={a.farbe} groesse={11} />
        <span style={{ fontSize: TYP.body, fontWeight: 600, color: C.ink }}>{a.text}</span>
        {kopf.zahlen && kopf.schwere !== 'hinweis' && <span style={{ fontSize: 12.5, color: C.inkDim }}>{kopf.zahlen}</span>}
        <span style={{ fontSize: 12, color: C.inkLeise }}>{d.geprueft} Prüfungen über Personen, Firmen, Deals, Mandate, Rechnungen, Follow-ups, Events, Marketing, Aufgaben, Fokus und Ablage</span>
      </div>
      {meldung && <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 8 }}>{meldung}</div>}
      {!d.befunde.length && <Leer>Jede Kennung zeigt auf etwas, das es gibt.</Leer>}
      {GRUPPEN.map(g => {
        const l = d.befunde.filter(b => b.schwere === g.schwere);
        if (!l.length) return null;
        return (
          <div key={g.schwere} style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: TYP.mikro, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise, marginBottom: 4 }}>
              <Punkt farbe={g.farbe} groesse={7} />{g.label} · {l.length}
            </div>
            {l.map(b => {
              const weiter = WEITER[b.id];
              return (
                <div key={b.id} style={{ padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ flex: 1, fontSize: TYP.bedien, color: C.ink, lineHeight: 1.5 }}>{b.text}</span>
                    <Chip farbe={g.farbe}>{b.anzahl}</Chip>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {b.beispiele.map(id => {
                      const href = ziel(b.art, id);
                      const name = d.namen?.[id];
                      const stil = name ? { ...kennung, fontFamily: 'inherit', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' } : kennung;
                      return href ? <Link key={id} href={href} title={id} style={{ ...stil, color: C.aktiv }}>{name ?? id}</Link> : <span key={id} title={id} style={stil}>{name ?? id}</span>;
                    })}
                    {b.anzahl > b.beispiele.length && <span style={{ fontSize: 12, color: C.inkLeise }}>+ {b.anzahl - b.beispiele.length} weitere</span>}
                    <span style={{ flex: 1 }} />
                    {weiter && <Link href={weiter.href} style={{ fontSize: 12.5, color: C.inkDim }}>{weiter.label} ›</Link>}
                    {b.reparierbar && <Knopf leise aus={laeuft} onClick={() => void zeigeVorschau([b.id])}>{b.knopf ?? 'Reparieren'}</Knopf>}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      {vorschau && (
        <Fenster titel="Reparieren — Vorschau" onZu={() => setVorschau(null)} breit={560}>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>Noch nichts geschrieben. Es werden nur Verweise entfernt, Follow-ups ohne Ziel mit Grund abgesagt, veraltete Import-Konflikte abgeräumt und fehlende Dateien markiert — kein Datensatz wird gelöscht.</div>
          {vorschau.aenderungen.length
            ? <div style={{ display: 'grid', gap: 6 }}>{vorschau.aenderungen.map(x => <div key={`${x.befundId}-${x.speicher}`} style={{ fontSize: TYP.bedien, color: C.ink }}>· {x.text}</div>)}</div>
            : <Leer>Nichts zu reparieren — der Stand hat sich inzwischen geändert.</Leer>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Knopf leise onClick={() => setVorschau(null)}>Abbrechen</Knopf>
            <Knopf aus={laeuft || !vorschau.aenderungen.length} onClick={() => void reparieren()}>Jetzt reparieren</Knopf>
          </div>
        </Fenster>
      )}
    </Karte>
  );
}
