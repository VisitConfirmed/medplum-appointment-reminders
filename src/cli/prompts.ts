import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

export interface PromptOptions {
  defaultValue?: string;
  required?: boolean;
  mask?: boolean;
}

export async function prompt(
  question: string,
  options: PromptOptions = {}
): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  let muted = false;

  if (options.mask && stdout.isTTY) {
    const rlInternal = rl as unknown as {
      _writeToOutput?: (stringToWrite: string) => void;
      output: NodeJS.WritableStream;
    };
    const originalWriteToOutput = rlInternal._writeToOutput?.bind(rlInternal);
    if (originalWriteToOutput) {
      rlInternal._writeToOutput = (stringToWrite: string) => {
        if (!muted) {
          originalWriteToOutput(stringToWrite);
          return;
        }
        if (stringToWrite === '\r\n' || stringToWrite === '\n' || stringToWrite === '\r') {
          rlInternal.output.write(stringToWrite);
        } else {
          rlInternal.output.write('*'.repeat(stringToWrite.length));
        }
      };
    }
  }

  try {
    const suffix = options.defaultValue
      ? ` [${options.defaultValue}]`
      : options.required
        ? ' (required)'
        : '';
    while (true) {
      const pending = rl.question(`${question}${suffix}: `);
      muted = options.mask === true;
      const answer = (await pending).trim();
      muted = false;
      if (answer) {
        return answer;
      }
      if (options.defaultValue !== undefined) {
        return options.defaultValue;
      }
      if (!options.required) {
        return '';
      }
    }
  } finally {
    rl.close();
  }
}
