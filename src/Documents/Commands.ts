import type { Codepage } from "../Printers/Codepages/index.js";
import { clampToRange } from "../NumericRange.js";
import type { PrinterCommandLanguages } from "../Printers/Languages/index.js";

/** General categories of side-effects commands can cause to a device. */
export type PrinterCommandEffectTypes
  = "unknown"
  | "altersConfig"
  | "feedsPaper"
  | "lossOfConnection"
  | "actuatesCutter"
  | "pulsesOutputPins"
  | "waitsForResponse";

/** Flags to indicate special operations a command might cause. */
export class CommandEffectFlags extends Set<PrinterCommandEffectTypes> { }
export const NoEffect = new CommandEffectFlags();

/** Union type of all possible commands that must be handled by command sets. */
export type CommandType
  // Users/PCLs may supply printer commands. This uses a different lookup table.
  = "CustomCommand"
  // General printer commands
  | "Reset"
  | "TestPrint"
  | "Raw"
  | "PulseOutput"
  | "Newline"
  | "Cut"
  // Status and Config
  | "GetConfiguration"
  | "GetStatus"
  // Print Format Commands
  | "OffsetPrintPosition"
  // Image commands
  | "Image"
  | "Barcode"
  | "TwoDCode"
  // Text formatting commands
  | "TextFormatting"
  | "TextDraw"
  | "Text"
  | "Codepage"
  //| "Box"
  | "HorizontalRule"
  // Configuration commands
  | "SetLineSpacing"
  | "SetPrintArea"

/** A command that can be sent to a printer. */
export interface IPrinterCommand {
  /** Get the display name of this command. */
  readonly name: string;
  /** Get the command type of this command. */
  readonly type: CommandType;
  /** Any effects this command may cause the printer to undergo. */
  readonly effectFlags: CommandEffectFlags;

  /** Get the human-readable output of this command. */
  toDisplay(): string;
}

/** A custom command beyond the standard command set, with command-language-specific behavior. */
export interface IPrinterExtendedCommand extends IPrinterCommand {
  /** The unique identifier for this command. */
  typeExtended: symbol;

  /** Gets the command languages this extended command can apply to. */
  commandLanguageApplicability: PrinterCommandLanguages;
}

abstract class BasicCommand implements IPrinterCommand {
  abstract name: string;
  abstract type: CommandType;
  effectFlags: CommandEffectFlags;
  toDisplay() { return this.name; }
  constructor(effects: PrinterCommandEffectTypes[]) {
    this.effectFlags = new CommandEffectFlags(effects);
  }
}

export class Newline extends BasicCommand {
  name = 'Print a newline';
  type: CommandType = 'Newline';
  constructor() { super( ['feedsPaper']); }
}

export type TestPrintType = 'hexadecimal' | 'rolling' | 'printerStatus'

export class TestPrint extends BasicCommand {
  name = 'Run a test print';
  type: CommandType = 'TestPrint';
  constructor(public readonly printType: TestPrintType = 'rolling') {
    super(['feedsPaper', 'actuatesCutter', 'lossOfConnection']);
  }
}

export class GetConfiguration extends BasicCommand {
  name = 'Get the printer configuration'
  type: CommandType = 'GetConfiguration';
  constructor() { super(['waitsForResponse']); }
}

export class GetStatus extends BasicCommand {
  name = 'Get the printer status'
  type: CommandType = 'GetStatus';
  constructor() { super(['waitsForResponse']); }
}

export type CutType = "Partial" | "Complete"

export class Cut implements IPrinterCommand {
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

export class PulseCommand implements IPrinterCommand {
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

export class ImageCommand implements IPrinterCommand {
  name = 'Prints an image'
  type = "Image" as const;
  effectFlags = new CommandEffectFlags(["feedsPaper"]);
  toDisplay() { return this.name; }

  constructor(public readonly imgData: string) {}
}

export class Barcode implements IPrinterCommand {
  name = 'Prints a barcode';
  type = 'Barcode' as const;
  effectFlags = new CommandEffectFlags(["feedsPaper"]);
  toDisplay(): string { return this.name; }

  constructor(public readonly barcodeData: object) {}
}

export class TwoDCode implements IPrinterCommand {
  name = 'Prints a 2D code';
  type = 'TwoDCode' as const;
  effectFlags = new CommandEffectFlags(["feedsPaper"]);
  toDisplay(): string { return this.name; }

  constructor(public readonly codeData: object) {}
}

export class RawCommand<TOutput> implements IPrinterCommand {
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

export class TextFormatting implements IPrinterCommand {
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

export class TextDraw implements IPrinterCommand {
  name = 'Write text as drawing'
  type = 'TextDraw' as const;
  effectFlags = NoEffect;
  toDisplay(): string { return `Draw text '${this.text.join('')}'`; }

  public readonly text: BoxDrawingCharacter[];

  constructor(...text: BoxDrawingCharacter[]) {
    this.text = text;
  }
}

export class Text implements IPrinterCommand {
  name = 'Write text'
  type = 'Text' as const;
  effectFlags = NoEffect;
  toDisplay() { return `Write '${this.text}'`; }

  constructor(public readonly text: string = '') {}
}

export class SetCodepage implements IPrinterCommand {
  name = 'Set character codepage'
  type = 'Codepage' as const;
  effectFlags = NoEffect;
  toDisplay() { return `Set codepage ${this.codepage}` }

  constructor(public readonly codepage: Codepage) {}
}

export type PrintPositionOrigin = "absolute" | "relative";

export class OffsetPrintPosition implements IPrinterCommand {
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

export class SetPrintArea implements IPrinterCommand {
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

export class HorizontalRule implements IPrinterCommand {
  name = 'Add horizontal rule'
  type = 'HorizontalRule' as const;
  effectFlags = NoEffect;
  toDisplay() { return this.name; }

  constructor (
    public readonly width?: number,
    public readonly lineStyle: LineStyle = 'single') {}
}

export class SetLineSpacing implements IPrinterCommand {
  name = 'Set the vertical line spacing'
  type = 'SetLineSpacing' as const;
  effectFlags = NoEffect;
  toDisplay() { return `Set vertical spacing to ${this.spacing}.`}

  public readonly spacing: number;

  constructor(spacing: number = 1) {
    this.spacing = clampToRange(spacing, 0, 255);
  }
}
