import * as Conf from '../Configs/index.js';
import * as Cmds from '../Commands/index.js';

/** A prepared document, ready to be compiled and sent. */
export interface IDocument {
  /** Gets the series of commands this document contains. */
  commands: ReadonlyArray<Cmds.IPrinterCommand>;
}

/** Stream of commands, with zero or more commands expected to return messages. */
export class Transaction{
  constructor(
    public readonly commands: Conf.MessageArrayLike,
    public readonly awaitedCommands: Cmds.IPrinterCommand[],
  ) {}
}

/** Compiled document of commands ready to be sent to a printer which supports the PCL. */
export class CompiledDocument {
  constructor(
    public readonly language: Conf.PrinterCommandLanguage,
    public readonly effects: Cmds.CommandEffectFlags,
    public readonly transactions: Transaction[]
  ) {}
}
