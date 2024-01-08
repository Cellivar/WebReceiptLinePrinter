import type { PrinterCommandLanguage } from "../Printers/Languages/index.js";
import * as Cmds from "./Commands.js";
import type { Codepage } from "../Printers/Codepages/index.js";
import type { Coordinate, IMediaOptions } from "../Printers/Options/index.js";
import type { IMessageHandlerResult } from "../Printers/Communication/index.js";
import type { TranspileDocumentError } from "./TranspileCommandError.js";

/** Describes a class capable of managing command implementations. */
export interface CommandSet<TOutput> {
  /** Encode a raw string command into a raw command according to the command language rules. */
  encodeCommand(str?: string, withNewline?: boolean): TOutput;

  /** Gets the command language this command set implements */
  get commandLanguage(): PrinterCommandLanguage;
  /** Get an empty command to do nothing at all. */
  get noop(): TOutput;
  /** Gets the commands to start a new document. */
  get documentStartCommands(): Cmds.IPrinterCommand[];
  /** Gets the commands to end a document. */
  get documentEndCommands(): Cmds.IPrinterCommand[];
  /** Get a new document metadata tracking object. */
  getNewTranspileState(media: IMediaOptions): TranspiledDocumentState;

  /** Parse a message object received from the printer. */
  parseMessage(
    msg: TOutput,
    sentCommand?: Cmds.IPrinterCommand
  ): IMessageHandlerResult<TOutput>;

  /** Get expanded commands for a given command, if applicable. */
  expandCommand(cmd: Cmds.IPrinterCommand): Cmds.IPrinterCommand[];

  /** Transpile a single command, tracking its effects to a document. */
  transpileCommand(
    cmd: Cmds.IPrinterCommand,
    docMetadata: TranspiledDocumentState
  ): TOutput | TranspileDocumentError;

  /** Combine separate commands into one series of commands. */
  combineCommands(...commands: TOutput[]): TOutput;
}

export function exhaustiveMatchGuard(_: never): never {
  throw new Error('Invalid case received!' + _);
}

/** Interface of document state effects carried between individual commands. */
export interface TranspiledDocumentState {
  lineSpacing: number;
  charactersPerLine: number;

  margin: {
    leftChars: number;
    rightChars: number;
  }
  printWidth: number;

  characterSize: Coordinate;

  commandEffectFlags: Cmds.CommandEffectFlags;
  codepage: Codepage;

  textFormat: Cmds.TextFormat;
}

/** A method for transpiling a given command to its native command. */
export type TranspileCommandDelegate<TOutput> = (
  cmd: Cmds.IPrinterCommand,
  docState: TranspiledDocumentState,
  commandSet: CommandSet<TOutput>
) => TOutput;

/** A manifest for a custom extended printer command. */
export interface IPrinterExtendedCommandMapping<TOutput> {
  extendedTypeSymbol: symbol,
  delegate: TranspileCommandDelegate<TOutput>,
}
