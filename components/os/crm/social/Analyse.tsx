'use client';

// ─── Markttraktion · Social › Analyse, Formate, Import (26.10.2026) ──────────────────────────────────────────────────────────────────
// Analyse: was als Nächstes zu tun ist (Empfehlungen), das Typische des Kanals, jede Folge mit Wirkung und Urteil, Formate und Säulen im
// Vergleich, Hook-Tests. Gerechnet wird NUR auf dem Server (lib/social/analyse.ts) — hier wird gezeigt. Formate: Serienformate anlegen und
// freigeben (erst dann darf der Agent sie in Stufe 2 selbst weiterführen). Import: Plattform-Export (CSV) → Vorschau → übernehmen.

import { useState } from 'react';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Chip, Knopf, Hinweis, Leerzustand, Kennzahl, Raster, Feldzeile, feld, eingabe } from '../../ui';
import { URTEIL_TEXT, type Urteil } from '@/lib/social/analyse';
import { PLATTFORM_NAME, SOCIAL_PLATTFORMEN, type SocialPlattform, type SocialKanal } from '@/lib/social/typen';
import type { ImportVorschau } from '@/lib/social/csv';
import { localDay } from '@/lib/zeit';
import { datumKurz } from '@/lib/make-one/faelligkeit';
import type { MitStand, SocialApi } from './daten';

const URTEIL_FARBE: Record<Urteil, string> = { 'mehr-davon': LEUCHT.gut, hook: LEUCHT.achtung, kuerzen: LEUCHT.achtung, streichen: LEUCHT.kritisch, beobachten: C.inkDim, 'zu-wenig-daten': C.inkLeise };
const URTEIL_KURZ: Record<Urteil, string> = { 'mehr-davon': 'mehr davon', hook: 'Hook umbauen', kuerzen: 'kürzen', streichen: 'nicht wiederholen', beobachten: 'beobachten', 'zu-wenig-daten': 'zu wenig Daten' };
const zahl = (n: number | undefined, nach = '') => (n === undefined ? '—' : `${n.toLocaleString('de-DE')}${nach}`);

export function Analyse({ api, kanal }: { api: SocialApi; kanal: SocialKanal }) {
  const a = api.lage!.analyse[kanal.id];
  const w = api.lage!.woche[kanal.id];
  if (!a || !a.folgenMitZahlen) {
    return <Karte><Leerzustand symbol="◔" titel="Noch keine Zahlen">Sobald Folgen veröffentlicht sind: Messung eintragen oder den Export der Plattform unter „Import“ hochladen. Dann zeigt die Analyse, was trägt.</Leerzustand></Karte>;
  }
  return (
    <>
      <Karte>
        <Ueberschrift>Als Nächstes</Ueberschrift>
        <div style={{ display: 'grid', gap: 8 }}>{a.empfehlungen.map((e, i) => <Hinweis key={i} art="info">{e}</Hinweis>)}</div>
        <p style={{ color: C.inkLeise, fontSize: TYP.bedien, marginBottom: 0 }}>Startschwellen, keine Plattform-Angaben: 50 % nach 3 s, 25 % bis zum Ende. Verglichen wird mit dem Typischen dieses Kanals — ab 5 Folgen mit Zahlen.</p>
      </Karte>
      <Raster min={160}>
        <Kennzahl label="Woche · Folgen" wert={String(w?.veroeffentlicht ?? 0)} />
        <Kennzahl label="Woche · Aufrufe" wert={zahl(w?.views)} />
        <Kennzahl label="Woche · Follower" wert={zahl(w?.follows)} />
        <Kennzahl label="Typisch · Aufrufe" wert={zahl(a.typisch.views)} />
        <Kennzahl label="Typisch · nach 3 s" wert={zahl(a.typisch.halte3s, ' %')} />
      </Raster>
      <Karte>
        <Ueberschrift>Jede Folge</Ueberschrift>
        <Liste>{a.folgen.map(f => (
          <Zeile key={f.id} titel={f.titel}
            unter={<span style={{ color: C.inkDim, fontSize: TYP.bedien }}>{zahl(f.zahlen.views)} Aufrufe · {zahl(f.zahlen.halte3s, ' %')} nach 3 s · {zahl(f.zahlen.durchsehen, ' %')} bis zum Ende · {zahl(f.zahlen.sharesJeTsd)} Shares/1.000 · {zahl(f.zahlen.followsJeTsd)} Follower/1.000</span>}
            rechts={<span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{f.wirkung !== null && <span style={{ color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{f.wirkung.toLocaleString('de-DE')}×</span>}<Chip farbe={URTEIL_FARBE[f.urteil]}>{URTEIL_KURZ[f.urteil]}</Chip></span>} />
        ))}</Liste>
        <p style={{ color: C.inkLeise, fontSize: TYP.bedien, marginBottom: 0 }}>Wirkung 1× = typisch für diesen Kanal (Aufrufe doppelt gewichtet, dazu Shares, Gespeichert, Follower je 1.000 und Haltequote). „Mehr davon“ = {URTEIL_TEXT['mehr-davon'].replace(/^Mehr davon — /, '')}</p>
      </Karte>
      {a.hooks.length > 0 && (
        <Karte>
          <Ueberschrift>Hook-Tests</Ueberschrift>
          {a.hooks.map(h => (
            <div key={h.folgeId} style={{ marginBottom: 12 }}>
              <div style={{ color: C.inkDim, fontSize: TYP.bedien, margin: '4px 0' }}>{h.titel}</div>
              <Liste>{h.varianten.map(v => (
                <Zeile key={v.hookId} titel={v.text} unter={`${v.messungen === 1 ? '1 Plattform' : `${v.messungen} Plattformen`} · ${zahl(v.views)} Aufrufe`} rechts={<Chip farbe={h.vorn === v.hookId ? LEUCHT.gut : C.inkDim}>{zahl(v.halte3s, ' %')} nach 3 s</Chip>} />
              ))}</Liste>
            </div>
          ))}
          <p style={{ color: C.inkLeise, fontSize: TYP.bedien, marginBottom: 0 }}>Verglichen werden nur Hook-Varianten derselben Folge. Eine Tendenz gibt es erst, wenn jede Variante auf mindestens zwei Plattformen gemessen ist.</p>
        </Karte>
      )}
    </>
  );
}

export function Formate({ api, kanal }: { api: SocialApi; kanal: MitStand<SocialKanal> }) {
  const formate = api.lage!.datei.formate.filter(f => f.kanalId === kanal.id);
  const [name, setName] = useState('');
  const [beschreibung, setBeschreibung] = useState('');
  const [laenge, setLaenge] = useState('');
  return (
    <>
      <Karte>
        <Ueberschrift>Serienformate</Ueberschrift>
        <p style={{ color: C.inkLeise, fontSize: TYP.bedien, marginTop: 0 }}>Ein freigegebenes Format darf der Agent in Stufe 2 selbst weiterführen. Wird es geändert, ist die Freigabe weg.</p>
        {formate.length === 0 ? <Leerzustand symbol="▤" titel="Noch keine Formate">Zum Beispiel „Day X“, „Der Fall“ oder „Ein Gedanke“ — mit Ziel-Länge.</Leerzustand>
          : <Liste>{formate.map(f => (
            <Zeile key={f.id} titel={f.name} unter={[f.beschreibung, f.laengeSek ? `${f.laengeSek} s` : null].filter(Boolean).join(' · ') || undefined}
              rechts={<Knopf leise={!!f.freigegebenAm} onClick={() => api.schreiben([{ op: 'format-freigeben', id: f.id, freigeben: !f.freigegebenAm, stand: f.stand }])}>{f.freigegebenAm ? 'Freigabe zurücknehmen' : 'Freigeben'}</Knopf>} />
          ))}</Liste>}
      </Karte>
      <Karte>
        <form onSubmit={async e => { e.preventDefault(); if (await api.schreiben([{ op: 'format', eintrag: { kanalId: kanal.id, name, beschreibung, laengeSek: laenge ? Number(laenge) : undefined } }])) { setName(''); setBeschreibung(''); setLaenge(''); } }} style={{ display: 'grid', gap: 12 }}>
          <Ueberschrift>Neues Format</Ueberschrift>
          <Feldzeile label="Name"><input style={eingabe} value={name} onChange={e => setName(e.target.value)} required maxLength={300} /></Feldzeile>
          <Feldzeile label="Was gehört dazu"><textarea style={{ ...feld, minHeight: 72 }} value={beschreibung} onChange={e => setBeschreibung(e.target.value)} maxLength={2000} /></Feldzeile>
          <Feldzeile label="Ziel-Länge (Sekunden)"><input style={eingabe} inputMode="numeric" value={laenge} onChange={e => setLaenge(e.target.value)} /></Feldzeile>
          <div><Knopf typ="submit">Format anlegen</Knopf></div>
        </form>
      </Karte>
    </>
  );
}

const SPALTE_NAME: Record<string, string> = {
  titel: 'Titel', link: 'Link', veroeffentlicht: 'Veröffentlicht', views: 'Aufrufe', likes: 'Likes', kommentare: 'Kommentare', shares: 'Geteilt',
  saves: 'Gespeichert', follows: 'Neue Follower', halte3s: 'Halterate 3 s', durchsehen: 'Durchsehquote', schnittSek: 'Ø Wiedergabe (s)',
};

export function Import({ api, kanal }: { api: SocialApi; kanal: SocialKanal }) {
  const [plattform, setPlattform] = useState<SocialPlattform>(kanal.plattformen[0] ?? 'tiktok');
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  // Stand der Zahlen = Tag des Exports (die Datei kennt nur den Tag der Veröffentlichung).
  const [stand, setStand] = useState(() => localDay());
  const [vorschau, setVorschau] = useState<ImportVorschau | null>(null);
  const [zuordnung, setZuordnung] = useState<Record<string, string>>({});
  const [ergebnis, setErgebnis] = useState<string | null>(null);
  const folgen = api.lage!.datei.folgen.filter(f => f.kanalId === kanal.id);
  const datei = async (f: File | undefined) => {
    if (!f) return;
    setName(f.name); setVorschau(null); setErgebnis(null); setZuordnung({});
    setText(await f.text());
  };
  return (
    <Karte>
      <form onSubmit={async e => { e.preventDefault(); const r = await api.importieren('import-vorschau', kanal.id, plattform, text, stand); setVorschau(r?.vorschau ?? null); }} style={{ display: 'grid', gap: 12 }}>
        <Ueberschrift>Zahlen aus der Plattform importieren</Ueberschrift>
        <p style={{ color: C.inkLeise, fontSize: TYP.bedien, margin: 0 }}>Export aus TikTok Studio, Meta Business Suite oder YouTube Studio als CSV. Erst die Vorschau — übernommen wird nur, was eindeutig zu einer Folge passt.</p>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))' }}>
          <Feldzeile label="Plattform">
            <select style={feld} value={plattform} onChange={e => setPlattform(e.target.value as SocialPlattform)}>{SOCIAL_PLATTFORMEN.map(p => <option key={p} value={p}>{PLATTFORM_NAME[p]}</option>)}</select>
          </Feldzeile>
          <Feldzeile label="Datei (CSV)"><input type="file" accept=".csv,text/csv" style={feld} onChange={e => void datei(e.target.files?.[0])} /></Feldzeile>
          <Feldzeile label="Stand der Zahlen (Tag des Exports)"><input type="date" style={feld} value={stand} max={localDay()} onChange={e => { setStand(e.target.value); setVorschau(null); }} /></Feldzeile>
        </div>
        <div><Knopf typ="submit" aus={!text}>Vorschau{name ? ` · ${name}` : ''}</Knopf></div>
      </form>
      {vorschau && (
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          {vorschau.fehler.map((f, i) => <Hinweis key={i} art="achtung">{f}</Hinweis>)}
          <span style={{ color: C.inkDim, fontSize: TYP.bedien }}>Erkannte Spalten: {Object.entries(vorschau.spalten).map(([k, v]) => `${SPALTE_NAME[k] ?? k} = „${v}“`).join(' · ') || '—'}</span>
          <Liste>{vorschau.zeilen.map(z => (
            <Zeile key={z.zeile} titel={z.titel || `Zeile ${z.zeile}`} unter={`${z.messung.views.toLocaleString('de-DE')} Aufrufe · Stand ${datumKurz(z.messung.am)}${z.veroeffentlichtAm ? ` · veröffentlicht ${datumKurz(z.veroeffentlichtAm)}` : ''}${z.hinweis ? ` · ${z.hinweis}` : ''}`}
              rechts={<select style={{ ...feld, minHeight: 40, width: 'auto', maxWidth: 220 }} value={zuordnung[String(z.zeile)] ?? z.folgeId ?? ''} onChange={e => setZuordnung(m => ({ ...m, [String(z.zeile)]: e.target.value }))}>
                <option value="">nicht übernehmen</option>
                {folgen.map(f => <option key={f.id} value={f.id}>{f.titel}</option>)}
              </select>} />
          ))}</Liste>
          <div><Knopf haupt onClick={async () => {
            const r = await api.importieren('import', kanal.id, plattform, text, stand, zuordnung);
            if (r?.uebernommen !== undefined) { setErgebnis(`${r.uebernommen} Messungen übernommen, ${r.uebersprungen ?? 0} übersprungen.`); setVorschau(null); }
          }}>Übernehmen</Knopf></div>
        </div>
      )}
      {ergebnis && <div style={{ marginTop: 12 }}><Hinweis art="gut">{ergebnis}</Hinweis></div>}
    </Karte>
  );
}
