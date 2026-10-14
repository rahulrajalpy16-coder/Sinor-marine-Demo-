import type { ComponentType } from 'react';
import { ThrusterPanel } from './ThrusterPanel';
import { HPRPanel } from './HPRPanel';
import { DPPanel } from './DPPanel';
import { CyScanPanel, DGPSPanel, RadaScanPanel, SprintNavPanel, TautWirePanel } from './PosRefPanel';

/**
 * Simulation/HMI panel for each equipment id. The Inspector hosts these inside the responsive
 * containers (side column, tablet drawer, phone bottom sheet), so a new system only adds a line here.
 * Panels should lay out in a single column below 640 px and may open full screen through a portal.
 */
export const SYSTEM_PANELS: Record<string, ComponentType> = {
  'bow-thruster-001': ThrusterPanel,
  'hpr-001': HPRPanel,
  'deployment-001': HPRPanel,
  'dp-console-001': DPPanel,
  'radascan-001': RadaScanPanel,
  'cyscan-001': CyScanPanel,
  'dgps-001': DGPSPanel,
  'tautwire-001': TautWirePanel,
  'sprintnav-001': SprintNavPanel,
};
