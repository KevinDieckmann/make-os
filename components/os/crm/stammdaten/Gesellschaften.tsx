'use client';

// ─── Stammdaten › Gesellschaften — Absender der Angebote (28.09.) ────────────
// Je Gesellschaft (Selbstständigkeit · KD Ventures · MAKE Innovation GmbH): Firmierung, Anschrift,
// Kontakt, Steuernummer/USt-IdNr., Geschäftsführung/Register, Bank (IBAN nur maskiert),
// Kleinunternehmer, Zahlungsziel, Gültigkeit, Nummernformat, Logo (PNG/JPG in der
// Dateiablage) und Fußtext. Gespeichert wird feldweise mit Stand (409 → neu geladen);
// die Werte liegen nur im Datenspeicher des Haushalts, nie im Code.
// 29.09. (Sichtprüfung F5): alle Schreibvorgänge einer Karte laufen nacheinander über `gesellschaftKette`
// (lib/crm/gesellschaft-kette.ts) — Stand aus der letzten Antwort, Meldung bleibt bis zum nächsten Schreiben,
// was nicht gespeichert wurde, steht als „nicht gespeichert“ da (erneut speichern / verwerfen).

import { useCallback, useEffect, useRef, useState } from 'react';
import { KERN_EINHEITEN, UG_NAME } from '@/lib/einheiten';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Leer, Knopf, Chip } from '../../ui';
import { Feldzeile, Feld } from '../teile';
import { mitVorgaben, firmierungNochUG, firmierungVorschlag, type Gesellschaft } from '@/lib/crm/gesellschaften';
import { nummerAusFormat, NUMMER_VORGABE } from '@/lib/crm/angebote';
import { gesellschaftKette, type GesellschaftAntwort } from '@/lib/crm/gesellschaft-kette';

type G = Gesellschaft & { stand: string; luecken: string[] };
const klein = { fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5 } as const;

/**
 * `nur` (04.10.): nur diese eine Gesellschaft — so steht die Absender-Pflege als Reiter „Absender“ im Register
 * (/os/unternehmen). `onGeaendert` meldet jede gespeicherte Änderung (dort lädt das Register den neuen Stand).
 */
export function Gesellschaften({ i = 0, nur, onGeaendert }: { i?: number; nur?: 'kdc' | 'kdv' | 'ug'; onGeaendert?: () => void }) {
  const [liste, setListe] = useState<G[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const laden = useCallback(async () => {
    try {
      const r = await fetch('/api/crm/gesellschaften', { cache: 'no-store' });
      const d = await r.json().catch(() => null) as { ok?: boolean; gesellschaften?: G[]; fehler?: string } | null;
      if (d?.ok) { setListe(d.gesellschaften ?? []); setFehler(null); } else setFehler(d?.fehler ?? `Antwort ${r.status}.`);
    } catch { setFehler('Keine Verbindung.'); }
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  if (!liste) return <Karte i={i}><Leer>{fehler ?? 'lädt …'}</Leer></Karte>;
  return (
    <>
      <Karte i={i}>
        <Ueberschrift>{nur ? 'Absender für Angebote' : 'Gesellschaften'}</Ueberschrift>
        <div style={klein}>Absender der Angebote (und später der Rechnungen). Pflichtangaben einmal mit dem Steuerberater abstimmen — Hinweis, keine Steuerberatung. Die IBAN steht hier nur maskiert; im PDF steht sie voll.</div>
        {fehler && <div style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch, marginTop: 8 }}>{fehler}</div>}
      </Karte>
      {liste.filter(g => !nur || g.id === nur).map((g, n) => <GesellschaftKarte key={g.id} i={i + n + 1} g={g} onNeu={x => { setListe(l => (l ?? []).map(y => (y.id === x.id ? x : y))); onGeaendert?.(); }} />)}
    </>
  );
}

/** Eine nicht gespeicherte Eingabe (409/Fehler) — bleibt sichtbar, bis sie gespeichert oder verworfen ist. */
interface Offen { schluessel: string; label: string; felder: Record<string, unknown>; anzeige: string }
const antwortVon = (r: Response) => r.json().catch(() => ({ ok: false, fehler: `Antwort ${r.status}.` })) as Promise<GesellschaftAntwort<G>>;

function GesellschaftKarte({ g, i, onNeu }: { g: G; i: number; onNeu: (g: G) => void }) {
  const [meldung, setMeldung] = useState<string | null>(null);
  const [unterwegs, setUnterwegs] = useState(0);
  const [ungespeichert, setUngespeichert] = useState<Offen[]>([]);
  const [iban, setIban] = useState('');
  const v = mitVorgaben(g);
  const name = KERN_EINHEITEN.find(e => e.id === g.id)?.label ?? g.id;
  const jahr = new Date().getFullYear();
  // Eine Kette je Karte: nacheinander, Stand aus der letzten Antwort (F5).
  const onNeuRef = useRef(onNeu);
  onNeuRef.current = onNeu;
  const kette = useRef(gesellschaftKette<G>(g.stand, { uebernehmen: x => onNeuRef.current(x), meldung: setMeldung, offen: setUnterwegs }));
  useEffect(() => { kette.current.standSetzen(g.stand); }, [g.stand]);

  async function setze(felder: Record<string, unknown>, label = 'Eingabe') {
    const schluessel = Object.keys(felder).sort().join('+');
    const r = await kette.current.schreibe(stand => fetch('/api/crm/gesellschaften', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: g.id, felder, stand }) }).then(antwortVon));
    if (r.ok) { setUngespeichert(l => l.filter(x => x.schluessel !== schluessel)); return true; }
    // Die IBAN bleibt im Eingabefeld stehen (samt „IBAN speichern“) — nie im Klartext in der Liste.
    const bank = felder.bank as { iban?: string } | undefined;
    if (!bank?.iban) {
      const w = Object.values(felder)[0];
      const anzeige = typeof w === 'string' ? (w ? `„${w}“` : 'leer') : typeof w === 'boolean' ? (w ? 'an' : 'aus') : w && typeof w === 'object' ? Object.entries(w as Record<string, unknown>).filter(([k, x]) => k !== 'iban' && typeof x === 'string' && x).map(([, x]) => `„${x as string}“`).join(', ') : '';
      setUngespeichert(l => [...l.filter(x => x.schluessel !== schluessel), { schluessel, label, felder, anzeige }]);
    }
    return false;
  }
  async function logoHoch(datei: File) {
    await kette.current.schreibe(stand => {
      const f = new FormData(); f.append('id', g.id); f.append('stand', stand); f.append('datei', datei);
      return fetch('/api/crm/gesellschaften', { method: 'POST', body: f }).then(antwortVon);
    }, 'Logo nicht gespeichert.');
  }
  async function logoWeg() {
    await kette.current.schreibe(stand => fetch(`/api/crm/gesellschaften?id=${encodeURIComponent(g.id)}&logo=1&stand=${encodeURIComponent(stand)}`, { method: 'DELETE' }).then(antwortVon), 'Logo nicht entfernt.');
  }
  const feld = (label: string, schluessel: keyof Gesellschaft, platz?: string, breite?: number) => (
    <Feldzeile label={label}><Feld wert={String(g[schluessel] ?? '')} platzhalter={platz ?? label} breite={breite} onFertig={t => void setze({ [schluessel]: t.trim() }, label)} /></Feldzeile>
  );
  return (
    <Karte i={i} akzent={g.luecken.length ? LEUCHT.achtung : undefined}>
      <Ueberschrift farbe={LEUCHT.business} rechts={g.luecken.length ? <Chip farbe={LEUCHT.achtung}>fehlt: {g.luecken.join(', ')}</Chip> : <Chip farbe={LEUCHT.gut}>vollständig</Chip>}>{name}</Ueberschrift>
      {meldung && (
        <div role="alert" style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: TYP.bedien, color: LEUCHT.kritisch, marginBottom: 8 }}>
          <span style={{ flex: 1 }}>{meldung}</span>
          <button onClick={() => setMeldung(null)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien }}>ok</button>
        </div>
      )}
      {unterwegs > 0 && <div aria-live="polite" style={{ ...klein, marginBottom: 6 }}>speichert …</div>}
      {firmierungNochUG(g) && (
        // Umbenennung 30.09.: nie still überschreiben — Hinweis + Knopf über den normalen Schreibweg (Stand/409).
        <div role="status" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: 10, borderRadius: 12, marginBottom: 10, border: `1px solid ${LEUCHT.achtung}55`, background: `${LEUCHT.achtung}10` }}>
          <span style={{ flex: '1 1 220px', minWidth: 0, fontSize: TYP.bedien, color: C.inkDim, overflowWrap: 'anywhere' }}>
            Firmierung noch als UG gespeichert („{g.firmierung}“) — auf {UG_NAME} ändern? Register (HRB) und Geschäftsführung bitte selbst prüfen.
          </span>
          <Knopf leise onClick={() => void setze({ firmierung: UG_NAME }, 'Firmierung')}>auf {UG_NAME} ändern</Knopf>
        </div>
      )}
      {ungespeichert.length > 0 && (
        <div style={{ display: 'grid', gap: 6, padding: 10, borderRadius: 12, marginBottom: 10, border: `1px solid ${LEUCHT.achtung}55`, background: `${LEUCHT.achtung}10` }}>
          <div style={{ fontSize: TYP.bedien, fontWeight: 700, color: LEUCHT.achtung }}>Nicht gespeichert</div>
          {ungespeichert.map(o => (
            <div key={o.schluessel} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim }}>
              <span style={{ flex: '1 1 180px', minWidth: 0, overflowWrap: 'anywhere' }}>{o.label}{o.anzeige ? `: ${o.anzeige}` : ''}</span>
              <Knopf leise onClick={() => void setze(o.felder, o.label)}>erneut speichern</Knopf>
              <button onClick={() => setUngespeichert(l => l.filter(x => x.schluessel !== o.schluessel))} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien }}>verwerfen</button>
            </div>
          ))}
        </div>
      )}
      {feld('Firmierung', 'firmierung', firmierungVorschlag(g.id) ? `Vorschlag: ${firmierungVorschlag(g.id)}` : 'z. B. KD Ventures UG (haftungsbeschränkt)')}
      {feld('Straße', 'strasse')}
      <Feldzeile label="PLZ · Ort"><span style={{ display: 'flex', gap: 8 }}><Feld wert={g.plz ?? ''} platzhalter="PLZ" breite={90} onFertig={t => void setze({ plz: t.trim() }, 'PLZ')} /><Feld wert={g.ort ?? ''} platzhalter="Ort" onFertig={t => void setze({ ort: t.trim() }, 'Ort')} /></span></Feldzeile>
      {feld('Land', 'land', 'Deutschland (leer lassen)')}
      {feld('E-Mail', 'email')}
      {feld('Telefon', 'telefon')}
      {feld('Web', 'web', 'z. B. www.beispiel.de')}
      {feld('Steuernummer', 'steuernummer')}
      {feld('USt-IdNr.', 'ustId', 'DE…')}
      {(g.id === 'ug' || g.id === 'kdv') && feld('Geschäftsführung', 'geschaeftsfuehrung')}
      {(g.id === 'ug' || g.id === 'kdv') && feld('Register', 'register', 'Amtsgericht … HRB …')}
      <Feldzeile label="Bank">
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Feld wert={g.bank?.bank ?? ''} platzhalter="Bank" onFertig={t => void setze({ bank: { ...g.bank, iban: undefined, bank: t.trim() } }, 'Bank')} />
            <Feld wert={g.bank?.bic ?? ''} platzhalter="BIC" breite={130} onFertig={t => void setze({ bank: { ...g.bank, iban: undefined, bic: t.trim() } }, 'BIC')} />
          </span>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {g.bank?.iban ? <span style={{ fontSize: TYP.bedien, fontFamily: 'ui-monospace, Menlo, monospace', color: C.inkDim }}>{g.bank.iban}</span> : <span style={klein}>keine IBAN</span>}
            <input value={iban} onChange={e => setIban(e.target.value)} placeholder={g.bank?.iban ? 'neue IBAN eingeben' : 'IBAN'} aria-label="IBAN" autoComplete="off"
              onKeyDown={async e => { if (e.key === 'Enter' && iban.trim()) { if (await setze({ bank: { ...g.bank, iban: iban.trim() } })) setIban(''); } }}
              style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, color: C.ink, fontSize: TYP.bedien, padding: '8px 11px', flex: '1 1 200px' }} />
            {iban.trim() && <Knopf onClick={async () => { if (await setze({ bank: { ...g.bank, iban: iban.trim() } })) setIban(''); }}>IBAN speichern</Knopf>}
            {g.bank?.iban && <button onClick={() => { if (window.confirm('IBAN entfernen?')) void setze({ bank: { ...g.bank, iban: undefined, ibanEntfernen: true } }, 'IBAN entfernen'); }} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien }}>entfernen</button>}
          </span>
          <Feld wert={g.bank?.inhaber ?? ''} platzhalter="Kontoinhaber (optional)" onFertig={t => void setze({ bank: { ...g.bank, iban: undefined, inhaber: t.trim() } }, 'Kontoinhaber')} />
        </div>
      </Feldzeile>
      <Feldzeile label="Kleinunternehmer">
        <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!g.kleinunternehmer} onChange={e => void setze({ kleinunternehmer: e.target.checked }, 'Kleinunternehmer')} /> § 19 UStG — Angebote ohne Umsatzsteuer
        </label>
      </Feldzeile>
      <Feldzeile label="Zahlungsziel · Gültigkeit">
        <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Feld typ="number" wert={g.zahlungszielTage != null ? String(g.zahlungszielTage) : ''} platzhalter={`${v.zahlungszielTage}`} breite={80} onFertig={t => void setze({ zahlungszielTage: t }, 'Zahlungsziel')} /><span style={klein}>Tage Zahlungsziel</span>
          <Feld typ="number" wert={g.gueltigkeitTage != null ? String(g.gueltigkeitTage) : ''} platzhalter={`${v.gueltigkeitTage}`} breite={80} onFertig={t => void setze({ gueltigkeitTage: t }, 'Gültigkeit')} /><span style={klein}>Tage gültig</span>
        </span>
      </Feldzeile>
      <Feldzeile label="Nummernformat">
        <div style={{ display: 'grid', gap: 4 }}>
          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Feld wert={g.nummernformat ?? ''} platzhalter={NUMMER_VORGABE} onFertig={t => void setze({ nummernformat: t.trim() }, 'Nummernformat')} />
            <Feld wert={g.kurz ?? ''} platzhalter={`Kürzel (${v.kurz})`} breite={130} onFertig={t => void setze({ kurz: t.trim() }, 'Kürzel')} />
          </span>
          <span style={klein}>Nächstes Angebot etwa: {nummerAusFormat(v.nummernformat, v.kurz, jahr, 1)} — {'{KURZ}'} {'{JAHR}'} {'{JJ}'} {'{NR4}'} (laufend je Gesellschaft und Jahr, lückenlos)</span>
        </div>
      </Feldzeile>
      <Feldzeile label="Logo">
        <span style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {g.logoDateiId && <img src={`/api/crm/dateien?id=${encodeURIComponent(g.logoDateiId)}`} alt={`Logo ${name}`} style={{ maxHeight: 40, maxWidth: 140, background: '#fff', borderRadius: 6, padding: 4 }} />}
          <input type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" aria-label="Logo hochladen" onChange={e => { const d = e.target.files?.[0]; if (d) void logoHoch(d); e.target.value = ''; }} style={{ fontSize: TYP.bedien, color: C.inkDim }} />
          {g.logoDateiId && <button onClick={() => void logoWeg()} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien }}>entfernen</button>}
        </span>
      </Feldzeile>
      <Feldzeile label="Fußtext">
        <textarea defaultValue={g.fusstext ?? ''} key={`${g.id}-${g.stand}`} rows={2} aria-label="Fußtext" placeholder="z. B. Es gelten unsere AGB …"
          onBlur={e => { if (e.target.value.trim() !== (g.fusstext ?? '')) void setze({ fusstext: e.target.value.trim() }, 'Fußtext'); }}
          style={{ width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, color: C.ink, fontSize: TYP.bedien, padding: '8px 11px', resize: 'vertical', lineHeight: 1.5 }} />
      </Feldzeile>
    </Karte>
  );
}

