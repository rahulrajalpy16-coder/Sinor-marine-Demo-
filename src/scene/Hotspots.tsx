import { Html, Line } from '@react-three/drei';
import { equipment } from '../equipment/registry';
import { useAppStore } from '../store/useAppStore';
import { currentCameraPose } from '../interactions/poseRegistry';

/** Floating callouts (like the reference video's annotations) that are also accessible select buttons. */
export function Hotspots() {
  const selectedId = useAppStore((s) => s.selectedId);
  const hoveredId = useAppStore((s) => s.hoveredId);
  const intro = useAppStore((s) => s.introActive);
  const select = useAppStore((s) => s.select);
  const hover = useAppStore((s) => s.hover);
  if (intro) return null;
  return (
    <group name="hotspots">
      {equipment
        .filter((e) => e.placement.implemented && e.id !== selectedId)
        .map((e) => {
          const [x, y, z] = e.placement.target;
          const label: [number, number, number] = [x + (e.placement.underwater ? 7 : 4), y + (e.placement.underwater ? -1 : 6), z];
          const hot = hoveredId === e.id;
          return (
            <group key={e.id}>
              <Line points={[[x, y, z], label]} color={hot ? '#ffffff' : '#00D9FF'} lineWidth={1} transparent opacity={0.8} depthTest={false} />
              <Html position={label} center zIndexRange={[20, 0]} style={{ pointerEvents: 'auto' }}>
                <button
                  type="button"
                  data-testid={`hotspot-${e.id}`}
                  aria-label={`Select ${e.name}`}
                  onClick={() => select(e.id, currentCameraPose())}
                  onMouseEnter={() => hover(e.id)}
                  onMouseLeave={() => hover(null)}
                  className={`whitespace-nowrap rounded-sm border px-2 py-1 font-mono text-[11px] uppercase tracking-wider backdrop-blur-sm transition-colors ${
                    hot ? 'border-cyan-light bg-cyan/25 text-ink' : 'border-cyan/60 bg-abyss/70 text-cyan-light hover:bg-cyan/20'
                  }`}
                >
                  <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-cyan align-middle" aria-hidden />
                  {e.name}
                </button>
              </Html>
            </group>
          );
        })}
    </group>
  );
}
