declare module 'mammoth' {
  interface MammothOptions {
    buffer?: Buffer;
    path?: string;
  }
  interface RawTextResult {
    value: string;
    messages: unknown[];
  }
  export function extractRawText(options: MammothOptions): Promise<RawTextResult>;
}