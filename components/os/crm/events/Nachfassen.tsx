'use client';

// ─── Event · Nachfassen — binnen 48 Stunden, je Gast mit der Notiz vom Abend ─
// Danach verblasst die Erinnerung. Hier stehen alle, die da waren und noch
// nicht nachgefasst sind: Reststunden bis zur Frist, die Notiz vom Abend,
// die zulässigen Wege (Ampel) und „Erledigt“, das das Nachfassen am Gast
// (followUpAm) und im Verlauf der Person festhält. Geschrieben und gesendet
// wird von Kevin oder Malin selbst.
// Zu zweit: nach Person gruppiert — „Deine Gäste“ zuerst, dann die der/des
// anderen. Wer nachfasst, ist wer einlädt (eingetragen, sonst wer die
// Beziehung hält); ein Klick gibt den Gast an die/den anderen.

import { useMemo, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Ueberschrift, Knopf, Chip, Leer, LEUCHT } from '../../schlank';
import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import { ampel } from '@/lib/crm/recht';
import { kontextAus } from '@/lib/crm/segmente';
import { followUpBis, nachfassenRest } from '@/lib/crm/events';
import { nachfassGruppen, einladerMit } from '@/lib/crm/eventplanung';
import { nameVon } from '@/lib/crm/team';
import type { Teilnahme } from '@/lib/crm/typen';
import { datum } from '../daten';
import { KanalAmpel } from '../teile';
import { Person } from '../team';
import { gastSetzen, WerTausch, type ReiterProps } from './gemeinsam';

const stunden = (h: number) => (h >= 48 ? `noch ${Math.floor(h / 24)} Tage` : h >= 0 ? `noch ${h} Std.` : h > -48 ? `seit ${-h} Std. vorbei` : `seit ${Math.floor(-h / 24)} Tagen vorbei`);
const fristFarbe = (h: number) => (h > 24 ? LEUCHT.gut : h >= 0 ? LEUCHT.achtung : LEUCHT.kritisch);

export function Nachfassen({ e, api, zuKontakt }: ReiterProps) {
  const crm = api.crm!;
  const heute = crm.heute;
  const ich = api.ich;
  const [jetzt] = useState(() => Date.now());
  const ctx = useMemo(() => kontextAus(crm.stand, heute), [crm.stand, heute]);
  const nachId = new Map((api.kontakte ?? []).map(k => [k.id, k]));
  const liste = crm.stand.teilnahmen.filter(t => t.eventId === e.id)
    .map(t => ({ t, k: nachId.get(t.kontaktId) }))
    .filter((x): x is { t: Teilnahme; k: Kontakt } => !!x.k);
  const da = liste.filter(x => x.t.status === 'da');
  const offen = da.filter(x => !x.t.followUpAm);
  const erledigt = da.filter(x => x.t.followUpAm).sort((a, b) => (b.t.followUpAm ?? '').localeCompare(a.t.followUpAm ?? ''));
  const nichtGekommen = liste.filter(x => x.t.status === 'no_show');
  const bis = followUpBis(e);
  const rest = nachfassenRest(e, jetzt);
  const fristgerecht = erledigt.filter(x => (x.t.followUpAm ?? '') <= bis).length;
  const quote = da.length ? fristgerecht / da.length : null;
  const gruppen = nachfassGruppen(offen, e, ich);

  if (e.datum > heute) return <Leer>Nach dem Event stehen hier alle, die da waren — nach Person gruppiert (wer einlädt, fasst nach), mit der 48-Stunden-Frist (bis {datum(bis)}) und ihrer Notiz vom Abend.</Leer>;

  const erledigen = (t: Teilnahme, k: Kontakt) => {
    void gastSetzen(api, t, { followUpAm: heute });
    void api.aktivitaet({ id: k.id, art: 'event', text: `Nachgefasst nach „${e.titel}“`, bezug: e.id });
  };
  /** Nachfassen an die/den anderen geben — zurück auf den Standard (Beziehung) nimmt den Eintrag weg. */
  const geben = (t: Teilnahme, k: Kontakt, person: string) => {
    const standard = einladerMit({}, k, e).person;
    void gastSetzen(api, t, { einladenDurch: person === standard ? undefined : person });
  };

  const karte = ({ t, k }: { t: Teilnahme; k: Kontakt }) => {
    const wer = einladerMit(t, k, e);
    return (
      <div key={t.id} style={{ padding: 14, borderRadius: 14, background: 'rgba(255,255,255,.03)', display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <b style={{ fontSize: TYP.body, fontWeight: 700 }}>{anzeigename(k)}</b>
          {k.firma && <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{k.firma}</span>}
          {k.anrede && <span style={{ fontSize: 12, color: C.inkLeise }}>{k.anrede}</span>}
        </div>
        <div style={{ fontSize: TYP.bedien, color: t.notiz ? C.ink : C.inkLeise, lineHeight: 1.5, whiteSpace: 'pre-wrap', borderLeft: `2px solid ${LEUCHT.beziehung}55`, paddingLeft: 10 }}>
          {t.notiz ?? 'Keine Notiz vom Abend — beim nächsten Mal im Abend-Modus festhalten.'}
        </div>
        <KanalAmpel ampel={ampel(k, { hatMandat: ctx.mitMandat.has(k.id), hatChance: ctx.mitChance.has(k.id) })} ziele={{ telefon: k.telefon ?? k.sms, email: k.email, linkedin: k.linkedin }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Knopf onClick={() => erledigen(t, k)}>Erledigt</Knopf>
          <Knopf leise onClick={() => zuKontakt(k.id)}>Zur Person</Knopf>
          <span style={{ marginLeft: 'auto' }}><WerTausch label="fasst nach" wert={wer.person} ich={ich} standard={wer.quelle === 'beziehung' ? 'hält die Beziehung' : wer.quelle === 'event' ? 'wie Event' : undefined} onWahl={person => geben(t, k, person)} /></span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Ueberschrift rechts={<span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {offen.length > 0 && <Chip farbe={fristFarbe(rest)}>{stunden(rest)}</Chip>}
        {quote !== null && <Chip farbe={quote >= 1 ? LEUCHT.gut : quote >= 0.8 ? LEUCHT.achtung : LEUCHT.kritisch}>{fristgerecht} von {da.length} fristgerecht</Chip>}
      </span>}>Nachfassen bis {datum(bis, heute)}</Ueberschrift>

      {gruppen.filter(g => g.liste.length || g.eigene).map(g => (
        <div key={g.person} style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Person id={g.person} groesse={22} />
            <span style={{ fontSize: TYP.body, fontWeight: 700, color: C.ink }}>{g.eigene ? 'Deine Gäste' : `Gäste von ${nameVon(g.person)}`}</span>
            <span style={{ fontSize: 12.5, color: g.liste.length ? fristFarbe(rest) : C.inkLeise }}>{g.liste.length ? `${g.liste.length} offen · ${rest >= 0 ? `${stunden(rest)} bis zur Frist` : `Frist ${stunden(rest)}`}` : 'nichts offen'}</span>
          </div>
          {g.liste.map(karte)}
          {g.eigene && !g.liste.length && offen.length > 0 && <div style={{ fontSize: 12.5, color: C.inkLeise }}>Bei dir ist alles nachgefasst — {offen.length} {offen.length === 1 ? 'Gast liegt' : 'Gäste liegen'} noch bei {nameVon(gruppen.find(x => !x.eigene && x.liste.length)?.person)}.</div>}
        </div>
      ))}
      {!offen.length && <Leer>{da.length ? 'Alle nachgefasst. In 30 Tagen zeigt der Überblick, welche Gespräche daraus wurden.' : 'Niemand als „da“ markiert — im Abend-Modus abhaken, wer gekommen ist.'}</Leer>}

      {erledigt.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: C.inkLeise, margin: '4px 0 6px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Nachgefasst</div>
          {erledigt.map(({ t, k }) => (
            <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
              <Person id={einladerMit(t, k, e).person} groesse={18} />
              <button onClick={() => zuKontakt(k.id)} style={{ background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: TYP.bedien, padding: 0, flex: 1, textAlign: 'left' }}>{anzeigename(k)}{k.firma ? ` · ${k.firma}` : ''}</button>
              <Chip farbe={(t.followUpAm ?? '') <= bis ? LEUCHT.gut : LEUCHT.achtung}>{datum(t.followUpAm, heute)}</Chip>
            </div>
          ))}
        </div>
      )}
      {nichtGekommen.length > 0 && (
        <div style={{ fontSize: 12.5, color: C.inkLeise, lineHeight: 1.5 }}>
          Zugesagt, aber nicht gekommen: {nichtGekommen.map(({ k }) => anzeigename(k)).join(', ')} — ein kurzes „schade, beim nächsten Mal“ hält die Tür offen.
        </div>
      )}
    </div>
  );
}
