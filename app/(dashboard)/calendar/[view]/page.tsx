import { notFound } from 'next/navigation';
import { CalendarShell } from '@/components/calendar/CalendarShell';
import type { CalendarView } from '@/types/calendar';

interface Props {
  params: Promise<{ view: string }>;
}

const VALID_VIEWS: CalendarView[] = ['month', 'week', 'day'];

export default async function CalendarViewPage(props: Props) {
  const params = await props.params;
  if (!VALID_VIEWS.includes(params.view as CalendarView)) notFound();
  return <CalendarShell view={params.view as CalendarView} />;
}
