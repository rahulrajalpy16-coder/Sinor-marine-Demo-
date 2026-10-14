import type { ComponentType } from 'react';
import { ThrusterPanel } from './ThrusterPanel';
import { HPRPanel } from './HPRPanel';
import { DPPanel } from './DPPanel';

/**
 * Simulation/HMI panel for each equipment id. The Inspector hosts these inside the responsive
 * containers (side column, tablet drawer, phone bottom sheet), so a new system only adds a line here.
 * Panels should lay out in a single column below 640 px and may open full screen through a portal.
 */
export const SYSTEM_PANELS: Record<string, ComponentType> = {
  'bow-thruster-001': ThrusterPanel,
  'hpr-001': HPRPanel,
  'dp-console-001': DPPanel,
};
