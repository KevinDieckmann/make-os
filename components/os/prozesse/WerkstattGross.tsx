'use client';

// ─── Prozesse · Werkstatt — das große Einstellungsfenster (22.10., „Werkstatt bau-fertig“ Punkte 7–11; Vorbild n8n: Eingabe · Knoten · Ausgabe) ──────────────
// Enter am gewählten Knoten bzw. der zweite Doppelklick öffnet es. Drei Spalten (schmal untereinander):
//   · links „Eingabe“ — die Platzhalter mit ihren Testwerten (klicken bzw. ziehen setzt sie an den Cursor des Textfelds in der Mitte), die Felder des Falls und der
//     Empfänger; „Beispiel bearbeiten“ ändert die Testdaten des Prozesses (nur erfundene Werte — der Server prüft es, lib/prozesse/testdaten.ts).
//   · Mitte „Maske“ — dieselbe Maske wie das Panel (./WerkstattPanel.tsx), nur mehr Platz.
//   · rechts „Ausgabe“ — „würde …“ live aus den Testwerten (lib/prozesse/werkstatt-ausgabe.ts, rein), darunter „Nur diesen Schritt testen“ / „Bis hier testen“
//     (derselbe Motor im Schatten, POST /api/prozesse/probelauf `nur`/`bis`) als Tabelle, JSON nur mit Kennungen. Gesendet wird NIE — „würde senden … an …“, das
//     Schloss bleibt sichtbar; ein Modell fragt auch der Test nicht.

import { useMemo, useState, type ReactNode } from 'react';
import { Lock, Play, ListChecks, Pencil, Braces } from 'lucide-react';
import { FARBE as C, TYP, MIKRO, LEUCHT, RAND } from '@/lib/make-one/design';
import { Knopf, Hinweis, Feldzeile, feld, SymbolKnopf } from '../ui';
import type { FallArt, ProzessDefinition, ProzessForm, ProzessKnoten } from '@/lib/prozesse/definition';
import { platzhalterFuer } from '@/lib/prozesse/baustein-katalog';
import { FALL_FELDER } from '@/lib/prozesse/ausloeser';
import { ausgabeVorschau } from '@/lib/prozesse/werkstatt-ausgabe';
import { webhookFelderVon, type ProzessTestdaten, type TestWert } from '@/lib/prozesse/testdaten';
import { PROBE_NAME, PROBE_BEDEUTUNG, centText, type ProbeErgebnis } from '@/lib/prozesse/werkstatt-hinweise';
import { BEDEUTUNG_FARBE } from '@/lib/make-one/design';
import { Fenster } from '../Fenster';
import { PlatzhalterChip } from './WerkstattMaske';

type K = ProzessKnoten<ProzessForm>;
export interface GrossWerte { platzhalter: Record<string, TestWert>; felder: Record<string, TestWert>; empfaenger: { kontaktId: string; name: string; email?: string; telefon?: string } }

export function WerkstattGross({ k, d, panel, werte, testdaten, namen, mitSchloss, nurLesen, test, testLaeuft, onTesten, onTestdaten, onZu }: {
  k: K; d: ProzessDefinition;
  /** Die Maske (Mitte) — das Panel des Knotens. */ panel: ReactNode;
  werte: GrossWerte; testdaten: ProzessTestdaten | null;
  namen: ReadonlyMap<string, string>; mitSchloss: boolean; nurLesen: boolean;
  /** Ergebnis des letzten „Schritt testen“ für diesen Knoten. */ test: (ProbeErgebnis & { art: 'nur' | 'bis' }) | null; testLaeuft: boolean;
  onTesten: (art: 'nur' | 'bis') => void;
  /** Testdaten speichern — liefert einen Fehlersatz bzw. null. */ onTestdaten: (t: ProzessTestdaten | null) => Promise<string | null>;
  onZu: () => void;
}) {
  const fall: FallArt = d.fallArt ?? 'mandat';
  const platz = useMemo(() => platzhalterFuer(fall, webhookFelderVon(d.knoten).map(f => f.id)), [fall, d.knoten]);
  const vorschau = useMemo(() => ausgabeVorschau(k, d, werte, { namen, mitSchloss }), [k, d, werte, namen, mitSchloss]);
  const [bearbeiten, setBearbeiten] = useState(false);
  const [json, setJson] = useState(false);
  return (
    <Fenster titel={`„${k.titel}“ — einstellen und testen`} onZu={onZu} breit={1320}>
      <div className="pw-gross">
        <section className="pw-gross-spalte" aria-label="Eingabe">
          <div style={{ ...MIKRO }}>Eingabe</div>
          <p style={{ margin: 0, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.45 }}>Was der Schritt bekommt — mit Testwerten (erfunden). Ein Klick auf einen Platzhalter setzt ihn an den Cursor des Textfelds in der Mitte; ziehen legt ihn ab.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {platz.map(x => <PlatzhalterChip key={x} id={x} wert={werte.platzhalter[x]} />)}
          </div>
          <div style={{ ...MIKRO, marginTop: 6 }}>Empfänger (Beispiel)</div>
          <p style={{ margin: 0, fontSize: TYP.bedien, color: C.ink }}>{werte.empfaenger.name}{werte.empfaenger.email ? ` · ${werte.empfaenger.email}` : ''}{werte.empfaenger.telefon ? ` · ${werte.empfaenger.telefon}` : ''}</p>
          {(k.form === 'entscheidung' || bearbeiten) && (
            <>
              <div style={{ ...MIKRO, marginTop: 6 }}>Felder des Falls</div>
              <dl className="pw-gross-felder">
                {FALL_FELDER[fall].map(f => <span key={f.id} style={{ display: 'contents' }}><dt>{f.titel}</dt><dd>{werte.felder[f.id] === undefined || werte.felder[f.id] === '' ? '—' : String(werte.felder[f.id])}</dd></span>)}
              </dl>
            </>
          )}
          {!nurLesen && !bearbeiten && <Knopf leise onClick={() => setBearbeiten(true)}><span className="pz-knopf-inhalt"><Pencil size={14} aria-hidden />Beispiel bearbeiten</span></Knopf>}
          {bearbeiten && <TestdatenEditor fall={fall} werte={werte} testdaten={testdaten} onSpeichern={onTestdaten} onZu={() => setBearbeiten(false)} />}
        </section>
        <section className="pw-gross-spalte pw-gross-mitte" aria-label="Maske">
          <div style={{ ...MIKRO }}>Einstellungen</div>
          {panel}
        </section>
        <section className="pw-gross-spalte" aria-label="Ausgabe">
          <div style={{ ...MIKRO }}>Ausgabe</div>
          <div className="pw-ausgabe">
            <p style={{ margin: 0, fontSize: TYP.body, color: C.ink, fontWeight: 600, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              {vorschau.schloss && <Lock size={16} color={LEUCHT.achtung} aria-label="mit Freigabe-Schloss" style={{ flex: '0 0 auto', marginTop: 3 }} />}
              <span>{vorschau.satz}</span>
            </p>
            {vorschau.zeilen.length > 0 && <AusgabeTabelle zeilen={vorschau.zeilen} />}
            {vorschau.fehlend.length > 0 && <p style={{ margin: 0, fontSize: TYP.bedien, color: C.inkLeise }}>{`ohne Testwert (bleibt leer): ${vorschau.fehlend.map(x => `{{${x}}}`).join(', ')}`}</p>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Knopf onClick={() => onTesten('nur')} titel="Spielt nur diesen Schritt im Motor durch (Schatten) — schreibt nichts, sendet nie"><span className="pz-knopf-inhalt"><Play size={14} aria-hidden />{testLaeuft ? 'Testet …' : 'Nur diesen Schritt testen'}</span></Knopf>
            <Knopf leise onClick={() => onTesten('bis')} titel="Spielt den Prozess bis hierher durch — mit den angenommenen Wegen"><span className="pz-knopf-inhalt"><ListChecks size={14} aria-hidden />Bis hier testen</span></Knopf>
          </div>
          {test && (
            <div style={{ display: 'grid', gap: 10 }} aria-live="polite">
              {test.hinweis && <Hinweis art="info">{test.hinweis === 'bis-nicht-erreicht' ? 'Auf diesem Weg erreicht der Lauf den Schritt nicht — einen anderen Weg annehmen (Raute, Freigabe, Warten).' : 'Von hier aus lässt sich der Schritt nicht allein testen.'}</Hinweis>}
              {test.schritte.map((x, i) => {
                const titel = d.knoten.find(y => y.id === x.knotenId)?.titel ?? x.knotenId;
                const farbe = BEDEUTUNG_FARBE[PROBE_BEDEUTUNG[x.status]];
                return (
                  <div key={`${x.knotenId}-${i}`} className="pw-test-schritt" style={{ borderColor: `${farbe}55` }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', justifyContent: 'space-between' }}>
                      <b style={{ fontSize: TYP.bedien, color: C.ink }}>{titel}</b>
                      <span style={{ fontSize: TYP.bedien, color: farbe, whiteSpace: 'nowrap' }}>{PROBE_NAME[x.status]}</span>
                    </div>
                    <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{x.text}</span>
                    {x.ausgabe && (json
                      ? <pre className="pw-json" aria-label="Ausgabe als JSON (nur Kennungen)">{JSON.stringify(x.ausgabe.json, null, 2)}</pre>
                      : <AusgabeTabelle zeilen={x.ausgabe.zeilen} />)}
                  </div>
                );
              })}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{`Nichts wurde geschrieben oder gesendet · Kosten geschätzt ${centText(test.kostenSchaetzungCent)}`}</span>
                <SymbolKnopf ariaLabel={json ? 'Als Tabelle zeigen' : 'Als JSON zeigen (nur Kennungen)'} gedrueckt={json} onClick={() => setJson(j => !j)}><Braces size={16} /></SymbolKnopf>
              </div>
            </div>
          )}
        </section>
      </div>
    </Fenster>
  );
}

function AusgabeTabelle({ zeilen }: { zeilen: readonly { feld: string; wert: string }[] }) {
  return (
    <table className="pw-ausgabe-tabelle">
      <tbody>{zeilen.map((z, i) => <tr key={i}><th scope="row">{z.feld}</th><td>{z.wert || '—'}</td></tr>)}</tbody>
    </table>
  );
}

/**
 * „Beispiel bearbeiten“ (Punkt 9): die Testdaten des Prozesses — Platzhalter der Fall-Art, Felder des Falls, der Empfänger. Nur erfundene Werte: Adressen unter
 * „.invalid“, Telefon als Platzhalter (der Server prüft und lehnt sonst mit Grund ab). Leer = das Beispiel gilt.
 */
function TestdatenEditor({ fall, werte, testdaten, onSpeichern, onZu }: { fall: FallArt; werte: GrossWerte; testdaten: ProzessTestdaten | null; onSpeichern: (t: ProzessTestdaten | null) => Promise<string | null>; onZu: () => void }) {
  const platz = platzhalterFuer(fall).filter(x => x !== 'prozess.titel' && x !== 'heute' && x !== 'lauf.start');
  const [p, setP] = useState<Record<string, string>>(() => Object.fromEntries(platz.map(x => [x, testdaten?.platzhalter?.[x] ?? ''])));
  const [f, setF] = useState<Record<string, string>>(() => Object.fromEntries(FALL_FELDER[fall].map(x => { const w = testdaten?.felder?.[x.id]; return [x.id, w === undefined ? '' : String(w)]; })));
  const [e, setE] = useState({ name: testdaten?.empfaenger?.name ?? '', email: testdaten?.empfaenger?.email ?? '', telefon: testdaten?.empfaenger?.telefon ?? '' });
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const typ = new Map(FALL_FELDER[fall].map(x => [x.id, x.art]));
  const wert = (id: string, v: string): TestWert | undefined => {
    if (!v.trim()) return undefined;
    const a = typ.get(id);
    if (a === 'zahl') { const n = Number(v.replace(',', '.')); return Number.isFinite(n) ? n : v; }
    if (a === 'ja-nein') return v === 'ja' || v === 'true';
    return v.trim();
  };
  const speichern = async () => {
    setLaeuft(true); setFehler(null);
    const felder = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, wert(k, v)]).filter(([, v]) => v !== undefined));
    const platzhalter = Object.fromEntries(Object.entries(p).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()]));
    const empfaenger = Object.fromEntries(Object.entries(e).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()]));
    const t: ProzessTestdaten = { ...(Object.keys(platzhalter).length ? { platzhalter } : {}), ...(Object.keys(felder).length ? { felder } : {}), ...(Object.keys(empfaenger).length ? { empfaenger } : {}), ...(testdaten?.annahmen ? { annahmen: testdaten.annahmen } : {}) };
    const r = await onSpeichern(Object.keys(t).length ? t : null);
    setLaeuft(false);
    if (r) setFehler(r); else onZu();
  };
  const eingabe = (label: string, v: string, set: (v: string) => void, platzhalter?: string) => (
    <Feldzeile key={label} label={label}><input aria-label={label} value={v} placeholder={platzhalter} onChange={ev => set(ev.target.value)} style={feld} /></Feldzeile>
  );
  return (
    <div className="pw-testdaten" role="group" aria-label="Beispiel bearbeiten">
      <Hinweis art="info">Nur erfundene Werte: Adressen unter „.invalid“ (z. B. erika@example.invalid), Telefon als Platzhalter (+49 000 0000000). Leer lassen = das Beispiel gilt.</Hinweis>
      <div style={{ ...MIKRO }}>Platzhalter</div>
      {platz.map(x => eingabe(`{{${x}}}`, p[x] ?? '', v => setP(o => ({ ...o, [x]: v })), String(werte.platzhalter[x] ?? '')))}
      <div style={{ ...MIKRO }}>Empfänger</div>
      {eingabe('Name', e.name, v => setE(o => ({ ...o, name: v })), werte.empfaenger.name)}
      {eingabe('Mail (nur .invalid)', e.email, v => setE(o => ({ ...o, email: v })), werte.empfaenger.email)}
      {eingabe('Telefon (Platzhalter)', e.telefon, v => setE(o => ({ ...o, telefon: v })), werte.empfaenger.telefon)}
      <div style={{ ...MIKRO }}>Felder des Falls</div>
      {FALL_FELDER[fall].map(x => eingabe(x.titel, f[x.id] ?? '', v => setF(o => ({ ...o, [x.id]: v })), String(werte.felder[x.id] ?? '')))}
      {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', position: 'sticky', bottom: 0, paddingTop: 6, background: C.flaeche, borderTop: `1px solid ${RAND.haar}` }}>
        <Knopf onClick={speichern}>{laeuft ? 'Speichert …' : 'Testdaten speichern'}</Knopf>
        <Knopf leise onClick={onZu}>Abbrechen</Knopf>
      </div>
    </div>
  );
}
