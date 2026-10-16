import { useEffect, useState } from 'react';
import { enterVR, xrStore } from './xrStore';

/** "Enter VR" button, shown only where the browser reports immersive VR support (Quest browser, PC VR). */
export function EnterVRButton() {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    let live = true;
    const check = () =>
      navigator.xr
        ?.isSessionSupported('immersive-vr')
        .then((ok) => live && setSupported(ok))
        .catch(() => undefined);
    check();
    // The dev emulator installs itself asynchronously; check again once it is in place.
    const unsubscribe = xrStore.subscribe((s, prev) => s.emulator !== prev.emulator && check());
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);
  if (!supported) return null;
  return (
    <button
      type="button"
      data-testid="enter-vr"
      onClick={() => void enterVR()}
      className="rounded-sm border border-cyan bg-cyan/20 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-ink hover:bg-cyan/30 coarse:min-h-[44px]"
    >
      Enter VR
    </button>
  );
}
