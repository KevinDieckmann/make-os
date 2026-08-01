import { StubModule } from '@/components/shared/StubModule';
import { ShoppingCart } from 'lucide-react';

export default function GroceriesPage() {
  return (
    <StubModule
      title="Einkauf & Haushalt"
      description="Gemeinsame Einkaufsliste nach Supermarkt-Gängen sortiert, Schnellzugang für Wochenstaples."
      icon={ShoppingCart}
    />
  );
}
