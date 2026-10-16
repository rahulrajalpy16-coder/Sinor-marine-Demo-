import { useEffect, useMemo, useRef, useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { LINE_HEIGHT, PANEL_FONT, layoutPanel, type PanelButton } from './panelLayout';

const CANVAS_W = 1024;
const COLORS = { bg: 'rgba(2, 19, 31, 0.94)', border: '#5fd6ff', title: '#e8f6ff', body: '#b9d4e6', btn: '#0b3550', btnHover: '#16618d', btnActive: '#1f7fb0', btnText: '#e8f6ff' };

let measureCtx: CanvasRenderingContext2D | null = null;
const measure = (text: string, font: string) => {
  measureCtx ??= document.createElement('canvas').getContext('2d')!;
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
};

export interface VRPanelProps {
  title: string;
  body?: string;
  buttons: PanelButton[];
  columns?: number;
  /** Panel width in metres. */
  width?: number;
  onButton: (id: string) => void;
  name?: string;
}

/**
 * A flat, canvas-drawn panel for the headset: title, wrapped text and a grid of buttons that the controller rays
 * hover and click. Drawn on top of the scene so a nearby bulkhead never hides it.
 */
export function VRPanel({ title, body, buttons, columns, width = 0.9, onButton, name }: VRPanelProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  // A press is trigger down and up on the same button, however long it is held (pointer-events' own click gives up
  // after 300 ms, which a deliberate trigger pull easily exceeds).
  const pressed = useRef<string | null>(null);
  const layout = useMemo(() => layoutPanel({ title, body, buttons, columns }, CANVAS_W, measure), [title, body, buttons, columns]);
  const canvas = useMemo(() => document.createElement('canvas'), []);
  const tex = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);
  useEffect(() => () => tex.dispose(), [tex]);

  useEffect(() => {
    canvas.width = layout.width;
    canvas.height = layout.height;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, layout.width, layout.height);
    ctx.fillStyle = COLORS.bg;
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(2, 2, layout.width - 4, layout.height - 4, 24);
    ctx.fill();
    ctx.stroke();
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = COLORS.title;
    ctx.font = PANEL_FONT.title;
    layout.title.forEach((l, i) => ctx.fillText(l, LINE_HEIGHT.pad, LINE_HEIGHT.pad + 40 + i * LINE_HEIGHT.title));
    ctx.fillStyle = COLORS.body;
    ctx.font = PANEL_FONT.body;
    layout.body.forEach((l, i) => ctx.fillText(l, LINE_HEIGHT.pad, layout.bodyTop + 28 + i * LINE_HEIGHT.body));
    ctx.font = PANEL_FONT.button;
    ctx.textAlign = 'center';
    for (const b of layout.buttons) {
      ctx.fillStyle = b.id === hovered ? COLORS.btnHover : b.active ? COLORS.btnActive : COLORS.btn;
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 14);
      ctx.fill();
      if (b.id === hovered) {
        ctx.strokeStyle = COLORS.border;
        ctx.stroke();
      }
      ctx.fillStyle = COLORS.btnText;
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 10, b.w - 20);
    }
    ctx.textAlign = 'left';
    tex.needsUpdate = true;
  }, [layout, hovered, canvas, tex]);

  const s = width / layout.width;
  const height = layout.height * s;
  const stop = (e: ThreeEvent<PointerEvent | MouseEvent>) => e.stopPropagation();

  return (
    <group name={name}>
      <mesh renderOrder={990} onPointerOver={stop} onClick={stop}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={tex} transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      {layout.buttons.map((b) => (
        <mesh
          key={b.id}
          name={`vr-button-${b.id}`}
          position={[(b.x + b.w / 2) * s - width / 2, height / 2 - (b.y + b.h / 2) * s, 0.002]}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(b.id);
          }}
          onPointerOut={() => {
            setHovered((h) => (h === b.id ? null : h));
            if (pressed.current === b.id) pressed.current = null;
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            pressed.current = b.id;
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            if (pressed.current !== b.id) return;
            pressed.current = null;
            onButton(b.id);
          }}
          onClick={stop}
        >
          <planeGeometry args={[b.w * s, b.h * s]} />
          <meshBasicMaterial transparent opacity={0} depthTest={false} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
