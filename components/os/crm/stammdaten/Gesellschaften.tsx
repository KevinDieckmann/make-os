'use client';

// ─── Stammdaten › Gesellschaften — Absender der Angebote (28.09.) ────────────
// Je Gesellschaft (Selbstständigkeit · KD Ventures · MAKE OS UG): Firmierung, Anschrift,
// Kontakt, Steuernummer/USt-IdNr., Geschäftsführung/Register, Bank (IBAN nur maskiert),
// Kleinunternehmer, Zahlungsziel, Gültigkeit, Nummernformat, Logo (PNG/JPG in der
// Dateiablage) und Fußtext. Gespeichert wird feldweise mit Stand (409 → neu geladen);
// die Werte liegen nur im Datenspeicher des Haushalts, nie im Code.

import { useCallback, useEffect, useState } from 'react';
import { KERN_EINHEITEN } from '@/lib/einheiten';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Leer, Knopf, Chip } from '../../schlank';
import { Feldzeile, Feld } from '../teile';
import { mitVorgaben, type Gesellschaft } from '@/lib/crm/gesellschaften';
import { nummerAusFormat, NUMMER_VORGABE } from '@/lib/crm/angebote';

type G = Gesellschaft & { stand: string; luecken: string[] };
const klein = { fontSize: 12.5, color: C.inkLeise, lineHeight: 1.5 } as const;

export function Gesellschaften({ i = 0 }: { i?: number }) {
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
        <Ueberschrift>Gesellschaften</Ueberschrift>
        <div style={klein}>Absender der Angebote (und später der Rechnungen). Pflichtangaben einmal mit dem Steuerberater abstimmen — Hinweis, keine Steuerberatung. Die IBAN steht hier nur maskiert; im PDF steht sie voll.</div>
        {fehler && <div style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch, marginTop: 8 }}>{fehler}</div>}
      </Karte>
      {liste.map((g, n) => <GesellschaftKarte key={g.id} i={i + n + 1} g={g} onNeu={x => setListe(l => (l ?? []).map(y => (y.id === x.id ? x : y)))} onFehler={t => { setFehler(t); void laden(); }} />)}
    </>
  );
}

function GesellschaftKarte({ g, i, onNeu, onFehler }: { g: G; i: number; onNeu: (g: G) => void; onFehler: (t: string) => void }) {
  const [meldung, setMeldung] = useState<string | null>(null);
  const [iban, setIban] = useState('');
  const v = mitVorgaben(g);
  const name = KERN_EINHEITEN.find(e => e.id === g.id)?.label ?? g.id;
  const jahr = new Date().getFullYear();

  async function setze(felder: Record<string, unknown>) {
    const r = await fetch('/api/crm/gesellschaften', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: g.id, felder, stand: g.stand }) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung — nichts gespeichert.' }));
    if (r.ok) { onNeu(r.gesellschaft); setMeldung(null); return true; }
    if (r.aktuell) { onNeu(r.aktuell); setMeldung('Wurde inzwischen geändert — Stand neu geladen, bitte noch einmal.'); return false; }
    setMeldung(r.fehler ?? 'Nicht gespeichert.');
    return false;
  }
  async function logoHoch(datei: File) {
    const f = new FormData(); f.append('id', g.id); f.append('stand', g.stand); f.append('datei', datei);
    const r = await fetch('/api/crm/gesellschaften', { method: 'POST', body: f }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    if (r.ok) { onNeu(r.gesellschaft); setMeldung(null); } else if (r.aktuell) { onNeu(r.aktuell); setMeldung(r.fehler); } else setMeldung(r.fehler ?? 'Logo nicht gespeichert.');
  }
  async function logoWeg() {
    const r = await fetch(`/api/crm/gesellschaften?id=${g.id}&logo=1&stand=${encodeURIComponent(g.stand)}`, { method: 'DELETE' }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    if (r.ok) onNeu(r.gesellschaft); else onFehler(r.fehler ?? 'Logo nicht entfernt.');
  }
  const feld = (label: string, schluessel: keyof Gesellschaft, platz?: string, breite?: number) => (
    <Feldzeile label={label}><Feld wert={String(g[schluessel] ?? '')} platzhalter={platz ?? label} breite={breite} onFertig={t => void setze({ [schluessel]: t.trim() })} /></Feldzeile>
  );
  return (
    <Karte i={i} akzent={g.luecken.length ? LEUCHT.achtung : undefined}>
      <Ueberschrift farbe={LEUCHT.business} rechts={g.luecken.length ? <Chip farbe={LEUCHT.achtung}>fehlt: {g.luecken.join(', ')}</Chip> : <Chip farbe={LEUCHT.gut}>vollständig</Chip>}>{name}</Ueberschrift>
      {meldung && <div style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch, marginBottom: 8 }}>{meldung}</div>}
      {feld('Firmierung', 'firmierung', 'z. B. KD Ventures UG (haftungsbeschränkt)')}
      {feld('Straße', 'strasse')}
      <Feldzeile label="PLZ · Ort"><span style={{ display: 'flex', gap: 8 }}><Feld wert={g.plz ?? ''} platzhalter="PLZ" breite={90} onFertig={t => void setze({ plz: t.trim() })} /><Feld wert={g.ort ?? ''} platzhalter="Ort" onFertig={t => void setze({ ort: t.trim() })} /></span></Feldzeile>
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
            <Feld wert={g.bank?.bank ?? ''} platzhalter="Bank" onFertig={t => void setze({ bank: { ...g.bank, iban: undefined, bank: t.trim() } })} />
            <Feld wert={g.bank?.bic ?? ''} platzhalter="BIC" breite={130} onFertig={t => void setze({ bank: { ...g.bank, iban: undefined, bic: t.trim() } })} />
          </span>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {g.bank?.iban ? <span style={{ fontSize: TYP.bedien, fontFamily: 'ui-monospace, Menlo, monospace', color: C.inkDim }}>{g.bank.iban}</span> : <span style={klein}>keine IBAN</span>}
            <input value={iban} onChange={e => setIban(e.target.value)} placeholder={g.bank?.iban ? 'neue IBAN eingeben' : 'IBAN'} aria-label="IBAN" autoComplete="off"
              onKeyDown={async e => { if (e.key === 'Enter' && iban.trim()) { if (await setze({ bank: { ...g.bank, iban: iban.trim() } })) setIban(''); } }}
              style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, color: C.ink, fontSize: TYP.bedien, padding: '8px 11px', flex: '1 1 200px' }} />
            {iban.trim() && <Knopf onClick={async () => { if (await setze({ bank: { ...g.bank, iban: iban.trim() } })) setIban(''); }}>IBAN speichern</Knopf>}
            {g.bank?.iban && <button onClick={() => { if (window.confirm('IBAN entfernen?')) void setze({ bank: { ...g.bank, iban: undefined, ibanEntfernen: true } }); }} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12.5 }}>entfernen</button>}
          </span>
          <Feld wert={g.bank?.inhaber ?? ''} platzhalter="Kontoinhaber (optional)" onFertig={t => void setze({ bank: { ...g.bank, iban: undefined, inhaber: t.trim() } })} />
        </div>
      </Feldzeile>
      <Feldzeile label="Kleinunternehmer">
        <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!g.kleinunternehmer} onChange={e => void setze({ kleinunternehmer: e.target.checked })} /> § 19 UStG — Angebote ohne Umsatzsteuer
        </label>
      </Feldzeile>
      <Feldzeile label="Zahlungsziel · Gültigkeit">
        <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Feld typ="number" wert={g.zahlungszielTage != null ? String(g.zahlungszielTage) : ''} platzhalter={`${v.zahlungszielTage}`} breite={80} onFertig={t => void setze({ zahlungszielTage: t })} /><span style={klein}>Tage Zahlungsziel</span>
          <Feld typ="number" wert={g.gueltigkeitTage != null ? String(g.gueltigkeitTage) : ''} platzhalter={`${v.gueltigkeitTage}`} breite={80} onFertig={t => void setze({ gueltigkeitTage: t })} /><span style={klein}>Tage gültig</span>
        </span>
      </Feldzeile>
      <Feldzeile label="Nummernformat">
        <div style={{ display: 'grid', gap: 4 }}>
          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Feld wert={g.nummernformat ?? ''} platzhalter={NUMMER_VORGABE} onFertig={t => void setze({ nummernformat: t.trim() })} />
            <Feld wert={g.kurz ?? ''} platzhalter={`Kürzel (${v.kurz})`} breite={130} onFertig={t => void setze({ kurz: t.trim() })} />
          </span>
          <span style={klein}>Nächstes Angebot etwa: {nummerAusFormat(v.nummernformat, v.kurz, jahr, 1)} — {'{KURZ}'} {'{JAHR}'} {'{JJ}'} {'{NR4}'} (laufend je Gesellschaft und Jahr, lückenlos)</span>
        </div>
      </Feldzeile>
      <Feldzeile label="Logo">
        <span style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {g.logoDateiId && <img src={`/api/crm/dateien?id=${encodeURIComponent(g.logoDateiId)}`} alt={`Logo ${name}`} style={{ maxHeight: 40, maxWidth: 140, background: '#fff', borderRadius: 6, padding: 4 }} />}
          <input type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" aria-label="Logo hochladen" onChange={e => { const d = e.target.files?.[0]; if (d) void logoHoch(d); e.target.value = ''; }} style={{ fontSize: 12.5, color: C.inkDim }} />
          {g.logoDateiId && <button onClick={() => void logoWeg()} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12.5 }}>entfernen</button>}
        </span>
      </Feldzeile>
      <Feldzeile label="Fußtext">
        <textarea defaultValue={g.fusstext ?? ''} key={`${g.id}-${g.stand}`} rows={2} aria-label="Fußtext" placeholder="z. B. Es gelten unsere AGB …"
          onBlur={e => { if (e.target.value.trim() !== (g.fusstext ?? '')) void setze({ fusstext: e.target.value.trim() }); }}
          style={{ width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, color: C.ink, fontSize: TYP.bedien, padding: '8px 11px', resize: 'vertical', lineHeight: 1.5 }} />
      </Feldzeile>
    </Karte>
  );
}

