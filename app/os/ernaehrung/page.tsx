import { redirect } from 'next/navigation';

// Ernährung ist ein Reiter der Gesundheitsseite (26.09.).
export default function ErnaehrungPage() { redirect('/os/gesundheit?s=ernaehrung'); }
