import registryJson from '../data/equipment-registry.json';
import vesselJson from '../data/vessel-config.json';
import designJson from '../data/design-config.json';
import { parseDesignConfig, parseEquipmentRegistry, parseVesselConfig, SchemaError } from './schema';
import { equipment, PLACEMENTS, registry } from './registry';

describe('content schemas', () => {
  it('parses the shipped registry, vessel and design config', () => {
    const reg = parseEquipmentRegistry(registryJson);
    expect(reg.equipment).toHaveLength(10);
    const v = parseVesselConfig(vesselJson, new Set(reg.equipment.map((e) => e.id)));
    expect(v.certified).toBe(false);
    expect(v.dimensionsMeters).toEqual({ length: 78, beam: 20, depth: 6.5 });
    expect(parseDesignConfig(designJson).defaultMode).toBe('hybrid');
  });

  it('has unique equipment ids and a placement for each', () => {
    const ids = registry.equipment.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(PLACEMENTS[id]).toBeDefined();
  });

  it('rejects duplicate ids', () => {
    const dup = { ...registryJson, equipment: [registryJson.equipment[0], registryJson.equipment[0]] };
    expect(() => parseEquipmentRegistry(dup)).toThrow(/duplicate/);
  });

  it('rejects unknown actions and malformed ids', () => {
    const bad = { ...registryJson, equipment: [{ ...registryJson.equipment[0], actions: ['launch-missiles'] }] };
    expect(() => parseEquipmentRegistry(bad)).toThrow(SchemaError);
    const badId = { ...registryJson, equipment: [{ ...registryJson.equipment[0], id: 'DP Console' }] };
    expect(() => parseEquipmentRegistry(badId)).toThrow(/kebab/);
  });

  it('rejects a vessel referencing unknown equipment or claiming certification', () => {
    expect(() => parseVesselConfig({ ...vesselJson, equipmentIds: ['nope'] }, new Set(['a']))).toThrow(/unknown equipment/);
    expect(() => parseVesselConfig({ ...vesselJson, certified: true })).toThrow(/certified/);
    expect(() => parseVesselConfig({ ...vesselJson, coordinates: { ...vesselJson.coordinates, up: '+Z' } })).toThrow(/coordinates/);
  });

  it('rejects unknown visual modes', () => {
    expect(() => parseDesignConfig({ ...designJson, modes: ['hybrid', 'psychedelic'] })).toThrow(/mode/);
  });

  it('marks the modelled systems as implemented', () => {
    expect(equipment.filter((e) => e.placement.implemented).map((e) => e.id).sort()).toEqual(
      [
        'bow-thruster-001',
        'cyscan-001',
        'deployment-001',
        'dgps-001',
        'dp-console-001',
        'hpr-001',
        'ibs-001',
        'radascan-001',
        'sprintnav-001',
        'tautwire-001',
      ],
    );
  });
});
