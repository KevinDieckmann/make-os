'use client';

// ─── Der Inhalt des Seitenfensters: Kontakt und Firma voll bearbeiten (03.10.) ─────────────────
// Kevin: „Wir müssen die Karten sauber bearbeiten können — den Kontakt ändern, die Firma ändern, zusammenführen.“ Keine neuen
// Formulare: dieselben Bausteine wie die Kontaktakte (Matrix: Einordnung · Person · Firma, Beziehung, nächster Schritt,
// Kanal-Ampel) und die Firmenkarte. Geschrieben wird über die bestehenden Wege mit Stand/409 (`api.kontaktTeil`,
// `api.teil`); danach rechnet die Runde den Lead-Score sofort neu (sie liest Kartei und CRM live).

import { useRouter } from 'next/navigation';
import { useMemo, useRef } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Ueberschrift, Knopf, Chip, Leer, LEUCHT } from '../../schlank';
import { anzeigename } from '@/lib/make-one/crm';
import { ampel as kanalAmpel } from '@/lib/crm/recht';
import { OFFENE_STUFEN } from '@/lib/crm/pipeline';
import { kontaktAkte, markttraktion } from '@/lib/crm/adresse';
import { type CrmApi } from '../daten';
import { KanalAmpel, Grund } from '../teile';
import { Hinweise, MatrixTeilInhalt, MatrixZeile, NaechsterSchrittTeil, BeziehungTeil, MatrixZahl, MATRIX_TEIL_LABEL, type MatrixTeil } from '../kontakt-teile';
import { FirmenKarte } from '../Firmen';
import { Seitenblatt } from './Seitenblatt';

/** Titel und „Akte ganz öffnen ›“ — immer sichtbar im Kopf des Seitenfensters. */
function AkteKnopf({ href }: { href: string }) {
  const router = useRouter();
  return <button onClick={() => router.push(href)} className="fassbar" style={{ alignSelf: 'center', background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontSize: TYP.bedien, fontWeight: 700, whiteSpace: 'nowrap', padding: '0 4px', minHeight: 44 }}>Akte ganz öffnen ›</button>;
}

const GRUPPEN: MatrixTeil[] = ['einordnung', 'person', 'firma'];

export function KontaktSeitenfenster({ api, kontaktId, startFirmaId, onZu, zuFirma, onFirmaGeaendert }: {
  api: CrmApi; kontaktId: string; onZu: () => void; zuFirma: (id: string) => void;
  /** Die Firma der Person, als das Fenster aufging — weicht sie jetzt ab (z. B. über das Feld „Firma“), bietet es an, Lead und Deals nachzuziehen. */
  startFirmaId?: string; onFirmaGeaendert: (von: string | undefined, nach: string, personId: string) => void;
}) {
  const k = api.kontakte?.find(x => x.id === kontaktId) ?? null;
  const heute = api.crm?.heute ?? '';
  const start = useRef<{ id: string; firma?: string }>({ id: kontaktId, firma: startFirmaId });
  if (start.current.id !== kontaktId) start.current = { id: kontaktId, firma: startFirmaId };
  const firma = k?.firmaId ? api.crm?.stand.firmen.find(f => f.id === k.firmaId) : undefined;
  const ampel = useMemo(() => {
    if (!k || !api.crm) return [];
    const offen = api.crm.stand.chancen.some(c => OFFENE_STUFEN.includes(c.stufe) && c.kontaktIds.includes(k.id));
    const mandat = api.crm.stand.mandate.some(m => m.status === 'aktiv' && m.kontaktIds.includes(k.id));
    return kanalAmpel(k, { hatMandat: mandat, hatChance: offen });
  }, [k, api.crm]);
  if (!k) return <Seitenblatt titel="Kontakt" onZu={onZu}><Leer>Diese Person gibt es nicht mehr — gelöscht oder zusammengeführt.</Leer></Seitenblatt>;
  const setze = (teil: Parameters<CrmApi['kontaktTeil']>[1]) => api.kontaktTeil(k.id, teil);
  const geaendert = !!k.firmaId && k.firmaId !== start.current.firma;
  return (
    <Seitenblatt titel={anzeigename(k)} unter={[k.position ?? k.jobtitel, firma?.name ?? k.firma].filter(Boolean).join(' · ') || 'Kontakt'} onZu={onZu} kopfRechts={<AkteKnopf href={kontaktAkte(k.id)} />}>
      <Hinweise k={k} heute={heute} setze={setze} />
      {geaendert && (
        <div role="status" style={{ padding: '10px 12px', borderRadius: 12, background: `${LEUCHT.achtung}14`, border: `1px solid ${LEUCHT.achtung}44`, fontSize: TYP.bedien, display: 'grid', gap: 8 }}>
          <span>Die Firma hat sich geändert. Sollen Qualifizierung (Lead) und offene Deals mit zur neuen Firma?</span>
          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Knopf onClick={() => onFirmaGeaendert(start.current.firma, k.firmaId!, k.id)}>Lead und Deals nachziehen …</Knopf></span>
        </div>
      )}
      <div>
        <Ueberschrift>Erreichbar</Ueberschrift>
        <KanalAmpel ampel={ampel} ziele={{ telefon: k.telefon ?? k.sms, email: k.email, linkedin: k.linkedin }} />
        <Grund ampel={ampel} />
      </div>
      <div>
        <NaechsterSchrittTeil k={k} heute={heute} setze={setze} />
      </div>
      {GRUPPEN.map(t => (
        <div key={t}>
          <Ueberschrift rechts={<MatrixZahl teil={t} k={k} api={api} />}>{MATRIX_TEIL_LABEL[t]}</Ueberschrift>
          <MatrixTeilInhalt teil={t} k={k} api={api} setze={setze} zuFirma={zuFirma} />
        </div>
      ))}
      <div>
        <Ueberschrift>Beziehung</Ueberschrift>
        <BeziehungTeil k={k} api={api} setze={setze} ohneTitel />
      </div>
      <div>
        <Ueberschrift>Notiz</Ueberschrift>
        <MatrixZeile label="Notiz" lang wert={k.notiz} onFertig={x => void setze({ notiz: x || undefined })} />
      </div>
      <div style={{ fontSize: 12, color: C.inkLeise, lineHeight: 1.5 }}>Datenschutz, Verlauf, Umsatz und Anträge stehen in der ganzen Akte. Jede Änderung hier gilt sofort — der Lead-Score rechnet neu.</div>
      <div><Chip farbe={C.inkDim}>Kennung {k.id.slice(0, 12)}</Chip></div>
    </Seitenblatt>
  );
}

export function FirmaSeitenfenster({ api, firmaId, onZu, zuKontakt, zuFirma }: { api: CrmApi; firmaId: string; onZu: () => void; zuKontakt: (id: string) => void; zuFirma: (id: string) => void }) {
  const f = api.crm?.stand.firmen.find(x => x.id === firmaId);
  if (!f) return <Seitenblatt titel="Firma" onZu={onZu}><Leer>Diese Firma gibt es nicht mehr — gelöscht oder zusammengeführt.</Leer></Seitenblatt>;
  return (
    <Seitenblatt titel={f.name} unter={[f.branche, f.stadt].filter(Boolean).join(' · ') || 'Firma'} onZu={onZu} kopfRechts={<AkteKnopf href={markttraktion('firmen', undefined, f.id)} />}>
      <FirmenKarte f={f} api={api} zuPerson={zuKontakt} zuFirma={zuFirma} />
    </Seitenblatt>
  );
}
