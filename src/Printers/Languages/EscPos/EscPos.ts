import * as Cmds from "../../../Documents/index.js";
import { PrinterCommandLanguages } from "../index.js";
import { type EscPosDocState } from './index.js';
import { clampToRange, repeat } from "../../../index.js";
import { handleEscPosMessage } from "./Messages.js";
import { TransmitPrinterId, handleTransmitPrinterId } from "./PrinterIdCmd.js";
import { TransmitPrinterStatus, handleTransmitPrinterStatus } from "./PrinterStatusCmd.js";
import { CodepageEncoder, type Codepage } from "../../Codepages/index.js";
import type { IMessageHandlerResult } from "../../Communication/Messages.js";
import type { IMediaOptions } from "../../Options/index.js";
import { AsciiCodeNumbers as Ascii } from "../../Codepages/ASCII.js";
import { exhaustiveMatchGuard, type IPrinterExtendedCommandMapping  } from "../../../Documents/CommandSet.js";
import { SetAutoStatusBack, setAutoStatusBack } from "./AutoStatusBack.js";
import { RawCommandSet } from "../RawCommandSet.js";
import { TranspileDocumentError } from "../../../Documents/TranspileCommandError.js";
import { codepageNumberForEscPos, codepageSwitchCmd } from "./Codepages.js";

/** PCL handler for ESC/POS */
export class EscPos extends RawCommandSet {
  private encoder = new TextEncoder();

  // TODO: Pull dynamically instead of assuming the printer supports these!
  // This list is common to most TM- series printers so will be safe for now..
  // https://download4.epson.biz/sec_pubs/pos/reference_en/charcode/supported_codepage.html
  private candidateCodepages: Codepage[] = [
    "CP437",
    "CP720",
    "CP737",
    "CP775",
    "CP850",
    "CP851",
    "CP852",
    "CP853",
    "CP855",
    "CP857",
    "CP858",
    "CP860",
    "CP861",
    "CP862",
    "CP863",
    "CP864",
    "CP865",
    "CP866",
    "CP869",
    "CP1098",
    "CP1118",
    "CP1119",
    "CP1125",
    "ISO88592",
    "ISO88597",
    "ISO885915",
    "RK1048",
    "WINDOWS1250",
    "WINDOWS1251",
    "WINDOWS1252",
    "WINDOWS1253",
    "WINDOWS1254",
    "WINDOWS1255",
    "WINDOWS1256",
    "WINDOWS1257",
    "WINDOWS1258",
  ];

  public encodeCommand(str = '', withNewline = false): Uint8Array {
    return this.encoder.encode(str + (withNewline ? '\n' : ''));
  }

  /** Encode a single character, for readability of command sequences. */
  private enc(char = '') {
    return this.encodeCommand(char)[0];
  }

  public get documentStartCommands(): Cmds.IPrinterCommand[] {
    // ESC/POS doesn't need any setup commands. The various command handlers
    // each handle setting things like codepages and line formatting directly.
    // TODO: Consider whether an ESC @ (reset) is appropriate, to clear any
    // weird settings that may have been set.
    return [];
  }

  public get documentEndCommands(): Cmds.IPrinterCommand[] {
    // ESC/POS doesn't have any special form end handling. Assume the document
    // provided a cut command or whatever the user intended, don't guess.

    // The manual indicates always getting the paper status is a good practice
    // as it tells you when the printer is done printing. This also ensures we
    // always have something to await at the end of a document.
    return [new TransmitPrinterStatus('PaperSensorStatus')];
  }

  public getNewTranspileState(media: IMediaOptions): EscPosDocState {
    // TODO: Pull more of these from printer options.
    return {
      characterSize: {
        left: 12,
        top: 24,
      },
      charactersPerLine: media.charactersPerLine,
      commandEffectFlags: new Cmds.CommandEffectFlags(),
      lineSpacing: 1,
      margin: {
        leftChars: 0,
        rightChars: 0,
      },
      printWidth: media.charactersPerLine,
      textFormat: {},
      dpi: 5,
      codepage: "CP437"
    };
  }

  public parseMessage(
    msg: Uint8Array,
    sentCommand?: Cmds.IPrinterCommand
  ): IMessageHandlerResult<Uint8Array> {
    return handleEscPosMessage(msg, sentCommand);
  }

  public expandCommand(cmd: Cmds.IPrinterCommand): Cmds.IPrinterCommand[] {
    switch (cmd.type) {
      default:
        return [cmd];
      case "GetConfiguration":
        // TODO: Dynamically figure out what subcommands to send to the printer
        // TODO: Add support for model-specific info?
        // Getting the complete active config from ESC/POS requires multiple
        // back-and-forth steps.
        return [
          new TransmitPrinterId('TypeID'),
          // TODO: Is this even useful?
          //new TransmitPrinterId('ModelID'),
          new TransmitPrinterId('InfoBSerialNo'),
          new TransmitPrinterId('InfoBFontLanguage'),
        ];
      case "GetStatus":
        // TODO: Dynamically figure out what subcommands to send to the printer
        return [
          new TransmitPrinterStatus('PaperSensorStatus'),
          new TransmitPrinterStatus('DrawerKickStatus'),
        ];
    }
  }

  public transpileCommand(
    cmd: Cmds.IPrinterCommand,
    docState: EscPosDocState): Uint8Array {
    // Do not suggest a better way to do this unless it's in the form of a complete PR.
    switch (cmd.type) {
      default:
        exhaustiveMatchGuard(cmd.type);
      case "CustomCommand":
        return this.extendedCommandHandler(cmd, docState);

      case "Reset":
        return new Uint8Array([Ascii.ESC, this.enc('@')]);
      case 'TestPrint':
        return new Uint8Array([Ascii.GS, this.enc('('), this.enc('A'), 0x02, 0x00, 0x01, 0x03]);
      case "Cut":
        return this.cutHandler(cmd as Cmds.Cut);
      case "Newline":
        return new Uint8Array([Ascii.LF]);
      case "PulseOutput":
        return this.pulseHandler(cmd as Cmds.PulseCommand);
      case "Raw":
        return (cmd as Cmds.RawCommand<Uint8Array>).command;
      case "OffsetPrintPosition":
        return this.offsetPrintPosition((cmd as Cmds.OffsetPrintPosition), docState);

      case "HorizontalRule":
        return this.horizontalRule((cmd as Cmds.HorizontalRule), docState);

      case "SetPrintArea":
        return this.setPrintArea((cmd as Cmds.SetPrintArea), docState);
      case "SetLineSpacing":
        return this.setLineSpacing((cmd as Cmds.SetLineSpacing), docState);
      case "TextFormatting":
        return this.setTextFormatting(cmd as Cmds.TextFormatting, docState);
      case "Codepage":
        return this.setCodepage((cmd as Cmds.SetCodepage).codepage, docState);

      case "TextDraw":
        return this.textDraw((cmd as Cmds.TextDraw).text, docState);
      case "Text":
        return this.text((cmd as Cmds.Text).text, docState);

      // Should be split into a composite command prior to running.
      case "GetConfiguration":
      case "GetStatus":
        return this.noop;

      // TODO: these commands lol
      case "Image":
      case "Barcode":
      case "TwoDCode":
        throw new TranspileDocumentError(
          `Unhandled command '${cmd.constructor.name}'.`
        );
    }
  }

  constructor(extendedCommands: Array<IPrinterExtendedCommandMapping<Uint8Array>> = []) {
    super(EscPos, extendedCommands);

    this.extendedCommandMap.set(TransmitPrinterId.typeE,     handleTransmitPrinterId);
    this.extendedCommandMap.set(TransmitPrinterStatus.typeE, handleTransmitPrinterStatus);
    this.extendedCommandMap.set(SetAutoStatusBack.typeE,     setAutoStatusBack);
  }

  private cutHandler(cmd: Cmds.Cut) {
    let cut = 0x00;
    switch (cmd.cutType) {
      case "Complete": cut = 0x00; break;
      case "Partial": cut = 0x01; break;
    }
    return new Uint8Array([Ascii.GS, this.enc('V'), cut]);
  }

  private pulseHandler(cmd: Cmds.PulseCommand) {
    let pin: number
    switch (cmd.pulsePin) {
      case "Pin2": pin = 0x00;
      case "Pin5": pin = 0x01;
    }
    const onMS = Math.floor(cmd.onMS / 2);
    const offMS = Math.floor(cmd.offMS / 2);
    return new Uint8Array([Ascii.ESC, this.enc('p'), pin, onMS, offMS]);
  }

  private setTextFormatting(cmd: Cmds.TextFormatting, docState: EscPosDocState) {
    const f = cmd.format;
    const buffer: number[] = [];

    if (f.underline !== undefined) { // ESC - // FS -
      docState.textFormat.underline = f.underline;
      let op: number;
      switch (f.underline) {
        case 'None'  : op = 0x00; break;
        case 'Single': op = 0x01; break;
        case 'Double': op = 0x02; break;
      }
      buffer.push(Ascii.ESC, 0x2d, op, Ascii.FS, 0x2d, op);
    }

    if (f.bold !== undefined) { // ESC E
      docState.textFormat.bold = f.bold;
      const op = f.bold === 'Enable' ? 0x01 : 0x00;
      buffer.push(Ascii.ESC, this.enc('E'), op);
    }

    if (f.invert !== undefined) { // GS B
      docState.textFormat.invert = f.invert;
      const op = f.invert === 'Enable' ? 0x01 : 0x00;
      buffer.push(Ascii.GS, this.enc('B'), op);
    }

    if (f.alignment !== undefined) { // ESC a
      docState.textFormat.alignment = f.alignment;
      let op: number;
      switch (f.alignment) {
        case 'Left': op = 0x00; break;
        case 'Center': op = 0x01; break;
        case 'Right': op = 0x02; break;
      }
      buffer.push(Ascii.ESC, this.enc('a'), op);
    }

    if (f.width !== undefined || f.height !== undefined) { // GS !
      const newHeight = f.height ?? docState.textFormat.height ?? 1;
      const newWidth  = f.width  ?? docState.textFormat.width  ?? 1;
      docState.textFormat.height = newHeight;
      docState.textFormat.width = newWidth;
      buffer.push(Ascii.GS, this.enc('!'), (newHeight - 1) | (newWidth - 1) << 4);
    }

    return new Uint8Array(buffer);
  }

  private setCodepage(
    codepage: Codepage,
    docState: EscPosDocState,
    persistToDocState = true
  ) {
    let gotCode = codepage;
    let code = codepageSwitchCmd.get(codepage);
    if (code === undefined) {
      code = new Uint8Array([codepageNumberForEscPos.CP437]);
      gotCode = "CP437";
    }

    if (persistToDocState) {
      docState.codepage = gotCode;
    }

    return this.combineCommands(new Uint8Array([
      // ESC t <codepage ID>, then any other weird commands we might need to set.
      Ascii.ESC, this.enc('t')]), code
    );
  }

  private offsetPrintPosition(
    cmd: Cmds.OffsetPrintPosition,
    docState: EscPosDocState
  ) {
    // TODO: Add offset to print position in form
    const offset = (cmd.characters) * docState.characterSize.left;
    switch (cmd.origin) {
      case 'absolute':
        const abs = clampToRange(offset, 0, 65535);
        // ESC $ lowbyte, highbyte
        return new Uint8Array([Ascii.ESC, this.enc('$'), (abs & 255), (abs >> 8 & 255)]);
      case 'relative':
        const rel = clampToRange(offset, -32768, 32767);
        // ESC \ lowbyte highbyte
        return new Uint8Array([Ascii.ESC, this.enc('\\'), (rel & 255), (rel >> 8 & 255)]);
    }
  }

  private textDraw(
    text: Cmds.BoxDrawingCharacter[],
    docState: EscPosDocState,
  ) {
    return this.combineCommands(
      this.setFormattingCodepage(),
      this.text(text.join(''), docState),
    );
  }

  private text(
    text: string,
    docState: EscPosDocState,
  ): Uint8Array {
    // Auto-switch between encodings for special characters.
    // TODO: Dynamic list of supported encodings based on printer model.
    const fragments = CodepageEncoder
      .autoEncode(text, this.candidateCodepages)
      .flatMap(f => [
        this.setCodepage(f.codepage, docState),
        f.bytes
      ]);
    return this.combineCommands(...fragments);
  }

  private setFormattingCodepage() {
    // FS C 0 to disable kanji
    // FS . to reset katakana mode?
    // FS t 0 to select 'CP437' for line formatting glyphs.
    return new Uint8Array([
      Ascii.FS, this.enc('C'), 0x00,
      Ascii.FS, this.enc('.'),
      Ascii.ESC, this.enc('t'), codepageNumberForEscPos.CP437,
    ]);
  }

  private horizontalRule(
    cmd: Cmds.HorizontalRule,
    docState: EscPosDocState,
  ) {
    const width = cmd.width ?? docState.charactersPerLine;
    const char = cmd.lineStyle === 'single' ? '─' : '═';
    return this.textDraw(
      repeat(char as Cmds.BoxDrawingCharacter, width),
      docState);
  }

  private setPrintArea(
    cmd: Cmds.SetPrintArea,
    docState: EscPosDocState,
  ) {
    docState.margin.leftChars = cmd.leftMargin;
    docState.printWidth = cmd.width;
    docState.margin.rightChars = cmd.rightMargin;
    const leftMarginMotionUnits = cmd.leftMargin * docState.characterSize.left;
    const printSizeMotionsUnits = cmd.width * docState.characterSize.left;
    // ESC/POS can't set a right margin, it doesn't really need to. We set this:
    // |---> text area -->    |
    // GS L sets the area start, GS W sets the area end.
    return new Uint8Array([
      // GS L lowbit, hightbit
      Ascii.GS, this.enc('L'), leftMarginMotionUnits & 255, leftMarginMotionUnits >> 8 & 255,
      Ascii.GS, this.enc('W'), printSizeMotionsUnits & 255, printSizeMotionsUnits >> 8 & 255,
    ]);
  }

  private setLineSpacing(
    cmd: Cmds.SetLineSpacing,
    docState: EscPosDocState,
  ) {
    const spacingInMotionUnits = clampToRange(cmd.spacing * docState.characterSize.top, 0, 255);
    return new Uint8Array([
      // ESC 3
      Ascii.ESC, this.enc('3'), spacingInMotionUnits,
    ])
  }
}

export const awaitsEffect = new Cmds.CommandEffectFlags(['waitsForResponse']);
export const EscPosLang = new PrinterCommandLanguages([EscPos]);