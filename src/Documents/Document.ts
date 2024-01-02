import type { PrinterCommandLanguage } from "../Printers/Languages/index.js";
import type { CommandEffectFlags, IPrinterCommand } from "./Commands.js";

/** A document of printer commands, to be compiled for a specific printer. */
export interface IDocument {
  /** Gets the series of commands this document contains. */
  commands: ReadonlyArray<IPrinterCommand>;
}

/** Stream of commands, optionally ended by an awaited command. */
export class Transaction<T>{
  constructor(
    public readonly commands: T,
    public readonly awaitedCommand: IPrinterCommand | undefined,
  ) {}
}

/** Compiled document of commands ready to be sent to a printer which supports the PCL. */
export class CompiledDocument<T> {
  constructor(
    public readonly language: PrinterCommandLanguage,
    public readonly effects: CommandEffectFlags,
    public readonly transactions: Transaction<T>[]
  ) {}
}

/** Describes a class capable of transpiling documents */
export interface IDocumentTranspiler<T> {
  transpileDocument(doc: IDocument): CompiledDocument<T>;
}
