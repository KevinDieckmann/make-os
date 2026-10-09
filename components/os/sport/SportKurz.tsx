'use client';

// ─── Sport — Kachel auf der Gesundheitsseite: Ziel, Wochen, heute, Ampel ────
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP, SCHRIFT, LEUCHT } from '@/lib/make-one/design';
import { Karte, Chip, Leer } from '../ui';
import type { SportAntwort } from './daten';
import { hauptziel, wochenBis, wochentagVon, wocheIst } from '@/lib/sport/plan';
import { geplanteEinheiten, saison } from '@/lib/sport/plan-bau';
import { montagVon } from '@/lib/sport/pace';
import { ampel, bezugAus, AMPEL_LABEL } from '@/lib/sport/ampel';
import { PLAN_LABEL } from '@/lib/sport/modell';
import { WEG } from '@/lib/wege';

const AMPEL_FARBE = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch, unbekannt: C.inkLeise } as const;

/**
 * Eigene Ansicht: Ziel, Ampel, Woche, Link in den Sport. Fremde Ansicht (09.10.): nur, wenn die Person ihre Gesundheit mit dir teilt
 * (Server-Tor, `?fuer=`), schreibgeschützt und ohne Link in ihre Bearbeitung — sonst nur der Satz.
 */
export function SportKurz({ eigene = true, fuer }: { eigene?: boolean; fuer?: string }) {
  const [d, setD] = useState<SportAntwort | null>(null);
  const [gesperrt, setGesperrt] = useState(false);
  useEffect(() => {
    if (!eigene && !fuer) return;
    setD(null); setGesperrt(false);
    fetch(eigene ? '/api/sport' : `/api/sport?fuer=${encodeURIComponent(fuer!)}`, { cache: 'no-store' }).then(r => r.json()).then(x => { if (x.ok) setD(x); else setGesperrt(true); }).catch(() => setGesperrt(true));
  }, [eigene, fuer]);
  if (!eigene && (!fuer || gesperrt)) return <Karte i={2}><Leer>Sport ist persönlich — jede Person plant ihren eigenen.</Leer></Karte>;
  if (!d) return <Karte i={2}><Leer>…</Leer></Karte>;
  if (!eigene) return <SportFremd d={d} />;
  if (!d.stand.einstieg.fertig) {
    // Ohne Plan zählen die Einheiten trotzdem (09.10.: WHOOP-Trainings vorher unsichtbar).
    const diese = wocheIst(d.stand, montagVon(d.heute)).einheiten;
    return (
      <Karte i={2} akzent={LEUCHT.business}>
        <Link href={WEG.sport(diese ? 'training' : undefined)} style={{ textDecoration: 'none', color: C.ink, display: 'block' }}>
          <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.body }}>{diese ? `Diese Woche ${diese} Einheit${diese === 1 ? '' : 'en'}` : 'Sport einrichten'}</div>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 4, lineHeight: 1.5 }}>{diese ? 'Training ansehen — Ziel und Wochenplan richtest du unter „Ziele & Plan“ ein.' : 'Hyrox, Laufen, Gym, Erholung — Ziel wählen, Datum setzen, Woche planen. Fünf Schritte.'}</div>
          <div style={{ color: C.inkLeise, fontSize: TYP.bedien, marginTop: 8 }}>{diese ? 'Training öffnen ›' : 'Los geht’s ›'}</div>
        </Link>
      </Karte>
    );
  }
  const s = d.stand;
  const ziel = hauptziel(s.ziele, d.heute);
  const geplant = s.woche[wochentagVon(d.heute)].art;
  const a = ampel(s.erholung[d.heute], geplant, bezugAus(s.erholung, d.heute), d.vitals[d.heute]?.recovery);
  const ist = wocheIst(s, montagVon(d.heute));
  const plan = geplanteEinheiten(s, montagVon(d.heute)).length;
  return (
    <Karte i={2} akzent={AMPEL_FARBE[a.stufe]}>
      <Link href={WEG.sport()} style={{ textDecoration: 'none', color: C.ink, display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.body }}>{ziel?.titel ?? 'Sport'}</span>
          {ziel?.datum && <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{wochenBis(d.heute, ziel.datum)} Wochen</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip farbe={AMPEL_FARBE[a.stufe]}>{AMPEL_LABEL[a.stufe]}</Chip>
          <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>heute {PLAN_LABEL[geplant]} · Woche {ist.einheiten} von {plan}</span>
        </div>
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.45 }}>{a.text}</div>
        <div style={{ color: C.inkLeise, fontSize: TYP.bedien }}>Sport öffnen ›</div>
      </Link>
    </Karte>
  );
}

/** Geteilte Ansicht (nur lesen): nächster Wettkampf, Woche erledigt/geplant — keine Werte der Erholung, kein Link in die Bearbeitung. */
function SportFremd({ d }: { d: SportAntwort }) {
  const s = d.stand;
  const ist = wocheIst(s, montagVon(d.heute));
  const plan = geplanteEinheiten(s, montagVon(d.heute)).length;
  const rennen = saison(s.ziele, d.heute)[0];
  return (
    <Karte i={2}>
      <div style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.body }}>{rennen ? rennen.ziel.titel : 'Sport'}</span>
        {rennen && <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>Wettkampf {rennen.text}</span>}
        <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>Diese Woche {ist.einheiten}{plan ? ` von ${plan}` : ''} Einheiten</span>
        <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Geteilt — nur lesen.</span>
      </div>
    </Karte>
  );
}
