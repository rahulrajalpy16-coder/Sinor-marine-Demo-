import { useState } from 'react';
import { Inspector } from '../Inspector';
import { BottomSheet } from './BottomSheet';
import { getEquipment } from '../../equipment/registry';
import { useAppStore } from '../../store/useAppStore';
import type { LayoutClass, Orientation } from '../../responsive/device';

/**
 * Hosts the Inspector (and with it every system's HMI panel) in the container that suits the device:
 * a right column on desktop, a collapsible side drawer on any touch screen held in landscape
 * (where a bottom sheet would leave almost no height for the 3D view), and a bottom sheet in portrait.
 */
export function InspectorDock({ layout, orientation }: { layout: LayoutClass; orientation: Orientation }) {
  const selectedId = useAppStore((s) => s.selectedId);
  const [collapsed, setCollapsed] = useState(false);
  if (!selectedId) return null;
  const name = getEquipment(selectedId)?.name ?? 'Details';

  if (layout !== 'desktop' && orientation === 'portrait') {
    // Keyed by selection so each new system opens at the same height.
    return (
      <BottomSheet key={selectedId} label={name} initial={layout === 'mobile' ? 'half' : 'peek'}>
        <Inspector bare />
      </BottomSheet>
    );
  }

  if (layout !== 'desktop') {
    return collapsed ? (
      <button
        type="button"
        data-testid="inspector-expand"
        onClick={() => setCollapsed(false)}
        className="pointer-events-auto absolute right-3 top-3 z-20 min-h-[44px] max-w-[45%] truncate rounded-sm border border-cyan/40 bg-abyss/85 px-3 text-xs backdrop-blur-md"
      >
        ◂ {name}
      </button>
    ) : (
      <div className={`pointer-events-none absolute bottom-3 right-3 top-3 z-20 flex ${layout === 'mobile' ? 'w-[min(24rem,52vw)]' : 'w-[min(24rem,46vw)]'} flex-col items-end gap-2`}>
        <button
          type="button"
          data-testid="inspector-collapse"
          aria-label="Hide details panel"
          onClick={() => setCollapsed(true)}
          className="pointer-events-auto min-h-[40px] rounded-sm border border-cyan/40 bg-abyss/85 px-3 text-xs backdrop-blur-md coarse:min-h-[44px]"
        >
          Hide ▸
        </button>
        <div className="flex min-h-0 w-full flex-1 flex-col">
          <Inspector />
        </div>
      </div>
    );
  }

  return (
    // A column flex box so the Inspector's own max-height resolves and long HMI panels scroll inside it.
    <div className="pointer-events-none flex max-h-full min-h-0 w-[22rem] shrink-0 flex-col self-start">
      <Inspector />
    </div>
  );
}
