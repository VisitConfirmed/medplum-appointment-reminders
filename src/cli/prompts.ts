import { createInterface } from 'node:readline/promises';
import { stdin, stdout, stderr } from 'node:process';

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

const ETX = '';
const BACKSPACE = '';

// Reads a secret without echoing it. Uses stdin raw mode for char-by-char
// input so backspace works, and routes the prompt to stderr (when it's a
// TTY) so the prompt stays visible — and the secret stays masked — even
// when stdout is redirected to a file. Falls back to a plain readline
// read when stdin isn't a TTY (CI / piped input).
export async function promptSecret(question: string): Promise<string> {
  const tty: NodeJS.WriteStream = stderr.isTTY ? stderr : stdout;
  const promptText = `${question} (required): `;

  if (!stdin.isTTY) {
    const rl = createInterface({ input: stdin, output: tty });
    try {
      while (true) {
        const answer = (await rl.question(promptText)).trim();
        if (answer) return answer;
      }
    } finally {
      rl.close();
    }
  }

  return new Promise<string>((resolve) => {
    const ask = (): void => {
      tty.write(promptText);
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');

      let secret = '';
      const finish = (): void => {
        stdin.removeListener('data', onData);
        stdin.setRawMode(false);
        stdin.pause();
      };
      const onData = (data: string): void => {
        for (const char of data) {
          if (char === '\r' || char === '\n') {
            finish();
            tty.write('\n');
            const trimmed = secret.trim();
            if (trimmed) {
              resolve(trimmed);
            } else {
              ask();
            }
            return;
          }
          if (char === ETX) {
            finish();
            tty.write('\n');
            process.exit(130);
          }
          if (char === BACKSPACE || char === '\b') {
            if (secret.length > 0) {
              secret = secret.slice(0, -1);
              tty.write('\b \b');
            }
            continue;
          }
          if (char.charCodeAt(0) < 32) {
            continue;
          }
          secret += char;
          tty.write('*');
        }
      };
      stdin.on('data', onData);
    };
    ask();
  });
}
