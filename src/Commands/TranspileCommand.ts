import * as Util from '../Util/index.js';
import * as Conf from '../Configs/index.js';
import type { PrinterConfig } from './PrinterConfig.js';
import type { TextFormat } from './BasicCommands.js';
import { CommandEffectFlags } from './Commands.js';

/** Interface of document state effects carried between individual commands. */
export interface TranspiledDocumentState {
  /** The current formatted character font size. */
  characterSize: Conf.Coordinate;
  /** The current formatted codepage. */
  codepage: Util.Codepage;
  /** The aggregate effects of this document, when printed. */
  commandEffectFlags: CommandEffectFlags;
  /** The current formatted document print width. */
  currentPrintWidth: number;

  /** The read-only config at the start of the transpile operation. */
  initialConfig: PrinterConfig;
  lineSpacing: number;

  margin: {
    leftChars: number;
    rightChars: number;
  }

  textFormat: TextFormat;
}

export function getNewTranspileState(config: PrinterConfig): TranspiledDocumentState {
  return {
    // TODO: Pull more of these from printer options.
    characterSize: {
      left: 12,
      top: 24,
    },
    commandEffectFlags: new CommandEffectFlags(),
    currentPrintWidth: config.charactersPerLine,
    lineSpacing: 1,
    margin: {
      leftChars: 0,
      rightChars: 0,
    },
    textFormat: {},
    codepage: "CP437",
    initialConfig: config,
  }
}

/** Represents an error when validating a document against a printer's capabilities. */
export class TranspileDocumentError extends Util.WebReceiptLineError {
  private _innerErrors: TranspileDocumentError[] = [];
  get innerErrors() {
    return this._innerErrors;
  }

  constructor(message: string, innerErrors?: TranspileDocumentError[]) {
    super(message);
    this._innerErrors = innerErrors ?? [];
  }
}
