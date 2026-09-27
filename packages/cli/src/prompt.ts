import { createInterface, type Interface } from "node:readline";

interface MutableInterface extends Interface {
  _writeToOutput?: (stringToWrite: string) => void;
}

/** Reads a line from stdin without echoing it back to the terminal. */
export async function promptHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    const rl = createInterface({ input: stdin, output: stdout, terminal: true }) as MutableInterface;
    stdout.write(question);

    const originalWrite = rl._writeToOutput?.bind(rl);
    rl._writeToOutput = (stringToWrite: string) => {
      if (stringToWrite === question || /\r?\n/.test(stringToWrite)) {
        originalWrite?.(stringToWrite);
      }
      // otherwise: swallow the character echo so the key never appears on screen
    };

    rl.question("", (answer: string) => {
      rl.close();
      stdout.write("\n");
      resolve(answer.trim());
    });
    rl.on("error", reject);
  });
}

export async function readStdinAll(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk: string) => (data += chunk));
    process.stdin.on("end", () => resolve(data.trim()));
    process.stdin.on("error", reject);
  });
}
