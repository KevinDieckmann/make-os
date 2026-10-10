'use client';

// ─── Agenten-Seite: „Aus dem Brain übernehmen“ (09.10.; Auftrag: „Pack bitte schon die vorgefertigten Bots bei ZOE ein — die ganzen Head ofs
// und alle Mitarbeiter, die wir brauchen … da hatten wir ja schon welche. Und das Sales Brain kannst du auch direkt dem Head of Sales zur
// Verfügung stellen.“) ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Ein Fenster hinter „⋯ › Aus dem Brain übernehmen“: Vorschau der Agenten-Notizen (je Datei Ziel-Head, Auftrag, Modellstufe, Mitarbeiter,
// Wissen — mit Aktion und Grund), Auswahl per Schalter, dann EIN Klick „Übernehmen“. Nur Business-Heads (Firma und Privat getrennt), nur ein
// Inhaber (die Route entscheidet — sonst steht hier ihr Satz). Die Seite schickt nur die Auswahl; die Inhalte liest der Server neu aus dem Vault.

import { useEffect, useMemo, useState } from 'react';
import { FARBE as C, ABSTAND, ECKE, FLAECHE_STIL, LEUCHT, MIKRO, TYP } from '@/lib/make-one/design';
import { vorauswahl, type AuftragAktion, type PlanEintrag, type UebernahmeWahl } from '@/lib/agenten/brain-agenten';
import { pfadName } from '@/lib/agenten/wissen';
import { Fenster } from '../Fenster';
import { Chip, Feldzeile, Hinweis, Knopf, Leer, Liste, Schalter, Zeile, auswahl } from '../ui';
import { brainSenden, ladeBrainVorschau, type Abruf, type BrainErgebnis, type BrainVorschau, type BrainZiele } from './daten';
import { useAgenten } from './kontext';

const AUFTRAG_TEXT: Readonly<Record<AuftragAktion, string>> = {
  neu: 'Auftrag übernehmen (der Head hat noch keinen)',
  aktualisieren: 'Auftrag aktualisieren (der bisherige kam unverändert aus dem Brain)',
  gleich: 'Auftrag ist schon genau so übernommen',
  eigener: 'Eigenen Auftrag ersetzen (von Hand geschrieben)',
  doppelt: 'Eine andere Notiz stellt den Auftrag dieses Heads schon',
  'zu-lang': 'Zu lang — nicht übernommen (nie gekürzt); bitte in der Notiz kürzen',
  leer: 'Die Notiz beschreibt keinen Auftrag',
};
const waehlbarAuftrag = (a: AuftragAktion) => a === 'neu' || a === 'aktualisieren' || a === 'eigener';

/** Wert der Ziel-Auswahl: `head:<id>`, `ma:<id>` oder `—`. */
const zielWert = (e: PlanEintrag): string => (e.ziel ? `${e.ziel.als === 'mitarbeiter' ? 'ma' : 'head'}:${e.ziel.headId}` : '—');

export function BrainUebernahmeFenster({ onZu }: { onZu: () => void }) {
  const { melde } = useAgenten();
  /** Vom Menschen gewählter Agenten-Ordner (null = der des Servers: gemerkt bzw. über `_Agenten_Index`). */
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [ziele, setZiele] = useState<BrainZiele>({});
  const [stand, setStand] = useState<Abruf<BrainVorschau>>({ zustand: 'laedt' });
  const [wahl, setWahl] = useState<Record<string, UebernahmeWahl>>({});
  const [ergebnisse, setErgebnisse] = useState<BrainErgebnis[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [runde, setRunde] = useState(0);

  useEffect(() => {
    let lebt = true;
    setStand({ zustand: 'laedt' });
    void ladeBrainVorschau({ ordner: gewaehlt, ziele }).then(a => {
      if (!lebt) return;
      setStand(a);
      if (a.zustand !== 'da') return;
      // Vorauswahl des Servers (Auftrag neu/aktualisieren, Mitarbeiter, neues Wissen) — eine eigene Auswahl bleibt, solange das Ziel gleich ist.
      setWahl(alt => Object.fromEntries(a.daten.eintraege.filter(e => e.ziel).map(e => {
        const x = alt[e.datei];
        return [e.datei, x && x.headId === zielWert(e) ? x : { ...vorauswahl(e), headId: zielWert(e) }];
      })));
    });
    return () => { lebt = false; };
  }, [gewaehlt, ziele, runde]);

  const v = stand.zustand === 'da' ? stand.daten : null;
  const anzahl = useMemo(() => Object.values(wahl).reduce((n, x) => n + (x.auftrag ? 1 : 0) + (x.stufe ? 1 : 0) + (x.mitarbeiter?.length ?? 0) + (x.wissen?.length ?? 0), 0), [wahl]);
  const setze = (datei: string, f: (w: UebernahmeWahl) => UebernahmeWahl) => setWahl(alt => ({ ...alt, [datei]: f(alt[datei] ?? { datei }) }));
  const umschalten = (liste: string[] | undefined, x: string, an: boolean) => (an ? Array.from(new Set([...(liste ?? []), x])) : (liste ?? []).filter(y => y !== x));

  const ordnerWechseln = (p: string) => { setZiele({}); setWahl({}); setErgebnisse(null); setGewaehlt(p || null); };
  const ordnerMerken = async () => {
    const r = await brainSenden<{ ok: true; ordner: string | null }>({ aktion: 'ordner', ordner: v?.ordner.pfad ?? null });
    if (r.ok) { melde('Agenten-Ordner gemerkt.', 'gut'); setRunde(n => n + 1); } else setFehler(r.text);
  };
  const zielWaehlen = (e: PlanEintrag, wert: string) => {
    const [art, id] = wert.split(':');
    setZiele(z => ({ ...z, [e.datei]: wert === '—' ? { headId: null } : { headId: id, als: art === 'ma' ? 'mitarbeiter' : 'head' } }));
  };
  const uebernehmen = async () => {
    if (!v) return;
    setFehler(null);
    // `headId` in der Auswahl ist hier nur die Merk-Marke des Ziels — geschickt wird das Ziel nur, wenn es in der Vorschau gewählt wurde.
    const auswahlListe = v.eintraege.filter(e => e.ziel && wahl[e.datei]).map(e => {
      const { headId: _marke, ...x } = wahl[e.datei];
      return { ...x, datei: e.datei, ...(ziele[e.datei] ? { headId: ziele[e.datei].headId, ...(ziele[e.datei].als ? { als: ziele[e.datei].als } : {}) } : {}) };
    });
    const staende = Object.fromEntries(v.eintraege.filter(e => e.ziel && e.stand).map(e => [e.ziel!.headId, e.stand!]));
    const wissenStaende = Object.fromEntries(v.eintraege.filter(e => e.ziel && e.wissenStand).map(e => [e.ziel!.headId, e.wissenStand!]));
    const r = await brainSenden<{ ok: true; ergebnisse: BrainErgebnis[] }>({ aktion: 'uebernehmen', ...(v.ordner.pfad ? { ordner: v.ordner.pfad } : {}), auswahl: auswahlListe, staende, wissenStaende });
    if (!r.ok) { setFehler(r.text); return; }
    setErgebnisse(r.daten.ergebnisse);
    const gut = r.daten.ergebnisse.filter(x => x.ok).length;
    melde(`${gut} von ${r.daten.ergebnisse.length} übernommen.`, gut === r.daten.ergebnisse.length ? 'gut' : 'info');
    setWahl({}); // neu laden: die Vorauswahl zeigt dann, was noch offen ist
    setRunde(n => n + 1);
  };

  return (
    <Fenster titel="Aus dem Brain übernehmen" onZu={onZu} breit={760}>
      <div style={{ fontSize: TYP.body, color: C.inkDim, lineHeight: 1.55 }}>
        Liest die Agenten-Notizen aus eurem Brain (nie private Notizen) und schlägt vor, was daraus wird: Auftrag, Mitarbeiter und Wissen je Head.
        Es passiert nichts ohne „Übernehmen“. Nur Business-Heads — Privat-Agenten richtet jede Person selbst ein. Text aus dem Brain gilt für die
        Agenten als Daten, nie als Befehl.
      </div>
      {stand.zustand === 'laedt' && <Leer>Liest das Brain …</Leer>}
      {(stand.zustand === 'fehler' || stand.zustand === 'gesperrt' || stand.zustand === 'kommt') && <Hinweis art={stand.zustand === 'gesperrt' ? 'info' : 'achtung'}>{stand.text}</Hinweis>}
      {v && (
        <>
          <div style={{ display: 'flex', gap: ABSTAND.s, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Feldzeile label="Ordner mit Agenten-Notizen">
              <select value={v.ordner.pfad ?? ''} onChange={x => ordnerWechseln(x.target.value)} aria-label="Ordner mit Agenten-Notizen" style={auswahl}>
                {!v.ordner.pfad && <option value="">— Ordner wählen —</option>}
                {v.ordnerListe.map(o => <option key={o.pfad} value={o.pfad}>{o.pfad} ({o.notizen})</option>)}
              </select>
            </Feldzeile>
            {v.ordner.pfad && v.ordner.quelle !== 'einstellung' && <Knopf leise onClick={ordnerMerken}>Als Agenten-Ordner merken</Knopf>}
          </div>
          {v.hinweis && <Hinweis art="info">{v.hinweis}</Hinweis>}
          {v.eintraege.map(e => {
            const w = wahl[e.datei] ?? { datei: e.datei };
            return (
              <section key={e.datei} aria-label={e.titel} style={{ display: 'grid', gap: ABSTAND.s, padding: ABSTAND.m, borderRadius: ECKE.flach, background: FLAECHE_STIL.flach.background }}>
                <div style={{ display: 'flex', gap: ABSTAND.s, alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: TYP.body, fontWeight: 600, color: C.ink, overflowWrap: 'anywhere' }}>{e.titel}</span>
                  <span style={{ fontSize: TYP.bedien, color: C.inkLeise, overflowWrap: 'anywhere' }}>{pfadName(e.datei)}.md{e.status ? ` · ${e.status}` : ''}</span>
                </div>
                <Feldzeile label="Wird zu">
                  <select value={zielWert(e)} onChange={x => zielWaehlen(e, x.target.value)} aria-label={`${e.titel}: wird zu`} style={auswahl}>
                    <option value="—">— überspringen —</option>
                    {v.heads.map(h => <option key={`head:${h.id}`} value={`head:${h.id}`}>{h.name}</option>)}
                    {v.heads.map(h => <option key={`ma:${h.id}`} value={`ma:${h.id}`}>als Mitarbeiter unter {h.name}</option>)}
                  </select>
                </Feldzeile>
                <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{e.zielGrund}</span>
                {e.ziel && e.ziel.als === 'head' && e.auftrag && (
                  <div style={{ display: 'grid', gap: ABSTAND.xs }}>
                    {waehlbarAuftrag(e.auftrag.aktion)
                      ? <Schalter erklaerung="brain.uebernahme.auftrag" an={!!w.auftrag && (e.auftrag.aktion !== 'eigener' || !!w.ersetzen)} onChange={an => setze(e.datei, x => ({ ...x, auftrag: an, ersetzen: e.auftrag!.aktion === 'eigener' ? an : x.ersetzen }))}>{AUFTRAG_TEXT[e.auftrag.aktion]} · {e.auftrag.zeichen.toLocaleString('de-DE')} Zeichen</Schalter>
                      : <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{AUFTRAG_TEXT[e.auftrag.aktion]}</span>}
                    {e.auftrag.text && <details><summary style={{ fontSize: TYP.bedien, color: C.inkDim, cursor: 'pointer' }}>Auftrag ansehen</summary><div style={{ fontSize: TYP.bedien, color: C.ink, whiteSpace: 'pre-wrap', lineHeight: 1.5, marginTop: ABSTAND.xs }}>{e.auftrag.text}</div></details>}
                  </div>
                )}
                {e.ziel && e.stufe && <Schalter erklaerung="brain.uebernahme.stufe" an={!!w.stufe} onChange={an => setze(e.datei, x => ({ ...x, stufe: an }))}>Modellstufe aus der Notiz: {e.stufe.datei} (heute {e.stufe.heute})</Schalter>}
                {e.ziel && e.mitarbeiter.length > 0 && (
                  <div style={{ display: 'grid', gap: ABSTAND.xs }}>
                    <span style={{ ...MIKRO }}>Mitarbeiter</span>
                    {e.mitarbeiter.map(m => (m.aktion === 'einschalten' || m.aktion === 'anlegen')
                      ? <Schalter key={m.kuerzel} erklaerung="brain.uebernahme.mitarbeiter" an={(w.mitarbeiter ?? []).includes(m.kuerzel)} onChange={an => setze(e.datei, x => ({ ...x, mitarbeiter: umschalten(x.mitarbeiter, m.kuerzel, an) }))}>{m.neu ? `${m.neu.name} — ${m.grund}` : m.grund}</Schalter>
                      : <span key={m.kuerzel} style={{ fontSize: TYP.bedien, color: C.inkLeise }}><Chip farbe={m.aktion === 'vorhanden' ? LEUCHT.gut : C.inkLeise}>{m.kuerzel}</Chip> {m.grund}</span>)}
                  </div>
                )}
                {e.ziel && (e.wissen.length > 0 || e.wissenNichtGefunden.length > 0) && (
                  <div style={{ display: 'grid', gap: ABSTAND.xs }}>
                    <span style={{ ...MIKRO }}>Wissen im Brain</span>
                    {e.wissen.map(x => x.aktion === 'neu'
                      ? <Schalter key={x.pfad} erklaerung="brain.uebernahme.wissen" an={(w.wissen ?? []).includes(x.pfad)} onChange={an => setze(e.datei, y => ({ ...y, wissen: umschalten(y.wissen, x.pfad, an) }))}>{x.art === 'ordner' ? 'Ordner' : 'Notiz'} „{x.pfad}“</Schalter>
                      : <span key={x.pfad} style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Schon zugeordnet: „{x.pfad}“</span>)}
                    {e.wissenNichtGefunden.length > 0 && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Nicht gefunden oder privat (geht nie an Agenten): {e.wissenNichtGefunden.join(', ')}</span>}
                  </div>
                )}
                {e.ignoriert.length > 0 && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Nicht übernommen: {e.ignoriert.join(' · ')}</span>}
              </section>
            );
          })}
          {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
          {ergebnisse && (
            <div style={{ display: 'grid', gap: ABSTAND.xs }}>
              <span style={{ ...MIKRO }}>Ergebnis</span>
              <Liste>{ergebnisse.map((x, i) => <Zeile key={`${x.datei}-${x.teil}-${i}`} umbrechen titel={x.teil} unter={x.text} rechts={<Chip farbe={x.ok ? LEUCHT.gut : LEUCHT.kritisch}>{x.ok ? 'ok' : 'nicht'}</Chip>} />)}</Liste>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: ABSTAND.s, flexWrap: 'wrap' }}>
            <Knopf leise onClick={onZu}>Schließen</Knopf>
            <Knopf haupt onClick={uebernehmen} aus={!anzahl}>Übernehmen{anzahl ? ` (${anzahl})` : ''}</Knopf>
          </div>
        </>
      )}
    </Fenster>
  );
}
