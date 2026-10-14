import { FixedStepper } from './fixedStep';
import type { SimulationController } from './controller';
import { applyPosRefCommand, initialPosRefState, stepPosRefs, type PosRefCommand, type PosRefState, type VesselPose } from './posrefs';

/**
 * Holds the RadaScan, CyScan, taut wire and SPRINT-Nav operating state outside React.
 * The simulation driver passes the vessel pose from DP on every tick (the taut wire angle and the
 * relative sensors' ranges depend on where the vessel is).
 */
export class PosRefController implements SimulationController<PosRefState, PosRefCommand> {
  readonly id = 'position-references';
  private state: PosRefState = initialPosRefState();
  private listeners = new Set<(s: PosRefState) => void>();
  private stepper = new FixedStepper(1 / 30, 240);
  private sinceNotify = 0;
  private pose: VesselPose = { eta: [0, 0, 0], speed: 0 };
  private scale = 5;
  lastError: string | null = null;

  constructor(private notifyHz = 10) {}

  getState() {
    return this.state;
  }

  getPose() {
    return this.pose;
  }

  dispatch(cmd: PosRefCommand) {
    try {
      this.state = applyPosRefCommand(this.state, cmd, this.pose);
      this.lastError = null;
      if (cmd.type === 'reset') this.stepper.reset();
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : String(e);
    }
    this.emit();
  }

  get timeScale() {
    return this.scale;
  }

  setTimeScale(scale: number) {
    if (![1, 5, 10, 20].includes(scale)) return;
    this.scale = scale;
    this.emit();
  }

  tick(frameSeconds: number, pose: VesselPose = this.pose) {
    this.pose = pose;
    const before = this.state;
    const n = this.stepper.advance(frameSeconds * this.scale);
    for (let i = 0; i < n; i++) this.state = stepPosRefs(this.state, this.stepper.stepSeconds, pose);
    this.sinceNotify += frameSeconds;
    const phase = (s: PosRefState) => `${s.radascan.phase}${s.cyscan.phase}${s.tautwire.phase}${s.pole.phase}${s.alarms.length}`;
    if (this.state !== before && (phase(before) !== phase(this.state) || this.sinceNotify >= 1 / this.notifyHz)) this.emit();
  }

  subscribe(listener: (s: PosRefState) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  listenerCount() {
    return this.listeners.size;
  }

  private emit() {
    this.sinceNotify = 0;
    for (const l of this.listeners) l(this.state);
  }
}

/** App-wide singleton: RadaScan, CyScan, taut wire and SPRINT-Nav operating state. */
export const posRefs = new PosRefController();
