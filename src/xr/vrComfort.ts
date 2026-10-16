import { create } from 'zustand';

export type TurnStyle = 'snap30' | 'snap45' | 'smooth';

export interface VRComfort {
  turn: TurnStyle;
  /** Darken the edges of the view while walking or turning smoothly. */
  vignette: boolean;
  /** Raise the view for a seated visitor, so eye height matches someone standing. */
  seated: boolean;
  /** Machinery sound from the thrusters. */
  sound: boolean;
}

export const DEFAULT_COMFORT: VRComfort = { turn: 'snap45', vignette: true, seated: false, sound: true };
/** Standing minus seated eye height, roughly. */
export const SEATED_LIFT_M = 0.5;

const KEY = 'sinor.vrComfort';

function load(): VRComfort {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_COMFORT, ...(JSON.parse(raw) as Partial<VRComfort>) } : DEFAULT_COMFORT;
  } catch {
    return DEFAULT_COMFORT;
  }
}

export const useVRComfort = create<VRComfort>(() => (typeof window === 'undefined' ? DEFAULT_COMFORT : load()));

/** Change comfort settings; they are remembered on this device. */
export function setComfort(patch: Partial<VRComfort>) {
  useVRComfort.setState(patch);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(useVRComfort.getState()));
  } catch {
    // Storage blocked (private mode): the setting still applies for this visit.
  }
}

/** Right-stick turning options for useXRControllerLocomotion. */
export function rotationOptions(turn: TurnStyle) {
  if (turn === 'smooth') return { type: 'smooth' as const, speed: 1.6 };
  return { type: 'snap' as const, degrees: turn === 'snap30' ? 30 : 45 };
}

export const TURN_LABEL: Record<TurnStyle, string> = { snap30: 'Snap 30°', snap45: 'Snap 45°', smooth: 'Smooth' };
export const nextTurn = (t: TurnStyle): TurnStyle => (t === 'snap30' ? 'snap45' : t === 'snap45' ? 'smooth' : 'snap30');

/** Tunnel-vision strength for a stick push and a smooth turn rate, 0 (none) to 1 (strongest). */
export function vignetteStrength(walk: number, turnRate: number): number {
  const v = Math.max(Math.min(1, Math.abs(walk)), Math.min(1, Math.abs(turnRate)));
  return v < 0.15 ? 0 : Math.min(1, (v - 0.15) / 0.6);
}
