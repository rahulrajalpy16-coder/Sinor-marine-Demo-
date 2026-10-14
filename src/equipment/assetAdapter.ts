/**
 * Asset adapter: decides whether a planned GLB exists before trying to load it.
 * SPA dev servers answer unknown paths with index.html, so a 200 alone is not proof of a model.
 */
export async function probeAsset(url: string | null, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (!url) return false;
  try {
    const res = await fetchImpl(url, { method: 'HEAD' });
    if (!res.ok) return false;
    const type = res.headers.get('content-type') ?? '';
    return /model\/gltf|octet-stream/.test(type) && !/text\/html/.test(type);
  } catch {
    return false;
  }
}
