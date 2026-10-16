import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { VR_PLACES, placeForEquipment, placePose } from './vrPlaces';
import { isWalkable } from './vrDecks';
import { TOUR } from './vrTour';
import { layoutPanel, wrapText } from './panelLayout';
import { nextTurn, rotationOptions, vignetteStrength } from './vrComfort';
import { thrusterGain } from './VRAudio';
import { isXRPointerEvent } from '../interactions/input';
import { equipmentById } from '../equipment/registry';

const mono = (t: string) => t.length * 10;

describe('VR places', () => {
  it('stand on a walkable deck where one exists', () => {
    for (const id of ['aft-deck', 'dp-console', 'bridge-front', 'helideck']) {
      const p = VR_PLACES.find((x) => x.id === id)!;
      expect(isWalkable(p.floor), id).toBe(true);
    }
  });

  it('face the point of interest on arrival', () => {
    for (const p of VR_PLACES) {
      const { position, yaw } = placePose(p);
      const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, yaw, 0));
      const toLook = new THREE.Vector3(-p.look[0] - position[0], 0, p.look[2] - position[2]).normalize();
      expect(forward.dot(toLook), p.id).toBeGreaterThan(0.999);
    }
  });

  it('link to real systems, and every tour stop is a place', () => {
    for (const p of VR_PLACES) if (p.equipmentId) expect(equipmentById.has(p.equipmentId), p.id).toBe(true);
    for (const s of TOUR) expect(VR_PLACES.some((p) => p.id === s.place), s.place).toBe(true);
    expect(placeForEquipment('bow-thruster-001')?.id).toBe('bow-thruster');
  });
});

describe('VR panels', () => {
  it('wraps text to the width and keeps paragraphs', () => {
    const lines = wrapText('one two three four\nfive', 100, '', mono);
    expect(lines).toEqual(['one two', 'three four', 'five']);
    expect(lines.every((l) => mono(l) <= 100)).toBe(true);
  });

  it('lays buttons out in a grid below the text', () => {
    const l = layoutPanel({ title: 'T', body: 'b', buttons: [1, 2, 3].map((i) => ({ id: `${i}`, label: `${i}` })) }, 1000, mono);
    expect(l.buttons[0].y).toBe(l.buttons[1].y);
    expect(l.buttons[2].y).toBeGreaterThan(l.buttons[0].y);
    expect(l.buttons[1].x).toBeGreaterThan(l.buttons[0].x);
    expect(l.height).toBeGreaterThan(l.buttons[2].y + l.buttons[2].h);
  });

  it('cuts very long text with an ellipsis', () => {
    const l = layoutPanel({ title: 'T', body: 'word '.repeat(500), buttons: [], maxBodyLines: 4 }, 300, mono);
    expect(l.body).toHaveLength(4);
    expect(l.body[3].endsWith('…')).toBe(true);
  });
});

describe('VR comfort and sound', () => {
  it('maps turning styles to locomotion options and cycles through them', () => {
    expect(rotationOptions('snap30')).toEqual({ type: 'snap', degrees: 30 });
    expect(rotationOptions('smooth').type).toBe('smooth');
    expect(nextTurn(nextTurn(nextTurn('snap45')))).toBe('snap45');
  });

  it('vignettes only on real movement', () => {
    expect(vignetteStrength(0.05, 0)).toBe(0);
    expect(vignetteStrength(1, 0)).toBe(1);
    expect(vignetteStrength(0, 0.5)).toBeGreaterThan(0);
  });

  it('is silent when stopped and louder under load', () => {
    expect(thrusterGain(1, false)).toBe(0);
    expect(thrusterGain(0, true)).toBeGreaterThan(0);
    expect(thrusterGain(-1, true)).toBeGreaterThan(thrusterGain(0.3, true));
    expect(thrusterGain(5, true)).toBe(1);
  });

  it('tells headset pointer events from screen events', () => {
    expect(isXRPointerEvent({ internalPointer: {} })).toBe(true);
    expect(isXRPointerEvent({ delta: 0 })).toBe(false);
  });
});
