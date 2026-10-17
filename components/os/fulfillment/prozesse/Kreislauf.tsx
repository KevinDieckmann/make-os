'use client';

// ─── Fulfillment › Kreislauf — heutiger Sales-Kreislauf und gezeichnete Abläufe (Paket C1, 10.10.; FULFILLMENT_KONZEPT.md 2.6) ──────────
// Der heutige Kreislauf aus Markttraktion › Planung GILT (Entscheidung 22:30); die früheren Vertriebsabläufe sind Wissen — klickbar und gezeichnet
// (Trichter, Fluss mit Weichen, Kreis mit Empfehlungsring, Zeitachse), Ergänzungen gestrichelt, Rückwege als Bögen. Ein Klick auf eine Stufe öffnet ihren Steckbrief,
// „heute“ springt in den heutigen Kreislauf. „Als Paket-Vorlage übernehmen“ kopiert einen Ablauf in eine Paket-Vorlage.
// 12.10. (kundenreif): der heutige Kreislauf als Rad mit den Zahlen der Markttraktion (GET /api/crm/planung) — jede Stufe springt in ihre Ansicht.
// 17.10. (Rückmeldung: „es dupliziert sich“): die Etagen der Landkarte stehen nur noch auf der Landkarte (vorher hier ein zweites Mal als Liste).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FARBE as C, TYP, MIKRO } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Leerzustand, Pillen, Chip, LEUCHT } from '../../ui';
import { WEG } from '@/lib/wege';
import type { KreislaufId } from '@/lib/crm/planung';
import { useUebersicht, vorlagenOps, fehlerText, holeJson } from './daten';
import { KreislaufRad, type RadStufe } from '../reise/teile';
import { KREISLAUF_REIHE, kreislaufWeg } from '@/lib/fulfillment/prozesse/ansichten';
import { AblaufBild, AblaufLegende } from './Zeichnung';
import { klein, Leiste, Meldung } from './teile';

const ART_TEXT: Record<string, string> = { einstieg: 'Einstieg', stufe: 'Stufe', ausstieg: 'Ausstieg', routine: 'Routine' };

/** Die Stufen des heutigen Kreislaufs (Markttraktion › Planung, `GET /api/crm/planung`) — Zahl, Satz, Weg. Ohne Zugang/Fehler: null. */
function useKreislaufStufen(): { stufen: RadStufe[] | null; fehler: string | null } {
  const [stufen, setStufen] = useState<RadStufe[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => {
    let aus = false;
    void holeJson<{ kreislauf?: { stufen?: { id: KreislaufId; label: string; anzahl: number; zusatz: string; href: string }[] } }>('/api/crm/planung').then(a => {
      if (aus) return;
      if (!a.ok) { setFehler(fehlerText(a)); return; }
      setStufen((a.j.kreislauf?.stufen ?? []).map(s => ({ id: s.id, label: s.label, anzahl: s.anzahl, zusatz: s.zusatz,
        // EINE Tabelle (`kreislaufWeg`, 15.10., Abnahme B7): Leads → Qualifizierung, Deals → Deals, Fulfillment → die Kunden in Lieferung …
        href: kreislaufWeg(s.id) })));
    });
    return () => { aus = true; };
  }, []);
  return { stufen, fehler };
}

export function Kreislauf() {
  const router = useRouter();
  const { daten, fehler } = useUebersicht();
  const kreis = useKreislaufStufen();
  const [wahl, setWahl] = useState<string | null>(null);
  const [stufe, setStufe] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; art: 'gut' | 'kritisch' } | null>(null);
  if (!daten) return fehler ? <Hinweis art="kritisch">{fehler}</Hinweis> : <div style={klein}>Lädt …</div>;
  const ablaeufe = daten.prozesse.filter(p => p.art === 'ablauf');
  const aktiv = ablaeufe.find(a => a.id === wahl) ?? ablaeufe[0];
  const st = aktiv && stufe ? aktiv.knoten.find(k => k.id === stufe) : undefined;
  const alsPaket = async () => {
    if (!aktiv) return;
    const a = await vorlagenOps([{ op: 'kopie', id: aktiv.id }]);
    setMeldung(a.ok ? { text: `„${aktiv.titel}“ als Paket-Vorlage angelegt — unter Prozesse bearbeiten und einem Produkt zuordnen.`, art: 'gut' } : { text: fehlerText(a), art: 'kritisch' });
  };
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Karte i={1} ton="fokus" licht={LEUCHT.business}>
        <Ueberschrift farbe={LEUCHT.business} erklaerung="fulfillment.kreislauf" rechts={<Link href={WEG.vertriebsplanung('kreislauf')} style={{ color: C.aktiv, fontSize: TYP.bedien }}>in der Markttraktion ›</Link>}>Der heutige Kreislauf</Ueberschrift>
        {kreis.fehler && <Hinweis art="achtung">Die Zahlen der Markttraktion ließen sich nicht laden ({kreis.fehler}) — die Stufen stehen trotzdem da.</Hinweis>}
        <KreislaufRad stufen={kreis.stufen ?? KREISLAUF_REIHE.map(id => ({ id }))} hier="fulfillment" beschreibung="Der Kreislauf der Markttraktion mit den heutigen Zahlen je Stufe."
          mitte={<span style={{ display: 'grid', gap: 4 }}><span style={MIKRO}>hier liefern wir</span><b style={{ fontSize: TYP.body, color: C.ink }}>{Object.values(daten.faelle).filter(f => f.status !== 'abgeschlossen').length} Kunden</b><span style={klein}>in Lieferung</span></span>}
          onStufe={st => { if (st.href) router.push(st.href); }} />
        <div style={klein}>Es gilt der Kreislauf aus Markttraktion › Planung. Jede Stufe öffnet ihre Ansicht; die Zahl ist der heutige Stand (Kanäle, Leads in Arbeit, offene Deals, fällige Follow-ups, aktive Mandate, Kunden mit offenen Schritten nach der Leistung, Wiederkäufer). Die Abläufe unten sind Wissen aus früheren Prozessen — keine zweite Wahrheit.</div>
      </Karte>
      <Meldung text={meldung?.text ?? null} art={meldung?.art} />
      {!ablaeufe.length ? (
        <Leerzustand symbol="⟲" titel="Noch keine Abläufe">Abläufe kommen per Import unter Bausteine (Datei mit „stufen“ und „uebergaenge“) — sie werden als Trichter, Fluss oder Zeitachse gezeichnet.</Leerzustand>
      ) : (
        <Karte i={2}>
          <Ueberschrift erklaerung="fulfillment.ablaufErgaenzung" rechts={<Knopf leise onClick={alsPaket}>Als Paket-Vorlage übernehmen</Knopf>}>Abläufe</Ueberschrift>
          {ablaeufe.length > 1 && <Pillen<string> liste={ablaeufe.map(a => ({ id: a.id, label: a.titel }))} aktiv={aktiv?.id} onWahl={id => { setWahl(id); setStufe(null); }} />}
          {aktiv && (
            <>
              <AblaufBild vorlage={aktiv} aktiv={stufe ?? undefined} onStufe={setStufe} />
              <AblaufLegende />
              {aktiv.vorbehalt && <Hinweis art="achtung" titel="Vorbehalt">{aktiv.vorbehalt}</Hinweis>}
              {(aktiv.quelleHinweis || aktiv.zeichenhinweise?.length) && <div style={klein}>{[aktiv.quelleHinweis, ...(aktiv.zeichenhinweise ?? [])].filter(Boolean).join(' · ')}</div>}
            </>
          )}
          {st && (
            <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <b style={{ color: C.ink, fontSize: TYP.body }}>{st.titel}</b>
                {st.art && <Chip farbe={LEUCHT.planung}>{ART_TEXT[st.art]}</Chip>}
                {st.beleg === 'ergaenzung' && <Chip farbe={C.inkLeise}>ergänzt (nicht aus der Quelle)</Chip>}
                {st.optional && <Chip farbe={C.inkLeise}>optional</Chip>}
              </div>
              {[['Zweck', st.ziel], ['Rolle', st.rolle], ['Kennzahl', st.kennzahl], ['Ausgang', st.ausgang], ['Begriff der Quelle', st.original], ['Phase', st.dokumentation]].filter(([, w]) => !!w).map(([k, w]) => (
                <div key={k} style={{ display: 'grid', gap: 2 }}><span style={MIKRO}>{k}</span><span style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>{w}</span></div>
              ))}
              {st.heute && <Leiste><Link href={WEG.vertriebsplanung()} style={{ color: C.aktiv, fontSize: TYP.bedien }}>Heute: {st.heute} — im Kreislauf öffnen ›</Link></Leiste>}
            </div>
          )}
        </Karte>
      )}
    </div>
  );
}
