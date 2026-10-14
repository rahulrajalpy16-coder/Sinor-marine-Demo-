import { useFrame } from '@react-three/fiber';
import { bowThruster } from '../simulations/controller';

/** Advances simulations once per frame (fixed-step inside), before any render-side reader. */
export function SimulationDriver() {
  useFrame((_, dt) => bowThruster.tick(dt), -1);
  return null;
}
