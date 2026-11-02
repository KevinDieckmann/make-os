'use client';

// ─── Verträge · Senden, Darlehen, Tabellen (02.11.) ──────────────────────────────────────────────────────────────────
// Kevin 02.11.: „Verträge per Mail aus dem Postfach“ und „vom Darlehensvertrag in die Finanzen — als Vorschlag“.
//   · `TextMitTabelle`  — Zeilen mit Tabulator (Zins- und Tilgungsplan) als Tabelle, sonst Text wie bisher
//   · `DarlehenVorschau` — in der Maske: gerechnete Zinsen, Plausibilität und Plan, bevor fertiggestellt wird
//   · `SendenKarte`     — „Vertrag senden“: Postfach (nur eigene im Business-Bereich, der Server prüft dasselbe), Empfänger aus der Akte des
//                          Vertragspartners, Betreff/Text — ERST der Klick sendet; genau das PDF dieses Vertrags hängt an
//   · `FinanzenKarte`   — unterschriebenes Darlehen: Geber/Nehmer wählen → „In Finanzen übernehmen“ (nur der Klick legt an)

import { useEffect, useMemo, useState } from 'react';
import { Karte, Ueberschrift, Knopf, Hinweis, Feldzeile, eingabe, Pillen, useRueckfrage } from '../ui';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { darlehenAusWerten, istDarlehenVertrag, tilgungsplanText } from '@/lib/vertraege/darlehen';
import { betragDeutsch } from '@/lib/finanzen/darlehen-plan';
import { DARLEHEN_ORTE, darlehenOrtName } from '@/lib/finanzen/darlehen';
import type { DarlehenOrt } from '@/lib/finanzen/rechenkern';
import { WEG } from '@/lib/wege';
import { senden, type VertragMitStand } from './daten';

const klein = { fontSize: TYP.bedien, color: C.inkDim } as const;
const neueAnfrage = (art: string) => `${art}-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Math.random()).slice(2)}`;

/** Text mit Tabellen-Blöcken: aufeinanderfolgende Zeilen mit Tabulator werden eine Tabelle (erste Zeile Kopf, „Summe“ fett). */
export function TextMitTabelle({ text, stil }: { text: string; stil?: React.CSSProperties }) {
  const bloecke = useMemo(() => {
    const aus: { tabelle: boolean; zeilen: string[] }[] = [];
    for (const z of text.split('\n')) {
      const t = z.includes('\t');
      const letzter = aus[aus.length - 1];
      if (letzter && letzter.tabelle === t) letzter.zeilen.push(z); else aus.push({ tabelle: t, zeilen: [z] });
    }
    return aus;
  }, [text]);
  return (
    <div style={stil}>
      {bloecke.map((b, i) => b.tabelle ? (
        <div key={i} style={{ overflowX: 'auto', margin: '6px 0' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: TYP.bedien, color: C.inkDim, minWidth: 320 }}>
            <tbody>
              {b.zeilen.map((z, j) => {
                const zellen = z.split('\t');
                const fett = j === 0 || zellen[0] === 'Summe';
                return (
                  <tr key={j} style={{ borderBottom: `1px solid ${C.linie}` }}>
                    {zellen.map((x, k) => <td key={k} style={{ padding: '3px 10px 3px 0', textAlign: k === 0 ? 'left' : 'right', fontWeight: fett ? 600 : 400, color: fett ? C.ink : undefined, whiteSpace: 'nowrap' }}>{x}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <div key={i} style={{ whiteSpace: 'pre-wrap' }}>{b.zeilen.join('\n')}</div>)}
    </div>
  );
}

/** Maske eines Darlehensvertrags: was der Vertrag rechnet — Fehler sperren das Fertigstellen (der Server prüft dasselbe, 400). */
export function DarlehenVorschau({ v }: { v: VertragMitStand }) {
  if (!istDarlehenVertrag(v)) return null;
  const d = darlehenAusWerten(v.werte);
  return (
    <Karte>
      <Ueberschrift>Darlehen gerechnet</Ueberschrift>
      {'leer' in d ? <div style={klein}>Sobald Betrag, Auszahlung, erste Rate, Anzahl und Rate stehen, rechnet der Vertrag Zinsen und Tilgungsplan.</div>
        : 'fehler' in d ? <Hinweis art="achtung" titel="Passt noch nicht">{d.fehler.join(' ')}</Hinweis>
        : (
          <>
            <div style={klein}>Zinsen gesamt {betragDeutsch(d.plan.zinsenGesamt)} € · {d.ratenAnzahl} Raten à {betragDeutsch(d.rate)} € · {d.zinsen === 'laufend' ? 'Zinsen monatlich' : 'Zinsen mit den Raten'}</div>
            <TextMitTabelle text={tilgungsplanText(d)} />
          </>
        )}
    </Karte>
  );
}

interface PostfachKurz { id: string; quelle: string; bereich: string | null; bereichName?: string; anzeigename?: string; adresse?: string; fremd?: boolean }

/** „Vertrag senden“ — erst der Klick sendet. */
export function SendenKarte({ v, onVertrag }: { v: VertragMitStand; onVertrag: (v: VertragMitStand) => void }) {
  const r = useRueckfrage();
  const [postfaecher, setPostfaecher] = useState<PostfachKurz[] | null>(null);
  const [ziele, setZiele] = useState<{ adressen: string[]; eingeschraenkt?: boolean } | null>(null);
  const [postfach, setPostfach] = useState<string | null>(null);
  const [an, setAn] = useState('');
  const [betreff, setBetreff] = useState('');
  const [text, setText] = useState('');
  const [anfrage, setAnfrage] = useState(() => neueAnfrage('vtr-send'));
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ art: 'kritisch' | 'gut' | 'achtung'; text: string } | null>(null);

  useEffect(() => {
    let weg = false;
    void (async () => {
      try {
        const [p, z] = await Promise.all([
          fetch('/api/inbox/postfaecher?space=business', { cache: 'no-store' }).then(x => x.json()).catch(() => null),
          fetch(`/api/vertraege?senden=${encodeURIComponent(v.id)}`, { cache: 'no-store' }).then(x => x.json()).catch(() => null),
        ]);
        if (weg) return;
        const liste = ((p?.postfaecher ?? []) as PostfachKurz[]).filter(x => x.quelle !== 'whatsapp' && !x.fremd && x.bereich);
        setPostfaecher(liste);
        if (liste.length === 1) setPostfach(liste[0].id);
        if (z?.ok) {
          setZiele({ adressen: z.adressen ?? [], eingeschraenkt: z.eingeschraenkt === true });
          if (z.adressen?.length) setAn(z.adressen[0]);
          setBetreff(z.vorgabe?.betreff ?? '');
          setText(z.vorgabe?.text ?? '');
        } else setZiele({ adressen: [] });
      } catch { if (!weg) setPostfaecher([]); }
    })();
    return () => { weg = true; };
  }, [v.id]);

  const abschicken = async (uwgBestaetigt = false): Promise<void> => {
    if (!postfach) return;
    setLaeuft(true);
    try {
      const a = await senden<{ vertrag: VertragMitStand; an?: string; code?: string; error?: string }>('/api/vertraege', { aktion: 'senden', id: v.id, stand: v.stand, postfach, an, betreff, text, uwgBestaetigt, anfrageId: anfrage });
      if (a.ok) { onVertrag(a.d.vertrag); setMeldung({ art: 'gut', text: `Gesendet an ${a.d.an ?? 'den Vertragspartner'} — Status „versendet“, Nachfassen in 5 Werktagen steht im Follow-up.` }); setAnfrage(neueAnfrage('vtr-send')); return; }
      if (a.status === 409 && a.d.code === 'uwg') {
        if (await r.bestaetigen({ titel: 'Trotzdem senden?', text: `${a.d.fehler ?? ''}\n\nDer Vertrag ist eine persönliche 1:1-Mail — senden, wenn der Text dabei bleibt.`, ja: 'Trotzdem senden' })) return abschicken(true);
        return;
      }
      if (a.status === 409 && (a.d as { aktuell?: VertragMitStand }).aktuell) onVertrag((a.d as { aktuell: VertragMitStand }).aktuell);
      setMeldung({ art: 'kritisch', text: a.d.fehler ?? a.d.error ?? 'Nicht gesendet.' });
    } finally { setLaeuft(false); }
  };

  if (v.status !== 'fertig' && v.status !== 'versendet') return null;
  return (
    <Karte>
      {r.dialog}
      <Ueberschrift>Vertrag senden</Ueberschrift>
      <div style={klein}>Geht als Mail aus deinem Postfach — mit genau dem PDF dieses Vertrags ({v.nummer}). Nichts geht ohne deinen Klick hinaus.</div>
      {meldung && <Hinweis art={meldung.art} rolle="alert">{meldung.text}</Hinweis>}
      {ziele?.eingeschraenkt && <Hinweis art="kritisch">Die Verarbeitung dieser Person ist eingeschränkt (Art. 18) — der Vertrag geht nicht per Mail hinaus.</Hinweis>}
      {postfaecher !== null && !postfaecher.length && <Hinweis art="achtung">Kein eigenes Postfach im Business-Bereich — unter Inbox › Postfächer verbinden und einem Bereich zuordnen.</Hinweis>}
      {ziele && !ziele.eingeschraenkt && !ziele.adressen.length && <Hinweis art="achtung">Der Vertragspartner hat keine E-Mail-Adresse in der Akte — dort ergänzen, dann senden.</Hinweis>}
      {!!postfaecher?.length && (
        <Feldzeile label="Aus Postfach">
          <Pillen liste={postfaecher.map(p => ({ id: p.id, label: `${p.anzeigename || p.adresse || p.id}${p.bereichName ? ` · ${p.bereichName}` : ''}` }))} aktiv={postfach} onWahl={setPostfach} />
        </Feldzeile>
      )}
      {!!ziele?.adressen.length && (
        <Feldzeile label="An">
          {ziele.adressen.length > 1
            ? <Pillen liste={ziele.adressen.map(a => ({ id: a, label: a }))} aktiv={an} onWahl={setAn} />
            : <div style={{ ...klein, color: C.ink }}>{an}</div>}
        </Feldzeile>
      )}
      <Feldzeile label="Betreff"><input aria-label="Betreff" style={eingabe} value={betreff} onChange={e => setBetreff(e.target.value)} /></Feldzeile>
      <Feldzeile label="Text"><textarea aria-label="Text der Mail" style={{ ...eingabe, minHeight: 140 }} value={text} onChange={e => setText(e.target.value)} /></Feldzeile>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <Knopf haupt aus={laeuft || !postfach || !an || !betreff.trim() || !text.trim() || !!ziele?.eingeschraenkt} onClick={() => abschicken()}>{v.status === 'versendet' ? 'Erneut senden' : 'Vertrag senden'}</Knopf>
      </div>
    </Karte>
  );
}

/** Unterschriebenes Darlehen → Finanzplanung (Vorschlag; erst der Klick legt das Darlehen und die Raten an). */
export function FinanzenKarte({ v, onVertrag }: { v: VertragMitStand; onVertrag: (v: VertragMitStand) => void }) {
  const vorgabeNehmer: DarlehenOrt | null = (DARLEHEN_ORTE as string[]).includes(v.gesellschaft) ? v.gesellschaft as DarlehenOrt : null;
  const [geber, setGeber] = useState<DarlehenOrt>('extern');
  const [nehmer, setNehmer] = useState<DarlehenOrt | null>(vorgabeNehmer);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ art: 'kritisch' | 'gut'; text: string } | null>(null);
  const [anfrage] = useState(() => neueAnfrage('vtr-fin'));
  if (!istDarlehenVertrag(v) || (v.status !== 'unterschrieben' && v.status !== 'aktiv')) return null;
  if (v.finanzen) {
    return (
      <Karte>
        <Ueberschrift>Darlehen in den Finanzen</Ueberschrift>
        <div style={klein}>Steht seit {v.finanzen.am.slice(0, 10).split('-').reverse().join('.')} in der Finanzplanung{v.finanzen.geber && v.finanzen.nehmer ? ` (${darlehenOrtName(v.finanzen.geber)} → ${darlehenOrtName(v.finanzen.nehmer)})` : ''}. Die Raten stehen in der Liquidität; beendet oder gekündigt nimmt die offenen heraus.</div>
        <div style={{ marginTop: 8 }}><Knopf leise href={WEG.finanzplanung(v.finanzen.geber && v.finanzen.nehmer && ['privat', 'kdc'].some(o => o === v.finanzen!.geber || o === v.finanzen!.nehmer) ? 'privat' : 'business')}>Zur Finanzplanung</Knopf></div>
      </Karte>
    );
  }
  const d = darlehenAusWerten(v.werte);
  const rechnet = !('leer' in d) && !('fehler' in d);
  const uebernehmen = async () => {
    if (!nehmer) return;
    setLaeuft(true);
    try {
      const a = await senden<{ vertrag: VertragMitStand; zahlungen?: number; error?: string }>('/api/vertraege', { aktion: 'finanzen', id: v.id, geber, nehmer, anfrageId: anfrage });
      if (a.ok) { onVertrag(a.d.vertrag); setMeldung({ art: 'gut', text: `Übernommen — ${a.d.zahlungen ? `${a.d.zahlungen} Raten in der Liquidität.` : 'die Raten rechnet die Finanzplanung.'}` }); }
      else setMeldung({ art: 'kritisch', text: a.d.fehler ?? a.d.error ?? 'Nicht übernommen.' });
    } finally { setLaeuft(false); }
  };
  return (
    <Karte>
      <Ueberschrift>In Finanzen übernehmen</Ueberschrift>
      <div style={klein}>Vorschlag: das Darlehen mit Raten und Zinsen in die Finanzplanung — erst dein Klick legt es an. Eine private Seite braucht den Zugang zu den privaten Finanzen.</div>
      {meldung && <Hinweis art={meldung.art} rolle="alert">{meldung.text}</Hinweis>}
      {!rechnet && <Hinweis art="achtung">{'fehler' in d ? d.fehler.join(' ') : 'Die Darlehens-Angaben im Vertrag sind unvollständig.'}</Hinweis>}
      <Feldzeile label="Geber"><Pillen liste={DARLEHEN_ORTE.map(o => ({ id: o, label: darlehenOrtName(o) }))} aktiv={geber} onWahl={o => setGeber(o as DarlehenOrt)} /></Feldzeile>
      <Feldzeile label="Nehmer"><Pillen liste={DARLEHEN_ORTE.map(o => ({ id: o, label: darlehenOrtName(o) }))} aktiv={nehmer} onWahl={o => setNehmer(o as DarlehenOrt)} /></Feldzeile>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <Knopf haupt aus={laeuft || !rechnet || !nehmer || geber === nehmer || (geber === 'extern' && nehmer === 'extern')} onClick={uebernehmen}>In Finanzen übernehmen</Knopf>
      </div>
    </Karte>
  );
}
