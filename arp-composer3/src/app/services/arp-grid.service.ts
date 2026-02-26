import { Injectable, signal, Signal } from '@angular/core';
import { ArpCell, CellState } from '../models/arp-cell.model';
import { ArpGrid, ArpRow, ChordDegree } from '../models/arp-grid.model';

const CELL_CYCLE: CellState[] = ['off', 'v1', 'v2', 'staccato'];

const ROW_DEFINITIONS: { label: string; degree: ChordDegree; octaveOffset: number }[] = [
  { label: 'Fifth-2', degree: 'fifth', octaveOffset: 1 },
  { label: 'Third-2', degree: 'third', octaveOffset: 1 },
  { label: '2nd-2',   degree: '2nd',   octaveOffset: 1 },
  { label: 'Root-2',  degree: 'root',  octaveOffset: 1 },
  { label: 'Fifth-1', degree: 'fifth', octaveOffset: 0 },
  { label: 'Third-1', degree: 'third', octaveOffset: 0 },
  { label: '2nd-1',   degree: '2nd',   octaveOffset: 0 },
  { label: 'Root-1',  degree: 'root',  octaveOffset: 0 },
];

function makeEmptyCells(count: number): ArpCell[] {
  return Array.from({ length: count }, () => ({ state: 'off' as CellState }));
}

function makeInitialGrid(stepsPerMeasure: number): ArpGrid {
  return {
    stepsPerMeasure,
    rows: ROW_DEFINITIONS.map(def => ({
      ...def,
      cells: makeEmptyCells(stepsPerMeasure),
    })),
  };
}

@Injectable({ providedIn: 'root' })
export class ArpGridService {
  private readonly _grid = signal<ArpGrid>(makeInitialGrid(16));

  readonly grid: Signal<ArpGrid> = this._grid.asReadonly();

  cycleCell(rowIdx: number, stepIdx: number): void {
    this._grid.update(g => {
      const rows = g.rows.map((row, ri) => {
        if (ri !== rowIdx) return row;
        const cells = row.cells.map((cell, ci) => {
          if (ci !== stepIdx) return cell;
          const next = CELL_CYCLE[(CELL_CYCLE.indexOf(cell.state) + 1) % CELL_CYCLE.length];
          return { state: next };
        });
        return { ...row, cells };
      });
      return { ...g, rows };
    });
  }

  setRowVelocity(rowIdx: number, v: 'v1' | 'v2'): void {
    this._grid.update(g => {
      const rows = g.rows.map((row, ri) => {
        if (ri !== rowIdx) return row;
        const cells = row.cells.map(cell =>
          cell.state === 'off' ? cell : { state: v as CellState }
        );
        return { ...row, cells };
      });
      return { ...g, rows };
    });
  }

  randomizeRow(rowIdx: number): void {
    const randomStates: CellState[] = ['v1', 'v2', 'staccato'];
    this._grid.update(g => {
      const rows = g.rows.map((row, ri) => {
        if (ri !== rowIdx) return row;
        const cells = row.cells.map(() => {
          if (Math.random() < 0.5) {
            return { state: randomStates[Math.floor(Math.random() * randomStates.length)] };
          }
          return { state: 'off' as CellState };
        });
        return { ...row, cells };
      });
      return { ...g, rows };
    });
  }

  clearRow(rowIdx: number): void {
    this._grid.update(g => {
      const rows = g.rows.map((row, ri) => {
        if (ri !== rowIdx) return row;
        return { ...row, cells: makeEmptyCells(g.stepsPerMeasure) };
      });
      return { ...g, rows };
    });
  }

  clearAll(): void {
    this._grid.update(g => ({
      ...g,
      rows: g.rows.map(row => ({ ...row, cells: makeEmptyCells(g.stepsPerMeasure) })),
    }));
  }

  resizeSteps(stepsPerMeasure: number): void {
    this._grid.update(g => {
      const rows = g.rows.map(row => {
        const newCells = makeEmptyCells(stepsPerMeasure);
        // preserve existing cells that fit
        row.cells.forEach((cell, i) => {
          if (i < stepsPerMeasure) newCells[i] = { ...cell };
        });
        return { ...row, cells: newCells };
      });
      return { ...g, rows, stepsPerMeasure };
    });
  }

  exportJson(): string {
    return JSON.stringify(this._grid(), null, 2);
  }

  importJson(json: string): void {
    try {
      const parsed: ArpGrid = JSON.parse(json);
      this._grid.set(parsed);
    } catch {
      console.error('ArpGridService: invalid JSON for import');
    }
  }
}
