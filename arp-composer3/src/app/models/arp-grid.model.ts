import { ArpCell } from './arp-cell.model';

export type ChordDegree = 'root' | '2nd' | 'third' | 'fifth';

export interface ArpRow {
  label: string;
  degree: ChordDegree;
  octaveOffset: number;
  cells: ArpCell[];
}

export interface ArpGrid {
  rows: ArpRow[];
  stepsPerMeasure: number;
}
