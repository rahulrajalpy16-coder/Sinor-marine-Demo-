import { FixedStepper } from './fixedStep';
import type { SimulationController } from './controller';
import { applyDPCommand, initialDPState, operatorStationAvailable, type DPCommand, type DPState, type RefId } from './dp';
import { bowThruster } from './controller';
import { DEFAULT_THRUSTER_PARAMS, thrustFrom } from './thruster';
import { coreStep, CORE_STEP } from './vesselCore';
import { powerSystem, windSystem } from './powerController';
import { hprDeployment } from './deploymentController';
import { hprReady } from './deployment';
import { posRefs } from './posrefsController';
import { posRefReadiness } from './posrefs';

/** Which position references can measure now: HPR from the Type 7950, the rest from their own states. */
function readiness(): Partial<Record<RefId, boolean>> {
  return { HPR: hprReady(hprDeployment.getState()), ...posRefReadiness(posRefs.getState(), posRefs.getPose()) };
}

/** Simulated seconds per fixed step (the shared core step). */
const DP_STEP = CORE_STEP;
/** Commands that are given at the DP operator station (blocked when no station has power). */
const OPERATOR_COMMANDS = new Set<DPCommand['type']>(['set-mode', 'set-setpoint', 'setpoint-here', 'set-joystick', 'ref-enable', 'acknowledge']);

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
      if (OPERATOR_COMMANDS.has(cmd.type) && this.state.status === 'running' && !operatorStationAvailable(this.state)) {
        throw new Error('No DP operator station has power: the command cannot be given (restore UPS power, or use the simulator reset)');
      }
      this.state = applyDPCommand(this.state, cmd);
      this.lastError = null;
      if (cmd.type === 'set-class') powerSystem.dispatch({ type: 'set-dp-class', value: cmd.value });
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

  /** Whole-simulator freeze (independent of the DP's own pause), used by the simulator controls. */
  frozen = false;
  setFrozen(v: boolean) {
    this.frozen = v;
    this.emit();
  }

  /**
   * Advance the shared core (electrical plant, wind, DP and vessel) by the frame time × simulation speed. The plant
   * and the wind run whenever the simulator is not frozen or paused; the vessel model only while DP is running.
   */
  tick(frameSeconds: number) {
    if (this.state.status !== 'running') {
      // Keep the references' readiness current for the panels even while DP is stopped.
      const ready = readiness();
      if (this.state.refs.some((r) => ready[r.id] !== undefined && ready[r.id] !== r.ready)) {
        this.state = { ...this.state, refs: this.state.refs.map((r) => (ready[r.id] !== undefined ? { ...r, ready: ready[r.id]! } : r)) };
        this.emit();
      }
    }
    if (this.frozen || this.state.status === 'paused') return;
    const before = this.state;
    const n = this.stepper.advance(frameSeconds * this.state.timeScale);
    for (let i = 0; i < n; i++) {
      const bt = bowThruster.getState();
      const inDp = bt.station === 'DP';
      const out = coreStep({ dp: this.state, power: powerSystem.getState(), wind: windSystem.getState() }, DP_STEP, {
        bt1: {
          inDp,
          running: bt.status === 'running' || bt.status === 'starting',
          forceN: bt.thrustKN * 1000,
          shaftKW: bt.powerKW,
          cmdN: inDp ? Math.abs(this.state.thrusters[0].cmdN) : Math.abs(thrustFrom(Math.abs(bt.command), DEFAULT_THRUSTER_PARAMS.ratedRpm)) * 1000,
        },
        ready: readiness(),
        sprintnavAided: posRefs.getState().sprintnav.gnssAiding,
      });
      this.state = out.core.dp;
      powerSystem.set(out.core.power, i === n - 1 ? frameSeconds : 0);
      windSystem.set(out.core.wind, i === n - 1 ? frameSeconds : 0);
      bowThruster.applySupply(out.bt1Supply.available, out.bt1Supply.limit);
      if (inDp) {
        // After a supply loss the Z-Thrust restarts BT1 automatically while DP has command.
        if (bt.status === 'stopped' && out.bt1Supply.available && this.state.status === 'running') bowThruster.dispatch({ type: 'start' });
        // Thrust ~ |pitch|^1.5 at rated speed, so invert for the pitch setpoint.
        const f = out.bt1CmdN / (DEFAULT_THRUSTER_PARAMS.maxThrustKN * 1000);
        bowThruster.setDpPitch(Math.sign(f) * Math.min(1, Math.abs(f)) ** (2 / 3));
      }
    }
    this.sinceNotify += frameSeconds;
    if (this.state !== before && (this.sinceNotify >= 1 / this.notifyHz || before.alarms.length !== this.state.alarms.length)) this.emit();
  }

  /** Replace the whole state (simulator reset, scenario load) and notify. */
  replace(next: DPState) {
    this.state = next;
    this.stepper.reset();
    this.lastError = null;
    this.emit();
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
