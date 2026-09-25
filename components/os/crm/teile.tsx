'use client';

// Gemeinsame Bauteile der Markttraktion: Kanal-Ampel, Notizvorlage, Verlauf, kleine Eingaben.

import { useEffect, useState, type ReactNode } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Knopf, feld, LEUCHT } from '../schlank';
import { NOTIZ_FELDER, type Aktivitaet, type NotizVorlage, type Ergebnis } from '@/lib/make-one/crm';
import type { KanalStatus } from '@/lib/crm/recht';
import { datum, plusTage } from './daten';

import { Person } from './team';

export const AMPEL_FARBE = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch } as const;
const KANAL_LABEL: Record<string, string> = { telefon: 'Telefon', mail: 'Mail', linkedin: 'LinkedIn', vernetzen: 'Vernetzen', newsletter: 'Newsletter', einladung: 'Einladung' };

/** Kanal-Ampel — anklickbar nur, was zulässig ist. */
export function KanalAmpel({ ampel, ziele }: { ampel: KanalStatus[]; ziele: { telefon?: string; email?: string; linkedin?: string } }) {
  const href = (s: KanalStatus) => s.farbe === 'rot' ? undefined
    : s.kanal === 'telefon' && ziele.telefon ? `tel:${ziele.telefon.replace(/\s/g, '')}`
    : s.kanal === 'mail' && ziele.email ? `mailto:${ziele.email}`
    : (s.kanal === 'linkedin' || s.kanal === 'vernetzen') && ziele.linkedin ? ziele.linkedin : undefined;
  if (!ampel.length) return <span style={{ fontSize: 12.5, color: C.inkLeise }}>Keine Adresse hinterlegt.</span>;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {ampel.map(s => {
        const f = AMPEL_FARBE[s.farbe];
        const inhalt = <><span style={{ width: 7, height: 7, borderRadius: '50%', background: f, boxShadow: `0 0 8px ${f}` }} />{KANAL_LABEL[s.kanal] ?? s.kanal}</>;
        const stil = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, textDecoration: 'none', border: `1px solid ${f}55`, background: `${f}14`, color: s.farbe === 'rot' ? C.inkLeise : C.ink } as const;
        const h = href(s);
        return h ? <a key={s.kanal} href={h} target={h.startsWith('http') ? '_blank' : undefined} rel="noreferrer" title={s.grund} style={stil}>{inhalt}</a>
          : <span key={s.kanal} title={s.grund} style={stil}>{inhalt}</span>;
      })}
    </div>
  );
}

export function Grund({ ampel }: { ampel: KanalStatus[] }) {
  const g = ampel.find(s => s.farbe !== 'gruen' && s.kanal !== 'vernetzen');
  return g ? <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 6 }}>{KANAL_LABEL[g.kanal]}: {g.grund}</div> : null;
}

const ART_LABEL: Record<string, string> = { uebergabe: 'Übergabe', mail: 'Mail', linkedin: 'LinkedIn', anruf: 'Anruf', antwort: 'Antwort', termin: 'Termin', notiz: 'Notiz', stufe: 'Stufe', gespraech: 'Gespräch', event: 'Event', system: 'System' };
const ERG_LABEL: Record<string, string> = { gespraech: 'Gespräch', termin: 'Termin', mailbox: 'Mailbox', nicht_erreicht: 'nicht erreicht', rueckruf: 'Rückruf', kein_bedarf: 'kein Bedarf', sperre: 'Sperre' };

/** Verlauf: jüngstes zuerst, Notizvorlage aufgeklappt. */
export function Verlauf({ liste, name, max = 50, heute }: { liste: Aktivitaet[]; name: (p: string) => string; max?: number; heute?: string }) {
  const l = [...liste].reverse().slice(0, max);
  if (!l.length) return <div style={{ fontSize: 12.5, color: C.inkLeise }}>Noch kein Verlauf. Das erste Gespräch mit der Notizvorlage festhalten.</div>;
  return (
    <div style={{ display: 'grid', gap: 0 }}>
      {l.map((a, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '78px 1fr', gap: 12, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
          <div style={{ fontSize: 12, color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{datum(a.am, heute)}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: TYP.bedien, color: C.ink }}>
              <b style={{ fontWeight: 600 }}>{ART_LABEL[a.art] ?? a.art}</b>{a.ergebnis && <span style={{ color: C.inkDim }}> · {ERG_LABEL[a.ergebnis]}</span>}
              <span style={{ color: C.inkLeise }}> · </span><span style={{ display: 'inline-flex', verticalAlign: 'middle', gap: 4, alignItems: 'center', color: C.inkLeise }}>{a.von !== 'system' && <Person id={a.von} groesse={14} />}{name(a.von)}</span>
            </div>
            {a.text && <div style={{ fontSize: 12.5, color: C.inkDim, marginTop: 2, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{a.text}</div>}
            {a.notiz && (
              <div style={{ display: 'grid', gap: 2, marginTop: 4 }}>
                {NOTIZ_FELDER.filter(f => a.notiz?.[f.id]).map(f => <div key={f.id} style={{ fontSize: 12.5, color: C.inkDim, lineHeight: 1.45 }}><span style={{ color: C.inkLeise }}>{f.label}:</span> {a.notiz![f.id]}</div>)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Notizvorlage mit Pflicht-Schritt — nach jedem echten Gespräch. */
export function NotizFormular({ heute, ergebnis, onFertig, onAbbruch, knopf = 'Speichern' }: {
  heute: string; ergebnis?: Ergebnis; knopf?: string;
  onFertig: (x: { notiz: NotizVorlage; naechster?: { text: string; datum: string }; text?: string }) => void; onAbbruch?: () => void;
}) {
  const [n, setN] = useState<NotizVorlage>({});
  const [schritt, setSchritt] = useState('');
  const [wann, setWann] = useState(plusTage(heute, ergebnis === 'termin' ? 7 : 5));
  useEffect(() => { setWann(plusTage(heute, ergebnis === 'termin' ? 7 : 5)); }, [ergebnis, heute]);
  const pflicht = ergebnis === 'gespraech' || ergebnis === 'termin' || ergebnis === 'rueckruf';
  const ok = !pflicht || (schritt.trim() && wann);
  return (
    <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
      {NOTIZ_FELDER.filter(f => f.id !== 'naechster').map(f => (
        <textarea key={f.id} rows={f.id === 'erkenntnisse' || f.id === 'bedarf' ? 2 : 1} placeholder={f.label} aria-label={f.label} value={n[f.id] ?? ''}
          onChange={e => setN({ ...n, [f.id]: e.target.value })} style={{ ...feld, resize: 'vertical', fontSize: TYP.bedien, padding: '9px 12px' }} />
      ))}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={schritt} placeholder={pflicht ? 'Nächster Schritt (Pflicht)' : 'Nächster Schritt'} aria-label="Nächster Schritt" onChange={e => setSchritt(e.target.value)} style={{ ...feld, flex: 1, minWidth: 180, fontSize: TYP.bedien, padding: '9px 12px' }} />
        <input type="date" value={wann} aria-label="bis wann" onChange={e => setWann(e.target.value)} style={{ ...feld, width: 'auto', fontSize: TYP.bedien, padding: '9px 12px' }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Knopf aus={!ok} onClick={() => ok && onFertig({ notiz: Object.fromEntries(Object.entries(n).filter(([, v]) => (v ?? '').trim())) as NotizVorlage, ...(schritt.trim() ? { naechster: { text: schritt.trim(), datum: wann } } : {}) })}>{knopf}</Knopf>
        {onAbbruch && <Knopf leise onClick={onAbbruch}>Abbrechen</Knopf>}
      </div>
    </div>
  );
}

export function Feldzeile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 150px) 1fr', gap: 12, alignItems: 'center', padding: '6px 0' }}>
      <span style={{ fontSize: 12.5, color: C.inkLeise }}>{label}</span>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

export function Pillen<T extends string>({ liste, aktiv, onWahl, farbe = C.aktiv, einzeilig }: { liste: { id: T; label: string }[]; aktiv: T | null | undefined; onWahl: (id: T) => void; farbe?: string; einzeilig?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: einzeilig ? 'nowrap' : 'wrap', whiteSpace: einzeilig ? 'nowrap' : undefined }}>
      {liste.map(l => {
        const an = l.id === aktiv;
        return <button key={l.id} onClick={e => { e.stopPropagation(); onWahl(l.id); }} className="fassbar" style={{ fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${an ? farbe : 'rgba(255,255,255,.1)'}`, background: an ? `${farbe}22` : 'transparent', color: an ? farbe : C.inkDim }}>{l.label}</button>;
      })}
    </div>
  );
}

/** Kleines Feld, das beim Verlassen speichert. */
export function Feld({ wert = '', onFertig, platzhalter, typ = 'text', breite }: { wert?: string; onFertig: (t: string) => void; platzhalter?: string; typ?: string; breite?: number | string }) {
  const [t, setT] = useState(wert);
  useEffect(() => { setT(wert); }, [wert]);
  return <input type={typ} value={t} placeholder={platzhalter} aria-label={platzhalter} onChange={e => setT(e.target.value)} onBlur={() => { if (t !== wert) onFertig(t); }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px', ...(breite ? { width: breite } : {}) }} />;
}
