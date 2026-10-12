import { FormatError } from '../errors.js';

/** A `.lofi.json` design file is malformed. `path` is the JSON path of the offending value. */
export class DesignFileError extends FormatError {
  readonly path: string;
  constructor(fileName: string | undefined, path: string, problem: string, options?: ErrorOptions) {
    super(`${fileName ?? 'design file'}, ${path}: ${problem}`, options);
    this.path = path;
  }
}

/** A design is structurally valid but cannot be used for the requested computation (for example no motor). */
export class DesignError extends FormatError {}
