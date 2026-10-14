import { FixedStepper } from './fixedStep';
import type { SimulationController } from './controller';
import { applyDPCommand, initialDPState, stepDP, type DPCommand, type DPState, type RefId } from './dp';
import { bowThruster } from './controller';
import { DEFAULT_THRUSTER_PARAMS } from './thruster';
import { hprDeployment } from './deploymentController';
import { hprReady } from './deployment';
import { posRefs } from './posrefsController';
import { posRefReadiness } from './posrefs';

/** Which position references can measure now: HPR from the Type 7950, the rest from their own states. */
function readiness(): Partial<Record<RefId, boolean>> {
  return { HPR: hprReady(hprDeployment.getState()), ...posRefReadiness(posRefs.getState(), posRefs.getPose()) };
}

/** Simulated seconds per fixed step. The model is slow (vessel time constants are minutes). */
const DP_STEP = 0.05;

/**
 * Holds DP state outside React. Each frame advances simulated time by frame × timeScale and couples
 * the bow thruster (DP reads BT1's delivered thrust and, when BT1 is in DP command, writes its pitch)
 * and the position references (the HPR only measures while the Type 7950 has the transceiver deployed;
 * RadaScan, CyScan, taut wire and SPRINT-Nav only once running, see posrefs.ts).
 */
export class DPController implements SimulationController<DPState, DPCommand> {
  readonly id = 'dp-3dof';
  private state: DPState = initialDPState(2);
  private listeners = new Set<(s: DPState) => void>();
  private stepper = new FixedStepper(DP_STEP, 400);
  private sinceNotify = 0;
  lastError: string | null = null;

  constructor(private notifyHz = 10) {}

  getState() {
    return this.state;
  }

  dispatch(cmd: DPCommand) {
    try {
      this.state = applyDPCommand(this.state, cmd);
      this.lastError = null;
      if (cmd.type === 'reset' || cmd.type === 'set-class') this.stepper.reset();
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : String(e);
    }
    this.emit();
  }

  /** Scale applied to the frame time, so the bow thruster can be advanced at the same pace. */
  get timeScale() {
    return this.state.status === 'running' ? this.state.timeScale : 1;
  }

  tick(frameSeconds: number) {
    if (this.state.status !== 'running') {
      // Keep the references' readiness current for the panels even while DP is stopped.
      const ready = readiness();
      if (this.state.refs.some((r) => ready[r.id] !== undefined && ready[r.id] !== r.ready)) {
        this.state = { ...this.state, refs: this.state.refs.map((r) => (ready[r.id] !== undefined ? { ...r, ready: ready[r.id]! } : r)) };
        this.emit();
      }
      return;
    }
    const before = this.state;
    const n = this.stepper.advance(frameSeconds * this.state.timeScale);
    for (let i = 0; i < n; i++) {
      const bt = bowThruster.getState();
      const available = bt.station === 'DP' && bt.status === 'running';
      const out = stepDP(this.state, DP_STEP, {
        bt1: { available, forceN: bt.thrustKN * 1000 },
        ready: readiness(),
      });
      this.state = out.state;
      if (bt.station === 'DP') {
        // Thrust ~ |pitch|^1.5 at rated speed, so invert for the pitch setpoint.
        const f = out.bt1CmdN / (DEFAULT_THRUSTER_PARAMS.maxThrustKN * 1000);
        bowThruster.setDpPitch(Math.sign(f) * Math.min(1, Math.abs(f)) ** (2 / 3));
      }
    }
    this.sinceNotify += frameSeconds;
    if (this.state !== before && (this.sinceNotify >= 1 / this.notifyHz || before.alarms.length !== this.state.alarms.length)) this.emit();
  }

  subscribe(listener: (s: DPState) => void) {
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

/** App-wide singleton: the vessel's DP system. */
export const dpSystem = new DPController();
