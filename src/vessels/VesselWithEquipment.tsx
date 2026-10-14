import { ProceduralVessel } from './ProceduralVessel';
import { EquipmentAsset } from '../equipment/EquipmentAsset';
import { DPConsole } from '../equipment/DPConsole';
import { IntegratedBridge } from '../equipment/IntegratedBridge';
import { HPT5000Transceiver, Type7950Machine } from '../equipment/HPRSystem';
import { BowThruster } from '../equipment/BowThruster';
import { CyScanSensor, DGPSAntennas, RadaScanSensor, SprintNavPole, TautWireUnit } from '../equipment/PositionReferences';
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
      <EquipmentAsset id="radascan-001" fallback={<RadaScanSensor />} />
      <EquipmentAsset id="cyscan-001" fallback={<CyScanSensor />} />
      <EquipmentAsset id="dgps-001" fallback={<DGPSAntennas />} />
      <EquipmentAsset id="tautwire-001" fallback={<TautWireUnit />} />
      <EquipmentAsset id="sprintnav-001" fallback={<SprintNavPole />} />
      <BT2Tunnel />
      <DPNetworkOverlay />
    </group>
  );
}
