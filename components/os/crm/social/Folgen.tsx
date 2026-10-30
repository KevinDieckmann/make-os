'use client';

// ─── Markttraktion · Social › Folgen (26.10.2026) ───────────────────────────────────────────────────────────────────────────────────
// Je Kanal die Folgen mit Status, Prüf-Befunden und der Leitplanken-Entscheidung („würde selbst posten“ / „Stapel, weil …“ / „gesperrt“).
// Öffnen = Editor: Titel, Format, Säule, Skript, bis zu drei Hook-Varianten, CTA, Quellen, KI-Inhalt, Status; darunter „Veröffentlicht“ und
// „Messung eintragen“ (Zahlen aus den Plattform-Insights — nie geschätzt). MAKE OS veröffentlicht nichts selbst.

import { useMemo, useState } from 'react';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Chip, Knopf, Hinweis, Leerzustand, Feldzeile, feld, eingabe, Pillen } from '../../ui';
import { FOLGE_STATUS, FOLGE_STATUS_NAME, PLATTFORM_NAME, SOCIAL_PLATTFORMEN, type FolgeStatus, type SocialPlattform, type SocialFolge, type SocialKanal, type PersonenImBild } from '@/lib/social/typen';
import { datumKurz } from '@/lib/make-one/faelligkeit';
import { tagVon } from '@/lib/zeit';
import type { Befund } from '@/lib/social/pruefer';
import type { AutonomieErgebnis } from '@/lib/social/autonomie';
import type { MitStand, SocialApi } from './daten';
import { FolgeMedien } from './Medien';

/** Aus einem Beitrag in die Reel-Werkstatt (Social.tsx legt den Auftrag an und wechselt den Bereich). */
export type ZurWerkstatt = (s: { folgeId?: string; medien: string[]; titel: string; ziel: 'reel' | 'bild' }) => void;

const WEG_FARBE: Record<AutonomieErgebnis['weg'], string> = { selbst: LEUCHT.gut, bereit: LEUCHT.gut, stapel: LEUCHT.achtung, gesperrt: LEUCHT.kritisch };
const WEG_TEXT: Record<AutonomieErgebnis['weg'], string> = { selbst: 'würde selbst posten', bereit: 'freigegeben', stapel: 'Freigabe-Stapel', gesperrt: 'gesperrt' };
const BEFUND_ART: Record<Befund['stufe'], 'kritisch' | 'achtung' | 'info'> = { stopp: 'kritisch', mensch: 'achtung', hinweis: 'info' };
const STATUS_FARBE: Record<FolgeStatus, string> = { idee: C.inkLeise, entwurf: C.inkDim, freigegeben: C.aktiv, geplant: C.aktiv, veroeffentlicht: LEUCHT.gut, verworfen: C.inkLeise };

type Filter = 'offen' | 'veroeffentlicht' | 'alle';

export function Folgen({ api, kanal, zurWerkstatt, start }: { api: SocialApi; kanal: MitStand<SocialKanal>; zurWerkstatt?: ZurWerkstatt; start?: string | null }) {
  const lage = api.lage!;
  const [offen, setOffen] = useState<string | 'neu' | null>(start ?? null);
  const [filter, setFilter] = useState<Filter>('offen');
  const folgen = useMemo(() => lage.datei.folgen.filter(f => f.kanalId === kanal.id)
    .filter(f => filter === 'alle' || (filter === 'veroeffentlicht' ? f.status === 'veroeffentlicht' : f.status !== 'veroeffentlicht' && f.status !== 'verworfen'))
    .sort((a, b) => (b.geaendert ?? '').localeCompare(a.geaendert ?? '')), [lage, kanal.id, filter]);
  const auf = offen && offen !== 'neu' ? lage.datei.folgen.find(f => f.id === offen) : undefined;

  if (offen) return <FolgeEditor api={api} kanal={kanal} folge={auf} onZu={() => setOffen(null)} zurWerkstatt={zurWerkstatt} />;
  return (
    <Karte>
      <Ueberschrift rechts={<Knopf onClick={() => setOffen('neu')}>+ Folge</Knopf>}>Folgen</Ueberschrift>
      <Pillen liste={[{ id: 'offen', label: 'In Arbeit' }, { id: 'veroeffentlicht', label: 'Veröffentlicht' }, { id: 'alle', label: 'Alle' }]} aktiv={filter} onWahl={(f: Filter) => setFilter(f)} />
      {folgen.length === 0
        ? <Leerzustand symbol="▶" titel="Noch keine Folgen" aktion={<Knopf onClick={() => setOffen('neu')}>Erste Folge anlegen</Knopf>}>Eine Folge ist ein Video: Skript, Hook-Varianten, Quellen — der Prüfer sagt, ob es raus darf.</Leerzustand>
        : <Liste>{folgen.map(f => {
          const l = lage.folgen[f.id];
          const stopps = l?.befunde.filter(b => b.stufe !== 'hinweis').length ?? 0;
          return (
            <Zeile key={f.id} onClick={() => setOffen(f.id)} titel={f.titel}
              unter={<span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Chip farbe={STATUS_FARBE[f.status]}>{FOLGE_STATUS_NAME[f.status]}</Chip>
                {l && f.status !== 'veroeffentlicht' && f.status !== 'verworfen' && <Chip farbe={WEG_FARBE[l.weg.weg]}>{WEG_TEXT[l.weg.weg]}</Chip>}
                {stopps > 0 && <Chip farbe={LEUCHT.achtung}>{stopps} Befund{stopps === 1 ? '' : 'e'}</Chip>}
                {f.saeule && <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>{f.saeule}</span>}
              </span>}
              rechts={f.messungen.length ? <span style={{ color: C.inkDim, fontSize: TYP.bedien }}>{f.messungen.length} Messung{f.messungen.length === 1 ? '' : 'en'}</span> : undefined} />
          );
        })}</Liste>}
    </Karte>
  );
}

function FolgeEditor({ api, kanal, folge, onZu, zurWerkstatt }: { api: SocialApi; kanal: MitStand<SocialKanal>; folge?: MitStand<SocialFolge>; onZu: () => void; zurWerkstatt?: ZurWerkstatt }) {
  const lage = api.lage!;
  const formate = lage.datei.formate.filter(f => f.kanalId === kanal.id);
  const [titel, setTitel] = useState(folge?.titel ?? '');
  const [formatId, setFormatId] = useState(folge?.formatId ?? '');
  const [saeule, setSaeule] = useState(folge?.saeule ?? '');
  const [skript, setSkript] = useState(folge?.skript ?? '');
  const [hooks, setHooks] = useState<{ id?: string; text: string; bildschirm: string }[]>(() => {
    const h: { id?: string; text: string; bildschirm: string }[] = (folge?.hooks ?? []).map(x => ({ id: x.id, text: x.text, bildschirm: x.bildschirm ?? '' }));
    while (h.length < 3) h.push({ text: '', bildschirm: '' });
    return h;
  });
  const [hookId, setHookId] = useState(folge?.hookId ?? '');
  const [cta, setCta] = useState(folge?.cta ?? kanal.marke.cta ?? '');
  const [quellen, setQuellen] = useState((folge?.quellen ?? []).join('\n'));
  const [kiInhalt, setKiInhalt] = useState(folge?.kiInhalt ?? true);
  const [personenImBild, setPersonenImBild] = useState<PersonenImBild>(folge?.personenImBild ?? 'keine');
  const [werbung, setWerbung] = useState(folge?.werbung === true);
  const [status, setStatus] = useState<FolgeStatus>(folge?.status ?? 'entwurf');
  const [medien, setMedien] = useState<string[]>(folge?.medien ?? []);
  const [beschriftung, setBeschriftung] = useState(folge?.beschriftung ?? '');
  const befunde = folge ? lage.folgen[folge.id]?.befunde ?? [] : [];
  const weg = folge ? lage.folgen[folge.id]?.weg : undefined;

  const speichern = async () => {
    const eintrag = {
      ...(folge ? { id: folge.id } : { kanalId: kanal.id }), titel, formatId: formatId || undefined, saeule, skript,
      hooks: hooks.filter(h => h.text.trim()).map(h => ({ ...(h.id ? { id: h.id } : {}), text: h.text, bildschirm: h.bildschirm })),
      hookId: hookId || undefined, cta, quellen: quellen.split('\n').map(q => q.trim()).filter(Boolean), kiInhalt, status,
      personenImBild: personenImBild === 'keine' ? undefined : personenImBild, werbung, medien, beschriftung: beschriftung.trim() || undefined,
    };
    if (await api.schreiben([{ op: 'folge', eintrag, ...(folge ? { stand: folge.stand } : {}) }]) && !folge) onZu();
  };

  return (
    <>
      <Karte>
        <form onSubmit={e => { e.preventDefault(); void speichern(); }} style={{ display: 'grid', gap: 12 }}>
          <Ueberschrift rechts={<Knopf leise onClick={onZu}>← Folgen</Knopf>}>{folge ? folge.titel : 'Neue Folge'}</Ueberschrift>
          {weg && <Hinweis art={weg.weg === 'selbst' || weg.weg === 'bereit' ? 'gut' : weg.weg === 'stapel' ? 'achtung' : 'kritisch'} titel={WEG_TEXT[weg.weg]}>{weg.grund}</Hinweis>}
          {folge?.freigegebenAm && <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>Freigegeben {folge.freigegebenVon === lage.ich ? 'von dir' : 'von einer Person des Haushalts'} am {datumKurz(tagVon(folge.freigegebenAm))} — jede Änderung am Inhalt nimmt die Freigabe zurück.</span>}
          <Feldzeile label="Titel"><input style={eingabe} value={titel} onChange={e => setTitel(e.target.value)} required maxLength={300} /></Feldzeile>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))' }}>
            <Feldzeile label="Format">
              <select style={feld} value={formatId} onChange={e => setFormatId(e.target.value)}>
                <option value="">ohne Format</option>
                {formate.map(f => <option key={f.id} value={f.id}>{f.name}{f.freigegebenAm ? ' ✓' : ''}</option>)}
              </select>
            </Feldzeile>
            <Feldzeile label="Säule">
              <input style={eingabe} value={saeule} onChange={e => setSaeule(e.target.value)} list={`saeulen-${kanal.id}`} maxLength={60} />
              <datalist id={`saeulen-${kanal.id}`}>{kanal.marke.saeulen.map(s => <option key={s} value={s} />)}</datalist>
            </Feldzeile>
            <Feldzeile label="Status">
              <select style={feld} value={status} onChange={e => setStatus(e.target.value as FolgeStatus)}>
                {FOLGE_STATUS.map(s => <option key={s} value={s}>{FOLGE_STATUS_NAME[s]}</option>)}
              </select>
            </Feldzeile>
          </div>
          {hooks.map((h, i) => (
            <div key={i} style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', alignItems: 'end' }}>
              <Feldzeile label={`Hook ${String.fromCharCode(65 + i)} — gesprochen`}><input style={eingabe} value={h.text} onChange={e => setHooks(l => l.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} maxLength={300} /></Feldzeile>
              <Feldzeile label="Bildschirmtext"><input style={eingabe} value={h.bildschirm} onChange={e => setHooks(l => l.map((x, j) => (j === i ? { ...x, bildschirm: e.target.value } : x)))} maxLength={120} /></Feldzeile>
              {h.id && <label style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 44, color: C.inkDim, fontSize: TYP.bedien }}>
                <input type="radio" name="hook" checked={hookId === h.id} onChange={() => setHookId(h.id!)} /> diesen Hook nehmen
              </label>}
            </div>
          ))}
          <Feldzeile label="Skript (gesprochen)"><textarea style={{ ...feld, minHeight: 180, fontSize: 16 }} value={skript} onChange={e => setSkript(e.target.value)} maxLength={12000} /></Feldzeile>
          <FolgeMedien medien={medien} setMedien={setMedien} info={lage.medien ?? {}} onGeaendert={() => void api.laden()}
            onWerkstatt={zurWerkstatt && folge ? () => zurWerkstatt({ folgeId: folge.id, medien, titel: titel || folge.titel, ziel: formate.find(f => f.id === formatId)?.art === 'bild' ? 'bild' : 'reel' }) : undefined} />
          {(formate.find(f => f.id === formatId)?.art ?? 'video') !== 'text' && (
            <Feldzeile label={`Beschriftung (Text unter dem Beitrag, mit Hashtags) · ${beschriftung.length}/2200 · ${(beschriftung.match(/#[\p{L}\p{N}_]+/gu) ?? []).length}/30 #`}>
              <textarea style={{ ...feld, minHeight: 96, fontSize: 16 }} value={beschriftung} onChange={e => setBeschriftung(e.target.value)} maxLength={2200} placeholder="Ein bis drei Sätze, Aufruf, dann Hashtags — leer = Skript + Aufruf" />
            </Feldzeile>
          )}
          <Feldzeile label="Aufruf am Ende (CTA)"><input style={eingabe} value={cta} onChange={e => setCta(e.target.value)} maxLength={300} /></Feldzeile>
          <Feldzeile label="Quellen (eine je Zeile)"><textarea style={{ ...feld, minHeight: 72 }} value={quellen} onChange={e => setQuellen(e.target.value)} /></Feldzeile>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44 }}>
            <input type="checkbox" checked={kiInhalt} onChange={e => setKiInhalt(e.target.checked)} /> Bild oder Stimme von einer KI (Plattform-Label setzen)
          </label>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44 }}>
            <input type="checkbox" checked={werbung} onChange={e => setWerbung(e.target.checked)} /> Werbung oder Kooperation mit Gegenleistung (kennzeichnen)
          </label>
          <Feldzeile label="Erkennbare Personen im Bild">
            <select style={feld} value={personenImBild} onChange={e => setPersonenImBild(e.target.value as PersonenImBild)}>
              <option value="keine">keine</option>
              <option value="offen">ja — Einwilligung fehlt noch</option>
              <option value="einwilligung">ja — Einwilligung liegt vor</option>
            </select>
          </Feldzeile>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><Knopf haupt typ="submit">Speichern</Knopf></div>
        </form>
      </Karte>
      {befunde.length > 0 && (
        <Karte>
          <Ueberschrift>Prüfung</Ueberschrift>
          <div style={{ display: 'grid', gap: 8 }}>{befunde.map((b, i) => <Hinweis key={i} art={BEFUND_ART[b.stufe]}>{b.text}</Hinweis>)}</div>
        </Karte>
      )}
      {folge && <Veroeffentlichen api={api} kanal={kanal} folge={folge} />}
      {folge && <MessungEintragen api={api} kanal={kanal} folge={folge} />}
    </>
  );
}

function PlattformWahl({ kanal, wert, onWert }: { kanal: SocialKanal; wert: SocialPlattform; onWert: (p: SocialPlattform) => void }) {
  return (
    <select style={feld} value={wert} onChange={e => onWert(e.target.value as SocialPlattform)}>
      {(kanal.plattformen.length ? kanal.plattformen : SOCIAL_PLATTFORMEN).map(p => <option key={p} value={p}>{PLATTFORM_NAME[p]}</option>)}
    </select>
  );
}

function Veroeffentlichen({ api, kanal, folge }: { api: SocialApi; kanal: SocialKanal; folge: SocialFolge }) {
  const [plattform, setPlattform] = useState<SocialPlattform>(kanal.plattformen[0] ?? 'tiktok');
  const [am, setAm] = useState(api.lage!.heute);
  const [link, setLink] = useState('');
  return (
    <Karte>
      <form onSubmit={async e => { e.preventDefault(); if (await api.schreiben([{ op: 'veroeffentlicht', folgeId: folge.id, plattform, am, link: link || undefined }])) setLink(''); }} style={{ display: 'grid', gap: 12 }}>
        <Ueberschrift>Veröffentlicht</Ueberschrift>
        {folge.veroeffentlicht.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{folge.veroeffentlicht.map(v => <Chip key={v.plattform} farbe={LEUCHT.gut}>{PLATTFORM_NAME[v.plattform]} · {v.am}</Chip>)}</div>}
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 180px), 1fr))' }}>
          <Feldzeile label="Plattform"><PlattformWahl kanal={kanal} wert={plattform} onWert={setPlattform} /></Feldzeile>
          <Feldzeile label="Tag"><input type="date" style={eingabe} value={am} onChange={e => setAm(e.target.value)} required /></Feldzeile>
          <Feldzeile label="Link (https)"><input style={eingabe} value={link} onChange={e => setLink(e.target.value)} inputMode="url" /></Feldzeile>
        </div>
        <div><Knopf typ="submit">Veröffentlichung eintragen</Knopf></div>
      </form>
    </Karte>
  );
}

const MESS_FELDER = [
  ['views', 'Aufrufe'], ['halte3s', 'Nach 3 s noch da (%)'], ['durchsehen', 'Bis zum Ende (%)'], ['schnittSek', 'Ø Sekunden'],
  ['likes', 'Likes'], ['kommentare', 'Kommentare'], ['shares', 'Shares'], ['saves', 'Gespeichert'], ['follows', 'Neue Follower'],
] as const;

function MessungEintragen({ api, kanal, folge }: { api: SocialApi; kanal: SocialKanal; folge: SocialFolge }) {
  const [plattform, setPlattform] = useState<SocialPlattform>(folge.veroeffentlicht[0]?.plattform ?? kanal.plattformen[0] ?? 'tiktok');
  const [am, setAm] = useState(api.lage!.heute);
  const [werte, setWerte] = useState<Record<string, string>>({});
  const [hookId, setHookId] = useState(folge.hookId ?? '');
  const speichern = async () => {
    const messung: Record<string, unknown> = { plattform, am, quelle: 'hand', hookId: hookId || undefined };
    for (const [k] of MESS_FELDER) if (werte[k]?.trim()) messung[k] = Number(werte[k].replace(',', '.'));
    if (await api.schreiben([{ op: 'messung', folgeId: folge.id, messung }])) setWerte({});
  };
  return (
    <Karte>
      <form onSubmit={e => { e.preventDefault(); void speichern(); }} style={{ display: 'grid', gap: 12 }}>
        <Ueberschrift>Messung eintragen</Ueberschrift>
        <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>Die Zahlen aus den Insights der Plattform abschreiben — die jüngste Messung je Plattform zählt.</span>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 160px), 1fr))' }}>
          <Feldzeile label="Plattform"><PlattformWahl kanal={kanal} wert={plattform} onWert={setPlattform} /></Feldzeile>
          <Feldzeile label="Stand vom"><input type="date" style={eingabe} value={am} onChange={e => setAm(e.target.value)} required /></Feldzeile>
          {MESS_FELDER.map(([k, label]) => (
            <Feldzeile key={k} label={label}><input style={eingabe} inputMode="decimal" value={werte[k] ?? ''} onChange={e => setWerte(w => ({ ...w, [k]: e.target.value }))} required={k === 'views'} /></Feldzeile>
          ))}
          {folge.hooks.length > 1 && <Feldzeile label="Welcher Hook lief">
            <select style={feld} value={hookId} onChange={e => setHookId(e.target.value)}>
              <option value="">—</option>
              {folge.hooks.map((h, i) => <option key={h.id} value={h.id}>{String.fromCharCode(65 + i)}: {h.text.slice(0, 40)}</option>)}
            </select>
          </Feldzeile>}
        </div>
        <div><Knopf typ="submit">Messung speichern</Knopf></div>
      </form>
      {folge.messungen.length > 0 && (
        <div style={{ marginTop: 12, display: 'grid', gap: 4, color: C.inkDim, fontSize: TYP.bedien }}>
          {[...folge.messungen].sort((a, b) => b.am.localeCompare(a.am)).slice(0, 8).map(m => (
            <span key={m.id}>{m.am} · {PLATTFORM_NAME[m.plattform]} · {m.views.toLocaleString('de-DE')} Aufrufe{m.halte3s !== undefined ? ` · ${m.halte3s} % nach 3 s` : ''}{m.quelle === 'import' ? ' · Import' : ''}</span>
          ))}
        </div>
      )}
    </Karte>
  );
}

