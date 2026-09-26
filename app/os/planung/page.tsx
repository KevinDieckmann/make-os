import { TagesplanView } from '@/components/os/TagesplanView';

export const dynamic = 'force-dynamic';

/** ?tag=YYYY-MM-DD blättert im Tagesplan vor und zurück (Kevins Zeitnavigation). */
export default async function PlanungPage(props: { searchParams?: Promise<{ tag?: string }> }) {
  const searchParams = await props.searchParams;
  const tag = searchParams?.tag;
  const gueltig = typeof tag === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(tag) ? tag : undefined;
  return <TagesplanView tag={gueltig} />;
}
