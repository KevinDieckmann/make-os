'use client';

// ─── Event · Überblick — Ziel, Rahmen, Kennzahlen, Mischung, nächste Schritte ─
// Vor dem Event zählt, ob Ziel und Gästeliste stimmen; danach, ob die
// richtigen Gespräche folgen (drei in 30 Tagen) und was sie gekostet haben.

import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Ueberschrift, Zahl, Raster, Chip, LEUCHT } from '../../schlank';
import { mix, zielHinweis, checklisteStand, vorlageAnwenden, VORLAGEN, budgetSumme, type VorlageId } from '@/lib/crm/eventplanung';
import type { Event } from '@/lib/crm/typen';
import { datum, euro } from '../daten';
import { Feldzeile, Pillen, Feld } from '../teile';
import { FORMATE, STATUS, MixAnzeige, Leise, eventSetzen, type ReiterProps, type Reiter } from './gemeinsam';

const tageBis = (von: string, bis: string) => Math.round((Date.parse(`${bis}T12:00:00Z`) - Date.parse(`${von}T12:00:00Z`)) / 864e5);

export function Ueberblick({ e, api, zuReiter }: ReiterProps & { zuReiter: (r: Reiter) => void }) {
  const crm = api.crm!;
  const heute = crm.heute;
  const z = crm.events[e.id];
  const gaeste = crm.stand.teilnahmen.filter(t => t.eventId === e.id);
  const m = mix(e, crm.stand.teilnahmen, api.kontakte ?? [], crm.stand.firmen);
  const cl = checklisteStand(e, heute);
  const hinweis = zielHinweis(e.ziel);
  const setze = (teil: Partial<Event>) => eventSetzen(api, e, teil);
  const vorbei = e.datum < heute;
  const noch = tageBis(heute, e.datum);
  const kosten = budgetSumme(e);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {z && (vorbei ? (
        <Raster min={120}>
          <Zahl wert={String(z.da)} label="waren da" farbe={LEUCHT.gut} />
          <Zahl wert={z.erscheinquote !== null ? `${z.erscheinquote} %` : `${z.da}/${z.zugesagt}`} label="erschienen" />
          <Zahl wert={String(z.folgegespraeche)} label="Folgegespräche (30 T)" farbe={z.folgegespraeche >= 3 ? LEUCHT.gut : undefined} />
          <Zahl wert={euro(z.beeinflusst)} label="beeinflusste Pipeline" />
          {z.kostenJeFolgegespraech !== null && <Zahl wert={euro(z.kostenJeFolgegespraech)} label="Kosten je Folgegespräch" />}
          {z.nachfassenOffen > 0 && <Zahl wert={String(z.nachfassenOffen)} label="nachfassen offen" farbe={LEUCHT.achtung} />}
        </Raster>
      ) : (
        <Raster min={120}>
          <Zahl wert={noch === 0 ? 'heute' : String(noch)} label={noch === 0 ? 'ist der Abend' : noch === 1 ? 'Tag bis zum Event' : 'Tage bis zum Event'} farbe={noch <= 7 ? LEUCHT.achtung : undefined} />
          <Zahl wert={String(gaeste.length)} label="auf der Liste" />
          <Zahl wert={String(z.eingeladen)} label="eingeladen" />
          <Zahl wert={String(z.zugesagt)} label="zugesagt" farbe={LEUCHT.gut} />
          {e.kapazitaet ? <Zahl wert={String(Math.max(0, e.kapazitaet - z.zugesagt))} label="Plätze frei" /> : null}
          {kosten > 0 && <Zahl wert={euro(kosten)} label="Budget" />}
        </Raster>
      ))}

      <div>
        <Feldzeile label="Titel"><Feld wert={e.titel} onFertig={titel => titel.trim() && setze({ titel: titel.trim() })} /></Feldzeile>
        <Feldzeile label="Ziel"><Feld wert={e.ziel} platzhalter="Messbar: „drei Folgegespräche mit Inhabern aus …“" onFertig={ziel => setze({ ziel })} /></Feldzeile>
        {hinweis && <div style={{ fontSize: 12.5, color: LEUCHT.achtung, margin: '2px 0 4px' }}>{hinweis}</div>}
        <Feldzeile label="Zielgruppe"><Feld wert={e.zielgruppe} platzhalter="Wen genau? z. B. Inhaber Maschinenbau Rhein-Main" onFertig={zielgruppe => setze({ zielgruppe: zielgruppe || undefined })} /></Feldzeile>
      </div>

      <div>
        <Ueberschrift rechts={<Leise onClick={() => zuReiter('gaeste')}>Gäste öffnen</Leise>}>Gästemischung</Ueberschrift>
        <MixAnzeige m={m} onSoll={mixZiel => setze({ mixZiel })} />
      </div>

      <div>
        <Ueberschrift rechts={<Leise onClick={() => zuReiter('checkliste')}>Checkliste öffnen</Leise>}>Nächste Schritte</Ueberschrift>
        {cl.naechste.length ? (
          <div style={{ display: 'grid', gap: 6 }}>
            {cl.naechste.map(p => (
              <div key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: TYP.bedien }}>
                <Chip farbe={p.ueberfaellig ? LEUCHT.kritisch : p.faelligAm <= heute ? LEUCHT.achtung : C.inkDim}>{p.ueberfaellig ? 'überfällig' : datum(p.faelligAm, heute)}</Chip>
                <span style={{ color: C.ink }}>{p.text}</span>
              </div>
            ))}
            <div style={{ fontSize: 12, color: C.inkLeise }}>{cl.erledigt} von {cl.gesamt} erledigt{cl.ohneAufgabe ? ` · ${cl.ohneAufgabe} noch nicht als Aufgabe` : ''}</div>
          </div>
        ) : <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{cl.gesamt ? 'Checkliste komplett erledigt.' : 'Noch keine Checkliste — eine Vorlage unten legt sechs Wochen Vorlauf an.'}</div>}
      </div>

      <div>
        <Feldzeile label="Format"><Pillen liste={[...FORMATE]} aktiv={e.format} onWahl={format => setze({ format })} /></Feldzeile>
        <Feldzeile label="Status"><Pillen liste={[...STATUS]} aktiv={e.status} onWahl={status => setze({ status })} /></Feldzeile>
        <Feldzeile label="Wann & wo">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Feld typ="date" wert={e.datum} breite={150} platzhalter="Datum" onFertig={d => d && setze({ datum: d })} />
            <Feld typ="time" wert={e.uhrzeit} breite={110} platzhalter="Uhrzeit" onFertig={uhrzeit => setze({ uhrzeit: uhrzeit || undefined })} />
            <div style={{ flex: 1, minWidth: 160 }}><Feld wert={e.ort} platzhalter="Ort" onFertig={ort => setze({ ort: ort || undefined })} /></div>
          </div>
        </Feldzeile>
        <Feldzeile label="Rahmen">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Feld typ="number" wert={e.kapazitaet ? String(e.kapazitaet) : ''} breite={110} platzhalter="Plätze" onFertig={k => setze({ kapazitaet: Number(k) || undefined })} />
            <div style={{ flex: 1, minWidth: 160 }}><Feld wert={e.coHost} platzhalter="Co-Host" onFertig={coHost => setze({ coHost: coHost || undefined })} /></div>
          </div>
        </Feldzeile>
        <Feldzeile label="Vorlage">
          <div style={{ display: 'grid', gap: 4 }}>
            <Pillen liste={VORLAGEN.map(v => ({ id: v.id, label: v.label }))} aktiv={(e.vorlage as VorlageId | undefined) ?? null} onWahl={id => api.setze('events', vorlageAnwenden(e, id) as unknown as { id: string } & Record<string, unknown>)} />
            <span style={{ fontSize: 12, color: C.inkLeise }}>Ergänzt Ablauf, Checkliste und Budget — nur, was fehlt. Nichts wird überschrieben.</span>
          </div>
        </Feldzeile>
        <Feldzeile label="Notiz"><Feld wert={e.notiz} onFertig={notiz => setze({ notiz: notiz || undefined })} /></Feldzeile>
      </div>

      <div><Leise onClick={() => { if (window.confirm(`„${e.titel}“ löschen?`)) { for (const t of (api.crm?.stand.teilnahmen ?? []).filter(x => x.eventId === e.id)) void api.weg('teilnahmen', t.id); void api.weg('events', e.id); } }}>Event löschen</Leise></div>
    </div>
  );
}
