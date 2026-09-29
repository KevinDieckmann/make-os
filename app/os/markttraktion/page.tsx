import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { MarkttraktionSeite } from '@/components/os/crm/Markttraktion';
import { aliasWeiterleitung } from '@/lib/crm/kennung-alias';

// Kennungs-Umzug (29.09., Paket D-C #35): alte Links auf eine Kontakt-Kennung (`?k=c-<alt>`, `?kontakt=`, aus Notizen,
// Lesezeichen, WEG.akte/kontakt) leiten auf die neue Kennung weiter (lib/crm/kennung-alias.ts). Nachgeschlagen wird nur,
// wenn `k`/`kontakt` wie eine Kontakt-Kennung aussieht.
export default async function MarkttraktionPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ziel = await aliasWeiterleitung('/os/markttraktion', await props.searchParams);
  if (ziel) redirect(ziel);
  return <Suspense><MarkttraktionSeite /></Suspense>;
}
