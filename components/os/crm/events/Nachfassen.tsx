'use client';

// ─── Event · Nachfassen — binnen 48 Stunden, je Gast mit der Notiz vom Abend ─
// Danach verblasst die Erinnerung. Hier stehen alle, die da waren und noch
// nicht nachgefasst sind: Reststunden bis zur Frist, die Notiz vom Abend,
// die zulässigen Wege (Ampel) und ein Knopf, der das Nachfassen am Kontakt
// festhält. Geschrieben und gesendet wird von Kevin oder Malin selbst.

import { useMemo, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Ueberschrift, Knopf, Chip, Leer, LEUCHT } from '../../schlank';
import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import { ampel } from '@/lib/crm/recht';
import { kontextAus } from '@/lib/crm/segmente';
import { followUpBis, nachfassenRest } from '@/lib/crm/events';
import type { Teilnahme } from '@/lib/crm/typen';
import { datum } from '../daten';
import { KanalAmpel } from '../teile';
import { gastSetzen, type ReiterProps } from './gemeinsam';

const stunden = (h: number) => (h >= 48 ? `noch ${Math.floor(h / 24)} Tage` : h >= 0 ? `noch ${h} Std.` : h > -48 ? `seit ${-h} Std. vorbei` : `seit ${Math.floor(-h / 24)} Tagen vorbei`);

export function Nachfassen({ e, api, zuKontakt }: ReiterProps) {
  const crm = api.crm!;
  const heute = crm.heute;
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

  if (e.datum > heute) return <Leer>Nach dem Event stehen hier alle, die da waren — mit der 48-Stunden-Frist (bis {datum(bis)}) und ihrer Notiz vom Abend.</Leer>;

  const nachgefasst = (t: Teilnahme, k: Kontakt) => {
    void gastSetzen(api, t, { followUpAm: heute });
    void api.aktivitaet({ id: k.id, art: 'event', text: `Nachgefasst nach „${e.titel}“`, bezug: e.id });
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Ueberschrift rechts={<span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {offen.length > 0 && <Chip farbe={rest > 24 ? LEUCHT.gut : rest >= 0 ? LEUCHT.achtung : LEUCHT.kritisch}>{stunden(rest)}</Chip>}
        {quote !== null && <Chip farbe={quote >= 1 ? LEUCHT.gut : quote >= 0.8 ? LEUCHT.achtung : LEUCHT.kritisch}>{fristgerecht} von {da.length} fristgerecht</Chip>}
      </span>}>Nachfassen bis {datum(bis, heute)}</Ueberschrift>

      {offen.map(({ t, k }) => (
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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Knopf onClick={() => nachgefasst(t, k)}>Nachgefasst</Knopf>
            <Knopf leise onClick={() => zuKontakt(k.id)}>Zur Person</Knopf>
          </div>
        </div>
      ))}
      {!offen.length && <Leer>{da.length ? 'Alle nachgefasst.' : 'Niemand als „da“ markiert — im Abend-Modus abhaken, wer gekommen ist.'}</Leer>}

      {erledigt.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: C.inkLeise, margin: '4px 0 6px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Nachgefasst</div>
          {erledigt.map(({ t, k }) => (
            <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
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
