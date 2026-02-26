import { Injectable, computed, signal } from '@angular/core';
import {
  ParsedPattern,
  PatternEvent,
  PatternValidation,
} from '../models/parsed-pattern.model';
import { ConfigService } from './config.service';

@Injectable({ providedIn: 'root' })
export class PatternService {
  private readonly _patternString = signal('*---*---*---*---');

  readonly patternString = this._patternString.asReadonly();

  readonly validation = computed<PatternValidation>(() => {
    const str = this._patternString();
    const beatsPerMeasure = this._configService.config().beatsPerMeasure;

    if (str.length === 0) {
      return { valid: false, error: 'Pattern cannot be empty.', warning: null };
    }

    const invalid = [...str].find(c => c !== '*' && c !== '-');
    if (invalid) {
      return {
        valid: false,
        error: `Invalid character "${invalid}". Use only '*' (note) and '-' (rest).`,
        warning: null,
      };
    }

    const warning =
      str.length % beatsPerMeasure !== 0
        ? `Pattern length (${str.length}) is not evenly divisible by beats per measure (${beatsPerMeasure}). Rhythm may feel uneven.`
        : null;

    return { valid: true, error: null, warning };
  });

  readonly parsedPattern = computed<ParsedPattern>(() => {
    const str = this._patternString();
    if (!this.validation().valid) {
      return { events: [], length: 0 };
    }
    const events: PatternEvent[] = [...str].map((char, index) => ({
      index,
      isNote: char === '*',
    }));
    return { events, length: str.length };
  });

  constructor(private readonly _configService: ConfigService) {}

  setPattern(pattern: string): void {
    this._patternString.set(pattern);
  }

  parse(pattern: string): ParsedPattern {
    const events: PatternEvent[] = [...pattern].map((char, index) => ({
      index,
      isNote: char === '*',
    }));
    return { events, length: pattern.length };
  }
}
