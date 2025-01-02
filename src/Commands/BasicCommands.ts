import * as Util from '../Util/index.js';
import { BasicCommand, CommandEffectFlags, NoEffect, type CommandTypeBasic, type IPrinterBasicCommand } from './Commands.js';

export class NoOp extends BasicCommand {
  name = 'No operation placeholder';
  type: CommandTypeBasic = 'NoOp';
  constructor() { super(); }
}

export class StartReceipt extends BasicCommand {
  name = 'Explicitly start a new receipt.';
  type = 'StartReceipt' as const;
  constructor() { super([]); }
}

export class EndReceipt extends BasicCommand {
  name = 'Explicitly end a receipt.';
  type: CommandTypeBasic = 'EndReceipt';
  constructor() { super([]); }
}

export class Newline extends BasicCommand {
  name = 'Print a newline';
  type: CommandTypeBasic = 'Newline';
  constructor() { super( ['feedsPaper']); }
}

export type TestPrintType = 'hexadecimal' | 'rolling' | 'printerStatus'

export class TestPrint extends BasicCommand {
  name = 'Run a test print';
  type: CommandTypeBasic = 'TestPrint';
  constructor(public readonly printType: TestPrintType = 'rolling') {
    super(['feedsPaper', 'actuatesCutter', 'lossOfConnection']);
  }
}

export class QueryConfiguration extends BasicCommand {
  name = 'Get the printer configuration'
  type: CommandTypeBasic = 'QueryConfiguration';
  constructor() { super(['waitsForResponse']); }
}

export class GetStatus extends BasicCommand {
  name = 'Get the printer status'
  type: CommandTypeBasic = 'GetStatus';
  constructor() { super(['waitsForResponse']); }
}

export type CutType = "Partial" | "Complete"

export class Cut implements IPrinterBasicCommand {
  name = 'Cut paper';
  type = "Cut" as const;
  effectFlags = new CommandEffectFlags(["actuatesCutter", "feedsPaper"]);
  toDisplay() { return `${this.name} ${this.cutType}.`; }

  constructor(
    public readonly cutType: CutType = "Partial",
    /** Number of character lines between the print head and cutter. */
    public readonly bladeOffsetLines = 4
  ) {}
}

export type PulsePin = "Drawer1" | "Drawer2"

export class PulseCommand implements IPrinterBasicCommand {
  name = "Pulse the drawer kick output.";
  type = 'PulseOutput' as const;
  effectFlags = new CommandEffectFlags(["pulsesOutputPins"]);
  toDisplay(): string {
    return `Pulse output ${this.pulsePin} for ${this.onMS}ms on and ${this.offMS} off.`;
  }

  public readonly onMS: number;
  public readonly offMS: number;
  public readonly pulsePin: PulsePin;
  constructor(
    /** Which device pin to pulse on */
    pulsePin: PulsePin = "Drawer1",
    /** Milliseconds pulse is on for, up to 500ms. */
    onMS: number = 100,
    /** Milliseconds pulse is off for. Must be greater than on time. Up to 500ms */
    offMS: number = 500,
  ) {
    this.onMS = Math.floor(Math.min(500, onMS ?? 100));
    this.offMS = Math.floor(Math.min(500, offMS ?? 500));
    this.pulsePin = pulsePin;
  }
}

export class ImageCommand implements IPrinterBasicCommand {
  name = 'Prints an image'
  type = "Image" as const;
  effectFlags = new CommandEffectFlags(["feedsPaper"]);
  toDisplay() { return this.name; }

  constructor(public readonly imgData: string) {}
}

export class Barcode implements IPrinterBasicCommand {
  name = 'Prints a barcode';
  type = 'Barcode' as const;
  effectFlags = new CommandEffectFlags(["feedsPaper"]);
  toDisplay(): string { return this.name; }

  constructor(public readonly barcodeData: object) {}
}

export class TwoDCode implements IPrinterBasicCommand {
  name = 'Prints a 2D code';
  type = 'TwoDCode' as const;
  effectFlags = new CommandEffectFlags(["feedsPaper"]);
  toDisplay(): string { return this.name; }

  constructor(public readonly codeData: object) {}
}

export class RawCommand<TOutput> implements IPrinterBasicCommand {
  name = 'Adds raw command'
  type = "Raw" as const;
  effectFlags = new CommandEffectFlags(["unknown"]);
  toDisplay() { return this.name }

  constructor(public readonly command: TOutput) {}
}

export type Underline = "None" | "Single" | "Double";
export type Bold      = "None" | "Enable";
export type Invert    = "None" | "Enable";
export type Alignment = "Left" | "Center" | "Right";
export type Width     = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type Height    = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface TextFormat {
  resetToDefault?: boolean,
  underline?: Underline,
  bold?: Bold,
  invert?: Invert,
  alignment?: Alignment,
  width?: Width,
  height?: Height
}

export class TextFormatting implements IPrinterBasicCommand {
  name = 'Set text formatting'
  type = "TextFormatting" as const;
  effectFlags = NoEffect;
  toDisplay() {
    const sb = ['Set text formatting: '];
    if (this.format.resetToDefault === true) { sb.push('first reset to defaults'); }
    if (this.format.bold      !== undefined) { sb.push('set bold ' +      this.format.bold); }
    if (this.format.height    !== undefined) { sb.push('set height ' +    this.format.height); }
    if (this.format.width     !== undefined) { sb.push('set width ' +     this.format.width); }
    if (this.format.underline !== undefined) { sb.push('set underline ' + this.format.underline); }
    if (this.format.invert    !== undefined) { sb.push('set invert ' +    this.format.invert); }
    if (this.format.alignment !== undefined) { sb.push('set alignment ' + this.format.alignment); }
    return sb.join(', ');
   }

  constructor(public readonly format: TextFormat = {}) {}
}

// https://en.wikipedia.org/wiki/Box-drawing_character
export type BoxDrawingCharacter = '' | ' '
  // Boxes!
  | '░' | '▒' | '▓'
  // Single line
  | '─' | '│' | '┌' | '┐' | '└' | '┘' | '├' | '┤' | '┬' | '┴' | '┼'
  // Double line
  | '═' | '║' | '╔' | '╗' | '╚' | '╝' | '╠' | '╣' | '╦' | '╩' | '╬'
  // Single/Double Adapters
  | '╒' | '╕' | '╘' | '╛' | '╞' | '╡' | '╤' | '╧' | '╪'
  | '╓' | '╖' | '╙' | '╜' | '╟' | '╢' | '╥' | '╨' | '╫'
  // Curves
  // TODO: Enable when codepage swapping is easier to implement.
  //| '╭' | '╮' | '╯' | '╰' | '╱' | '╲' | '╳'

export type OnlyBoxDrawingCharacters<S> =
  S extends ""
    ? unknown
    : S extends `${BoxDrawingCharacter}${infer Tail}`
      ? OnlyBoxDrawingCharacters<Tail>
      : never;

export class TextDraw implements IPrinterBasicCommand {
  name = 'Write text as drawing'
  type = 'TextDraw' as const;
  effectFlags = NoEffect;
  toDisplay(): string { return `Draw text '${this.text.join('')}'`; }

  public readonly text: BoxDrawingCharacter[];

  constructor(...text: BoxDrawingCharacter[]) {
    this.text = text;
  }
}

export class Text implements IPrinterBasicCommand {
  name = 'Write text'
  type = 'Text' as const;
  effectFlags = NoEffect;
  toDisplay() { return `Write '${this.text}'`; }

  constructor(public readonly text: string = '') {}
}

export class SetCodepage implements IPrinterBasicCommand {
  name = 'Set character codepage'
  type = 'Codepage' as const;
  effectFlags = NoEffect;
  toDisplay() { return `Set codepage ${this.codepage}` }

  constructor(public readonly codepage: Util.Codepage) {}
}

export type PrintPositionOrigin = "absolute" | "relative";

export class OffsetPrintPosition implements IPrinterBasicCommand {
  name = 'Change print position'
  type = 'OffsetPrintPosition' as const;
  effectFlags = NoEffect;
  toDisplay() { return `Offset print position ${this.origin} by ${this.characters} characters.`}

  public readonly origin: PrintPositionOrigin;
  public readonly characters: number;
  constructor(
    origin: PrintPositionOrigin = 'relative',
    characters?: number
  ) {
    this.origin = origin;
    this.characters = characters ?? 0;
  }
}

export class SetPrintArea implements IPrinterBasicCommand {
  name = 'Set print area'
  type = 'SetPrintArea' as const;
  effectFlags = NoEffect;
  toDisplay() { return `Set print area to |${this.leftMargin} [${this.width}] ${this.rightMargin}|`; }

  constructor(
    /** Characters to the left of the print space. */
    public readonly leftMargin = 0,
    /** Characters of the printable area between the margins. */
    public readonly width = 0,
    /** Characters to the right of the print space. */
    public readonly rightMargin = 0
  ) {}
}

export type LineStyle = 'single' | 'double'

export class HorizontalRule implements IPrinterBasicCommand {
  name = 'Add horizontal rule'
  type = 'HorizontalRule' as const;
  effectFlags = NoEffect;
  toDisplay() { return this.name; }

  constructor (
    public readonly width?: number,
    public readonly lineStyle: LineStyle = 'single') {}
}

export class SetLineSpacing implements IPrinterBasicCommand {
  name = 'Set the vertical line spacing'
  type = 'SetLineSpacing' as const;
  effectFlags = NoEffect;
  toDisplay() { return `Set vertical spacing to ${this.spacing}.`}

  public readonly spacing: number;

  constructor(spacing: number = 1) {
    this.spacing = Util.clampToRange(spacing, 0, 255);
  }
}
