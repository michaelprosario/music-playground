declare module 'jzz-synth-tiny' {
  import type { JZZ } from 'jzz';
  /**
   * Call this once at module load time to register the jzz-synth-tiny plugin
   * with the JZZ engine. Adds `JZZ.synth.Tiny` to the JZZ namespace.
   */
  function JzzSynthTiny(jzz: typeof JZZ): void;
  export = JzzSynthTiny;
}
