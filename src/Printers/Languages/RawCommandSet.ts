import * as Cmds from "../../Documents/index.js";
import type { IMessageHandlerResult } from "../Communication/index.js";
import type { IMediaOptions } from "../Options/index.js";
import type { CommandSet, IPrinterExtendedCommandMapping, TranspileCommandDelegate, TranspiledDocumentState } from "../../Documents/CommandSet.js";
import { TranspileDocumentError } from "../../Documents/TranspileCommandError.js";
import type { PrinterCommandLanguage } from "./index.js";

/** A class to transpile commands as raw 8-bit commands to a printer. */
export abstract class RawCommandSet implements CommandSet<Uint8Array> {
  /** Encode a raw string command into a Uint8Array according to the command language rules. */
  public abstract encodeCommand(str?: string, withNewline?: boolean): Uint8Array;

  private readonly _noop = new Uint8Array();
  public get noop() {
    return this._noop;
  }

  public abstract get documentStartCommands(): Cmds.IPrinterCommand[];
  public abstract get documentEndCommands(): Cmds.IPrinterCommand[];
  private cmdLanguage: PrinterCommandLanguage;
  get commandLanguage() {
    return this.cmdLanguage;
  }

  public abstract getNewTranspileState(media: IMediaOptions): TranspiledDocumentState;

  protected extendedCommandMap = new Map<symbol, TranspileCommandDelegate<Uint8Array>>;

  protected constructor(
    implementedLanguage: PrinterCommandLanguage,
    extendedCommands: Array<IPrinterExtendedCommandMapping<Uint8Array>> = []
  ) {
    this.cmdLanguage = implementedLanguage;
    extendedCommands.forEach(c => this.extendedCommandMap.set(c.extendedTypeSymbol, c.delegate));
  }

  public abstract parseMessage(
    msg: Uint8Array,
    sentCommand?: Cmds.IPrinterCommand
  ): IMessageHandlerResult<Uint8Array>;

  public abstract expandCommand(cmd: Cmds.IPrinterCommand): Cmds.IPrinterCommand[];

  public abstract transpileCommand(
    cmd: Cmds.IPrinterCommand,
    docState: TranspiledDocumentState
  ): Uint8Array | TranspileDocumentError;

  protected extendedCommandHandler(
    cmd: Cmds.IPrinterCommand,
    docState: TranspiledDocumentState
  ) {
    const lookup = (cmd as Cmds.IPrinterExtendedCommand).typeExtended;
    if (!lookup) {
      throw new TranspileDocumentError(
        `Command '${cmd.constructor.name}' did not have a value for typeExtended. If you're trying to implement a custom command check the documentation.`
      )
    }

    const cmdHandler = this.extendedCommandMap.get(lookup);

    if (cmdHandler === undefined) {
      throw new TranspileDocumentError(
        `Unknown command '${cmd.constructor.name}' was not found in the command map for ${this.commandLanguage} command language. If you're trying to implement a custom command check the documentation for correctly adding mappings.`
      );
    }
    return cmdHandler(cmd, docState, this);
  }

  public combineCommands(...commands: Uint8Array[]) {
    const bufferLen = commands.reduce((sum, arr) => sum + arr.byteLength, 0);
    return commands.reduce(
      (accumulator, arr) => {
        accumulator.buffer.set(arr, accumulator.offset);
        return { ...accumulator, offset: arr.byteLength + accumulator.offset };
      },
      { buffer: new Uint8Array(bufferLen), offset: 0 }
    ).buffer;
  }
}
