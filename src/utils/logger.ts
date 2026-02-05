 /**
  * Централизованный логгер для отладки
  * Все логи видны в консоли браузера
  */
 
 type LogLevel = 'debug' | 'info' | 'warn' | 'error';
 
 interface LogEntry {
   timestamp: string;
   level: LogLevel;
   context: string;
   message: string;
   data?: any;
 }
 
 const LOG_COLORS = {
   debug: '#6b7280',
   info: '#3b82f6',
   warn: '#f59e0b',
   error: '#ef4444',
 };
 
 class Logger {
   private context: string;
   private static logs: LogEntry[] = [];
   private static maxLogs = 100;
 
   constructor(context: string) {
     this.context = context;
   }
 
   private log(level: LogLevel, message: string, data?: any) {
     const timestamp = new Date().toISOString();
     const entry: LogEntry = { timestamp, level, context: this.context, message, data };
     
     // Store in memory
     Logger.logs.push(entry);
     if (Logger.logs.length > Logger.maxLogs) {
       Logger.logs.shift();
     }
 
     // Console output with styling
     const color = LOG_COLORS[level];
     const prefix = `%c[${timestamp}] [${level.toUpperCase()}] [${this.context}]`;
     
     if (data !== undefined) {
       console[level](prefix, `color: ${color}; font-weight: bold`, message, data);
     } else {
       console[level](prefix, `color: ${color}; font-weight: bold`, message);
     }
   }
 
   debug(message: string, data?: any) {
     this.log('debug', message, data);
   }
 
   info(message: string, data?: any) {
     this.log('info', message, data);
   }
 
   warn(message: string, data?: any) {
     this.log('warn', message, data);
   }
 
   error(message: string, data?: any) {
     this.log('error', message, data);
   }
 
   // Get all stored logs
   static getLogs(): LogEntry[] {
     return [...Logger.logs];
   }
 
   // Clear logs
   static clearLogs() {
     Logger.logs = [];
   }
 
   // Export logs as JSON string
   static exportLogs(): string {
     return JSON.stringify(Logger.logs, null, 2);
   }
 }
 
 // Factory function
 export const createLogger = (context: string) => new Logger(context);
 
 // Default logger instance
 export const logger = new Logger('App');
 
 // Global error handler
 if (typeof window !== 'undefined') {
   window.onerror = (message, source, lineno, colno, error) => {
     const errorLogger = new Logger('GlobalError');
     errorLogger.error('Uncaught error', { message, source, lineno, colno, stack: error?.stack });
     return false;
   };
 
   window.onunhandledrejection = (event) => {
     const errorLogger = new Logger('UnhandledPromise');
     errorLogger.error('Unhandled promise rejection', { reason: event.reason });
   };
 }
 
 export default Logger;