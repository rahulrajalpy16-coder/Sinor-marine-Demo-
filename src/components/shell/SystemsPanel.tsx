import { useState } from 'react';
import { EquipmentTree } from '../EquipmentTree';
import { registry } from '../../equipment/registry';
import type { LayoutClass } from '../../responsive/device';

/** System explorer: fixed sidebar on desktop, a collapsible panel on tablet, a drawer on phones. */
export function SystemsPanel({ layout }: { layout: LayoutClass }) {
  const [open, setOpen] = useState(false);
  const body = (
    <>
      <EquipmentTree onPicked={layout === 'desktop' ? undefined : () => setOpen(false)} />
      <p className="border-t border-white/5 pt-2 text-[10px] leading-snug text-mute">{registry.note}</p>
    </>
  );

  if (layout === 'desktop') {
    return (
      <div
        data-testid="systems-panel"
        className="pointer-events-auto flex max-h-full w-60 shrink-0 flex-col gap-3 self-start overflow-y-auto rounded-sm border border-cyan/20 bg-abyss/75 p-3 backdrop-blur-md"
      >
        {body}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="pointer-events-auto absolute left-3 top-3 z-30 min-h-[40px] rounded-sm border border-cyan/40 bg-abyss/85 px-3 py-1.5 text-xs backdrop-blur-md coarse:min-h-[44px]"
        aria-expanded={open}
        aria-controls="systems-drawer"
        data-testid="tree-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '✕ Close' : '☰ Systems'}
      </button>
      {open && (
        <div
          id="systems-drawer"
          data-testid="systems-panel"
          className={`pointer-events-auto absolute left-3 top-16 z-30 flex flex-col gap-3 overflow-y-auto overscroll-contain rounded-sm border border-cyan/30 bg-abyss/95 p-3 backdrop-blur-md ${
            layout === 'mobile' ? 'bottom-3 right-3' : 'max-h-[calc(100%-5rem)] w-72'
          }`}
        >
          {body}
        </div>
      )}
    </>
  );
}
