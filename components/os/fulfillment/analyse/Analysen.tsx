'use client';

// ─── Fulfillment › Analysen — alle Dossiers, Kosten, Fristen (C3, 10.10.; FULFILLMENT_KONZEPT.md Abschnitt 10) ─────────────────────────────────
// Je Business-Mandat mit Dossier: Freigaben F1/F2, Stand der Läufe, Kosten, Art.-14-Fristen bald (nur Zahlen, keine Namen); darunter aktive Mandate
// ohne Dossier mit dem Weg „Dossier anlegen“. Liest GET /api/fulfillment/dossier?alle=1.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileSearch } from 'lucide-react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { WEG } from '@/lib/wege';
import { euroText } from '@/lib/ki/kosten';
import type { DossierKurz } from '@/lib/fulfillment/typen';
import { LAUF_LABEL } from '@/lib/fulfillment/analyse/sicht';
import { Karte, Ueberschrift, Zeile, Chip, Hinweis, Leer, Leerzustand, Liste, Kennzahl, Raster, LEUCHT } from '../../ui';

type Eintrag = { mandatId: string; titel: string; kunde: string; status: string } & Partial<DossierKurz>;

export function Analysen() {
  const router = useRouter();
  const [daten, setDaten] = useState<{ dossiers: Eintrag[]; ohneDossier: Eintrag[]; kostenCent: number } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => {
    void fetch('/api/fulfillment/dossier?alle=1', { cache: 'no-store' }).then(r => r.json()).then(j => { if (j.ok) setDaten(j); else setFehler(String(j.fehler ?? 'Nicht geladen.')); }).catch(() => setFehler('Keine Verbindung.'));
  }, []);
  if (fehler) return <Hinweis art="kritisch">{fehler}</Hinweis>;
  if (!daten) return <Leer>Analysen werden geladen …</Leer>;
  const art14 = daten.dossiers.reduce((s, d) => s + (d.art14Bald ?? 0), 0);
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Raster min={160}>
        <Kennzahl label="Dossiers" wert={String(daten.dossiers.length)} />
        <Kennzahl label="Geprüft (F2)" wert={String(daten.dossiers.filter(d => d.f2).length)} />
        <Kennzahl label="Kosten gesamt" wert={euroText(daten.kostenCent)} />
        <Kennzahl label="Art. 14 bald fällig" wert={String(art14)} ton={art14 ? LEUCHT.achtung : undefined} />
      </Raster>
      <Karte>
        <Ueberschrift>Dossiers</Ueberschrift>
        {!daten.dossiers.length && <Leerzustand symbol={<FileSearch size={26} />} titel="Noch keine Dossiers">Ein Dossier legst du im Fall eines Mandats unter „Analyse“ an.</Leerzustand>}
        <Liste>
          {daten.dossiers.map(d => (
            <Zeile key={d.mandatId} onClick={() => router.push(WEG.dossier(d.mandatId))} titel={`${d.titel} · ${d.kunde}`}
              unter={`${Object.entries(d.laeufe ?? {}).map(([a, s]) => `${a.toUpperCase()} ${LAUF_LABEL[s as keyof typeof LAUF_LABEL] ?? s}`).join(' · ') || 'noch keine Läufe'} · ${euroText(d.kostenCent ?? 0)}`}
              rechts={<span style={{ display: 'flex', gap: 6 }}>
                <Chip farbe={d.f1 ? LEUCHT.gut : C.inkLeise}>F1</Chip>
                <Chip farbe={d.f2 ? LEUCHT.gut : C.inkLeise}>F2</Chip>
                {(d.art14Bald ?? 0) > 0 && <Chip farbe={LEUCHT.achtung}>Art. 14 · {d.art14Bald}</Chip>}
              </span>} />
          ))}
        </Liste>
      </Karte>
      {daten.ohneDossier.length > 0 && (
        <Karte flach>
          <Ueberschrift>Mandate ohne Dossier</Ueberschrift>
          <Liste>
            {daten.ohneDossier.map(m => <Zeile key={m.mandatId} onClick={() => router.push(WEG.dossier(m.mandatId))} titel={`${m.titel} · ${m.kunde}`} unter="Dossier anlegen ›" />)}
          </Liste>
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Nichts startet von selbst — jeder Lauf nur mit Klick auf genau diesen Lauf.</div>
        </Karte>
      )}
    </div>
  );
}
