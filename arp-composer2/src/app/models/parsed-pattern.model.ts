export interface PatternEvent {
  index: number;
  isNote: boolean;
}

export interface ParsedPattern {
  events: PatternEvent[];
  length: number;
}

export interface PatternValidation {
  valid: boolean;
  error: string | null;
  warning: string | null;
}
