/** Errors raised by the file-format package. All say what was wrong and where. */
export class FormatError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** A RASP `.eng` file broke one of the format's rules. `line` is 1-based. */
export class EngParseError extends FormatError {
  readonly line: number;
  constructor(fileName: string | undefined, line: number, problem: string) {
    super(`${fileName ?? 'RASP file'}, line ${String(line)}: ${problem}`);
    this.line = line;
  }
}

/** An OpenRocket `.ork` file was malformed or inconsistent. `path` names the element. */
export class OrkParseError extends FormatError {
  readonly path: string;
  constructor(fileName: string | undefined, path: string, problem: string, options?: ErrorOptions) {
    super(`${fileName ?? '.ork file'}, ${path}: ${problem}`, options);
    this.path = path;
  }
}

/**
 * A valid `.ork` feature that the minimal reader (plan 0005) does not model.
 * Nothing is approximated or skipped: the file must be rejected as a whole.
 */
export class OrkUnsupportedError extends FormatError {
  readonly path: string;
  constructor(fileName: string | undefined, path: string, feature: string) {
    super(
      `${fileName ?? '.ork file'}, ${path}: ${feature} is not supported by the minimal .ork reader (docs/plans/0005-ork-reader.md)`,
    );
    this.path = path;
  }
}
