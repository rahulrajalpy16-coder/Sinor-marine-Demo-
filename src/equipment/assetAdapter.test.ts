import { probeAsset } from './assetAdapter';

const res = (ok: boolean, type: string) => ({ ok, headers: new Headers({ 'content-type': type }) }) as Response;

describe('asset adapter', () => {
  it('falls back when the model is missing, is HTML (SPA fallback) or the request fails', async () => {
    expect(await probeAsset(null)).toBe(false);
    expect(await probeAsset('/m.glb', async () => res(false, 'text/plain'))).toBe(false);
    expect(await probeAsset('/m.glb', async () => res(true, 'text/html'))).toBe(false);
    expect(await probeAsset('/m.glb', async () => {
      throw new Error('offline');
    })).toBe(false);
  });
  it('accepts a real GLB response', async () => {
    expect(await probeAsset('/m.glb', async () => res(true, 'model/gltf-binary'))).toBe(true);
  });
});
