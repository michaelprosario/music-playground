export type CellState = 'off' | 'v1' | 'v2' | 'staccato';

export interface ArpCell {
  state: CellState;
}

export const CELL_VELOCITY: Record<CellState, number> = {
  off: 0,
  v1: 64,
  v2: 100,
  staccato: 80,
};

export const STACCATO_DURATION_RATIO = 0.20;
export const NORMAL_DURATION_RATIO   = 0.85;
