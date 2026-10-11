'use client';

// ─── MAKE OS — Fokus-Tafel: Unser Fokus · Mein Fokus · geteilt, je Bereich und Horizont (09.10.) ───────────────────────────────
// Kevin 09.10. spät: „Bau die Fokus-Seite auch nochmal ein wenig um, dass wir selber alle immer Fokusse einstellen können — sonst macht das
// ja alles keinen Sinn. Muss ja auch wieder individuell sein.“ EIN Bauteil für die Fokus-Seite (alle Horizonte) und die Planung (ein Horizont):
//   · Bereich Privat · Business (Konto „nur Business“: nur Business), im Business je Gesellschaft (Gesamt + die Business-Gesellschaften).
//   · je Horizont: „Unser Fokus“ (gemeinsam, nur volle Mitglieder ändern) und „Mein Fokus“ (nur ich, optional „mit <Name> teilen“);
//     darunter, was die andere Person mit mir teilt (der Server schickt nur das).
// Ein Feld, Enter oder Verlassen speichert (Stand/409 — die neue Fassung kommt, die Eingabe bleibt). Lesen/Schreiben NUR über useFokus.
// 11.10. (Kevin: „sehr unübersichtlich“): mit mehreren Horizonten steht ein Horizont ohne jeden Satz als EINE Zeile da (Frage + „Fokus
// eintragen“); erst der Klick zeigt die beiden Felder. Gesetzte Horizonte stehen wie bisher — statt zehn leerer Felder untereinander.

import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { FOKUS_FRAGE, FOKUS_HORIZONTE, FOKUS_LABEL, type FokusBereich, type FokusHorizont, type FokusWessen } from '@/lib/planung/fokus';
import { useFokus } from '@/lib/planung/fokus-client';
import { Erklaert, Hinweis, Knopf, Pillen, Schalter, Segmente, feld, LEUCHT } from '../ui';
import { useNurBusiness } from '../useInhaber';

/** Ein Feld: lokaler Entwurf, Enter/Verlassen speichert; bei Fehler bleibt der Entwurf stehen. */
export function FokusFeld({ wert, label, platzhalter, aus, gross, onSpeichern }: {
  wert: string; label: string; platzhalter: string; aus?: boolean; gross?: boolean; onSpeichern: (text: string) => Promise<{ ok: boolean; meldung?: string }>;
}) {
  const [entwurf, setEntwurf] = useState(wert);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [gespeichert, setGespeichert] = useState(false);
  useEffect(() => { setEntwurf(wert); }, [wert]);
  const speichern = async () => {
    const t = entwurf.trim();
    if (t === wert.trim()) return;
    const r = await onSpeichern(t);
    if (r.ok) { setMeldung(null); setGespeichert(true); setTimeout(() => setGespeichert(false), 1800); } else setMeldung(r.meldung ?? 'Nicht gespeichert.');
  };
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <input value={entwurf} disabled={aus} aria-label={label} placeholder={platzhalter}
        onChange={e => setEntwurf(e.target.value)} onBlur={() => void speichern()} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEntwurf(wert); }}
        style={{ ...feld, fontWeight: gross ? 600 : 400, opacity: aus ? 0.7 : 1 }} />
      {gespeichert && <span role="status" style={{ fontSize: TYP.bedien, color: LEUCHT.gut }}>gespeichert</span>}
      {meldung && <Hinweis art="achtung" rolle="status">{meldung}</Hinweis>}
    </div>
  );
}

export interface FokusTafelProps {
  /** Fester Bereich (Planung im Privat- bzw. Business-Filter) — sonst wählbar, Vorgabe `vorgabe`. */
  bereich?: FokusBereich;
  vorgabe?: FokusBereich;
  /** Welche Horizonte (Standard: alle, vom Jahr zum Tag). */
  horizonte?: readonly FokusHorizont[];
  /** Planungsjahr (nur für den Jahres-Fokus). */
  jahr?: number;
}

export function FokusTafel({ bereich: fest, vorgabe = 'privat', horizonte = FOKUS_HORIZONTE, jahr }: FokusTafelProps) {
  const nurBusiness = useNurBusiness();
  const [wahl, setWahl] = useState<FokusBereich>(vorgabe);
  useEffect(() => { setWahl(vorgabe); }, [vorgabe]);
  const bereich: FokusBereich = fest ?? (nurBusiness ? 'business' : wahl);
  const [einheit, setEinheit] = useState<string>('gesamt');
  const { sicht, fehler, schreiben } = useFokus(nurBusiness === null && !fest ? null : bereich, { ...(bereich === 'business' ? { einheit } : {}), ...(jahr ? { jahr } : {}) });
  const partnerNamen = (sicht?.partner ?? []).map(p => p.vorname).join(' und ');

  const setzen = (wessen: FokusWessen, h: FokusHorizont) => async (text: string) => schreiben(wessen, h, { text });
  const [offen, setOffen] = useState<readonly FokusHorizont[]>([]);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {(!fest && !nurBusiness) || (bereich === 'business' && (sicht?.einheiten.length ?? 0) > 1) ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {!fest && !nurBusiness && <Segmente liste={[{ id: 'privat' as const, label: 'Privat' }, { id: 'business' as const, label: 'Business' }]} aktiv={bereich} onWahl={setWahl} />}
          {bereich === 'business' && sicht && sicht.einheiten.length > 1 && (
            <Pillen liste={sicht.einheiten.map(e => ({ id: e.id, label: e.name }))} aktiv={einheit} onWahl={setEinheit} />
          )}
        </div>
      ) : null}
      {fehler && <Hinweis art="achtung" rolle="status">{fehler}</Hinweis>}
      {sicht && horizonte.map(h => {
        const v = sicht.horizonte[h];
        const leer = !v.unser.text.trim() && !v.mein.text.trim() && !v.partner.length;
        if (horizonte.length > 1 && leer && !offen.includes(h)) return (
          <section key={h} aria-label={`Fokus ${FOKUS_LABEL[h]}`} style={{ display: 'flex', gap: '4px 12px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <span style={{ display: 'grid', gap: 2, minWidth: 0, flex: '1 1 220px' }}>
              <span style={{ fontSize: TYP.mikro, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 600 }}>{h === 'jahr' ? `${FOKUS_LABEL[h]} ${sicht.jahr}` : FOKUS_LABEL[h]}</span>
              <span style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.4 }}>{FOKUS_FRAGE[h]}</span>
            </span>
            <Knopf leise onClick={() => setOffen(o => [...o, h])}>Fokus eintragen</Knopf>
          </section>
        );
        return (
          <section key={h} aria-label={`Fokus ${FOKUS_LABEL[h]}`} style={{ display: 'grid', gap: 8 }}>
            {horizonte.length > 1 && <div style={{ fontSize: TYP.mikro, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 600 }}>{h === 'jahr' ? `${FOKUS_LABEL[h]} ${sicht.jahr}` : FOKUS_LABEL[h]}</div>}
            <span style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.4 }}>{FOKUS_FRAGE[h]}</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 10 }}>
              <div style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: TYP.bedien, color: LEUCHT.planung, fontWeight: 600 }}>Unser Fokus{bereich === 'business' && sicht.einheit !== 'gesamt' ? ` · ${sicht.einheiten.find(e => e.id === sicht.einheit)?.name ?? ''}` : ''}{v.unser.quelle === 'alt' ? <span style={{ color: C.inkLeise, fontWeight: 400 }}> · bisheriger Satz</span> : null}</span>
                <FokusFeld wert={v.unser.text} label={`Unser Fokus ${FOKUS_LABEL[h]}`} platzhalter={sicht.darfUnser ? 'gemeinsam eintragen …' : 'noch keiner gesetzt'} aus={!sicht.darfUnser} gross={h === 'tag'} onSpeichern={setzen('unser', h)} />
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: TYP.bedien, color: LEUCHT.schlaf, fontWeight: 600 }}>
                  Mein Fokus
                  {sicht.partner.length > 0 && (
                    <Erklaert erklaerung="fokus.teilen" name="Mein Fokus teilen"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 400, color: v.mein.geteilt ? LEUCHT.schlaf : C.inkLeise }}>
                      <Schalter erklaerungOhne="Teilen-Schalter im Satz „Mein Fokus“ — das „i“ um den ganzen Satz erklärt das Teilen" an={v.mein.geteilt} onChange={an => { void schreiben('mein', h, { geteilt: an }); }} farbe={LEUCHT.schlaf} ariaLabel={`Mein Fokus ${FOKUS_LABEL[h]} mit ${partnerNamen} teilen`} />
                      {v.mein.geteilt ? `geteilt mit ${partnerNamen}` : 'nur ich'}
                    </span></Erklaert>
                  )}
                </span>
                <FokusFeld wert={v.mein.text} label={`Mein Fokus ${FOKUS_LABEL[h]}`} platzhalter="nur für dich …" gross={h === 'tag'} onSpeichern={setzen('mein', h)} />
              </div>
            </div>
            {v.partner.map(p => (
              <div key={p.speicher} style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.45 }}>
                <span style={{ color: LEUCHT.beziehung, fontWeight: 600 }}>{p.vorname}:</span> {p.text}
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
