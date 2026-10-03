'use client';

// ─── Weitere Person dazu — der Entscheider kommt erst im Gespräch ───────────────────────────────
// Kevin: „Wenn wir in der Qualifizierung sind, kann alles anders kommen.“ Im Gespräch fällt ein Name: der Geschäftsführer, die
// Einkaufsleiterin. Hier legt man sie als neuen Ansprechpartner der Firma an (über den Weg der Kartei: Sperrliste, Datenschutz-
// Stempel, Dublettenschutz) und kann sie zum Hauptansprechpartner des Leads machen. Rechtlich: Daten, die wir von Dritten
// haben (Quelle: Gespräch) — Herkunft „Recherche“, damit die Art.-14-Frist an der Person steht; KEINE Einwilligung.

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Knopf, feld, LEUCHT, Hinweis } from '../../ui';
import { Fenster } from '../../Fenster';
import { localDay } from '@/lib/zeit';
import { neueKontaktKennung } from '@/lib/kennung';
import { anzeigename } from '@/lib/make-one/crm';
import { hatAdresse } from '@/lib/crm/emails';
import type { LeadZeile } from '@/lib/crm/leads';
import type { CrmApi } from '../daten';
import { leadPost } from './hilfen';
import type { FertigInfo } from './FirmaWechseln';

const gleicherName = (k: { vorname: string; nachname: string }, v: string, n: string) => k.nachname.trim().toLowerCase() === n.trim().toLowerCase() && k.vorname.trim().toLowerCase() === v.trim().toLowerCase();

export function WeiterePersonDialog({ api, z, onZu, onFertig }: { api: CrmApi; z: LeadZeile; onZu: () => void; onFertig: (i: FertigInfo) => void }) {
  const heute = api.crm?.heute ?? localDay();
  const firma = z.firmaId ? api.crm?.stand.firmen.find(f => f.id === z.firmaId) : undefined;
  const [e, setE] = useState({ vorname: '', nachname: '', position: '', email: '', telefon: '' });
  const [entscheider, setEntscheider] = useState(true);
  const [haupt, setHaupt] = useState(true);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState('');
  const kontakte = api.kontakte ?? [];
  const dublette = e.email.includes('@') ? kontakte.find(k => hatAdresse(k, e.email)) : undefined;
  const namensgleich = e.nachname.trim() ? kontakte.find(k => gleicherName(k, e.vorname, e.nachname)) : undefined;
  const ok = !!firma && !!e.nachname.trim() && !dublette;
  const los = async () => {
    if (!firma || !ok || laeuft) return;
    setLaeuft(true); setMeldung('');
    try {
      const id = neueKontaktKennung();
      // Besitzer ist die handelnde Person (Sitzung) — wer die Person im Gespräch erfährt und anlegt, hält die Beziehung; nur ohne Sitzung gilt der Besitzer des Leads.
      const besitzer = api.ich ?? (z.besitzer && z.besitzer !== 'beide' ? z.besitzer : undefined);
      const gespeichert = await api.kontaktSetzen({
        id, vorname: e.vorname.trim(), nachname: e.nachname.trim(), ...(e.email.trim() ? { email: e.email.trim().toLowerCase() } : {}), ...(e.telefon.trim() ? { telefon: e.telefon.trim() } : {}),
        ...(e.position.trim() ? { position: e.position.trim() } : {}), firma: firma.name, firmaId: firma.id, eignung: '', prio: '', stufe: 'neu', lebensphase: 'kontakt', anrede: 'Sie',
        ...(besitzer ? { besitzer } : {}), herkunft: 'recherche', fremddaten: true, quelle: 'Qualifizierung (im Gespräch genannt)',
        aktivitaeten: [{ am: new Date().toISOString(), art: 'system', text: `Als weiterer Ansprechpartner in der Qualifizierung angelegt (${firma.name})`, von: 'system' }], importiertAm: heute, geaendertAm: heute,
      });
      if (!gespeichert) { setMeldung('Nicht angelegt — vielleicht gibt es die Person schon, oder die Verbindung fehlt.'); return; }
      // Der Entscheider wird, was die Runde zuerst öffnet — und ist die Antwort auf „Wer entscheidet?“, solange dort noch nichts steht.
      const felder: Record<string, unknown> = {};
      if (haupt) felder.hauptKontaktId = id;
      if (entscheider && !z.antworten?.entscheider) felder.antworten = { entscheider: `${`${e.vorname} ${e.nachname}`.trim()} entscheidet${e.position.trim() ? ` (${e.position.trim()})` : ''}` };
      if (Object.keys(felder).length) {
        // Erst, wenn die Kartei die Person kennt, darf der Lead auf sie zeigen.
        await api.laden(true);
        const r = await leadPost({ aktion: 'setze', id: z.id, felder });
        if (!r.ok) { setMeldung(`Die Person ist angelegt, aber am Lead konnte nichts gesetzt werden: ${r.fehler ?? ''}`); return; }
      }
      await api.laden(true);
      onFertig({ text: `${`${e.vorname} ${e.nachname}`.trim()} ist jetzt Ansprechpartner bei ${firma.name}${haupt ? ' und Hauptansprechpartner des Leads' : ''}. Art. 14: die Person ist noch nicht informiert — das steht an ihrem Kontakt.` });
    } finally { setLaeuft(false); }
  };
  return (
    <Fenster titel="Weitere Person dazu" onZu={onZu} breit={560}>
      {!firma ? (
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>Dieser Lead hat noch keine Firma. Erst über „Firma wechseln oder neu“ eine Firma zuordnen — dann lässt sich eine weitere Person dazu anlegen.</div>
      ) : (
        <>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>Neuer Ansprechpartner bei <b style={{ color: C.ink }}>{firma.name}</b> — z. B. die Entscheiderin, von der im Gespräch die Rede war.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
            <input value={e.vorname} onChange={x => setE({ ...e, vorname: x.target.value })} placeholder="Vorname" aria-label="Vorname" style={{ ...feld, fontSize: 16, padding: '10px 12px' }} />
            <input value={e.nachname} onChange={x => setE({ ...e, nachname: x.target.value })} placeholder="Nachname *" aria-label="Nachname" style={{ ...feld, fontSize: 16, padding: '10px 12px' }} />
            <input value={e.position} onChange={x => setE({ ...e, position: x.target.value })} placeholder="Position, z. B. Geschäftsführer" aria-label="Position" style={{ ...feld, fontSize: 16, padding: '10px 12px' }} />
            <input value={e.email} onChange={x => setE({ ...e, email: x.target.value })} placeholder="E-Mail (falls bekannt)" aria-label="E-Mail" inputMode="email" style={{ ...feld, fontSize: 16, padding: '10px 12px' }} />
            <input value={e.telefon} onChange={x => setE({ ...e, telefon: x.target.value })} placeholder="Telefon (falls bekannt)" aria-label="Telefon" inputMode="tel" style={{ ...feld, fontSize: 16, padding: '10px 12px' }} />
          </div>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44, cursor: 'pointer', fontSize: TYP.bedien }}><input type="checkbox" checked={entscheider} onChange={x => { setEntscheider(x.target.checked); if (x.target.checked) setHaupt(true); }} style={{ width: 22, height: 22 }} />Sie oder er entscheidet (trägt die Frage „Entscheider“ ein, solange dort nichts steht)</label>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44, cursor: 'pointer', fontSize: TYP.bedien }}><input type="checkbox" checked={haupt} onChange={x => setHaupt(x.target.checked)} style={{ width: 22, height: 22 }} />Zum Hauptansprechpartner dieses Leads machen</label>
          {dublette && <div style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch }}>Diese Mail gehört schon zu {anzeigename(dublette)} — nicht doppelt anlegen.</div>}
          {!dublette && namensgleich && <div style={{ fontSize: TYP.bedien, color: LEUCHT.achtung }}>Achtung: {anzeigename(namensgleich)}{namensgleich.firma ? ` (${namensgleich.firma})` : ''} gibt es schon — gleiche Person? Dann lieber „Zusammenführen“.</div>}
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5 }}>Die Angaben stammen aus dem Gespräch, nicht von der Person selbst (Art. 14 DSGVO): die Information an sie steht als Frist an ihrem Kontakt. Eine Einwilligung gibt es dadurch nicht — angesprochen wird nur auf zulässigen Wegen.</div>
          {meldung && <Hinweis art="kritisch" rolle="alert">{meldung}</Hinweis>}
        </>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Knopf leise onClick={onZu}>Abbrechen</Knopf>
        <Knopf aus={!ok || laeuft} onClick={() => los()}>Anlegen</Knopf>
      </div>
    </Fenster>
  );
}
