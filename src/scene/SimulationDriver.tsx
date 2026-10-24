import { useFrame } from '@react-three/fiber';
import { bowThruster } from '../simulations/controller';
import { dpSystem } from '../simulations/dpController';
import { hprDeployment } from '../simulations/deploymentController';
import { posRefs } from '../simulations/posrefsController';

/** Advances simulations once per frame (fixed-step inside), before any render-side reader. */
export function SimulationDriver() {
  useFrame((_, dt) => {
    // Simulator freeze: every model holds its state (the camera and the screens stay live).
    if (dpSystem.frozen) return;
    const scale = dpSystem.timeScale;
    hprDeployment.tick(dt);
    const { eta, nu } = dpSystem.getState();
    posRefs.tick(dt, { eta, speed: Math.hypot(nu[0], nu[1]) });
    dpSystem.tick(dt);
    bowThruster.tick(dt * scale);
  }, -1);
  return null;
}
