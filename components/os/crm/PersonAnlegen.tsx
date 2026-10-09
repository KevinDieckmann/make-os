'use client';

// ─── Markttraktion · Bausteine für den EINEN Weg „Person anlegen“ (09.10., Woche 2 · 1.8/1.10/1.12) ─────────────────────────────
// Kartei, Firmenkarte, „+ Aktivität“ und Prospecting legen über `api.personAnlegen` an (POST /api/crm/person, Regeln je Weg in
// lib/crm/person-anlegen.ts). Hier stehen die gemeinsamen Felder:
//   · `ZustaendigWahl`   wer die Beziehung hält — wählbar, Vorgabe nach Welt (1.10: vorher wurde immer, wer anlegt, zuständig)
//   · `SchrittFelder`    nächster Schritt + Datum (1.12) → Follow-up
//   · `NeuePersonKurz`   das Kurzformular (Vor-/Nachname, Kontakt, Position, Firma, Zuständig, Schritt) — bleibt bei einem Fehler stehen

import { useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Knopf, LEUCHT, feld } from '../ui';
import { Wahl } from './Wahl';
import { Feld, Feldzeile } from './teile';
import { FirmenDatalist } from './FirmenDatalist';
import { TEAM, BEIDE, nameVon } from '@/lib/crm/team';
import { ANLEGE_REGELN, zustaendigFuer, type PersonWeg } from '@/lib/crm/person-anlegen';
import { WEG } from '@/lib/wege';
import type { CrmApi } from './daten';

/** Zuständig (1.10): Team + „Beide“ — die Vorgabe kommt aus dem Weg (`zustaendigFuer`). */
export function ZustaendigWahl({ wert, onWahl }: { wert: string; onWahl: (w: string) => void }) {
  const liste = [...TEAM.map(t => ({ id: t.id, label: t.name })), { id: BEIDE, label: nameVon(BEIDE) }];
  return <Feldzeile label="Zuständig"><Wahl label="Zuständig" liste={liste} wert={wert} onWahl={onWahl} /></Feldzeile>;
}

/** Nächster Schritt (optional) — Text + Datum; nur zusammen gültig (der Server lehnt halbe Angaben ab). */
export function SchrittFelder({ text, datum, onText, onDatum }: { text: string; datum: string; onText: (t: string) => void; onDatum: (d: string) => void }) {
  return (
    <Feldzeile label="Nächster Schritt">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1 1 200px' }}><Feld wert={text} platzhalter="z. B. Erstgespräch vereinbaren (optional)" onFertig={onText} /></div>
        <input type="date" value={datum} onChange={e => onDatum(e.target.value)} aria-label="Datum des nächsten Schritts" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px', width: 'auto', minHeight: 44 }} />
      </div>
    </Feldzeile>
  );
}

/** Die Eingabe des Schritts für den Server — leer bleibt leer; Datum ohne Text verlangt einen Text (Hinweis am Formular). */
export function schrittEingabe(text: string, datum: string): { naechsterSchritt?: { text: string; datum: string }; fehlt?: string } {
  const t = text.trim();
  if (!t && !datum) return {};
  if (!t) return { fehlt: 'Zum Datum fehlt der nächste Schritt (was ist zu tun?).' };
  if (!datum) return { fehlt: 'Der nächste Schritt braucht ein Datum.' };
  return { naechsterSchritt: { text: t, datum } };
}

/**
 * Kurzformular „neue Person“ — für die Firmenkarte (1.13), „+ Aktivität“ (1.7) und Prospecting (1.14). `firmaId` steht fest (Firmenkarte),
 * sonst ist die Firma frei (bestehend oder neu). Bei einem Fehler (Dublette, Art. 18, zu lang) bleibt das Formular stehen; eine Dublette
 * bietet „Diese Person nehmen“ an.
 */
export function NeuePersonKurz({ api, weg, firmaId, firmaName, vorgabe, onFertig, knopf = 'Anlegen' }: {
  api: CrmApi; weg: PersonWeg; firmaId?: string; firmaName?: string; vorgabe?: { vorname?: string; nachname?: string; firma?: string };
  onFertig: (id: string | null) => void; knopf?: string;
}) {
  const [e, setE] = useState({ vorname: vorgabe?.vorname ?? '', nachname: vorgabe?.nachname ?? '', email: '', telefon: '', position: '', firma: vorgabe?.firma ?? '' });
  const [zust, setZust] = useState(() => zustaendigFuer(weg, undefined, api.ich));
  const [schritt, setSchritt] = useState({ text: '', datum: '' });
  const [fehler, setFehler] = useState<string | null>(null);
  const [dublette, setDublette] = useState<{ id: string; name: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const firmen = api.crm?.stand.firmen ?? [];
  const mitSchritt = ANLEGE_REGELN[weg].followUp !== 'nie';
  const ok = (e.vorname.trim() || e.nachname.trim()) && !laeuft;
  const anlegen = async () => {
    if (!ok) return;
    const s = mitSchritt ? schrittEingabe(schritt.text, schritt.datum) : {};
    if (s.fehlt) { setFehler(s.fehlt); return; }
    setLaeuft(true); setFehler(null); setDublette(null);
    try {
      const r = await api.personAnlegen(weg, {
        vorname: e.vorname, nachname: e.nachname, email: e.email, telefon: e.telefon, position: e.position,
        ...(firmaId ? { firmaId } : e.firma.trim() ? { firma: e.firma.trim() } : {}), zustaendig: zust, ...(s.naechsterSchritt ? { naechsterSchritt: s.naechsterSchritt } : {}),
      });
      if (!r.ok || !r.kontaktId) { setFehler(r.fehler ?? 'Nicht angelegt.'); if (r.dublette) setDublette(r.dublette); return; }
      onFertig(r.kontaktId);
    } finally { setLaeuft(false); }
  };
  return (
    <div className="deal-anlegen" style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 190px), 1fr))', gap: 8 }}>
        <Feld wert={e.vorname} platzhalter="Vorname" onFertig={vorname => setE({ ...e, vorname })} />
        <Feld wert={e.nachname} platzhalter="Nachname" onFertig={nachname => setE({ ...e, nachname })} />
        <Feld wert={e.email} platzhalter="E-Mail" onFertig={email => setE({ ...e, email })} />
        <Feld wert={e.telefon} platzhalter="Telefon" onFertig={telefon => setE({ ...e, telefon })} />
        <Feld wert={e.position} platzhalter="Position" onFertig={position => setE({ ...e, position })} />
        {!firmaId && (
          <div>
            <input list={`neu-firmen-${weg}`} value={e.firma} onChange={x => setE({ ...e, firma: x.target.value })} placeholder="Firma (bestehend oder neu)" aria-label="Firma" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px' }} />
            <FirmenDatalist id={`neu-firmen-${weg}`} firmen={firmen} suche={e.firma} />
          </div>
        )}
      </div>
      {firmaId && firmaName && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Firma: {firmaName}</div>}
      <ZustaendigWahl wert={zust} onWahl={setZust} />
      {mitSchritt && <SchrittFelder text={schritt.text} datum={schritt.datum} onText={text => setSchritt({ ...schritt, text })} onDatum={datum => setSchritt({ ...schritt, datum })} />}
      {fehler && <div role="alert" style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch, lineHeight: 1.5 }}>{fehler}</div>}
      {dublette && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}><Knopf leise onClick={() => onFertig(dublette.id)}>{`${dublette.name} nehmen`}</Knopf><Link href={WEG.akte(dublette.id)} style={{ fontSize: TYP.bedien, color: C.aktiv }}>Kontakt öffnen ›</Link></div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Knopf aus={!ok} onClick={anlegen}>{laeuft ? 'legt an …' : knopf}</Knopf>
        <Knopf leise onClick={() => onFertig(null)}>Abbrechen</Knopf>
      </div>
    </div>
  );
}
