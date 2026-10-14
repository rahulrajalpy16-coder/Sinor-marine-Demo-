import { ProceduralVessel } from './ProceduralVessel';
import { EquipmentAsset } from '../equipment/EquipmentAsset';
import { DPConsole } from '../equipment/DPConsole';
import { IntegratedBridge } from '../equipment/IntegratedBridge';
import { HPT5000Transceiver, Type7950Machine } from '../equipment/HPRSystem';
import { BowThruster } from '../equipment/BowThruster';
import { BT2Tunnel, DPNetworkOverlay } from '../scene/DPSceneOverlay';

export function VesselWithEquipment() {
  return (
    <group>
      <ProceduralVessel />
      <EquipmentAsset id="ibs-001" fallback={<IntegratedBridge />} />
      <EquipmentAsset id="dp-console-001" fallback={<DPConsole />} />
      <EquipmentAsset id="hpr-001" fallback={<HPT5000Transceiver />} />
      <EquipmentAsset id="deployment-001" fallback={<Type7950Machine />} />
      <EquipmentAsset id="bow-thruster-001" fallback={<BowThruster />} />
      <BT2Tunnel />
      <DPNetworkOverlay />
    </group>
  );
}
