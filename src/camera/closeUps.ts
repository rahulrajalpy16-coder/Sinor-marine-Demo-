import type { CameraPose } from './cameraMachine';
import { hprDeployment } from '../simulations/deploymentController';
import { posRefs } from '../simulations/posrefsController';
import { sprintNavPos } from '../simulations/posrefs';
import { HPR_AXIS, HPR_DATUM_Y } from '../simulations/acoustic';
import { HPT5000, STROKE, transceiverY } from '../equipment/hprData';
import { SPRINTNAV } from '../equipment/posrefData';
import { PLACEMENTS } from '../equipment/registry';

/**
 * Close-up camera poses (vessel frame) for the small units that the system view frames from a distance.
 * Each follows the unit where it is now: on deck, swinging, deployed, or parked in the seachest.
 */
export const CLOSE_UPS: Record<string, { label: string; pose: () => CameraPose }> = {
  'hpr-001': {
    label: 'HPT 5000 close-up',
    pose: () => {
      const travel = hprDeployment.getState().travel;
      // Parked inside the seachest: the 7950 view looks through the open inspection door instead.
      if (travel < STROKE * 0.5) return { position: PLACEMENTS['deployment-001'].camera, target: PLACEMENTS['deployment-001'].target };
      const y = HPR_DATUM_Y + transceiverY(travel).flange - HPT5000.length.value / 2;
      // From forward and starboard, so the Sonardyne HPT band and its Forward mark face the camera.
      return { position: [HPR_AXIS.x + 0.95, y + 0.15, HPR_AXIS.z + 1.05], target: [HPR_AXIS.x, y, HPR_AXIS.z] };
    },
  },
  'sprintnav-001': {
    label: 'SPRINT-Nav close-up',
    pose: () => {
      const angle = posRefs.getState().pole.angleDeg;
      const p = sprintNavPos(angle);
      // The unit hangs below the pole end when deployed and lies along the deck edge when stowed.
      const k = angle / 90;
      const c: [number, number, number] = [p[0], p[1] - (SPRINTNAV.height.value / 2) * k, p[2] - (SPRINTNAV.height.value / 2) * (1 - k)];
      // From outboard (port), where the SPRINT-Nav band faces.
      return { position: [c[0] - 1.25, c[1] + 0.25 + 0.4 * (1 - k), c[2] + 0.6], target: c };
    },
  },
};
