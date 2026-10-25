'use client';

// ─── Formular „Angebot anfordern“ — die Felder (25.10.2026) ──────────────────────────────────────────────────────────────────────────────
// EIN Bauteil für das Team (Markttraktion › Formulare, mit Kundensuche über `kunde` und Feldern für Rabatt/eigenen Preis) und den externen Link
// (/angebot/<slug>, nur Produkte des Links, ohne Rabatt). Handy zuerst: eine Spalte, Eingaben 16 px, Ziele ≥ 44 px. Gesendet wird die Anfrage an
// `onSenden` — der Server entscheidet alles (Kunde, Deal, Angebot, Leitplanken, Versand); hier stehen nur die Eingaben und das Ergebnis.

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { FARBE as C, TYP, TIEF, RAND, ECKE } from '@/lib/make-one/design';
import { Feldzeile, Hinweis, Knopf, Segmente, eingabe } from '../../ui';
import type { KatalogProdukt } from '@/lib/crm/formulare';

export interface AnfrageWerte {
  firma: { name: string; strasse: string; plz: string; ort: string };
  person: { anrede: 'Sie' | 'Du'; vorname: string; nachname: string; email: string; telefon: string };
}
export const leereWerte = (): AnfrageWerte => ({ firma: { name: '', strasse: '', plz: '', ort: '' }, person: { anrede: 'Sie', vorname: '', nachname: '', email: '', telefon: '' } });

export interface AnfrageErgebnis { ok?: boolean; status?: string; text?: string; fehler?: string; nummer?: string; gruende?: string[]; angebotId?: string }
interface Wahl { optionen: string[]; mengen: Record<string, number>; rabatt: string; preise: Record<string, string> }

const neueId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`);
const zahl = (t: string): number | null => { const n = Number(t.replace(/\./g, '').replace(',', '.')); return t.trim() && Number.isFinite(n) ? n : null; };

export function AnfrageFormular({ katalog, intern, kunde, werte, setWerte, festePerson, extra, hinweisUnten, onSenden, onNeu }: {
  katalog: KatalogProdukt[];
  /** Team: Notiz, Rabatt und eigener Preis (→ Freigabe). Extern: nur Produkte, Optionen und Mengen. */
  intern?: boolean;
  /** Kundensuche des Teams (über den Feldern). */
  kunde?: ReactNode;
  werte: AnfrageWerte;
  setWerte: (w: AnfrageWerte) => void;
  /** Eine gewählte Person: ihre Felder stehen fest (nur die Adresse aus ihren Adressen wählbar). */
  festePerson?: { emails: string[] };
  /** Zusätzliche Felder (Honigtopf der öffentlichen Seite). */
  extra?: ReactNode;
  hinweisUnten?: ReactNode;
  onSenden: (anfrage: Record<string, unknown>, anfrageId: string) => Promise<AnfrageErgebnis>;
  onNeu?: () => void;
}) {
  const [wahl, setWahl] = useState<Record<string, Wahl>>({});
  const [start, setStart] = useState('');
  const [notiz, setNotiz] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<AnfrageErgebnis | null>(null);
  const anfrageId = useRef(neueId());
  const gewaehlt = useMemo(() => katalog.filter(p => wahl[p.id]), [katalog, wahl]);
  const f = werte.firma, p = werte.person;
  const setF = (x: Partial<AnfrageWerte['firma']>) => setWerte({ ...werte, firma: { ...f, ...x } });
  const setP = (x: Partial<AnfrageWerte['person']>) => setWerte({ ...werte, person: { ...p, ...x } });
  const umschalten = (id: string) => setWahl(w => { const n = { ...w }; if (n[id]) delete n[id]; else n[id] = { optionen: [], mengen: {}, rabatt: '', preise: {} }; return n; });
  const aendern = (id: string, x: Partial<Wahl>) => setWahl(w => ({ ...w, [id]: { ...w[id], ...x } }));

  const senden = async () => {
    setFehler(null);
    if (!f.name.trim()) { setFehler('Bitte die Firma angeben.'); return; }
    if (!p.vorname.trim() || !p.nachname.trim()) { setFehler('Bitte Vor- und Nachname angeben.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(p.email.trim())) { setFehler('Bitte eine gültige E-Mail-Adresse angeben — an sie geht das Angebot.'); return; }
    if (!gewaehlt.length) { setFehler('Bitte mindestens ein Produkt wählen.'); return; }
    const produkte = gewaehlt.map(x => {
      const w = wahl[x.id];
      const preise = Object.fromEntries(Object.entries(w.preise).map(([k, v]) => [k, zahl(v)]).filter(([, v]) => v !== null).map(([k, v]) => [k, Math.round((v as number) * 100)]));
      const rabatt = zahl(w.rabatt);
      return { id: x.id, ...(w.optionen.length ? { optionen: w.optionen } : {}), ...(Object.keys(w.mengen).length ? { mengen: w.mengen } : {}), ...(intern && rabatt ? { rabattProzent: rabatt } : {}), ...(intern && Object.keys(preise).length ? { preise } : {}) };
    });
    const anfrage = {
      firma: { name: f.name.trim(), ...(f.strasse.trim() ? { strasse: f.strasse.trim() } : {}), ...(f.plz.trim() ? { plz: f.plz.trim() } : {}), ...(f.ort.trim() ? { ort: f.ort.trim() } : {}) },
      person: { anrede: p.anrede, vorname: p.vorname.trim(), nachname: p.nachname.trim(), email: p.email.trim(), ...(p.telefon.trim() ? { telefon: p.telefon.trim() } : {}) },
      produkte, ...(start ? { start } : {}), ...(intern && notiz.trim() ? { notiz: notiz.trim() } : {}),
    };
    const r = await onSenden(anfrage, anfrageId.current);
    if (r.ok === false && !r.status) { setFehler(r.fehler ?? 'Nicht angenommen.'); return; }
    setErgebnis(r);
  };
  const neu = () => { setErgebnis(null); setWahl({}); setStart(''); setNotiz(''); anfrageId.current = neueId(); onNeu?.(); };

  if (ergebnis) {
    const art = ergebnis.status === 'verschickt' ? 'gut' : ergebnis.status === 'abgelehnt' ? 'kritisch' : 'info';
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <Hinweis art={art} rolle="status" titel={ergebnis.status === 'verschickt' ? 'Verschickt' : ergebnis.status === 'abgelehnt' ? 'Nicht angenommen' : 'Zur Prüfung'}>
          {ergebnis.text ?? ergebnis.fehler}
          {intern && !!ergebnis.gruende?.length && ergebnis.status !== 'verschickt' && <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: TYP.bedien }}>{ergebnis.gruende.map(g => <li key={g}>{g}</li>)}</ul>}
        </Hinweis>
        <Knopf haupt voll onClick={neu}>Nächstes Angebot anfordern</Knopf>
      </div>
    );
  }

  return (
    <form onSubmit={e => { e.preventDefault(); void senden(); }} style={{ display: 'grid', gap: 14 }}>
      {kunde}
      <div style={{ display: 'grid', gap: 10 }}>
        <Feldzeile label="Firma"><input value={f.name} onChange={e => setF({ name: e.target.value })} style={eingabe} autoComplete="organization" required /></Feldzeile>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          <Feldzeile label="Straße (optional)"><input value={f.strasse} onChange={e => setF({ strasse: e.target.value })} style={eingabe} autoComplete="street-address" /></Feldzeile>
          <Feldzeile label="PLZ"><input value={f.plz} onChange={e => setF({ plz: e.target.value })} style={eingabe} inputMode="numeric" autoComplete="postal-code" /></Feldzeile>
          <Feldzeile label="Ort"><input value={f.ort} onChange={e => setF({ ort: e.target.value })} style={eingabe} autoComplete="address-level2" /></Feldzeile>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        <Feldzeile label="Anrede im Angebot" gruppe><Segmente liste={[{ id: 'Sie', label: 'Sie' }, { id: 'Du', label: 'Du' }]} aktiv={p.anrede} onWahl={a => !festePerson && setP({ anrede: a })} /></Feldzeile>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          <Feldzeile label="Vorname"><input value={p.vorname} onChange={e => setP({ vorname: e.target.value })} style={eingabe} readOnly={!!festePerson} autoComplete="given-name" required /></Feldzeile>
          <Feldzeile label="Nachname"><input value={p.nachname} onChange={e => setP({ nachname: e.target.value })} style={eingabe} readOnly={!!festePerson} autoComplete="family-name" required /></Feldzeile>
        </div>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <Feldzeile label="E-Mail (an sie geht das Angebot)">
            {festePerson && festePerson.emails.length > 1
              ? <select value={p.email} onChange={e => setP({ email: e.target.value })} style={eingabe}>{festePerson.emails.map(m => <option key={m} value={m}>{m}</option>)}</select>
              : <input value={p.email} onChange={e => setP({ email: e.target.value })} style={eingabe} type="email" inputMode="email" readOnly={!!festePerson} autoComplete="email" required />}
          </Feldzeile>
          <Feldzeile label="Telefon (optional)"><input value={p.telefon} onChange={e => setP({ telefon: e.target.value })} style={eingabe} type="tel" inputMode="tel" readOnly={!!festePerson} autoComplete="tel" /></Feldzeile>
        </div>
      </div>

      <Feldzeile label="Produkte" gruppe>
        {katalog.length === 0 ? <Hinweis art="achtung">Es gibt (noch) keine aktiven Produkte für dieses Formular.</Hinweis> : (
          <div style={{ display: 'grid', gap: 8 }}>
            {katalog.map(x => {
              const w = wahl[x.id];
              const grund = x.teile.filter(t => t.rolle === 'grund');
              const optionen = x.teile.filter(t => t.rolle === 'option');
              return (
                <div key={x.id} data-formular-produkt={x.id} style={{ border: `1px solid ${w ? TIEF.rand(C.aktiv) : RAND.flaeche}`, borderRadius: ECKE.knopf, padding: 12, display: 'grid', gap: 8, background: w ? TIEF.flaeche(C.aktiv) : 'transparent' }}>
                  <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', minHeight: 44 }}>
                    <input type="checkbox" checked={!!w} onChange={() => umschalten(x.id)} style={{ width: 22, height: 22, marginTop: 2, flex: '0 0 auto' }} />
                    <span style={{ display: 'grid', gap: 3, minWidth: 0 }}>
                      <span style={{ fontWeight: 700, fontSize: TYP.body }}>{x.name}</span>
                      <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{grund.map(t => t.preis).join(' + ') || 'Preis auf Anfrage'}</span>
                    </span>
                  </label>
                  {w && (
                    <div style={{ display: 'grid', gap: 8, paddingLeft: 32 }}>
                      {x.text && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5 }}>{x.text}</div>}
                      {optionen.map(t => (
                        <label key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 44, fontSize: TYP.bedien }}>
                          <input type="checkbox" checked={w.optionen.includes(t.id)} onChange={() => aendern(x.id, { optionen: w.optionen.includes(t.id) ? w.optionen.filter(o => o !== t.id) : [...w.optionen, t.id] })} style={{ width: 20, height: 20 }} />
                          Option: {t.label} · {t.preis}
                        </label>
                      ))}
                      {x.teile.filter(t => t.menge && (t.rolle === 'grund' || w.optionen.includes(t.id))).map(t => (
                        <Feldzeile key={t.id} label={`${t.label}: ${t.menge!.einheit} je Monat (${t.menge!.min.toLocaleString('de-DE')}–${t.menge!.max.toLocaleString('de-DE')})`}>
                          <input type="number" inputMode="decimal" min={t.menge!.min} max={t.menge!.max} step={0.5} value={w.mengen[t.id] ?? t.menge!.vorgabe}
                            onChange={e => { const n = Number(e.target.value); aendern(x.id, { mengen: { ...w.mengen, [t.id]: n } }); }} style={eingabe} />
                        </Feldzeile>
                      ))}
                      {intern && (
                        <details style={{ fontSize: TYP.bedien, color: C.inkDim }}>
                          <summary style={{ cursor: 'pointer', minHeight: 32 }}>Rabatt oder eigener Preis (dann zur Freigabe)</summary>
                          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                            <Feldzeile label="Rabatt in %"><input value={w.rabatt} onChange={e => aendern(x.id, { rabatt: e.target.value })} style={eingabe} inputMode="decimal" /></Feldzeile>
                            {grund.filter(t => t.preis).map(t => (
                              <Feldzeile key={t.id} label={`Eigener Preis ${t.label} (€ netto, statt ${t.preis})`}><input value={w.preise[t.id] ?? ''} onChange={e => aendern(x.id, { preise: { ...w.preise, [t.id]: e.target.value } })} style={eingabe} inputMode="decimal" /></Feldzeile>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Feldzeile>

      <Feldzeile label="Gewünschter Start (optional)"><input type="date" value={start} onChange={e => setStart(e.target.value)} style={eingabe} /></Feldzeile>
      {intern && <Feldzeile label="Notiz für intern (geht nicht ins Angebot)"><textarea value={notiz} onChange={e => setNotiz(e.target.value)} rows={3} maxLength={2000} style={{ ...eingabe, minHeight: 88, resize: 'vertical' }} /></Feldzeile>}
      {extra}
      {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
      {hinweisUnten}
      <Knopf haupt voll typ="submit">Angebot anfordern</Knopf>
    </form>
  );
}
