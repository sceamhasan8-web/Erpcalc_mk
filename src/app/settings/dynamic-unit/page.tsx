"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getProductionMode, setProductionMode } from '@/lib/productionMode';

const sections = ['Normal production', 'Footwear production'] as const;

type SectionKey = (typeof sections)[number];

export default function DynamicUnitPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<SectionKey>('Normal production');

  useEffect(() => {
    const currentMode = getProductionMode();
    setActiveSection(currentMode === 'footwear' ? 'Footwear production' : 'Normal production');
  }, []);

  function handleSelect(section: SectionKey) {
    setActiveSection(section);
    setProductionMode(section === 'Footwear production' ? 'footwear' : 'normal');
    router.push('/orders');
  }

  return (
    <main className="min-h-screen p-4 lg:p-8">
      <div className="mx-auto max-w-4xl rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[var(--ec-foreground)]">Production mode</h1>
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          {sections.map((section) => (
            <button
              key={section}
              type="button"
              onClick={() => handleSelect(section)}
              className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                activeSection === section
                  ? 'bg-[var(--ec-primary)] text-white'
                  : 'border border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-foreground)] hover:border-[var(--ec-primary)]'
              }`}
            >
              {section}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-6">
          <h2 className="text-xl font-semibold text-[var(--ec-foreground)] mb-3">{activeSection}</h2>
          <p className="text-sm text-[var(--ec-muted)]">Choose a production mode to open the corresponding page.</p>
        </div>
      </div>
    </main>
  );
}
