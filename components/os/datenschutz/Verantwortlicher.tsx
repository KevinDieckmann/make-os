'use client';

// ─── System › Datenschutz · Verantwortlicher (05.10.) ───────────────────────
// EINE Quelle für Name/Firma, Anschrift, Kontakt und Datenschutzbeauftragten: Auskunft (Art. 15), Verzeichnis (Art. 30),
// Danke-Mail (Art. 13) und Selbstprüfung lesen hier. Ändern darf nur der Inhaber (die Route prüft es serverseitig);
// alle anderen im Haushalt sehen die Angaben nur.

import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Feldzeile, feld, LEUCHT, Hinweis } from '../ui';
import { verantwortlicherPruefen, verantwortlicherText, type Verantwortlicher as V, type VerantwortlicherWirksam, type Empfaenger } from '@/lib/datenschutz/einrichtung';

export interface EinrichtungAntwort {
  ok: boolean; verantwortlicher: V | null; wirksam: VerantwortlicherWirksam; empfaenger: Empfaenger[]; darf: boolean; fehler?: string;
  /** Vorlage der Information nach Art. 14 (05.10.): gespeichert (oder null) und wirksam, dazu die Platzhalter. */
  art14?: { betreff: string; text: string } | null; art14Wirksam?: { betreff: string; text: string }; platzhalter?: Record<string, string>;
}

const LEER = { name: '', anschrift: '', mail: '', telefon: '', vertretung: '', dsbName: '', dsbMail: '', seite: '', aufsicht: '' };

export function VerantwortlicherKarte({ d, onGeaendert, i = 0 }: { d: EinrichtungAntwort; onGeaendert: () => void; i?: number }) {
  const [f, setF] = useState(LEER);
  const [meldung, setMeldung] = useState<{ text: string; gut: boolean } | null>(null);
  useEffect(() => {
    const v = d.verantwortlicher;
    setF(v ? { name: v.name, anschrift: v.anschrift, mail: v.mail, telefon: v.telefon ?? '', vertretung: v.vertretung ?? '', dsbName: v.dsb?.name ?? '', dsbMail: v.dsb?.mail ?? '', seite: v.seite ?? '', aufsicht: v.aufsicht ?? '' } : LEER);
  }, [d.verantwortlicher]);
  const w = d.wirksam;
  const setze = (k: keyof typeof LEER) => (e: { target: { value: string } }) => setF(x => ({ ...x, [k]: e.target.value }));
  const speichern = async () => {
    const roh = { name: f.name, anschrift: f.anschrift, mail: f.mail, telefon: f.telefon, vertretung: f.vertretung, dsb: { name: f.dsbName, mail: f.dsbMail }, seite: f.seite, aufsicht: f.aufsicht };
    const p = verantwortlicherPruefen(roh);
    if (!p.ok) { setMeldung({ text: p.fehler, gut: false }); return; }
    const r = await fetch('/api/datenschutz/einrichtung', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'verantwortlicher', verantwortlicher: roh }) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    setMeldung(r.ok ? { text: 'Gespeichert — Auskunft, Verzeichnis und Hinweise nennen ab jetzt diese Angaben.', gut: true } : { text: r.fehler ?? 'Nicht gespeichert.', gut: false });
    if (r.ok) onGeaendert();
  };
  const ein = (k: keyof typeof LEER, label: string, opt: { typ?: string; platz?: string } = {}) => (
    <Feldzeile label={label}><input type={opt.typ ?? 'text'} value={f[k]} onChange={setze(k)} placeholder={opt.platz} disabled={!d.darf} style={feld} /></Feldzeile>
  );
  return (
    <Karte i={i} id="verantwortlicher" akzent={w.v ? undefined : LEUCHT.achtung}>
      <Ueberschrift rechts={<Chip farbe={w.v ? LEUCHT.gut : LEUCHT.achtung}>{w.quelle === 'einrichtung' ? 'eingetragen' : w.quelle === 'umgebung' ? 'aus der Umgebung' : 'fehlt'}</Chip>}>Verantwortlicher</Ueberschrift>
      {!w.v && <Hinweis art="achtung" titel="Verantwortlicher fehlt — eintragen">Auskunft, Verzeichnis und Selbstprüfung zeigen das deutlich, bis Name/Firma, Anschrift und Kontakt-Mail eingetragen sind (Art. 13 Abs. 1 lit. a, Art. 30 Abs. 1 lit. a DSGVO).</Hinweis>}
      {w.v && <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, marginBottom: 10 }}>Wirksam: {verantwortlicherText(w.v)}{w.v.dsb?.name || w.v.dsb?.mail ? ` · Datenschutzbeauftragter: ${[w.v.dsb.name, w.v.dsb.mail].filter(Boolean).join(', ')}` : ''}</div>}
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {ein('name', 'Name bzw. Firma (mit Rechtsform)', { platz: 'z. B. Beispiel GmbH' })}
        {ein('mail', 'Kontakt-Mail für Datenschutz', { typ: 'email', platz: 'datenschutz@…' })}
        <Feldzeile label="Anschrift"><textarea value={f.anschrift} onChange={setze('anschrift')} rows={2} disabled={!d.darf} placeholder="Straße Nr., PLZ Ort" style={{ ...feld, resize: 'vertical', lineHeight: 1.5 }} /></Feldzeile>
        {ein('vertretung', 'Vertreten durch (optional)', { platz: 'Geschäftsführung' })}
        {ein('telefon', 'Telefon (optional)', { typ: 'tel' })}
        {ein('dsbName', 'Datenschutzbeauftragter (optional)')}
        {ein('dsbMail', 'Mail des Datenschutzbeauftragten (optional)', { typ: 'email' })}
        {ein('seite', 'Datenschutzhinweis — Adresse (optional; steht auf Buchungsseiten und in der Danke-Mail)', { platz: 'example.de/datenschutz' })}
        <Feldzeile label="Zuständige Aufsichtsbehörde (optional; steht in jeder Auskunft)"><textarea value={f.aufsicht} onChange={setze('aufsicht')} rows={2} disabled={!d.darf} placeholder="Name der Landesbehörde, Anschrift bzw. Webseite" style={{ ...feld, resize: 'vertical', lineHeight: 1.5 }} /></Feldzeile>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
        {d.darf ? <Knopf onClick={speichern}>Speichern</Knopf> : <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Ändern kann nur der Inhaber.</span>}
        {meldung && <span role="status" style={{ fontSize: TYP.bedien, color: meldung.gut ? LEUCHT.gut : LEUCHT.achtung }}>{meldung.text}</span>}
      </div>
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 10, lineHeight: 1.5 }}>Ohne Eintrag gilt, was die Umgebung der Instanz vorgibt (MAKE_OS_VERANTWORTLICHER_*). Hinweis, keine Rechtsberatung.</div>
    </Karte>
  );
}
