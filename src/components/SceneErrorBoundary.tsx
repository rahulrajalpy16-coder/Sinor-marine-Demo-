import { Component, type ReactNode } from 'react';

/** If WebGL or the scene fails, keep the HUD and accessible equipment list usable. */
export class SceneErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <div className="max-w-md rounded-sm border border-amber-300/40 bg-abyss/90 p-5">
            <h2 className="mb-2 text-ink">3D view unavailable</h2>
            <p className="text-sm text-mute">
              The 3D scene could not start ({this.state.error}). The system explorer and equipment details still work.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
