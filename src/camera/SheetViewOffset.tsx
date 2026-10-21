import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { sheetCover } from '../components/shell/BottomSheet';

/**
 * On phones the details sheet covers the lower part of the screen. Shift the view's centre up into the space left
 * above the sheet, so the focused system is not hidden behind it. Eases with the sheet; clears when it closes.
 */
export function SheetViewOffset() {
  const { camera, size } = useThree();
  const shift = useRef(0);
  useFrame((_, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    // Centre of the visible area: half the covered height up from the canvas centre (capped so it never leaves the top).
    const target = (Math.min(sheetCover.fraction, 0.6) * size.height * 0.85) / 2;
    shift.current += (target - shift.current) * (1 - Math.exp(-dt * 6));
    if (Math.abs(shift.current) < 0.5 && target === 0) {
      if (cam.view?.enabled) cam.clearViewOffset();
      shift.current = 0;
      return;
    }
    cam.setViewOffset(size.width, size.height, 0, shift.current, size.width, size.height);
  });
  return null;
}
