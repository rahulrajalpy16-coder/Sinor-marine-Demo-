import { Component, Suspense, useEffect, useState, type ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';
import { probeAsset } from './assetAdapter';
import { getEquipment } from './registry';
import { useAppStore } from '../store/useAppStore';
import { useSelectable } from '../interactions/useSelectable';

class AssetBoundary extends Component<{ fallback: ReactNode; onFail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function GLBModel({ id, url }: { id: string; url: string }) {
  const { scene } = useGLTF(url);
  const handlers = useSelectable(id);
  return <primitive object={scene} {...handlers} />;
}

/**
 * Renders the equipment's planned GLB when it exists, otherwise the procedural representative model.
 * A missing or broken model never crashes the scene.
 */
export function EquipmentAsset({ id, fallback }: { id: string; fallback: ReactNode }) {
  const eq = getEquipment(id);
  const setStatus = useAppStore((s) => s.setAssetStatus);
  const [hasGlb, setHasGlb] = useState(false);
  useEffect(() => {
    let alive = true;
    setStatus(id, 'probing');
    probeAsset(eq?.model ?? null).then((ok) => {
      if (!alive) return;
      setHasGlb(ok);
      setStatus(id, ok ? 'glb' : 'procedural');
    });
    return () => {
      alive = false;
    };
  }, [id, eq?.model, setStatus]);

  if (!hasGlb || !eq?.model) return <>{fallback}</>;
  return (
    <AssetBoundary fallback={fallback} onFail={() => setStatus(id, 'procedural')}>
      <Suspense fallback={fallback}>
        <GLBModel id={id} url={eq.model} />
      </Suspense>
    </AssetBoundary>
  );
}
