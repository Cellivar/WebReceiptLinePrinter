// [flags] I miss C#.
/** Command languages a printer could support. One printer may support multiple. */
export enum PrinterCommandLanguage {
  /** Error condition indicating autodetect failed. */
  none = 0,
  /** Printer can be set to ESC/POS. */
  escPos = 1 << 0,
}

/** Types that can be used for comm channels to printers. */
export type MessageArrayLike = string | Uint8Array
export type MessageArrayLikeType = "string" | "Uint8Array"
export interface MessageArrayLikeMap {
  "string": string;
  "Uint8Array": Uint8Array;
}
