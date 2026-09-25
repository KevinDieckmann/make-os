'use client';

// Gemeinsame Bauteile der Markttraktion: Kanal-Ampel, Notizvorlage, Verlauf, kleine Eingaben.
// Erfassen ohne Reibung (25.09.): Die Kanal-Chips sind Links — Telefon wählt,
// Mail öffnet das Mailprogramm, LinkedIn das Profil —, aber nur, wo die Ampel
// nicht rot ist (§ 7 UWG). MAKE OS versendet nichts; es öffnet nur das
// Programm des Nutzers. Die Notizvorlage hält auf Wunsch das ausdrückliche Ja
// zur Mail als Einwilligung mit Wortlaut fest.

import { useEffect, useState, type ReactNode } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Knopf, feld, LEUCHT } from '../schlank';
import { NOTIZ_FELDER, type Aktivitaet, type NotizVorlage, type Ergebnis, type Kontakt } from '@/lib/make-one/crm';
import type { KanalStatus } from '@/lib/crm/recht';
import { kanalLink, einwilligungVorlage, einwilligungUebernehmen } from '@/lib/crm/erfassen';
import { datum, plusTage, type CrmApi } from './daten';

import { Person } from './team';

export const AMPEL_FARBE = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch } as const;
const KANAL_LABEL: Record<string, string> = { telefon: 'Telefon', mail: 'Mail', linkedin: 'LinkedIn', vernetzen: 'Vernetzen', newsletter: 'Newsletter', einladung: 'Einladung' };

const KANAL_TUN: Record<string, string> = { telefon: 'anrufen', mail: 'Mail öffnen', linkedin: 'Profil öffnen', vernetzen: 'Profil öffnen' };

/**
 * Kanal-Ampel — ein Tipp ruft an oder öffnet, aber nur, was zulässig ist:
 * rot bleibt ein Chip ohne Link (der Grund steht im Tooltip). Links öffnen
 * nur Telefon, Mailprogramm oder LinkedIn — versendet wird hier nichts.
 */
export function KanalAmpel({ ampel, ziele }: { ampel: KanalStatus[]; ziele: { telefon?: string; email?: string; linkedin?: string } }) {
  if (!ampel.length) return <span style={{ fontSize: 12.5, color: C.inkLeise }}>Keine Adresse hinterlegt.</span>;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {ampel.map(s => {
        const f = AMPEL_FARBE[s.farbe];
        const h = kanalLink(s, ziele);
        const inhalt = <><span style={{ width: 7, height: 7, borderRadius: '50%', background: f, boxShadow: `0 0 8px ${f}` }} />{KANAL_LABEL[s.kanal] ?? s.kanal}{h && <span aria-hidden style={{ color: C.inkLeise, fontWeight: 500 }}>↗</span>}</>;
        // Große Tippfläche fürs Handy (min. 32 px), Farbe und Kante aus der Ampel.
        const stil = { display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32, padding: '5px 11px', borderRadius: 999, fontSize: 12, fontWeight: 600, textDecoration: 'none', border: `1px solid ${f}55`, background: `${f}14`, color: s.farbe === 'rot' ? C.inkLeise : C.ink } as const;
        const extern = !!h && h.startsWith('http');
        return h ? <a key={s.kanal} href={h} target={extern ? '_blank' : undefined} rel={extern ? 'noopener noreferrer' : undefined} title={`${KANAL_LABEL[s.kanal] ?? s.kanal} ${KANAL_TUN[s.kanal] ?? ''} · ${s.grund}`} className="fassbar" style={stil}>{inhalt}</a>
          : <span key={s.kanal} title={s.grund} style={stil}>{inhalt}</span>;
      })}
    </div>
  );
}

export function Grund({ ampel }: { ampel: KanalStatus[] }) {
  const g = ampel.find(s => s.farbe !== 'gruen' && s.kanal !== 'vernetzen');
  return g ? <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 6 }}>{KANAL_LABEL[g.kanal]}: {g.grund}</div> : null;
}

/** Ergebnis-Knöpfe der Power Hour — auch im „+ Gespräch“. Mit `notiz` öffnet sich die Notizvorlage (nächster Schritt Pflicht). */
export const ERGEBNIS_KNOEPFE: { id: Ergebnis; label: string; notiz: boolean }[] = [
  { id: 'gespraech', label: 'Gespräch', notiz: true }, { id: 'termin', label: 'Termin', notiz: true }, { id: 'rueckruf', label: 'Rückruf', notiz: true },
  { id: 'mailbox', label: 'Mailbox', notiz: false }, { id: 'nicht_erreicht', label: 'Nicht erreicht', notiz: false }, { id: 'kein_bedarf', label: 'Kein Bedarf', notiz: false }, { id: 'sperre', label: 'Sperre', notiz: false },
];

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

/** Was die Notizvorlage zurückgibt — mit dem Ja zur Mail, wenn es im Gespräch fiel. */
export interface NotizErgebnis {
  notiz: NotizVorlage; naechster?: { text: string; datum: string }; text?: string;
  /** Ausdrückliches Ja mit Wortlaut — der Aufrufer übernimmt es (lib/crm/erfassen.ts einwilligungUebernehmen). */
  einwilligung?: { kanal: 'mail'; nachweis: string };
}

/**
 * Notizvorlage mit Pflicht-Schritt — nach jedem echten Gespräch. Optional der
 * Schalter „Einwilligung für Mail erhalten“ mit Wortlaut (vorbelegt in der
 * Anrede der Person); `einwilligung={false}` blendet ihn aus, etwa wenn es
 * schon eine gültige gibt.
 */
export function NotizFormular({ heute, ergebnis, onFertig, onAbbruch, knopf = 'Speichern', einwilligung = true, anrede, autoFokus }: {
  heute: string; ergebnis?: Ergebnis; knopf?: string; einwilligung?: boolean; anrede?: 'Sie' | 'Du'; autoFokus?: boolean;
  onFertig: (x: NotizErgebnis) => void; onAbbruch?: () => void;
}) {
  const [n, setN] = useState<NotizVorlage>({});
  const [schritt, setSchritt] = useState('');
  const [wann, setWann] = useState(plusTage(heute, ergebnis === 'termin' ? 7 : 5));
  const [ja, setJa] = useState(false);
  const [wortlaut, setWortlaut] = useState(einwilligungVorlage(anrede));
  useEffect(() => { setWann(plusTage(heute, ergebnis === 'termin' ? 7 : 5)); }, [ergebnis, heute]);
  useEffect(() => { setWortlaut(einwilligungVorlage(anrede)); }, [anrede]);
  const pflicht = ergebnis === 'gespraech' || ergebnis === 'termin' || ergebnis === 'rueckruf';
  const ok = (!pflicht || (schritt.trim() && wann)) && (!ja || wortlaut.trim());
  const fertig = () => ok && onFertig({
    notiz: Object.fromEntries(Object.entries(n).filter(([, v]) => (v ?? '').trim())) as NotizVorlage,
    ...(schritt.trim() ? { naechster: { text: schritt.trim(), datum: wann } } : {}),
    ...(einwilligung && ja && wortlaut.trim() ? { einwilligung: { kanal: 'mail' as const, nachweis: wortlaut.trim() } } : {}),
  });
  return (
    <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
      {NOTIZ_FELDER.filter(f => f.id !== 'naechster').map((f, i) => (
        <textarea key={f.id} rows={f.id === 'erkenntnisse' || f.id === 'bedarf' ? 2 : 1} placeholder={f.label} aria-label={f.label} value={n[f.id] ?? ''} autoFocus={autoFokus && i === 0}
          onChange={e => setN({ ...n, [f.id]: e.target.value })} style={{ ...feld, resize: 'vertical', fontSize: TYP.bedien, padding: '9px 12px' }} />
      ))}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={schritt} placeholder={pflicht ? 'Nächster Schritt (Pflicht)' : 'Nächster Schritt'} aria-label="Nächster Schritt" onChange={e => setSchritt(e.target.value)} style={{ ...feld, flex: 1, minWidth: 180, fontSize: TYP.bedien, padding: '9px 12px' }} />
        <input type="date" value={wann} aria-label="bis wann" onChange={e => setWann(e.target.value)} style={{ ...feld, width: 'auto', fontSize: TYP.bedien, padding: '9px 12px' }} />
      </div>
      {einwilligung && (
        <div style={{ display: 'grid', gap: 6, padding: '8px 10px', borderRadius: 10, background: ja ? `${LEUCHT.gut}10` : 'transparent', border: `1px solid ${ja ? `${LEUCHT.gut}44` : 'rgba(255,255,255,.06)'}` }}>
          <button type="button" role="switch" aria-checked={ja} onClick={() => setJa(!ja)} className="fassbar"
            style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 36, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: C.ink, fontSize: TYP.bedien, fontWeight: 600, textAlign: 'left' }}>
            <span aria-hidden style={{ width: 34, height: 20, borderRadius: 999, flex: '0 0 auto', position: 'relative', background: ja ? LEUCHT.gut : 'rgba(255,255,255,.14)', transition: 'background .2s ease' }}>
              <span style={{ position: 'absolute', top: 2, left: ja ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: C.grund, transition: 'left .2s ease' }} />
            </span>
            Einwilligung für Mail erhalten
          </button>
          {ja && <input value={wortlaut} aria-label="Wortlaut der Einwilligung" placeholder="Wortlaut: Frage und Antwort" onChange={e => setWortlaut(e.target.value)} style={{ ...feld, fontSize: TYP.bedien, padding: '9px 12px' }} />}
          <span style={{ fontSize: 12, color: C.inkLeise, lineHeight: 1.45 }}>Eine Visitenkarte ist keine Einwilligung — nur ein ausdrückliches Ja mit Wortlaut.</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <Knopf aus={!ok} onClick={fertig}>{knopf}</Knopf>
        {onAbbruch && <Knopf leise onClick={onAbbruch}>Abbrechen</Knopf>}
      </div>
    </div>
  );
}

/** Gibt es schon eine gültige Mail-Einwilligung? Dann braucht die Notizvorlage den Schalter nicht. */
export const hatMailEinwilligung = (k?: Pick<Kontakt, 'einwilligungen'> | null) =>
  (k?.einwilligungen ?? []).some(e => e.kanal === 'mail' && e.grundlage === 'einwilligung' && !e.widerrufenAm);

/**
 * Aktivität festhalten (/api/crm/aktivitaet — Regeln laufen dort) und, wenn im
 * Gespräch ein ausdrückliches Ja fiel, die Mail-Einwilligung übernehmen. Die
 * Einwilligung wird auf den FRISCHEN Stand aus der Antwort gesetzt — mit dem
 * alten Stand der Oberfläche würden Stufe, Wiedervorlage und nächster Schritt
 * der gerade festgehaltenen Aktivität wieder überschrieben.
 */
export async function festhalten(api: CrmApi, body: { id: string; art: string } & Record<string, unknown>, einwilligung: NotizErgebnis['einwilligung'], heute: string) {
  const r = await api.aktivitaet(body);
  if (einwilligung && r.kontakt) {
    const neu = einwilligungUebernehmen(r.kontakt, einwilligung.nachweis, heute, api.ich ?? undefined);
    if (neu) await api.kontaktSetzen(neu);
  }
  return r;
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
