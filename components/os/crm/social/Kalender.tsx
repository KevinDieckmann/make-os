'use client';

// ─── Markttraktion · Social › Kalender (28.10.2026, Malin-Paket) ───────────────────────────────────────────────────────────────────────
// Was wann rausgeht — Woche oder Monat: Beiträge mit Termin (Farbe = Zustand wie in der Automatik), freie Plätze des Redaktionsplans (die der
// Agent als Nächstes füllt) und „ohne Termin“ zum Einplanen. Umplanen: am Rechner ziehen und auf einen Tag fallen lassen, am Handy antippen und
// Tag/Uhrzeit wählen. Rechnen nur in lib/social/kalender.ts; geschrieben wird eine normale Änderung der Folge (mit Stand).

import { useMemo, useState } from 'react';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Hinweis, Feldzeile, eingabe, Pillen } from '../../ui';
import { kalenderTage, kalenderEintraege, ohneTermin, type KalenderAnsicht, type KalenderEintrag } from '@/lib/social/kalender';
import { tagPlus } from '@/lib/zeit/kalender-kern';
import { planVon } from '@/lib/social/plan';
import type { SocialKanal } from '@/lib/social/typen';
import type { MitStand, SocialApi } from './daten';

const TON: Record<KalenderEintrag['ton'], { farbe: string; text: string }> = {
  online: { farbe: LEUCHT.gut, text: 'online' }, automatisch: { farbe: C.aktiv, text: 'geht automatisch raus' }, wartet: { farbe: LEUCHT.achtung, text: 'wartet auf euch' },
  problem: { farbe: LEUCHT.kritisch, text: 'Problem' }, entwurf: { farbe: C.inkDim, text: 'Entwurf' }, frei: { farbe: C.inkLeise, text: 'frei' },
};
const WT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const kurz = (tag: string) => `${tag.slice(8, 10)}.${tag.slice(5, 7)}.`;
const ZIEH = 'application/x-make-social-folge';

export function Kalender({ api, kanal, oeffnen }: { api: SocialApi; kanal: MitStand<SocialKanal>; oeffnen: (folgeId: string) => void }) {
  const lage = api.lage!;
  const [ansicht, setAnsicht] = useState<KalenderAnsicht>('woche');
  const [bezug, setBezug] = useState(lage.heute);
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const tage = useMemo(() => kalenderTage(ansicht, bezug), [ansicht, bezug]);
  const eintraege = useMemo(() => kalenderEintraege(kanal, lage.datei.folgen, lage.automatik.luecken[kanal.id] ?? [], lage.automatik.folgen, tage), [kanal, lage, tage]);
  const offen = useMemo(() => ohneTermin(kanal.id, lage.datei.folgen), [kanal.id, lage]);
  const folge = gewaehlt ? lage.datei.folgen.find(f => f.id === gewaehlt) : undefined;
  const uhr = planVon(kanal).uhrzeit;

  const umplanen = async (id: string, tag: string | null, um?: string) => {
    const f = lage.datei.folgen.find(x => x.id === id);
    if (!f) return;
    await api.schreiben([{ op: 'folge', eintrag: { id, geplantAm: tag ?? null, geplantUm: tag ? (um ?? f.geplantUm ?? null) : null, ...(tag && (f.status === 'idee') ? { status: 'entwurf' } : {}) }, stand: f.stand }]);
  };
  const neuAm = async (tag: string, um: string) => {
    const neu = await api.schreiben([{ op: 'folge', eintrag: { kanalId: kanal.id, titel: 'Neuer Beitrag', skript: '', hooks: [], status: 'entwurf', geplantAm: tag, geplantUm: um } }]);
    const id = neu?.geaendert?.[0];
    if (id) oeffnen(id);
  };
  const schritt = ansicht === 'woche' ? 7 : 30;
  const monatName = new Date(`${bezug.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  return (
    <>
      <Karte>
        <Ueberschrift rechts={<span style={{ display: 'flex', gap: 6 }}>
          <Knopf leise onClick={() => setBezug(tagPlus(bezug, -schritt))} ariaLabel="zurück">◀</Knopf>
          <Knopf leise onClick={() => setBezug(lage.heute)}>Heute</Knopf>
          <Knopf leise onClick={() => setBezug(tagPlus(bezug, schritt))} ariaLabel="vor">▶</Knopf>
        </span>}>{ansicht === 'woche' ? `Woche ab ${kurz(tage[0])}` : monatName}</Ueberschrift>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <Pillen liste={[{ id: 'woche', label: 'Woche' }, { id: 'monat', label: 'Monat' }]} aktiv={ansicht} onWahl={(a: KalenderAnsicht) => setAnsicht(a)} />
          <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{(['automatisch', 'wartet', 'online', 'problem', 'frei'] as const).map(t => <Chip key={t} farbe={TON[t].farbe}>{TON[t].text}</Chip>)}</span>
        </div>
        <div className={ansicht === 'woche' ? 'social-kal-woche' : 'social-kal-monat'} style={{ display: 'grid', gap: 6, gridTemplateColumns: ansicht === 'woche' ? 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))' : 'repeat(7, minmax(0, 1fr))' }}>
          {ansicht === 'monat' && WT.map(w => <span key={w} style={{ fontSize: TYP.bedien, color: C.inkLeise, textAlign: 'center' }}>{w}</span>)}
          {tage.map((t, i) => {
            const l = eintraege.get(t) ?? [];
            const fremd = ansicht === 'monat' && t.slice(0, 7) !== bezug.slice(0, 7);
            return (
              <div key={t}
                onDragOver={e => { if (e.dataTransfer.types.includes(ZIEH)) e.preventDefault(); }}
                onDrop={e => { const id = e.dataTransfer.getData(ZIEH); if (id) { e.preventDefault(); void umplanen(id, t); } }}
                style={{ minHeight: ansicht === 'woche' ? 120 : 72, borderRadius: 12, padding: 6, background: t === lage.heute ? `${C.aktiv}14` : C.flaeche, opacity: fremd ? 0.5 : 1, display: 'grid', alignContent: 'start', gap: 4, minWidth: 0 }}>
                <span style={{ fontSize: TYP.bedien, color: t === lage.heute ? C.aktiv : C.inkDim, fontWeight: 600 }}>{ansicht === 'woche' ? `${WT[i]} ${kurz(t)}` : Number(t.slice(8, 10))}</span>
                {l.map(e => (
                  <button key={`${e.art}-${e.id}`} type="button" draggable={e.art === 'folge'}
                    onDragStart={x => { if (e.art === 'folge') x.dataTransfer.setData(ZIEH, e.id); }}
                    onClick={() => (e.art === 'folge' ? setGewaehlt(e.id) : void neuAm(e.tag, e.uhrzeit))}
                    title={e.art === 'platz' ? 'Freier Platz — der Agent füllt ihn; tippen = selbst einen Beitrag anlegen' : `${e.titel} · ${TON[e.ton].text}`}
                    style={{ textAlign: 'left', minHeight: 32, padding: '4px 6px', borderRadius: 8, cursor: 'pointer', fontSize: TYP.bedien, color: C.ink, minWidth: 0,
                      background: e.art === 'platz' ? 'transparent' : `${TON[e.ton].farbe}22`, border: e.art === 'platz' ? `1px dashed ${C.inkLeise}` : `1px solid ${TON[e.ton].farbe}66`,
                      outline: gewaehlt === e.id ? `2px solid ${C.aktiv}` : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ color: TON[e.ton].farbe }}>{e.uhrzeit}</span> {ansicht === 'woche' || e.art === 'folge' ? e.titel : '+'}{e.medien ? ' ▣' : ''}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
        <p style={{ color: C.inkLeise, fontSize: TYP.bedien, margin: '12px 0 0' }}>Gestrichelt = freier Platz im Plan (der Agent füllt ihn, wenn er an ist — tippen legt selbst einen Beitrag an). Am Rechner Beiträge auf einen anderen Tag ziehen, am Handy antippen.</p>
      </Karte>

      {folge && (
        <Karte>
          <form onSubmit={async e => { e.preventDefault(); const d = new FormData(e.currentTarget); await umplanen(folge.id, String(d.get('tag') || '') || null, String(d.get('um') || '') || undefined); setGewaehlt(null); }} style={{ display: 'grid', gap: 12 }}>
            <Ueberschrift rechts={<Knopf leise onClick={() => setGewaehlt(null)}>Schließen</Knopf>}>{folge.titel}</Ueberschrift>
            {(lage.automatik.folgen[folge.id] ?? []).map(s => <Hinweis key={s.plattform} art={s.zustand === 'online' || s.zustand === 'geplant' || s.zustand === 'faellig' ? 'gut' : s.zustand === 'fehler' || s.zustand === 'unklar' || s.zustand === 'verpasst' ? 'kritisch' : 'info'}>{s.grund}</Hinweis>)}
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 160px), 1fr))' }}>
              <Feldzeile label="Tag"><input name="tag" type="date" style={eingabe} defaultValue={folge.geplantAm ?? ''} /></Feldzeile>
              <Feldzeile label={`Uhrzeit (leer = ${uhr} aus dem Plan)`}><input name="um" type="time" style={eingabe} defaultValue={folge.geplantUm ?? ''} /></Feldzeile>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Knopf haupt typ="submit">Umplanen</Knopf>
              <Knopf onClick={() => oeffnen(folge.id)}>Beitrag öffnen</Knopf>
              {folge.geplantAm && folge.status !== 'veroeffentlicht' && <Knopf leise onClick={async () => { await umplanen(folge.id, null); setGewaehlt(null); }}>Termin entfernen</Knopf>}
            </div>
          </form>
        </Karte>
      )}

      {offen.length > 0 && (
        <Karte>
          <Ueberschrift>Ohne Termin ({offen.length})</Ueberschrift>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {offen.slice(0, 30).map(f => (
              <button key={f.id} type="button" draggable onDragStart={x => x.dataTransfer.setData(ZIEH, f.id)} onClick={() => setGewaehlt(f.id)}
                style={{ minHeight: 44, padding: '6px 10px', borderRadius: 10, border: `1px solid ${C.inkLeise}55`, background: C.flaeche, color: C.ink, cursor: 'grab', fontSize: TYP.bedien }}>
                {f.titel}
              </button>
            ))}
          </div>
          <p style={{ color: C.inkLeise, fontSize: TYP.bedien, margin: '10px 0 0' }}>Auf einen Tag ziehen oder antippen und einen Tag wählen.</p>
        </Karte>
      )}
    </>
  );
}
