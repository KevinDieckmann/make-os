import { RitualView } from '@/components/os/RitualView';

export const metadata = { title: 'Tagesritual — MAKE OS' };
export const dynamic = 'force-dynamic';

export default async function RitualPage(props: { searchParams?: Promise<{ modus?: string }> }) {
  const searchParams = await props.searchParams;
  const modus = searchParams?.modus === 'abend' ? 'abend' : searchParams?.modus === 'morgen' ? 'morgen' : undefined;
  return <RitualView startModus={modus} />;
}
