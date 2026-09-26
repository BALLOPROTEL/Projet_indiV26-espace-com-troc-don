import { LoggerService } from '@nestjs/common';

type LogLevel =\n  | 'debug'\n  | 'error'\n  | 'fatal'\n  | 'info'\n  | 'verbose'\n  | 'warn';

export class JsonLoggerService implements LoggerService {
  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, optionalParams);
  }

  private write(
    level: LogLevel,
    message: unknown,
    optionalParams: unknown[],
  ): void {
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      message: this.serialize(message),
      ...(optionalParams.length > 0
        ? { details: optionalParams.map((item) => this.serialize(item)) }
        : {}),
    };

    const line = `${JSON.stringify(payload)}\n`;

    if (level === 'error' || level === 'fatal') {
      process.stderr.write(line);
      return;
    }

    process.stdout.write(line);
  }

  private serialize(value: unknown): unknown {
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }

    return value;
  }
}
