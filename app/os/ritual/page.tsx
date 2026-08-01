import { RitualView } from '@/components/os/RitualView';

export const metadata = { title: 'Tagesritual — MAKE OS' };
export const dynamic = 'force-dynamic';

export default function RitualPage({ searchParams }: { searchParams?: { modus?: string } }) {
  const modus = searchParams?.modus === 'abend' ? 'abend' : searchParams?.modus === 'morgen' ? 'morgen' : undefined;
  return <RitualView startModus={modus} />;
}
