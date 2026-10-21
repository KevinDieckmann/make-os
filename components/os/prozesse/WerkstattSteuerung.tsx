'use client';

// ─── Prozesse · Werkstatt — Zustand, Scharfschalten, Einstellungen der Läufe (22.10.; ANALYSE_100.md Punkte 36, 37, 40, 50, 59) ─────────────────────────────
// In der Kopfzeile: der Zustand des Prozesses (Entwurf · Probelauf · scharf · pausiert — lib/prozesse/laeufe-ansicht.ts `werkstattZustand`) und was man daraus
// tun kann. „Scharf schalten“ fragt zuerst den Motor (`scharf-vorschau`): Kosten aufgeschlüsselt (Läufe × Agenten-Schritte × Modellstufe), die Frage „Gilt das für
// n bestehende Fälle?“ (Vorgabe nur neue), das Budget JE PROZESS (Entscheidung 21.10.: kein Gesamtbudget) — erst der Klick schaltet scharf (`scharf`, mit dem Stand des
// Eintrags). Pausieren und Fortsetzen gehen über den Status der Werkstatt (EIN Schreibweg, `onStatus`). Die Einstellungen (Flutschutz, Notbremse, Wiedereintritt,
// Ziel/Abbruch, Budget) stehen in einem Fenster. Steuern dürfen nur volle Mitglieder (lib/prozesse/rollen.ts) — die anderen sehen nur den Zustand.

import { useEffect, useMemo, useState } from 'react';
import { FlaskConical, Pause, PencilLine, Archive, Zap, Settings2, Play } from 'lucide-react';
import { FARBE as C, TYP, MIKRO, BEDEUTUNG_FARBE } from '@/lib/make-one/design';
import { Knopf, Hinweis, Chip, Erklaert, Feldzeile, feld, Segmente, Zeile, Leer } from '../ui';
import { Fenster } from '../Fenster';
import type { Bedingung, MaskenWert, ProzessDefinition, ProzessStatus, Verknuepfung } from '@/lib/prozesse/definition';
import { LAUF_GRENZEN, type Bestehende, type ProzessLaufStand } from '@/lib/prozesse/lauf-typen';
import { rautenFelder } from '@/lib/prozesse/definition-pruefen';
import {
  werkstattZustand, fortsetzenStatus, ZUSTAND_NAME, ZUSTAND_BEDEUTUNG, kostenZeilen, budgetVorschlag, euroZuCent, centZuEuro, centWort, zeitText, type WerkstattZustand,
} from '@/lib/prozesse/laeufe-ansicht';
import type { ProzessRechte } from '@/lib/prozesse/rollen';
import { MaskenEingabe } from './WerkstattMaske';
import { BefundListe, feldTitel } from './WerkstattPanel';
import { laeufeSenden, type ScharfVorschau } from './laeufe-daten';

const klein = { fontSize: TYP.bedien, color: C.inkDim, margin: 0, lineHeight: 1.45 } as const;
const SYMBOL: Readonly<Record<WerkstattZustand, typeof Zap>> = { entwurf: PencilLine, probelauf: FlaskConical, scharf: Zap, pausiert: Pause, archiviert: Archive };

export interface SteuerungProps {
  prozessId: string;
  /** Die jüngste Version (Felder für Ziel/Abbruch) bzw. der Entwurf. */
  def: ProzessDefinition;
  status: ProzessStatus;
  hatVersion: boolean;
  laufStand: ProzessLaufStand | null;
  rechte: ProzessRechte | undefined;
  nurAnsehen: boolean;
  /** Stand des Eintrags (Werkstatt) — scharf schalten ändert den Status und braucht ihn. */
  stand: () => string;
  /** Status über den EINEN Schreibweg der Werkstatt setzen — liefert einen Fehlersatz oder null. */
  onStatus: (s: ProzessStatus) => Promise<string | null>;
  /** Nach Scharfschalten bzw. Einstellungen: Eintrag und Laufzeit-Stand neu laden. */
  onGeaendert: () => Promise<void>;
  onMeldung: (text: string, art: 'gut' | 'achtung' | 'kritisch' | 'info') => void;
}

/** Zustand + Knöpfe der Kopfzeile. */
export function WerkstattSteuerung(p: SteuerungProps) {
  const z = werkstattZustand(p.status, p.laufStand, p.hatVersion);
  const [scharf, setScharf] = useState(false);
  const [einst, setEinst] = useState(false);
  const darf = !!p.rechte?.status && !p.nurAnsehen;
  const S = SYMBOL[z.art];
  const status = async (s: ProzessStatus, gut: string) => { const f = await p.onStatus(s); p.onMeldung(f ?? gut, f ? 'kritisch' : 'gut'); };
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
      <Erklaert erklaerung="prozesse.zustand" name="Zustand des Prozesses">
        <span title={z.satz}><Chip farbe={BEDEUTUNG_FARBE[ZUSTAND_BEDEUTUNG[z.art]]}><span className="pz-knopf-inhalt"><S size={13} aria-hidden />{ZUSTAND_NAME[z.art]}</span></Chip></span>
      </Erklaert>
      {darf && z.aktionen.includes('schatten') && <Knopf leise onClick={() => status('probelauf', 'Läuft jetzt im Schatten — Läufe rechnen und schreiben nichts.')} titel="Läufe rechnen mit echten Fällen und schreiben nichts"><span className="pz-knopf-inhalt"><FlaskConical size={14} aria-hidden />Im Schatten laufen</span></Knopf>}
      {darf && z.aktionen.includes('scharf') && <Knopf onClick={() => setScharf(true)} titel="Kosten, bestehende Fälle und Budget prüfen — dann scharf schalten"><span className="pz-knopf-inhalt"><Zap size={14} aria-hidden />Scharf schalten</span></Knopf>}
      {darf && z.aktionen.includes('pausieren') && <Knopf leise onClick={() => status('pausiert', 'Pausiert — offene Läufe halten an.')} titel="Offene Läufe halten an und gehen nach dem Fortsetzen dort weiter"><span className="pz-knopf-inhalt"><Pause size={14} aria-hidden />Pausieren</span></Knopf>}
      {darf && z.aktionen.includes('fortsetzen') && <Knopf onClick={() => status(fortsetzenStatus(p.laufStand), 'Fortgesetzt.')} titel="Der Prozess läuft wieder"><span className="pz-knopf-inhalt"><Play size={14} aria-hidden />Fortsetzen</span></Knopf>}
      {p.hatVersion && !p.nurAnsehen && <Knopf leise onClick={() => setEinst(true)} titel="Flutschutz, Notbremse, Wiedereintritt, Ziel und Abbruch, Budget"><span className="pz-knopf-inhalt"><Settings2 size={14} aria-hidden />Einstellungen</span></Knopf>}
      {scharf && <ScharfFenster {...p} onZu={() => setScharf(false)} />}
      {einst && <EinstellungenFenster {...p} darf={darf} onZu={() => setEinst(false)} />}
    </span>
  );
}

/** „Scharf schalten“ — Vorschau vom Motor, Rückfrage, Budget, dann der eine Klick. */
export function ScharfFenster(p: SteuerungProps & { onZu: () => void; /** Nur für Tests: eine fertige Vorschau statt des Abrufs. */ vorschau?: ScharfVorschau }) {
  const [v, setV] = useState<ScharfVorschau | null>(p.vorschau ?? null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [befunde, setBefunde] = useState<{ stufe: string; text: string; knotenId?: string }[]>(p.vorschau?.befunde ?? []);
  const [bestehende, setBestehende] = useState<Bestehende>('nur-neue');
  const [budget, setBudget] = useState<string>(() => (p.vorschau ? centZuEuro(budgetVorschlag(p.vorschau.schaetzungCent, p.vorschau.agentenSchritte)) : ''));
  useEffect(() => {
    if (p.vorschau) return;
    let an = true;
    void laeufeSenden({ aktion: 'scharf-vorschau', prozess: p.prozessId }).then(r => {
      if (!an) return;
      const x = r.j?.vorschau;
      if (r.status === 200 && x) { setV(x); setBefunde(x.befunde); setBudget(centZuEuro(budgetVorschlag(x.schaetzungCent, x.agentenSchritte))); }
      else setFehler(String(r.j?.fehler ?? 'Die Vorschau ließ sich nicht laden.'));
    });
    return () => { an = false; };
  }, [p.prozessId, p.vorschau]);
  const cent = euroZuCent(budget);
  const sperre = befunde.some(b => b.stufe === 'offen' || b.stufe === 'fehler');
  const budgetFehler = cent === null ? 'Betrag in Euro, z. B. 5 oder 12,50.' : cent > LAUF_GRENZEN.budgetCentMax ? `Höchstens ${centZuEuro(LAUF_GRENZEN.budgetCentMax)} € je Monat.` : v?.agentenSchritte && !cent ? 'Der Prozess hat Agenten-Schritte — bitte ein Budget festlegen.' : undefined;
  const zeilen = v ? kostenZeilen(v.laeufeJeMonat, v.stufen ?? []) : [];
  const los = async () => {
    setFehler(null);
    if (cent === null || budgetFehler) return;
    const r = await laeufeSenden({ aktion: 'scharf', prozess: p.prozessId, stand: p.stand(), budgetCent: cent, bestehende });
    if (r.status === 200 && r.j?.ok) {
      const g = r.j.gestartet ?? 0, zr = r.j.zurueckgehalten ?? 0;
      p.onMeldung(`Scharf geschaltet${g ? ` — ${g} bestehende ${g === 1 ? 'Fall gestartet' : 'Fälle gestartet'}` : ''}${zr ? `, ${zr} zurückgehalten (Flutschutz)` : ''}.`, 'gut');
      await p.onGeaendert();
      p.onZu();
      return;
    }
    if (r.j?.befunde) setBefunde(r.j.befunde);
    setFehler(String(r.j?.fehler ?? 'Nicht scharf geschaltet.'));
  };
  return (
    <Fenster titel="Scharf schalten" onZu={p.onZu} breit={640}>
      <section style={{ display: 'grid', gap: 12 }} aria-label="Scharf schalten">
        <p style={klein}>Ab dann legen Läufe echte Aufgaben und Vorschläge an. Nach außen geht weiterhin nur, was ihr im Stapel freigebt.</p>
        {!v && !fehler && <p style={klein}>Die Vorschau rechnet …</p>}
        {v && (
          <>
            <div style={{ ...MIKRO }}>{`Version ${v.version} · Kosten geschätzt`}</div>
            {zeilen.length ? zeilen.map((z, i) => <Zeile key={i} umbrechen titel={z.text} rechts={<span style={klein}>{`${centWort(z.centMonat)} / Monat`}</span>} />)
              : <p style={klein}>Keine Agenten-Schritte — dieser Prozess kostet keine KI.</p>}
            {zeilen.length > 0 && <p style={{ ...klein, color: C.ink }}>{`Zusammen etwa ${centWort(v.schaetzungCent)} im Monat (${v.laeufeJeMonat} ${v.laeufeJeMonat === 1 ? 'Lauf' : 'Läufe'} geschätzt aus den letzten 30 Tagen bzw. dem Zeitplan).`}</p>}
            {v.bestehende > 0 && (
              <Feldzeile label={`Gilt das für ${v.bestehende} bestehende ${v.bestehende === 1 ? 'Fall' : 'Fälle'}?`} erklaerung="prozesse.bestehende">
                <Segmente liste={[{ id: 'nur-neue' as const, label: 'Nur neue Fälle' }, { id: 'alle' as const, label: `Auch die ${v.bestehende} bestehenden` }]} aktiv={bestehende} onWahl={setBestehende} umbrechen />
              </Feldzeile>
            )}
            <Feldzeile label="Budget dieses Prozesses je Monat (€)" erklaerung="prozesse.budget" fehler={budgetFehler}>
              <input aria-label="Budget je Monat in Euro" inputMode="decimal" value={budget} onChange={e => setBudget(e.target.value)} style={{ ...feld, maxWidth: 200 }} />
            </Feldzeile>
          </>
        )}
        {sperre && <Hinweis art="achtung">Diese Version kann noch nicht scharf laufen — erst die offenen Punkte erledigen und neu veröffentlichen.</Hinweis>}
        <BefundListe befunde={befunde.map(b => ({ stufe: (b.stufe === 'fehler' || b.stufe === 'offen' ? b.stufe : 'hinweis') as 'fehler' | 'offen' | 'hinweis', text: b.text, ...(b.knotenId ? { knotenId: b.knotenId } : {}) }))} />
        {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Knopf haupt aus={!v || sperre || !!budgetFehler} onClick={los}><span className="pz-knopf-inhalt"><Zap size={16} aria-hidden />Scharf schalten</span></Knopf>
          <Knopf leise onClick={p.onZu}>Abbrechen</Knopf>
        </div>
      </section>
    </Fenster>
  );
}

const zahlText = (n: number | undefined) => (n === undefined ? '' : String(n));
const VERLAUF_WORT: Readonly<Record<string, string>> = {
  scharf: 'scharf geschaltet', bestehende: 'bestehende Fälle', budget: 'Budget geändert', einstellung: 'Einstellungen geändert', pause: 'pausiert', fortgesetzt: 'fortgesetzt', notbremse: 'Notbremse',
  'budget-80': '80 % des Budgets', 'budget-grenze': 'Budget erreicht', zurueckgehalten: 'zurückgehalten (Flutschutz)', gestartet: 'Zurückgehaltene gestartet', verworfen: 'Zurückgehaltene verworfen',
  umzug: 'Läufe auf neue Version', abgebrochen: 'Lauf abgebrochen', erneut: 'erneut gestartet',
};

/** Die Einstellungen der Läufe (Felder mit Vorgabe — leer = Vorgabe). */
function EinstellungenFenster(p: SteuerungProps & { darf: boolean; onZu: () => void }) {
  const e = p.laufStand?.einstellung ?? {};
  const [flut, setFlut] = useState(zahlText(e.flutJeStunde));
  const [bremse, setBremse] = useState(zahlText(e.notbremseJeStunde));
  const [erneut, setErneut] = useState(zahlText(e.erneutNachTagen));
  const [budget, setBudget] = useState(e.scharf ? centZuEuro(e.scharf.budgetCent) : '');
  const [ziel, setZiel] = useState<Bedingung[]>(e.ziel?.bedingungen ?? []);
  const [abbruch, setAbbruch] = useState<Bedingung[]>(e.abbruch?.bedingungen ?? []);
  const [fehler, setFehler] = useState<string | null>(null);
  const felder = useMemo(() => rautenFelder(p.def).map(id => ({ id, label: feldTitel(id) })), [p.def]);
  const zahl = (t: string, min: number, max: number): number | null | 'fehler' => { const s = t.trim(); if (!s) return null; const n = Number(s); return Number.isInteger(n) && n >= min && n <= max ? n : 'fehler'; };
  const bed = (b: Bedingung[], v?: Verknuepfung) => (b.length ? { bedingungen: b, ...(v ? { verknuepfung: v } : {}) } : null);
  const speichern = async () => {
    setFehler(null);
    const f = zahl(flut, 1, 1000), n = zahl(bremse, 1, 5000), w = zahl(erneut, 1, 3650);
    if (f === 'fehler' || n === 'fehler' || w === 'fehler') { setFehler('Ganze Zahlen: Flutschutz 1–1000, Notbremse 1–5000, Wiedereintritt 1–3650 Tage — leer heißt Vorgabe.'); return; }
    const c = e.scharf ? euroZuCent(budget) : undefined;
    if (c === null) { setFehler('Budget: Betrag in Euro, z. B. 5 oder 12,50.'); return; }
    const r = await laeufeSenden({ aktion: 'einstellung', prozess: p.prozessId, felder: { flutJeStunde: f, notbremseJeStunde: n, erneutNachTagen: w, ...(c !== undefined ? { budgetCent: c } : {}), ziel: bed(ziel, e.ziel?.verknuepfung), abbruch: bed(abbruch, e.abbruch?.verknuepfung) } });
    if (r.status === 200 && r.j?.ok) { p.onMeldung('Einstellungen gespeichert.', 'gut'); await p.onGeaendert(); p.onZu(); return; }
    setFehler(String(r.j?.fehler ?? 'Nicht gespeichert.'));
  };
  const aus = !p.darf;
  const verlauf = [...(p.laufStand?.verlauf ?? [])].reverse().slice(0, 12);
  return (
    <Fenster titel="Einstellungen der Läufe" onZu={p.onZu} breit={680}>
      <section style={{ display: 'grid', gap: 12 }} aria-label="Einstellungen der Läufe">
        {aus && <Hinweis art="info">Die Einstellungen ändern nur volle Mitglieder — du siehst sie.</Hinweis>}
        <Feldzeile label={`Flutschutz: Starts je Stunde (leer = ${LAUF_GRENZEN.flutJeStunde})`} erklaerung="prozesse.flutschutz">
          <input aria-label="Flutschutz je Stunde" inputMode="numeric" value={flut} disabled={aus} placeholder={String(LAUF_GRENZEN.flutJeStunde)} onChange={x => setFlut(x.target.value)} style={{ ...feld, maxWidth: 180 }} />
        </Feldzeile>
        <Feldzeile label={`Notbremse: Wirkungen je Stunde (leer = ${LAUF_GRENZEN.notbremseJeStunde})`} erklaerung="prozesse.notbremse">
          <input aria-label="Notbremse je Stunde" inputMode="numeric" value={bremse} disabled={aus} placeholder={String(LAUF_GRENZEN.notbremseJeStunde)} onChange={x => setBremse(x.target.value)} style={{ ...feld, maxWidth: 180 }} />
        </Feldzeile>
        <Feldzeile label="Wiedereintritt nach Tagen (leer = nie automatisch)" erklaerung="prozesse.wiedereintritt">
          <input aria-label="Wiedereintritt nach Tagen" inputMode="numeric" value={erneut} disabled={aus} placeholder="nie" onChange={x => setErneut(x.target.value)} style={{ ...feld, maxWidth: 180 }} />
        </Feldzeile>
        {e.scharf && (
          <Feldzeile label="Budget dieses Prozesses je Monat (€)" erklaerung="prozesse.budget">
            <input aria-label="Budget je Monat in Euro (Einstellungen)" inputMode="decimal" value={budget} disabled={aus} onChange={x => setBudget(x.target.value)} style={{ ...feld, maxWidth: 200 }} />
          </Feldzeile>
        )}
        <Erklaert erklaerung="prozesse.ziel-abbruch" name="Ziel und Abbruch" breit>
          <MaskenEingabe f={{ id: 'ziel', label: 'Ziel erreicht, wenn …', typ: 'bedingungen' }} wert={ziel as unknown as MaskenWert} onWert={v => setZiel(v as unknown as Bedingung[])} optionen={[]} felder={felder} aus={aus} />
        </Erklaert>
        <MaskenEingabe f={{ id: 'abbruch', label: 'Abbrechen, wenn …', typ: 'bedingungen' }} wert={abbruch as unknown as MaskenWert} onWert={v => setAbbruch(v as unknown as Bedingung[])} optionen={[]} felder={felder} aus={aus} />
        <p style={klein}>Einschränkung nach Art. 18 und Werbesperre beenden einen Lauf immer — das lässt sich nicht abschalten.</p>
        {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
        {!aus && <div><Knopf haupt onClick={speichern}>Speichern</Knopf></div>}
        <div style={{ ...MIKRO }}>Verlauf des Prozesses</div>
        {!verlauf.length && <Leer>Noch nichts im Verlauf.</Leer>}
        {verlauf.map((x, i) => <Zeile key={i} umbrechen titel={VERLAUF_WORT[x.was] ?? x.was} unter={`${zeitText(x.am)}${x.wert !== undefined && (x.was === 'scharf' || x.was === 'budget') ? ` · Budget ${centWort(x.wert)}` : ''}${x.n !== undefined ? ` · ${x.n}` : ''}${x.notiz ? ` · ${x.notiz}` : ''}`} />)}
      </section>
    </Fenster>
  );
}
