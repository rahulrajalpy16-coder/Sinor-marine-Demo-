import { PLACEMENTS } from '../equipment/registry';

/** Guided tour: an ordered walk through the vessel's DP equipment, one place per stop. */
export interface TourStop {
  place: string;
  title: string;
  text: string;
}

const summary = (id: string) => PLACEMENTS[id]?.summary ?? '';

export const TOUR: TourStop[] = [
  {
    place: 'aft-deck',
    title: 'Welcome aboard',
    text: 'You are on the open aft working deck of a 78 m DP2 offshore support vessel. Dynamic positioning keeps her on station with thrusters instead of anchors. This tour visits the systems that make that work.',
  },
  { place: 'dp-console', title: 'DP console', text: summary('dp-console-001') },
  { place: 'bridge-front', title: 'Integrated bridge', text: summary('ibs-001') },
  { place: 'hpr-room', title: 'HPR deployment machine', text: summary('deployment-001') },
  { place: 'bow-thruster', title: 'Bow thruster', text: summary('bow-thruster-001') },
  {
    place: 'helideck',
    title: 'End of the tour',
    text: 'From the helideck you can see the whole vessel. Press X at any time to open the menu, jump to a place or change comfort settings.',
  },
];
