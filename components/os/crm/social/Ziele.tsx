'use client';

// ─── Markttraktion · Social › Ziele (27.10.2026) ───────────────────────────────────────────────────────────────────────────────────
// Kevin 27.10.: „Vervollständige weiter die Ziele.“ Je Kanal: Ziele mit Stand (gerechnet NUR auf dem Server, lib/social/ziele.ts — hier wird
// gezeigt), Vorschläge aus der Vorlage des Kanals, ein Ziel anlegen/ändern und die Follower je Plattform eintragen (Kontostand aus den
// Insights — nie geschätzt). Schreiben über die Einzel-Schritte `ziel`, `ziel-weg`, `kontostand` mit dem Stand des Kanals.

import { useState } from 'react';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Chip, Knopf, Leerzustand, Feldzeile, feld, eingabe, Fortschritt } from '../../ui';
import { ZIEL_METRIKEN, ZIEL_METRIK_NAME, ZIEL_MIT_LINIE, PLATTFORM_NAME, type KanalZiel, type SocialKanal, type SocialPlattform, type ZielMetrik } from '@/lib/social/typen';
import { ZIEL_AMPEL_NAME, type ZielAmpel } from '@/lib/social/ziele';
import { vorlageVon, type VorlageZiel } from '@/lib/social/vorlagen';
import type { MitStand, SocialApi } from './daten';

const AMPEL_FARBE: Record<ZielAmpel, string> = {
  erreicht: LEUCHT.gut, 'auf-kurs': LEUCHT.gut, knapp: LEUCHT.achtung, hinter: LEUCHT.kritisch, verfehlt: LEUCHT.kritisch, 'ohne-daten': C.inkLeise,
};
const mitLinie = (m: ZielMetrik) => (ZIEL_MIT_LINIE as readonly ZielMetrik[]).includes(m);
const zahl = (n: number) => n.toLocaleString('de-DE');
/** JJJJ-MM-TT → TT.MM.JJJJ (Ziele laufen über Jahresgrenzen — das Jahr gehört dazu). */
const tag = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}`;

export function Ziele({ api, kanal }: { api: SocialApi; kanal: MitStand<SocialKanal> }) {
  const lage = api.lage!;
  const staende = lage.kanaele[kanal.id]?.ziele ?? [];
  const [offen, setOffen] = useState<KanalZiel | Partial<KanalZiel> | null>(null);
  const vorschlaege = (vorlageVon(kanal.vorlage)?.ziele ?? [])
    .filter(v => !kanal.ziele.some(z => z.metrik === v.metrik && (z.plattform ?? null) === (v.plattform ?? null)))
    .filter(v => !v.plattform || kanal.plattformen.includes(v.plattform));

  return (
    <>
      <Karte>
        <Ueberschrift rechts={<Knopf onClick={() => setOffen({})}>+ Ziel</Knopf>}>Ziele</Ueberschrift>
        {kanal.ziele.length === 0
          ? <Leerzustand symbol="◎" titel="Noch kein Ziel" aktion={<Knopf onClick={() => setOffen({ metrik: 'follower' })}>Erstes Ziel anlegen</Knopf>}>
            Ein Ziel mit Termin (Follower oder Aufrufe bis …) und eins für Takt oder Qualität — gemessen wird nur, was eingetragen ist.
          </Leerzustand>
          : <Liste>{kanal.ziele.map(z => {
            const st = staende.find(s => s.id === z.id);
            return (
              <Zeile key={z.id} onClick={() => setOffen(z)}
                titel={`${ZIEL_METRIK_NAME[z.metrik]}${z.plattform ? ` · ${PLATTFORM_NAME[z.plattform]}` : ''}: ${zahl(z.zielwert)}${z.bis ? ` bis ${tag(z.bis)}` : ''}`}
                unter={<span style={{ display: 'grid', gap: 6 }}>
                  {st && st.ampel !== 'ohne-daten' && <Fortschritt anteil={st.anteil} farbe={AMPEL_FARBE[st.ampel]} />}
                  <span style={{ color: C.inkDim, fontSize: TYP.bedien }}>{st?.satz ?? ''}</span>
                  {z.notiz && <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>{z.notiz}</span>}
                </span>}
                rechts={st ? <Chip farbe={AMPEL_FARBE[st.ampel]}>{ZIEL_AMPEL_NAME[st.ampel]}</Chip> : undefined} />
            );
          })}</Liste>}
        {vorschlaege.length > 0 && (
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>Vorschläge aus der Vorlage:</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {vorschlaege.map((v, i) => <Knopf key={i} leise onClick={() => setOffen(ausVorschlag(v))}>{ZIEL_METRIK_NAME[v.metrik]}{v.plattform ? ` · ${PLATTFORM_NAME[v.plattform]}` : ''}{v.zielwert ? `: ${zahl(v.zielwert)}` : ''}</Knopf>)}
            </div>
          </div>
        )}
      </Karte>
      {offen && <ZielForm key={'id' in offen && offen.id ? offen.id : 'neu'} api={api} kanal={kanal} ziel={offen} hinweis={vorlageVon(kanal.vorlage)?.ziele.find(v => v.metrik === offen.metrik)?.hinweis} onFertig={() => setOffen(null)} />}
      <Kontostaende api={api} kanal={kanal} />
    </>
  );
}

const ausVorschlag = (v: VorlageZiel): Partial<KanalZiel> => ({ metrik: v.metrik, plattform: v.plattform, ...(v.zielwert ? { zielwert: v.zielwert } : {}) });

function ZielForm({ api, kanal, ziel, hinweis, onFertig }: { api: SocialApi; kanal: MitStand<SocialKanal>; ziel: Partial<KanalZiel>; hinweis?: string; onFertig: () => void }) {
  const [metrik, setMetrik] = useState<ZielMetrik>(ziel.metrik ?? 'follower');
  const [plattform, setPlattform] = useState<SocialPlattform | ''>(ziel.plattform ?? '');
  const [zielwert, setZielwert] = useState(ziel.zielwert ? String(ziel.zielwert) : '');
  const [von, setVon] = useState(ziel.von ?? api.lage!.heute);
  const [bis, setBis] = useState(ziel.bis ?? '');
  const [notiz, setNotiz] = useState(ziel.notiz ?? '');
  const linie = mitLinie(metrik);
  const speichern = async () => {
    const eintrag = { ...(ziel.id ? { id: ziel.id } : {}), metrik, plattform: plattform || undefined, zielwert: Number(zielwert.replace(/\./g, '').replace(',', '.')), von, bis: linie ? bis : undefined, notiz };
    if (await api.schreiben([{ op: 'ziel', kanalId: kanal.id, eintrag, stand: kanal.stand }])) onFertig();
  };
  return (
    <Karte>
      <form onSubmit={e => { e.preventDefault(); void speichern(); }} style={{ display: 'grid', gap: 12 }}>
        <Ueberschrift rechts={<Knopf leise onClick={onFertig}>Schließen</Knopf>}>{ziel.id ? 'Ziel ändern' : 'Neues Ziel'}</Ueberschrift>
        {hinweis && <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>{hinweis}</span>}
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))' }}>
          <Feldzeile label="Kennzahl">
            <select style={feld} value={metrik} onChange={e => setMetrik(e.target.value as ZielMetrik)}>{ZIEL_METRIKEN.map(m => <option key={m} value={m}>{ZIEL_METRIK_NAME[m]}</option>)}</select>
          </Feldzeile>
          <Feldzeile label="Plattform">
            <select style={feld} value={plattform} onChange={e => setPlattform(e.target.value as SocialPlattform | '')}>
              <option value="">alle zusammen</option>
              {kanal.plattformen.map(p => <option key={p} value={p}>{PLATTFORM_NAME[p]}</option>)}
            </select>
          </Feldzeile>
          <Feldzeile label="Zielwert"><input style={eingabe} inputMode="decimal" value={zielwert} onChange={e => setZielwert(e.target.value)} required /></Feldzeile>
          <Feldzeile label="Ab"><input type="date" style={eingabe} value={von} max={api.lage!.heute} onChange={e => setVon(e.target.value)} required /></Feldzeile>
          {linie && <Feldzeile label="Bis"><input type="date" style={eingabe} value={bis} min={von} onChange={e => setBis(e.target.value)} required /></Feldzeile>}
        </div>
        <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>
          {linie ? 'Gemessen gegen eine gerade Linie vom Stand am Start bis zum Zielwert am Termin.' : metrik === 'posts-woche' ? 'Durchschnitt der letzten vier Wochen.' : 'Median der letzten zehn veröffentlichten Folgen mit Zahlen.'}
        </span>
        <Feldzeile label="Notiz"><input style={eingabe} value={notiz} onChange={e => setNotiz(e.target.value)} maxLength={300} /></Feldzeile>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Knopf haupt typ="submit">Speichern</Knopf>
          {ziel.id && <Knopf leise farbe={LEUCHT.kritisch} onClick={async () => { if (await api.schreiben([{ op: 'ziel-weg', kanalId: kanal.id, id: ziel.id, stand: kanal.stand }])) onFertig(); }}>Ziel entfernen</Knopf>}
        </div>
      </form>
    </Karte>
  );
}

function Kontostaende({ api, kanal }: { api: SocialApi; kanal: MitStand<SocialKanal> }) {
  const [plattform, setPlattform] = useState<SocialPlattform>(kanal.plattformen[0] ?? 'instagram');
  const [am, setAm] = useState(api.lage!.heute);
  const [follower, setFollower] = useState('');
  const letzte = kanal.plattformen.map(p => ({ p, s: kanal.staende.filter(x => x.plattform === p).sort((a, b) => a.am.localeCompare(b.am)).at(-1) }));
  if (!kanal.plattformen.length) return null;
  return (
    <Karte>
      <form onSubmit={async e => { e.preventDefault(); if (await api.schreiben([{ op: 'kontostand', kanalId: kanal.id, plattform, am, follower: Number(follower.replace(/\./g, '')) }])) setFollower(''); }} style={{ display: 'grid', gap: 12 }}>
        <Ueberschrift>Follower eintragen</Ueberschrift>
        <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>Aus den Insights der Plattform abschreiben — ein Wert je Plattform und Tag, ein neuer Wert am selben Tag ersetzt den alten.</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {letzte.map(({ p, s }) => <Chip key={p} farbe={s ? C.aktiv : C.inkLeise}>{PLATTFORM_NAME[p]}: {s ? `${zahl(s.follower)} · ${tag(s.am)}` : 'noch kein Stand'}</Chip>)}
        </div>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 180px), 1fr))' }}>
          <Feldzeile label="Plattform">
            <select style={feld} value={plattform} onChange={e => setPlattform(e.target.value as SocialPlattform)}>{kanal.plattformen.map(p => <option key={p} value={p}>{PLATTFORM_NAME[p]}</option>)}</select>
          </Feldzeile>
          <Feldzeile label="Stand vom"><input type="date" style={eingabe} value={am} max={api.lage!.heute} onChange={e => setAm(e.target.value)} required /></Feldzeile>
          <Feldzeile label="Follower"><input style={eingabe} inputMode="numeric" value={follower} onChange={e => setFollower(e.target.value)} required /></Feldzeile>
        </div>
        <div><Knopf typ="submit">Stand speichern</Knopf></div>
      </form>
    </Karte>
  );
}
