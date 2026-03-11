import { Position } from '../types';

export type BoardHole =
  | { type: 'track'; arm: number; spot: number }
  | { type: 'home'; arm: number; slot: number }
  | { type: 'base'; arm: number; slot: number };

export function mapPositionToBoardHole(
  pos: Position,
  playerSeat: number,
  playerCount: number
): BoardHole {

  const ARM_LENGTH = 14;

  if (pos.kind === 'track') {
    const arm = Math.floor(pos.index / ARM_LENGTH);
    const spot = pos.index % ARM_LENGTH;

    return {
      type: 'track',
      arm,
      spot
    };
  }

  if (pos.kind === 'home') {
    return {
      type: 'home',
      arm: playerSeat,
      slot: pos.slot
    };
  }

  return {
    type: 'base',
    arm: playerSeat,
    slot: pos.slot
  };
}