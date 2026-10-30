'use client';

// ─── Rechnungen · Kunde aus der Markttraktion zuordnen (30.10.) ─────────────
// Kevin 30.10.: „Es geht keine Rechnung raus, ohne dass das Ganze zugeordnet ist … auch in der Selbstständigkeit immer mit der Markttraktion
// abgleichen und wir da suchen können.“ Ein Baustein für Entwurf UND gestellte Rechnung (Altbestand nachtragen):
//   · Suchfeld mit Treffern aus Firmen UND Personen (`suchPasst`, Name, Firma, Ort) — eingeschränkte Personen (Art. 18) liefert der Katalog gar nicht.
//   · „Neu in der Markttraktion anlegen“ über die vorhandenen Schreibwege (POST /api/crm/person: `firma` bzw. `anlegen` mit Weg „kartei“ —
//     Dublettenprüfung, Art. 18, Änderungsprotokoll dort), danach wählt der Baustein den neuen Eintrag (der Aufrufer ordnet zu).
//   · Chip „Zugeordnet: Firma · Person“ mit Links in die Akten (`WEG.firma`/`WEG.kontakt`/`WEG.mandat`) und „ändern“.
// Schreiben der Zuordnung macht der Aufrufer (`kunde` im Entwurf, `zuordnen` an einer gestellten Rechnung) — hier nur Auswahl und Anlegen.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { suchPasst } from '@/lib/text/such-norm';
import { WEG } from '@/lib/wege';
import { Chip, Knopf, Liste, Zeile, Feldzeile, Hinweis, feld } from '../ui';
import type { RechnungKatalog } from './daten';

/** So viele Treffer zeigt die Suche (der Rest über eine genauere Eingabe — nie still gekürzt: der Satz sagt, wie viele es noch sind). */
const TREFFER = 8;

interface Treffer { id: string; art: 'firma' | 'person'; name: string; unter: string; such: (string | undefined)[] }

function trefferAus(k: RechnungKatalog): Treffer[] {
  return [
    ...k.firmen.map(f => ({ id: f.id, art: 'firma' as const, name: f.name, unter: ['Firma', f.ort].filter(Boolean).join(' · '), such: [f.name, f.ort] })),
    ...k.personen.map(p => ({ id: p.id, art: 'person' as const, name: p.name, unter: ['Person', p.firma, p.ort].filter(Boolean).join(' · '), such: [p.name, p.firma, p.ort] })),
  ];
}

/** Suchfeld + Treffer + „neu anlegen“. `vorschlag` belegt das Anlegen vor (Firma/Name aus den schon getippten Empfängerfeldern). */
export function KundeSuche({ katalog, laedt, onWahl, vorschlag, onNeu, autoFokus }: {
  katalog: RechnungKatalog | null; laedt?: boolean;
  onWahl: (id: string) => void | Promise<void>;
  vorschlag?: { firma?: string; name?: string; email?: string };
  /** Nach dem Anlegen: die neue Kennung (f-… bzw. c-…) — `neu` = gerade angelegt (der Aufrufer behält getippte Felder). */
  onNeu: (id: string) => void | Promise<void>;
  autoFokus?: boolean;
}) {
  const [q, setQ] = useState('');
  const [neu, setNeu] = useState<null | { firma: string; vorname: string; nachname: string; email: string }>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [dublette, setDublette] = useState<{ id: string; name: string } | null>(null);
  const alle = useMemo(() => (katalog ? trefferAus(katalog) : []), [katalog]);
  const treffer = useMemo(() => (q.trim() ? alle.filter(t => suchPasst(t.such, q)) : []), [alle, q]);

  function neuOeffnen() {
    const name = (vorschlag?.name ?? '').trim();
    const teile = name.split(/\s+/).filter(Boolean);
    const suchtext = q.trim();
    setMeldung(null); setDublette(null);
    setNeu({
      firma: (vorschlag?.firma ?? '').trim() || (teile.length ? '' : suchtext),
      vorname: teile.length > 1 ? teile.slice(0, -1).join(' ') : '',
      nachname: teile.length ? teile[teile.length - 1] : '',
      email: (vorschlag?.email ?? '').trim(),
    });
  }

  async function anlegen() {
    if (!neu) return;
    setMeldung(null); setDublette(null);
    const firma = neu.firma.trim(), vorname = neu.vorname.trim(), nachname = neu.nachname.trim(), email = neu.email.trim();
    if (!firma && !vorname && !nachname) { setMeldung('Firma oder Name der Person eintragen.'); return; }
    const mitPerson = !!(vorname || nachname);
    // Person (mit ihrer Firma) über den Kartei-Weg; nur eine Firma über `firma` — dieselben Wege wie in der Markttraktion.
    const body = mitPerson
      ? { aktion: 'anlegen', weg: 'kartei', person: { vorname, nachname, ...(email ? { email } : {}), ...(firma ? { firma } : {}), lebensphase: 'kunde', herkunft: 'vertrag' } }
      : { aktion: 'firma', firma: { name: firma } };
    let d: { ok?: boolean; fehler?: string; kontaktId?: string; firmaId?: string; dublette?: { id: string; name: string } } | null = null;
    try {
      const r = await fetch('/api/crm/person', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      d = await r.json().catch(() => ({ ok: false, fehler: `Antwort ${r.status}` }));
    } catch { d = { ok: false, fehler: 'Keine Verbindung — nichts angelegt.' }; }
    if (!d?.ok) {
      if (d?.dublette) { setDublette(d.dublette); setMeldung(d.fehler ?? 'Diese Person gibt es schon.'); return; }
      setMeldung(d?.fehler ?? 'Nicht angelegt.'); return;
    }
    const id = mitPerson ? d.kontaktId : d.firmaId;
    if (!id) { setMeldung('Nicht angelegt.'); return; }
    setNeu(null); setQ('');
    await onNeu(id);
  }

  if (neu) {
    const setze = (t: Partial<typeof neu>) => setNeu({ ...neu, ...t });
    return (
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Neu in der Markttraktion anlegen — mit Person entsteht sie samt Firma (Dubletten prüft die Kartei).</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <Feldzeile label="Firma"><input value={neu.firma} onChange={e => setze({ firma: e.target.value })} style={feld} /></Feldzeile>
          <Feldzeile label="Vorname"><input value={neu.vorname} onChange={e => setze({ vorname: e.target.value })} style={feld} /></Feldzeile>
          <Feldzeile label="Nachname"><input value={neu.nachname} onChange={e => setze({ nachname: e.target.value })} style={feld} /></Feldzeile>
          <Feldzeile label="E-Mail (optional)"><input value={neu.email} type="email" onChange={e => setze({ email: e.target.value })} style={feld} /></Feldzeile>
        </div>
        {meldung && <Hinweis art="achtung" rolle="status" aktion={dublette ? <Knopf onClick={() => { const id = dublette.id; setNeu(null); setDublette(null); void onWahl(id); }}>{`${dublette.name} zuordnen`}</Knopf> : undefined}>{meldung}</Hinweis>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Knopf farbe={LEUCHT.gut} onClick={anlegen}>Anlegen und zuordnen</Knopf>
          <Knopf leise onClick={() => { setNeu(null); setMeldung(null); setDublette(null); }}>Abbrechen</Knopf>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <input value={q} onChange={e => setQ(e.target.value)} type="search" autoFocus={autoFokus} aria-label="Kunde in der Markttraktion suchen"
        placeholder={katalog ? 'Kunde suchen: Firma, Person oder Ort' : laedt ? 'Kartei lädt …' : 'Kartei nicht geladen'} disabled={!katalog} style={feld} />
      {treffer.length > 0 && (
        <Liste>
          {treffer.slice(0, TREFFER).map(t => <Zeile key={t.id} onClick={() => { setQ(''); void onWahl(t.id); }} titel={t.name} unter={t.unter} rechts={<Chip farbe={C.inkDim}>{t.art === 'firma' ? 'Firma' : 'Person'}</Chip>} />)}
        </Liste>
      )}
      {treffer.length > TREFFER && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{`Noch ${treffer.length - TREFFER} weitere — genauer suchen.`}</div>}
      {q.trim() && !treffer.length && katalog && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Kein Treffer in der Markttraktion.</div>}
      {meldung && <Hinweis art="achtung" rolle="status">{meldung}</Hinweis>}
      <div><Knopf leise onClick={neuOeffnen} aus={!katalog}>Neu in der Markttraktion anlegen</Knopf></div>
    </div>
  );
}

/** „Zugeordnet: Firma · Person“ mit Links in die Akten und „ändern“ (fehlt bei einer gestellten Rechnung — sie wechselt ihren Kunden nicht). */
export function ZuordnungChip({ kundeFirmaId, kontaktId, mandatId, namen, onAendern }: {
  kundeFirmaId?: string; kontaktId?: string; mandatId?: string; namen: Readonly<Record<string, string>>; onAendern?: () => void;
}) {
  const link = { color: C.aktiv, textDecoration: 'none' } as const;
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien }}>
      <Chip farbe={LEUCHT.gut}>Zugeordnet</Chip>
      {kundeFirmaId && <Link href={WEG.firma(kundeFirmaId)} style={link}>{namen[kundeFirmaId] ?? 'Firma'} ›</Link>}
      {kontaktId && <Link href={WEG.kontakt(kontaktId)} style={link}>{namen[kontaktId] ?? 'Person'} ›</Link>}
      {mandatId && <Link href={WEG.mandat(mandatId)} style={link}>{namen[mandatId] ? `Mandat ${namen[mandatId]}` : 'Mandat'} ›</Link>}
      {onAendern && <Knopf leise onClick={onAendern}>ändern</Knopf>}
    </div>
  );
}
