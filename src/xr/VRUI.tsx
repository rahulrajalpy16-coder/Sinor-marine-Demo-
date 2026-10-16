import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useXRInputSourceState } from '@react-three/xr';
import * as THREE from 'three';
import { useAppStore } from '../store/useAppStore';
import { getEquipment } from '../equipment/registry';
import { VRPanel } from './VRPanel';
import type { PanelButton } from './panelLayout';
import { VR_PLACES, placeById, placeForEquipment } from './vrPlaces';
import { TOUR } from './vrTour';
import { goToPlace, openMenu, useVRNav } from './vrNav';
import { readHeadPose } from './vrState';
import { TURN_LABEL, nextTurn, setComfort, useVRComfort } from './vrComfort';

const onOff = (v: boolean) => (v ? 'On' : 'Off');

/**
 * The headset's interface: the equipment card for whatever the controller ray selected, the menu (places,
 * guided tour, comfort), the tour cards and a first-run hint. X or Y on the left controller toggles the menu.
 * Each panel appears in front of the visitor when it opens (or after a teleport) and then stays put.
 */
export function VRUI() {
  const { menu, tourStep, menuSeen, goto } = useVRNav();
  const comfort = useVRComfort();
  const selectedId = useAppStore((s) => s.selectedId);
  const select = useAppStore((s) => s.select);
  const deselect = useAppStore((s) => s.deselect);
  useMenuButton();

  const startTour = () => {
    useVRNav.setState({ tourStep: 0, menu: 'closed' });
    deselect();
    goToPlace(TOUR[0].place);
  };
  const tourTo = (i: number) => {
    if (i < 0 || i >= TOUR.length) return endTour();
    const stop = TOUR[i];
    useVRNav.setState({ tourStep: i });
    goToPlace(stop.place);
    const eq = placeById(stop.place)?.equipmentId;
    if (eq) select(eq);
    else deselect();
  };
  const endTour = () => {
    useVRNav.setState({ tourStep: null });
    deselect();
  };

  let panel: { key: string; title: string; body?: string; buttons: PanelButton[]; columns?: number; onButton: (id: string) => void } | null = null;

  if (menu === 'main') {
    panel = {
      key: 'menu',
      title: 'Go to',
      buttons: [
        ...VR_PLACES.map((p) => ({ id: `place:${p.id}`, label: p.label })),
        { id: 'tour', label: tourStep === null ? 'Start guided tour' : 'Restart tour' },
        { id: 'comfort', label: 'Comfort settings' },
        { id: 'close', label: 'Close menu' },
      ],
      onButton: (id) => {
        if (id.startsWith('place:')) {
          const place = id.slice(6);
          goToPlace(place);
          useVRNav.setState({ menu: 'closed' });
          const eq = placeById(place)?.equipmentId;
          if (eq && tourStep === null) select(eq);
        } else if (id === 'tour') startTour();
        else if (id === 'comfort') openMenu('comfort');
        else useVRNav.setState({ menu: 'closed' });
      },
    };
  } else if (menu === 'comfort') {
    panel = {
      key: 'comfort',
      title: 'Comfort',
      body: 'Snap turning and the vignette help most people avoid motion sickness. Seated mode raises your view to standing height.',
      buttons: [
        { id: 'turn', label: `Turning: ${TURN_LABEL[comfort.turn]}` },
        { id: 'vignette', label: `Vignette: ${onOff(comfort.vignette)}`, active: comfort.vignette },
        { id: 'seated', label: `Seated mode: ${onOff(comfort.seated)}`, active: comfort.seated },
        { id: 'sound', label: `Sound: ${onOff(comfort.sound)}`, active: comfort.sound },
        { id: 'back', label: 'Back' },
        { id: 'close', label: 'Close menu' },
      ],
      onButton: (id) => {
        if (id === 'turn') setComfort({ turn: nextTurn(comfort.turn) });
        else if (id === 'vignette') setComfort({ vignette: !comfort.vignette });
        else if (id === 'seated') setComfort({ seated: !comfort.seated });
        else if (id === 'sound') setComfort({ sound: !comfort.sound });
        else if (id === 'back') openMenu('main');
        else useVRNav.setState({ menu: 'closed' });
      },
    };
  } else if (tourStep !== null) {
    const stop = TOUR[tourStep];
    const last = tourStep === TOUR.length - 1;
    panel = {
      key: `tour-${tourStep}`,
      title: `${tourStep + 1}/${TOUR.length} · ${stop.title}`,
      body: stop.text,
      columns: 3,
      buttons: [
        { id: 'prev', label: 'Back' },
        { id: 'next', label: last ? 'Finish' : 'Next' },
        { id: 'end', label: 'End tour' },
      ],
      onButton: (id) => (id === 'prev' ? tourTo(Math.max(0, tourStep - 1)) : id === 'next' ? tourTo(tourStep + 1) : endTour()),
    };
  } else if (selectedId) {
    const eq = getEquipment(selectedId);
    const place = placeForEquipment(selectedId);
    if (eq) {
      const specs = eq.placement.specs.slice(0, 3).map((s) => `${s.label}: ${s.value}`).join('\n');
      panel = {
        key: `eq-${selectedId}`,
        title: eq.name,
        body: `${eq.placement.summary}\n\n${specs}`,
        buttons: [...(place ? [{ id: 'go', label: 'Go there' }] : []), { id: 'close', label: 'Close' }],
        onButton: (id) => (id === 'go' && place ? goToPlace(place.id) : deselect()),
      };
    }
  } else if (!menuSeen) {
    panel = {
      key: 'hint',
      title: 'Welcome aboard',
      body: 'Point a controller at equipment and pull the trigger to learn about it. Press X on the left controller for places, the guided tour and comfort settings. Push the left stick to walk, the right stick to turn.',
      buttons: [{ id: 'menu', label: 'Open menu' }, { id: 'tour', label: 'Start guided tour' }],
      onButton: (id) => (id === 'tour' ? (openMenu('closed'), startTour()) : openMenu('main')),
    };
  }

  return (
    <InFrontOfVisitor placeKey={`${panel?.key}:${goto?.seq ?? 0}`}>
      {panel && <VRPanel key={panel.key} name={`vr-panel-${panel.key}`} title={panel.title} body={panel.body} buttons={panel.buttons} columns={panel.columns} onButton={panel.onButton} />}
    </InFrontOfVisitor>
  );
}

/** X or Y on the left controller opens or closes the menu (on the press, not while held). */
function useMenuButton() {
  const left = useXRInputSourceState('controller', 'left');
  const was = useRef(false);
  useFrame(() => {
    const g = left?.gamepad;
    const down = g?.['x-button']?.state === 'pressed' || g?.['y-button']?.state === 'pressed';
    if (down && !was.current) openMenu(useVRNav.getState().menu === 'closed' ? 'main' : 'closed');
    was.current = !!down;
  });
}

/**
 * Places its children 1.1 m in front of the visitor, a little below eye level and facing them, whenever `placeKey`
 * changes, in the parent's frame so it rides with the vessel. Waits a few frames so a teleport that triggered the
 * change has moved the headset first, and comes back if the visitor ends up more than 3 m away.
 */
function InFrontOfVisitor({ placeKey, children }: { placeKey: string; children: React.ReactNode }) {
  const camera = useThree((s) => s.camera);
  const group = useRef<THREE.Group>(null);
  const pending = useRef(6);
  const tmp = useMemo(() => ({ head: new THREE.Vector3(), q: new THREE.Quaternion(), fwd: new THREE.Vector3() }), []);
  useEffect(() => {
    pending.current = 6;
  }, [placeKey]);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    readHeadPose(camera, tmp.head, tmp.q);
    if (pending.current > 0) {
      pending.current--;
      return;
    }
    // Once placed, the panel stays put unless the visitor has walked well away from it (or a headset pose that was
    // still settling after a jump put it somewhere odd): then it comes back in front of them.
    if (pending.current < 0 && g.getWorldPosition(tmp.fwd).distanceTo(tmp.head) < 3) return;
    pending.current = -1;
    tmp.fwd.set(0, 0, -1).applyQuaternion(tmp.q).setY(0);
    if (tmp.fwd.lengthSq() < 1e-6) tmp.fwd.set(0, 0, -1);
    tmp.fwd.normalize();
    // Work out the pose in world space, then express it in the parent (the vessel-following frame).
    g.position.copy(tmp.head).addScaledVector(tmp.fwd, 1.1);
    g.position.y -= 0.12;
    g.quaternion.setFromEuler(new THREE.Euler(0, Math.atan2(-tmp.fwd.x, -tmp.fwd.z), 0));
    if (g.parent) {
      g.parent.worldToLocal(g.position);
      g.quaternion.premultiply(g.parent.getWorldQuaternion(tmp.q).invert());
    }
  });
  return <group ref={group}>{children}</group>;
}
