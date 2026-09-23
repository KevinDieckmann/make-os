'use client';

import { useState } from 'react';
import { type GroceryItem, type GroceryCategory } from '@/types/make-os';

const QUICK_ADD: { name: string; category: GroceryCategory }[] = [
  { name: 'Hafermilch',    category: 'GETRÄNKE' },
  { name: 'Beeren',        category: 'GEMÜSE' },
  { name: 'Kaffee',        category: 'TROCKENWAREN' },
  { name: 'Eier',          category: 'PROTEINE' },
  { name: 'Spinat',        category: 'GEMÜSE' },
  { name: 'Skyr',          category: 'MILCHPRODUKTE' },
  { name: 'Lachs',         category: 'PROTEINE' },
  { name: 'Avocado',       category: 'GEMÜSE' },
];

const INITIAL: GroceryItem[] = [
  { id: 'g1', name: 'Brokkoli',       category: 'GEMÜSE',       quantity: '1 Stk',  checked: false },
  { id: 'g2', name: 'Zucchini',       category: 'GEMÜSE',       quantity: '2 Stk',  checked: false },
  { id: 'g3', name: 'Hähnchenbrust',  category: 'PROTEINE',     quantity: '500g',   checked: false },
  { id: 'g4', name: 'Eier',           category: 'PROTEINE',     quantity: '10 Stk', checked: true  },
  { id: 'g5', name: 'Haferflocken',   category: 'TROCKENWAREN', quantity: '1 Pkg',  checked: false },
  { id: 'g6', name: 'Waschmittel',    category: 'SONSTIGES',    quantity: '1 Pkg',  checked: false },
  { id: 'g7', name: 'Joghurt',        category: 'MILCHPRODUKTE',quantity: '500g',   checked: false },
  { id: 'g8', name: 'Mineralwasser',  category: 'GETRÄNKE',     quantity: '6×0.7L', checked: false },
];

const CATEGORY_ORDER: GroceryCategory[] = ['GEMÜSE', 'PROTEINE', 'MILCHPRODUKTE', 'TROCKENWAREN', 'GETRÄNKE', 'SONSTIGES'];

const CAT_COLORS: Record<GroceryCategory, string> = {
  GEMÜSE:       '#00ff66',
  PROTEINE:     '#3b82f6',
  MILCHPRODUKTE:'#f59e0b',
  TROCKENWAREN: '#8b5cf6',
  GETRÄNKE:     '#00aaff',
  SONSTIGES:    '#555555',
};

export function SmartGroceries() {
  const [items, setItems] = useState<GroceryItem[]>(INITIAL);

  function toggle(id: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  }

  function quickAdd(name: string, category: GroceryCategory) {
    if (items.some(i => i.name === name)) return;
    setItems(prev => [...prev, {
      id: `qa-${Date.now()}`,
      name, category, checked: false,
    }]);
  }

  const openCount    = items.filter(i => !i.checked).length;
  const checkedCount = items.filter(i => i.checked).length;

  return (
    <div className="os-card" style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #1e1e1e', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#555', letterSpacing: '0.12em', marginBottom: 3 }}>SYS.EINKAUF</div>
          <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#ffffff', letterSpacing: '0.04em' }}>SMART GROCERIES</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#00ff66', border: '1px solid #00ff6622', padding: '2px 6px', letterSpacing: '0.06em' }}>
            {openCount} OFFEN
          </span>
          <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#444', border: '1px solid #1e1e1e', padding: '2px 6px', letterSpacing: '0.06em' }}>
            {checkedCount} ✓
          </span>
        </div>
      </div>

      {/* Quick add badges */}
      <div style={{ borderBottom: '1px solid #111', padding: '8px 14px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {QUICK_ADD.map(qa => {
          const exists = items.some(i => i.name === qa.name);
          return (
            <button
              key={qa.name}
              onClick={() => quickAdd(qa.name, qa.category)}
              disabled={exists}
              className="interactive-element"
              style={{
                padding: '3px 8px',
                background: exists ? '#050505' : 'transparent',
                border: `1px solid ${exists ? '#111' : '#1e1e1e'}`,
                color: exists ? '#222' : '#555',
                fontFamily: 'var(--mono-font)',
                fontSize: 11,
                letterSpacing: '0.06em',
                cursor: exists ? 'default' : 'pointer',
              }}
            >
              {exists ? '✓' : '+'} {qa.name}
            </button>
          );
        })}
      </div>

      {/* Items by category */}
      <div style={{ padding: '0 14px 14px', maxHeight: 280, overflowY: 'auto' }}>
        {CATEGORY_ORDER.map(cat => {
          const catItems = items.filter(i => i.category === cat);
          if (catItems.length === 0) return null;
          return (
            <div key={cat} style={{ marginTop: 10 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 4,
                paddingBottom: 4,
                borderBottom: '1px solid #111',
              }}>
                <div style={{ width: 4, height: 4, background: CAT_COLORS[cat] }} />
                <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: CAT_COLORS[cat], letterSpacing: '0.12em' }}>
                  {cat}
                </span>
              </div>
              {catItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => toggle(item.id)}
                  className="interactive-element"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '5px 0',
                    borderBottom: '1px solid #080808',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: 8, height: 8, flexShrink: 0,
                    border: `1px solid ${item.checked ? '#00ff66' : '#2a2a2a'}`,
                    background: item.checked ? '#00ff66' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {item.checked && <span style={{ color: '#000', fontSize: 11, fontWeight: 900 }}>✓</span>}
                  </div>
                  <span style={{
                    flex: 1,
                    fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
                    fontSize: 12,
                    color: item.checked ? '#333' : '#aaaaaa',
                    textDecoration: item.checked ? 'line-through' : 'none',
                  }}>
                    {item.name}
                  </span>
                  {item.quantity && (
                    <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#333', letterSpacing: '0.04em' }}>
                      {item.quantity}
                    </span>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
