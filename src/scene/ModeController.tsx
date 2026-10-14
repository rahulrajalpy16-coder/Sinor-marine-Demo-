import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { applyModeToMaterials } from '../rendering/applyMode';
import { useAppStore } from '../store/useAppStore';
import { reveal } from './reveal';

/** Keeps shared materials in sync with the visual mode and the intro reveal. */
export function ModeController() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);
  const lastRef = useRef({ mode: '', reveal: -1 });
  useFrame(() => {
    const last = lastRef.current;
    const mode = useAppStore.getState().visualMode;
    if (mode === last.mode && reveal.value === last.reveal) return;
    last.mode = mode;
    last.reveal = reveal.value;
    applyModeToMaterials(mode, reveal.value);
  });
  return null;
}
