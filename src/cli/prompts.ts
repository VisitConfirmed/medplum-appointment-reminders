import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

export interface PromptOptions {
  defaultValue?: string;
  required?: boolean;
}

export async function prompt(
  question: string,
  options: PromptOptions = {}
): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const suffix = options.defaultValue
      ? ` [${options.defaultValue}]`
      : options.required
        ? ' (required)'
        : '';
    while (true) {
      const answer = (await rl.question(`${question}${suffix}: `)).trim();
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
