import type { VisualMode } from '../equipment/types';
import { MODE_STYLES } from '../rendering/modes';

export interface EquipmentVisual {
  /** Cyan emissive strength. */
  glow: number;
  /** Ghosted (isolation mode, not the isolated system). */
  ghost: boolean;
  /** Show the selection outline linework. */
  outline: boolean;
}

/** Pure mapping from interaction + mode state to how one equipment item is drawn. */
export function equipmentVisual(
  id: string,
  s: { selectedId: string | null; hoveredId: string | null; visualMode: VisualMode },
): EquipmentVisual {
  const selected = s.selectedId === id;
  const hovered = s.hoveredId === id;
  const style = MODE_STYLES[s.visualMode];
  const ghost = style.isolateSelection && s.selectedId !== null && !selected;
  const base = s.visualMode === 'blueprint' || s.visualMode === 'xray' ? 0.35 : 0.08;
  return {
    glow: selected ? 0.55 : hovered ? 0.4 : base,
    ghost,
    outline: selected || hovered,
  };
}
