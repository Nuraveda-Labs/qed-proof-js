export interface Io {
  log: (line: string) => void;
  error: (line: string) => void;
}

export const defaultIo: Io = {
  log: (line: string) => process.stdout.write(line + "\n"),
  error: (line: string) => process.stderr.write(line + "\n"),
};
