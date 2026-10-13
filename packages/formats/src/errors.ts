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
  readonly feature: string;
  constructor(fileName: string | undefined, path: string, feature: string) {
    super(`${fileName ?? '.ork file'}, ${path}: ${feature} is not supported yet.`);
    this.path = path;
    this.feature = feature;
  }
}

/** A component path without the file's container elements: `stage "S" > bodytube "Body" > ...`. */
function readablePath(path: string): string {
  return path
    .replace(/^openrocket > rocket "[^"]*"(?: > subcomponents)?(?: > )?/, '')
    .replaceAll(' > subcomponents', '');
}

/**
 * Every unsupported feature of a file at once (D-082), so that the user sees the whole list
 * rather than one problem per attempt. An `OrkUnsupportedError` itself, for callers that catch
 * that type.
 */
export class OrkUnsupportedFeaturesError extends OrkUnsupportedError {
  readonly problems: readonly OrkUnsupportedError[];
  constructor(fileName: string | undefined, problems: readonly OrkUnsupportedError[]) {
    const first = problems[0];
    super(fileName, first?.path ?? 'openrocket', first?.feature ?? 'this design');
    this.problems = problems;
    if (problems.length > 1) {
      this.message = `${fileName ?? '.ork file'}: ${String(problems.length)} parts of this design are not supported yet:\n${problems
        .map((p) => `- ${readablePath(p.path)}: ${p.feature}`)
        .join('\n')}`;
    }
  }
}

/** A RockSim `.rse` file was malformed or inconsistent. `where` names the engine or point. */
export class RseParseError extends FormatError {
  readonly where: string;
  constructor(
    fileName: string | undefined,
    where: string,
    problem: string,
    options?: ErrorOptions,
  ) {
    super(`${fileName ?? '.rse file'}, ${where}: ${problem}`, options);
    this.where = where;
  }
}

/** A valid `.rse` feature whose meaning is not documented well enough to model (plan 0007, D-029). */
export class RseUnsupportedError extends FormatError {
  readonly where: string;
  constructor(fileName: string | undefined, where: string, feature: string) {
    super(
      `${fileName ?? '.rse file'}, ${where}: ${feature} is not supported by the .rse reader (docs/plans/0007-motor-model.md)`,
    );
    this.where = where;
  }
}
