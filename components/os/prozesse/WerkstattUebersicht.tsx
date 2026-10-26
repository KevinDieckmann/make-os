'use client';

// ─── Prozesse · Werkstatt — Übersicht und „+ Prozess“ (Etappe B2, 21.10.; Kevins Bild: „Neuer Prozess: Bereich, Fall-Art, Eigner, Steckbrief → Werkstatt“) ─────
// Ohne gewählten Prozess zeigt die Werkstatt alle Prozesse nach Bereich: die eigenen (öffnen in der Werkstatt), die Pakete des Fulfillments (nur lesen — sie öffnen
// weiter ihren vorhandenen Editor). „+ Prozess“ legt über den EINEN Schreibweg an (POST /api/prozesse/werkstatt `anlegen`, einmalig über `anfrageId`) und führt
// in die Werkstatt; die Kachel steht danach in ihrem Bereich der Fliege. Nichts Persönliches: die Personen kommen aus dem Team der Instanz.

import { useState } from 'react';
import { Plus, Workflow, LayoutTemplate, Sparkles, FileUp } from 'lucide-react';
import { FARBE as C, TYP, MIKRO } from '@/lib/make-one/design';
import { Knopf, Hinweis, Feldzeile, feld, auswahl as auswahlStil, Pillen, Zeile, Leerzustand } from '../ui';
import { Fenster } from '../Fenster';
import { WEG } from '@/lib/wege';
import { neueKennung } from '@/lib/kennung';
import { PROZESS_BEREICHE, FALL_ARTEN, PROZESS_TEXT, type FallArt, type ProzessBereich } from '@/lib/prozesse/definition';
import { PRODUKT_BEREICHE, produktProzessTitel } from '@/lib/prozesse/produkt-bindung';
import { useKatalog, useWerkstattListe, werkstattSenden } from './werkstatt-daten';

const klein = { fontSize: TYP.bedien, color: C.inkDim, margin: 0, lineHeight: 1.45 } as const;
const STATUS_WORT: Readonly<Record<string, string>> = { entwurf: 'Entwurf', probelauf: 'Probelauf', aktiv: 'aktiv', pausiert: 'pausiert', archiviert: 'archiviert' };

/**
 * Der Dialog „Neuer Prozess“: Name, Bereich, Fall-Art, Eigner, Beschreibung → anlegen → in die Werkstatt. `fuerProdukt` (22.10., Prozesse × Fulfillment — von der
 * Produktkarte „Prozess für dieses Produkt anlegen“): Name = „<Produkt> umsetzen“ (`produktProzessTitel`), Bereich nur Fulfillment · Übergabe · Ausbau, ein Lauf hängt immer am Mandat.
 */
export function NeuerProzessFenster({ onZu, onAngelegt, bereichVorgabe, fuerProdukt }: { onZu: () => void; onAngelegt: (id: string) => Promise<void> | void; bereichVorgabe?: ProzessBereich; fuerProdukt?: { name: string } }) {
  const kat = useKatalog();
  const team = (kat.daten?.auswahl?.['team-person'] ?? []).filter(t => !t.id.startsWith('rolle:'));
  const [titel, setTitel] = useState(fuerProdukt ? produktProzessTitel(fuerProdukt.name, PROZESS_TEXT.titel) : '');
  const [bereich, setBereich] = useState<ProzessBereich>(fuerProdukt ? 'fulfillment' : bereichVorgabe ?? 'sales');
  const [fallArt, setFallArt] = useState<FallArt>(fuerProdukt ? 'mandat' : 'lead');
  const bereiche = fuerProdukt ? PROZESS_BEREICHE.filter(b => PRODUKT_BEREICHE.includes(b.id)) : PROZESS_BEREICHE;
  const [eigner, setEigner] = useState('');
  const [beschreibung, setBeschreibung] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [anfrageId] = useState(() => neueKennung('pza'));
  // E4 (22.10.): im Bereich Fulfillment auch ein „Paket“ (Ablauf, der im Fall läuft) — angelegt mit Marke `werkstatt:`, bearbeitet nur hier.
  const [art, setArt] = useState<'prozess' | 'paket'>('prozess');
  const alsPaket = !fuerProdukt && bereich === 'fulfillment' && art === 'paket';
  const anlegen = async () => {
    setFehler(null);
    if (alsPaket) {
      const p = await werkstattSenden(() => ({ aktion: 'paket-neu', anfrageId, titel: titel.trim() }));
      const pid = typeof p.j?.paketId === 'string' ? p.j.paketId : null;
      if (p.status === 200 && p.j?.ok && pid) { await onAngelegt(pid); return; }
      setFehler(String(p.j?.fehler ?? 'Das Paket ließ sich nicht anlegen.'));
      return;
    }
    const r = await werkstattSenden(() => ({ aktion: 'anlegen', anfrageId, titel: titel.trim(), bereich, fallArt, ...(eigner ? { eigner } : {}), ...(beschreibung.trim() ? { beschreibung: beschreibung.trim() } : {}) }));
    const id = r.j?.eintrag?.id;
    if (r.status === 200 && r.j?.ok && id) { await onAngelegt(id); return; }
    setFehler(String(r.j?.fehler ?? 'Der Prozess ließ sich nicht anlegen.'));
  };
  return (
    <Fenster titel={fuerProdukt ? 'Prozess für dieses Produkt' : 'Neuer Prozess'} onZu={onZu} breit={640}>
      <p style={klein}>{fuerProdukt
        ? `Der Prozess gehört zum Produkt „${fuerProdukt.name}“: ein neues Mandat mit diesem Produkt startet ihn — erst nach „Veröffentlichen“, im Probelauf zuerst ohne Wirkung. Gebaut wird in der Werkstatt.`
        : 'Ein Prozess beginnt als Entwurf mit einer Phase und einem Auslöser „von Hand“. Gebaut wird in der Werkstatt; erst „Veröffentlichen“ macht ihn lauffähig.'}</p>
      <Feldzeile label="Name * (Verb + Gegenstand)"><input aria-label="Name" value={titel} maxLength={PROZESS_TEXT.titel} placeholder="z. B. Lead nachfassen" onChange={e => setTitel(e.target.value)} style={feld} autoFocus /></Feldzeile>
      <Feldzeile gruppe label="Bereich — die Kachel steht dort auf der Landkarte"><Pillen liste={bereiche.map(b => ({ id: b.id, label: b.titel }))} aktiv={bereich} onWahl={setBereich} /></Feldzeile>
      {!fuerProdukt && bereich === 'fulfillment' && (
        <Feldzeile gruppe label="Was entsteht?">
          <Pillen liste={[{ id: 'prozess' as const, label: 'Prozess (läuft im Motor)' }, { id: 'paket' as const, label: 'Paket (Ablauf im Fall des Kunden)' }]} aktiv={art} onWahl={setArt} />
        </Feldzeile>
      )}
      {alsPaket ? <p style={klein}>Ein Paket des Fulfillments: Phasen, Schritte und Bestätigungen, die jeder Fall dieses Pakets durchläuft. Es entsteht mit einer Phase und wird nur in der Werkstatt bearbeitet.</p> : fuerProdukt
        ? <Feldzeile gruppe label="Woran hängt ein Lauf?"><span style={klein}>Am Mandat — dem Mandat mit diesem Produkt.</span></Feldzeile>
        : <Feldzeile gruppe label="Woran hängt ein Lauf?"><Pillen liste={FALL_ARTEN.map(f => ({ id: f.id, label: f.titel }))} aktiv={fallArt} onWahl={setFallArt} /></Feldzeile>}
      {!alsPaket && (
        <>
          <Feldzeile label="Eigner (eine Person aus dem Team, später änderbar)">
            <select aria-label="Eigner" value={eigner} onChange={e => setEigner(e.target.value)} style={{ ...auswahlStil, width: '100%' }}>
              <option value="">— noch offen —</option>
              {team.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </Feldzeile>
          <Feldzeile label="Steckbrief (worum geht es?)"><textarea aria-label="Beschreibung" value={beschreibung} maxLength={PROZESS_TEXT.beschreibung} rows={3} onChange={e => setBeschreibung(e.target.value)} style={{ ...feld, resize: 'vertical' }} /></Feldzeile>
        </>
      )}
      {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
      <div><Knopf haupt aus={!titel.trim()} onClick={anlegen}><span className="pz-knopf-inhalt"><Plus size={16} aria-hidden />Anlegen und bauen</span></Knopf></div>
    </Fenster>
  );
}

/** Die Werkstatt ohne gewählten Prozess: alle Prozesse nach Bereich, „+ Prozess“. */
export function WerkstattUebersicht({ onNeu, onVorlage, onDatei, onHead }: { onNeu: () => void; /** „Aus Vorlage anlegen“ (22.10., Kundengewinnung). */ onVorlage?: () => void; /** „Aus Datei“ (26.10., Werkstatt-Import). */ onDatei?: () => void; /** „Head fragen“ — ganzer Entwurf als Vorschlag (22.10.). */ onHead?: () => void }) {
  const liste = useWerkstattListe();
  const l = liste.daten?.prozesse ?? [];
  if (liste.fehler && !liste.daten) return <Hinweis art="kritisch">{liste.fehler}</Hinweis>;
  if (!liste.daten) return <p style={klein}>Die Werkstatt lädt …</p>;
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={klein}>Hier entstehen eigene Prozesse — im Stil eines n8n-Editors, mit unseren Formen und dem Flow. System-Prozesse sind nur lesbar; Pakete des Fulfillments öffnen ihren Editor.</p>
        {liste.daten.rechte.entwurf && (
          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 8 }}>
            {onHead && <Knopf leise onClick={onHead}><span className="pz-knopf-inhalt"><Sparkles size={16} aria-hidden />Head fragen</span></Knopf>}
            {onDatei && <Knopf leise onClick={onDatei} titel="Prozesse aus einer Datei (make-os/prozess) als Entwurf anlegen"><span className="pz-knopf-inhalt"><FileUp size={16} aria-hidden />Aus Datei</span></Knopf>}
            {onVorlage && <Knopf onClick={onVorlage}><span className="pz-knopf-inhalt"><LayoutTemplate size={16} aria-hidden />Aus Vorlage</span></Knopf>}
            <Knopf haupt onClick={onNeu}><span className="pz-knopf-inhalt"><Plus size={16} aria-hidden />Prozess</span></Knopf>
          </span>
        )}
      </div>
      {!l.length && <Leerzustand symbol={<Workflow size={20} />} titel="Noch keine eigenen Prozesse" aktion={liste.daten.rechte.entwurf ? <Knopf onClick={onVorlage ?? onNeu}>{onVorlage ? 'Mit einer Vorlage beginnen' : 'Ersten Prozess anlegen'}</Knopf> : undefined}>Ein Prozess beginnt mit einem Auslöser; „+“ am Ausgang hängt den nächsten Baustein an.</Leerzustand>}
      {PROZESS_BEREICHE.map(b => {
        const drin = l.filter(p => p.bereich === b.id);
        if (!drin.length) return null;
        return (
          <section key={b.id} style={{ display: 'grid', gap: 6 }}>
            <div style={{ ...MIKRO }}>{b.titel}</div>
            {drin.map(p => {
              const Z = p.quelle === 'werkstatt' ? Workflow : LayoutTemplate;
              // E4 (22.10.): ein Paket mit Marke `werkstatt:` öffnet sich in der Werkstatt, die übrigen (noch) im Editor des Fulfillments.
              const href = p.quelle === 'werkstatt' || p.inWerkstatt ? WEG.prozesse({ p: p.id, ansicht: 'werkstatt' }) : WEG.fulfillment('prozesse', { e: p.id });
              return (
                <Zeile key={p.id} umbrechen links={<Z size={18} aria-hidden color={C.inkDim} />} titel={p.titel}
                  unter={p.quelle === 'werkstatt' ? `${STATUS_WORT[p.status ?? 'entwurf'] ?? p.status}${p.version ? ` · Version ${p.version}` : ''}${p.entwurfGeaendert && p.version ? ' · Entwurf geändert' : ''}` : `Fulfillment-Paket · Fassung ${p.version ?? ''} · nur hier lesen`}
                  rechts={<Knopf leise href={href}>{p.quelle === 'werkstatt' ? 'Öffnen ›' : 'Im Editor öffnen ›'}</Knopf>} />
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
