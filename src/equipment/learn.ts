/**
 * Learning content for each system: what it is for, how it works, and a short exercise on its simulator panel.
 * Written for visitors with no marine background; the "try" steps name the real buttons on each panel.
 */
export interface SystemLesson {
  /** One line under the system's name in the systems list. */
  tag: string;
  /** Its job on board, in one or two sentences. */
  role: string;
  /** How it works, in order. */
  how: string[];
  /** A short exercise on the simulator panel. */
  tryIt: string[];
  /** One fact worth remembering. */
  fact?: string;
}

export const LESSONS: Record<string, SystemLesson> = {
  'ibs-001': {
    tag: 'Navigation and control centre',
    role: 'The integrated bridge brings radar, electronic charts, conning and thruster control onto one network, so the officer of the watch can see and control the vessel from one place.',
    how: [
      'Sensors such as GNSS, gyro compass, speed log, wind and radar feed a dual redundant network.',
      'Each multi-function workstation can show radar, ECDIS (electronic chart) or the conning display.',
      'The autopilot and thruster levers on the forward console steer and drive the vessel in transit.',
      'Alarms from every system are gathered centrally and the bridge watch alarm checks the officer is alert.',
      'For station keeping, control passes to the aft-facing DP station, which looks over the working deck.',
    ],
    tryIt: [
      'Orbit around the forward console to find the five workstations, the levers and the GMDSS wing.',
      'Switch to Realistic mode to see the bridge as built.',
      'Open the DP System from the systems list to take control of the vessel from the aft station.',
    ],
    fact: 'Every workstation is multi-function, so any of the five can take over radar or chart duty if another one fails.',
  },
  'dp-console-001': {
    tag: 'Holds position and heading automatically',
    role: 'Dynamic positioning keeps the vessel on a chosen position and heading using only its own thrusters, so it can work next to platforms or over subsea sites without anchors.',
    how: [
      'Position references (GNSS, HPR, CyScan, RadaScan, taut wire and SPRINT-Nav) each measure where the vessel is.',
      'The DP controllers compare the references, reject any that disagree with the rest, and blend the others into one position.',
      'They compare that position and the gyro heading with the setpoint and work out the force needed, adding a feed-forward from the wind sensors.',
      'Thrust allocation shares the force between the bow thrusters and the stern azimuths.',
      'Consequence analysis keeps checking that the vessel could still hold position after its worst single failure (DP2 and DP3).',
    ],
    tryIt: [
      'Press START SIM, then AUTO POS to hold the current position.',
      'Raise the wind or current and watch the thrusters work harder to stay on the spot.',
      'Fail a thruster, or make a reference drift, and see the alarms and the voting reject it.',
      'Change the class between DP1, DP2 and DP3 to see how much redundancy each one has.',
    ],
    fact: 'DP2 and DP3 vessels need at least three position references available at once, and they must not all be of the same type.',
  },
  'hpr-001': {
    tag: 'Acoustic position reference',
    role: 'The HPT 5000 is the ship-side transceiver of a USBL acoustic positioning system. It measures range and bearing to a transponder on the seabed and gives DP a position that does not depend on satellites.',
    how: [
      'The Type 7950 machine lowers the transceiver through the hull, about 3 m below the keel, clear of aerated water and thruster noise.',
      'The transceiver sends an acoustic interrogation; the seabed transponder answers on its own channel.',
      'Range comes from the two-way travel time and the speed of sound in water.',
      'Bearing comes from the tiny time differences of the reply across the transducer array (ultra-short baseline).',
      'With heading, roll and pitch, DP turns range and bearing into the vessel position relative to the transponder.',
    ],
    tryIt: [
      'Press RETRACT to bring the HPT 5000 back into the seachest, then CLOSE VALVE and OPEN DOOR to see it parked.',
      'Close the door, OPEN VALVE and DEPLOY to send it back down.',
      'Turn on the signals and watch the slant range and round-trip time.',
      'Use the close-up view to see the Sonardyne HPT band and the Forward mark that lines the transceiver up with the bow.',
    ],
    fact: 'Sound travels about 1,500 m/s in sea water, so a reply from 100 m away takes roughly 0.13 s to come back.',
  },
  'deployment-001': {
    tag: 'Lowers the HPR through the hull',
    role: 'The Type 7950 is a through-hull deployment machine. It puts the HPT 5000 transceiver below the hull to work and brings it back inside for maintenance, without a dry dock or divers.',
    how: [
      'Parked, the transceiver sits in the seachest above a closed 14-inch gate valve, so the hull stays watertight.',
      'With the valve open, the hydraulic machine drives the pole down through the sealing section.',
      'Fully deployed, the transceiver face is about 2.95 m below the hull.',
      'Interlocks stop the pole moving with the valve closed and stop the valve closing on the pole.',
      'With the pole parked and the valve shut, the inspection door can be opened to service the transceiver.',
    ],
    tryIt: [
      'With the valve closed, press DEPLOY: the interlock refuses and tells you why.',
      'Open the valve and deploy, then retract and close the valve again.',
      'Open the seachest door to see the HPT 5000 at rest inside.',
      'Press Explode assembly to pull the machine apart into its sections.',
    ],
    fact: 'The machine needs a space 6.1 m high, so it usually stands in its own trunk rising from the bottom plating.',
  },
  'bow-thruster-001': {
    tag: 'Pushes the bow sideways',
    role: 'A tunnel thruster across the bow pushes the bow to port or starboard. It makes harbour manoeuvres easy and gives DP its sideways control at the front of the ship.',
    how: [
      'An 800 kW electric motor turns the propeller at a constant 300 rpm.',
      'Thrust is changed by turning the blades (controllable pitch): zero pitch gives no thrust even at full speed.',
      'Pitch to one side pushes water through the tunnel and the bow moves the other way.',
      'The Z-Thrust control sets the pitch from the bridge lever (FU), with step buttons (NFU), or from DP.',
      'Starting is only allowed with zero pitch, which keeps the starting load on the motor low.',
    ],
    tryIt: [
      'Move the lever off zero and press START: the interlock blocks it. Return to zero and start.',
      'Move the lever to port and starboard and watch the thrust and motor load.',
      'Hand control to DP and watch DP set the pitch for you.',
      'Press Explode assembly to look inside the thruster.',
    ],
    fact: 'Because thrust is set by blade pitch, the thruster reverses its push without ever stopping or reversing the motor.',
  },
  'radascan-001': {
    tag: 'Radar reference to a structure',
    role: 'RadaScan View measures the range and bearing to coded responders on a platform or another vessel, so DP can hold position relative to that structure, even while it moves.',
    how: [
      'The rotating sensor sends microwave radar signals across the 500 m zone.',
      'Each responder answers with its own code, so the sensor knows exactly which target it sees.',
      'Range comes from the reply timing and bearing from the antenna angle.',
      'Radar is not blinded by fog, rain, snow or steam.',
      'The same sensor also gives a radar picture of the area.',
    ],
    tryIt: [
      'Press START and wait for TRACKING.',
      'Move the vessel in DP and watch the range and bearing change.',
      'Turn on fog in the CyScan panel and compare: RadaScan keeps tracking.',
    ],
    fact: 'Relative references like RadaScan let a vessel follow a moving target such as a turret or a drifting FPSO.',
  },
  'cyscan-001': {
    tag: 'Laser reference to a structure',
    role: 'CyScan AS is a rotating laser that measures range and bearing to reflective targets on a platform. It is very precise, but fog, heavy rain or spray can block the beam.',
    how: [
      'A Class 1M laser fan sweeps around while the head turns.',
      'Reflective targets on the structure return the light; the timing gives the range.',
      'The head angle at the moment of the return gives the bearing.',
      'A gimbal keeps the beam level as the vessel rolls and pitches.',
    ],
    tryIt: [
      'Press START and wait for TRACKING.',
      'Switch FOG / RAIN on: the usable range shrinks and the target is lost.',
      'Watch DP alarm and carry on with the remaining references.',
    ],
    fact: 'With prisms the laser reaches 2,500 m; with a cylindrical target the range is a few hundred metres.',
  },
  'dgps-001': {
    tag: 'Satellite position reference',
    role: 'Two Fugro Seastar receivers give the absolute position from satellites, corrected to decimetre accuracy. They are usually the main references, and DP votes them against the others.',
    how: [
      'The GA830 antennas on the mast receive GPS, GLONASS, Galileo and BeiDou signals.',
      'Each receiver works out its position from the satellite ranges.',
      'Correction data arrive over L-band satellite or NTRIP, bringing the error down to about 10 cm.',
      'Two independent receivers mean one failure does not remove satellite positioning.',
    ],
    tryIt: [
      'Read both receiver displays and compare the positions.',
      'In the DP System, lose DGPS 1 and see DP carry on with DGPS 2 and the other references.',
    ],
    fact: 'Both antennas share the same sky, so a satellite or space-weather problem can hit both at once. That is why DP2 needs a reference independent of GNSS.',
  },
  'tautwire-001': {
    tag: 'Mechanical position reference',
    role: 'The taut wire lowers a heavy weight to the seabed on a wire held at constant tension. The wire angles show how far the vessel has moved from the weight.',
    how: [
      'The winch lowers the 400 kg weight from the boom until it lands on the seabed.',
      'The winch then holds the wire at constant tension, so it stays straight.',
      'A gimbal head on the boom measures the wire angles across and along the ship.',
      'Angle and water depth give the horizontal offset from the weight.',
      'It is usable within ±30°; beyond that the vessel has moved too far.',
    ],
    tryIt: [
      'Press LOWER WEIGHT and watch it reach the bottom.',
      'Move the vessel in DP and watch the across and along angles change.',
      'Push the vessel further and see the angle warning, then the limit.',
    ],
    fact: 'It is simple and fully independent of satellites and acoustics, which is why many DP vessels still carry one.',
  },
  'sprintnav-001': {
    tag: 'Inertial reference independent of GNSS',
    role: 'SPRINT-Nav DP combines inertial sensors, a 375 kHz Doppler velocity log (DVL) and a pressure sensor in one titanium housing. Once started from GNSS it navigates on its own, giving DP a position reference that is independent of satellites.',
    how: [
      'The Type 8097 pole swings the unit over the side and a hydraulic lock holds the pole against the hull.',
      'Powered up, the unit initialises its position from GNSS, which takes about 10 minutes.',
      'The DVL beams lock on to the seabed (0.4 to 200 m below) and measure the vessel’s velocity; the inertial sensors measure motion and heading; the pressure sensor gives depth.',
      'The DP operator then disables GNSS aiding: the unit is now independent of GNSS, as DP2 and DP3 require.',
      'Its error grows only slowly, less than 2 m over 24 hours, and the same transducers measure the water current down to 120 m.',
    ],
    tryIt: [
      'Press RECOVER POLE to bring the unit on deck, then DEPLOY POLE to swing it back down.',
      'Switch SPRINT-NAV off and on again and watch it initialise from GNSS.',
      'When it reaches 100 %, press GNSS AIDING to go independent, and watch the drift on the position plot.',
      'Use the close-up view to see the titanium housing and the four DVL transducers.',
    ],
    fact: 'An internal battery keeps it navigating for 5 minutes through a power dropout, so it does not need to start again from GNSS.',
  },
};
