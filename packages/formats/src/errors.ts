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
