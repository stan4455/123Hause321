/**
 * Simple logger utility
 */
export class Logger {
  private prefix: string;
  
  constructor(prefix: string = "") {
    this.prefix = prefix;
  }
  
  info(message: string, ...args: unknown[]): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}]${this.prefix ? ` [${this.prefix}]` : ""} ${message}`, ...args);
  }
  
  error(message: string, ...args: unknown[]): void {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}]${this.prefix ? ` [${this.prefix}]` : ""} ERROR: ${message}`, ...args);
  }
  
  warn(message: string, ...args: unknown[]): void {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}]${this.prefix ? ` [${this.prefix}]` : ""} WARN: ${message}`, ...args);
  }
}

export const logger = new Logger();
