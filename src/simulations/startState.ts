/**
 * Where the simulation starts. By default the vessel is on station: the HPR deployed and RadaScan, CyScan, taut
 * wire and SPRINT-Nav running, so every position reference is connected and available to DP. `?start=stowed` starts
 * with everything parked instead (used by the browser tests and to demonstrate the deployment sequences).
 */
export function startOnStation(search = typeof window !== 'undefined' ? window.location.search : ''): boolean {
  return new URLSearchParams(search).get('start') !== 'stowed';
}
