import { ProceduralVessel } from './ProceduralVessel';
import { EquipmentAsset } from '../equipment/EquipmentAsset';
import { DPConsole } from '../equipment/DPConsole';
import { HPRTransducer } from '../equipment/HPRTransducer';
import { BowThruster } from '../equipment/BowThruster';

export function VesselWithEquipment() {
  return (
    <group>
      <ProceduralVessel />
      <EquipmentAsset id="dp-console-001" fallback={<DPConsole />} />
      <EquipmentAsset id="hpr-001" fallback={<HPRTransducer />} />
      <EquipmentAsset id="bow-thruster-001" fallback={<BowThruster />} />
    </group>
  );
}
