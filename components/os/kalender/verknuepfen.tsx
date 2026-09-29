'use client';

// ─── Kalender — CRM und Gäste am Termin (30.09., Paket K3) ──────────────────
// Kevin 29.09.: „Kontakt/Firma/Mandat verknüpfen → Aktivität im CRM“ und „Gäste mit echter Einladung nach Klick“.
//   TerminVerknuepfen   Schnellsuche über die Kartei (`crmSuchen` mit `suchNorm`, eingeschränkte Personen fehlen —
//                       GET /api/aufgaben/crm); gespeichert wird NUR in `kalender-bezug` (die Route, K1).
//   GaesteWahl          Gäste aus dem CRM (Kontakte mit E-Mail, GET /api/kalender/gaeste) oder frei eingegebene Adresse;
//                       Werbesperre wählbar mit Hinweis (1:1 ist keine Werbung), Art. 18 gar nicht erst in der Suche.
//                       Mit Antworten (zugesagt/abgesagt …), wenn der Termin schon Gäste hat.
//   EinladungFrage      Die Rückfrage VOR dem Schreiben: „Einladung an n Personen über iCloud senden?“ mit den Adressen.
//   useTerminAusAdresse Kalender öffnet einen Termin aus der Adresse (`WEG.termin`, Klick in einer CRM-Akte).

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Knopf, feld, LEUCHT } from '../schlank';
import { useCrmVerweise } from '../aufgaben/hilfe';
import { crmSuchen, bezugName, bezugLink, bezugSetzen, bezugOhne, BEZUG_ARTEN, BEZUG_LABEL } from '@/lib/aufgaben/crm-verweise';
import { adresseAus, gastDazu, einladungFrage, antwortenZaehlen, TEILNAHME_LABEL, TEILNAHME_ZEICHEN, type GastWahl, type Teilnehmer } from '@/lib/kalender/gaeste';
import type { BezugKennungen } from '@/lib/kalender/bezug';
import type { KTermin } from './teile';

const mikro = { fontSize: 12.5, color: C.inkLeise } as const;
const chip = { display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 999, padding: '3px 4px 3px 10px', fontSize: 12.5, maxWidth: '100%', minWidth: 0 } as const;

/** Nur die vier CRM-Felder (Aufgabe/Event bleiben, wie sie sind). */
type CrmBezug = Pick<BezugKennungen, 'kontaktId' | 'firmaId' | 'mandatId' | 'dealId'>;

/** Mit Kontakt/Firma/Mandat/Deal verknüpfen — Chips + Schnellsuche. */
export function TerminVerknuepfen({ wert, onWert, aus }: { wert: CrmBezug; onWert: (b: CrmBezug) => void; aus?: boolean }) {
  const [suche, setSuche] = useState('');
  const [offen, setOffen] = useState(false);
  const gesetzt = BEZUG_ARTEN.filter(a => wert[a]);
  const verweise = useCrmVerweise(offen || gesetzt.length > 0);
  const treffer = useMemo(() => crmSuchen(verweise, suche), [verweise, suche]);
  const feldRef = useRef<HTMLInputElement>(null);
  const nimm = (x: (typeof treffer)[number]) => { onWert(bezugSetzen(wert, x, verweise)); setSuche(''); setOffen(false); };
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <span style={mikro}>Mit Kontakt, Firma, Mandat oder Deal verknüpfen — wird im CRM zum Meeting</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {gesetzt.map(a => {
          const id = wert[a]!;
          return (
            <span key={a} style={{ ...chip, border: `1px solid ${LEUCHT.business}55`, background: `${LEUCHT.business}14` }}>
              <span style={{ color: C.inkLeise }}>{BEZUG_LABEL[a]}</span>
              <Link href={bezugLink(a, id)} style={{ color: LEUCHT.business, textDecoration: 'none', fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bezugName(verweise, a, id) ?? (verweise ? 'nicht mehr im CRM' : '…')}</Link>
              {!aus && <button type="button" onClick={() => onWert((bezugOhne(wert, a) ?? {}) as CrmBezug)} aria-label={`${BEZUG_LABEL[a]} lösen`} className="fassbar" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 14, padding: '0 6px' }}>×</button>}
            </span>
          );
        })}
        {!aus && !offen && <button type="button" onClick={() => { setOffen(true); setTimeout(() => feldRef.current?.focus(), 0); }} className="fassbar" style={{ border: '1px dashed rgba(255,255,255,.2)', background: 'transparent', color: C.inkDim, borderRadius: 999, padding: '4px 11px', fontSize: 12.5, cursor: 'pointer', fontFamily: SCHRIFT.text }}>+ verknüpfen</button>}
      </div>
      {offen && (
        <div>
          <input ref={feldRef} value={suche} onChange={e => setSuche(e.target.value)} placeholder={verweise ? 'Name, Firma, Mandat oder Deal suchen …' : 'Kartei wird geladen …'} aria-label="Im CRM suchen"
            onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setOffen(false); setSuche(''); } if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); if (treffer[0]) nimm(treffer[0]); } }}
            style={{ ...feld, fontSize: TYP.bedien, padding: '8px 12px', colorScheme: 'dark' }} />
          <div role="listbox" aria-label="Treffer im CRM" style={{ marginTop: 4, display: 'grid' }}>
            {treffer.map(x => (
              <button key={`${x.art}-${x.id}`} type="button" role="option" aria-selected={false} onClick={() => nimm(x)} className="fassbar"
                style={{ display: 'flex', gap: 10, alignItems: 'baseline', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,.05)', padding: '8px 4px', cursor: 'pointer', color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, minWidth: 0 }}>
                <span style={{ ...mikro, width: 58, flex: '0 0 auto' }}>{BEZUG_LABEL[x.art]}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.name}</span>
                {x.unter && <span style={{ color: C.inkLeise, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.unter}</span>}
              </button>
            ))}
            {suche.trim() && verweise && !treffer.length && <span style={{ ...mikro, padding: '6px 4px' }}>Nichts gefunden.</span>}
            <button type="button" onClick={() => { setOffen(false); setSuche(''); }} style={{ justifySelf: 'start', background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12, padding: '6px 4px' }}>fertig</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Gäste suchen (CRM) oder frei eingeben. `antworten` = vorhandene Gäste mit Zusage/Absage (Termin-Fenster). */
export function GaesteWahl({ gaeste, onGaeste, antworten, aus, hinweis }: {
  gaeste: readonly GastWahl[]; onGaeste: (g: GastWahl[]) => void; antworten?: readonly Teilnehmer[]; aus?: boolean; hinweis?: string;
}) {
  const [suche, setSuche] = useState('');
  const [treffer, setTreffer] = useState<GastWahl[]>([]);
  useEffect(() => {
    const q = suche.trim();
    if (q.length < 2 || adresseAus(q)) { setTreffer([]); return; }
    const t = setTimeout(() => { fetch(`/api/kalender/gaeste?q=${encodeURIComponent(q)}`, { cache: 'no-store' }).then(r => r.json()).then(d => setTreffer(Array.isArray(d?.treffer) ? d.treffer : [])).catch(() => setTreffer([])); }, 200);
    return () => clearTimeout(t);
  }, [suche]);
  const frei = adresseAus(suche);
  const dazu = (g: GastWahl) => { onGaeste(gastDazu(gaeste, g)); setSuche(''); setTreffer([]); };
  const status = (email: string) => antworten?.find(a => a.email === email)?.status;
  const gesperrt = gaeste.filter(g => g.werbesperre).length;
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <span style={mikro}>Gäste{antworten?.length ? ` · ${antwortenZaehlen(antworten)}` : ''}</span>
      {gaeste.length > 0 && (
        <div role="list" aria-label="Gäste" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {gaeste.map(g => { const s = status(g.email); return (
            <span key={g.email} role="listitem" title={`${g.email}${s ? ` · ${TEILNAHME_LABEL[s]}` : ''}${g.werbesperre ? ' · Werbesperre (1:1-Termin erlaubt)' : ''}`}
              style={{ ...chip, border: `1px solid ${g.werbesperre ? `${LEUCHT.achtung}66` : 'rgba(255,255,255,.14)'}`, background: 'rgba(255,255,255,.04)' }}>
              {s && <span aria-label={TEILNAHME_LABEL[s]} style={{ color: s === 'zugesagt' ? LEUCHT.gut : s === 'abgesagt' ? LEUCHT.kritisch : C.inkLeise, fontWeight: 800 }}>{TEILNAHME_ZEICHEN[s]}</span>}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{g.name ?? g.email}</span>
              {g.kontaktId && <span aria-label="aus dem CRM" title="aus dem CRM" style={{ color: LEUCHT.business, fontSize: 11 }}>CRM</span>}
              {!aus && <button type="button" onClick={() => onGaeste(gaeste.filter(x => x.email !== g.email))} aria-label={`${g.name ?? g.email} entfernen`} className="fassbar" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 14, padding: '0 6px' }}>×</button>}
            </span>
          ); })}
        </div>
      )}
      {!aus && (
        <div style={{ position: 'relative' }}>
          <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Gäste hinzufügen — Name aus dem CRM oder E-Mail" aria-label="Gäste hinzufügen"
            onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); if (frei) dazu({ email: frei }); else if (treffer[0]) dazu(treffer[0]); } }}
            style={{ ...feld, fontSize: TYP.bedien, padding: '8px 12px', colorScheme: 'dark' }} />
          {(treffer.length > 0 || frei) && (
            <div role="listbox" aria-label="Gäste-Vorschläge" style={{ marginTop: 4, display: 'grid' }}>
              {frei && <button type="button" role="option" aria-selected={false} onClick={() => dazu({ email: frei })} className="fassbar" style={{ textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,.05)', padding: '8px 4px', cursor: 'pointer', color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien }}>+ {frei}</button>}
              {treffer.map(g => (
                <button key={g.kontaktId ?? g.email} type="button" role="option" aria-selected={false} onClick={() => dazu(g)} className="fassbar"
                  style={{ display: 'flex', gap: 10, alignItems: 'baseline', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,.05)', padding: '8px 4px', cursor: 'pointer', color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, minWidth: 0 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                  <span style={{ color: C.inkLeise, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.email}</span>
                  {g.werbesperre && <span style={{ color: LEUCHT.achtung, fontSize: 11.5, whiteSpace: 'nowrap' }}>Werbesperre</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {gesperrt > 0 && <span role="note" style={{ fontSize: 12, color: LEUCHT.achtung }}>{gesperrt === 1 ? 'Eine Person hat' : `${gesperrt} Personen haben`} eine Werbesperre — ein 1:1-Termin ist keine Werbung und bleibt erlaubt; bitte keine werblichen Inhalte in die Einladung.</span>}
      {hinweis && <span style={{ fontSize: 12, color: C.inkLeise }}>{hinweis}</span>}
    </div>
  );
}

/** Rückfrage vor dem Schreiben — ohne Bestätigung geht keine Einladung, Änderung, Absage oder Antwort raus. */
export function EinladungFrage({ was, adressen, laeuft, onJa, onNein, nein = 'Zurück', warnung }: {
  was: 'einladung' | 'aenderung' | 'absage' | 'antwort'; adressen: readonly string[]; laeuft?: boolean; onJa: () => void; onNein: () => void; nein?: string;
  /** Zusätzlicher Warnhinweis (z. B. unbestätigte Adresse aus einer Buchung). */
  warnung?: string;
}) {
  return (
    <div role="alertdialog" aria-label={einladungFrage(was, adressen.length)} style={{ display: 'grid', gap: 8, background: `${LEUCHT.achtung}14`, border: `1px solid ${LEUCHT.achtung}55`, borderRadius: 12, padding: '10px 12px' }}>
      <b style={{ fontSize: TYP.bedien }}>{einladungFrage(was, adressen.length)}</b>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: C.inkDim, lineHeight: 1.6, maxHeight: 140, overflowY: 'auto', wordBreak: 'break-all' }}>
        {adressen.map(a => <li key={a}>{a}</li>)}
      </ul>
      {warnung && <span role="note" style={{ fontSize: 12, color: LEUCHT.achtung, lineHeight: 1.45 }}>{warnung}</span>}
      <span style={{ fontSize: 12, color: C.inkLeise }}>iCloud verschickt die Mail vom Kalenderkonto. Ohne „Senden“ wird nichts gespeichert.</span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Knopf farbe={LEUCHT.achtung} aus={laeuft} onClick={onJa}>{laeuft ? 'sendet …' : was === 'antwort' ? 'Antwort senden' : was === 'absage' ? 'Absage senden und löschen' : 'Senden und speichern'}</Knopf>
        <Knopf leise onClick={onNein}>{nein}</Knopf>
      </div>
    </div>
  );
}

/**
 * Den Termin aus der Adresse öffnen (`/os/kalender?tag=…&termin=<Schlüssel>`, aus einer CRM-Akte): Tag anspringen, sobald
 * die Termine da sind das Fenster öffnen — einmal je Adresse.
 */
export function useTerminAusAdresse(termine: readonly KTermin[] | undefined, setAnker: (tag: string) => void, setOffen: (t: KTermin) => void) {
  const [ziel, setZiel] = useState<{ termin: string; tag?: string } | null>(null);
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const termin = q.get('termin'), tag = q.get('tag');
      if (termin) { setZiel({ termin, ...(tag && /^\d{4}-\d{2}-\d{2}$/.test(tag) ? { tag } : {}) }); if (tag && /^\d{4}-\d{2}-\d{2}$/.test(tag)) setAnker(tag); }
    } catch { /* ohne Adresse */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ziel || !termine) return;
    const t = termine.find(x => x.id === ziel.termin) ?? termine.find(x => x.uid === ziel.termin);
    if (t) { setOffen(t); setZiel(null); }
  }, [ziel, termine, setOffen]);
}
