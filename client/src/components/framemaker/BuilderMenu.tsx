import type { LucideIcon } from 'lucide-react';

export interface BuilderMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface Props {
  items: BuilderMenuItem[];
  active: string;
  onSelect: (id: string) => void;
}

const activeLift = {
  color: 'var(--color-primary)',
  boxShadow: 'var(--depth-contact), var(--depth-rim-top), inset 0 0 14px -2px var(--color-glow), 0 0 16px -6px var(--color-glow)',
};

/** Левое меню-рейка сборщика кадра — дизайн-язык сайдбара */
export default function BuilderMenu({ items, active, onSelect }: Props) {
  return (
    <div
      className="nx-surface rounded-2xl p-3 lg:space-y-1 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible"
      style={{
        boxShadow: 'var(--depth-ambient), var(--depth-rim-top)',
        border: '1px solid color-mix(in srgb, var(--color-border) 45%, transparent)',
      }}
    >
      <div className="px-3 py-2 hidden lg:block">
        <span className="text-xs font-mono text-gray-500 uppercase">СБОРКА КАДРА</span>
      </div>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`nx-press flex items-center gap-2 lg:gap-3 px-2.5 lg:px-3 py-2 lg:py-2.5 rounded-xl flex-shrink-0 lg:flex-shrink ${
              isActive
                ? 'glass-accent nav-link-active'
                : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
            }`}
            style={isActive ? activeLift : undefined}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="text-xs lg:text-sm font-medium lg:flex-1 text-left whitespace-nowrap">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
