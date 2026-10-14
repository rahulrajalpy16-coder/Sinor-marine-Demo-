import { useFrame } from '@react-three/fiber';
import { bowThruster } from '../simulations/controller';
import { dpSystem } from '../simulations/dpController';
import { hprDeployment } from '../simulations/deploymentController';

/** Advances simulations once per frame (fixed-step inside), before any render-side reader. */
export function SimulationDriver() {
  useFrame((_, dt) => {
    const scale = dpSystem.timeScale;
    hprDeployment.tick(dt);
    dpSystem.tick(dt);
    bowThruster.tick(dt * scale);
  }, -1);
  return null;
}
