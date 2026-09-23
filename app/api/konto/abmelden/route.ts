import { ohneSitzung } from '@/lib/zugang/antwort';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST() { return ohneSitzung(); }
