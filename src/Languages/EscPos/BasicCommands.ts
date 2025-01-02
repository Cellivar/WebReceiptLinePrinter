import * as Util from '../../Util/index.js';
import * as Cmds from '../../Commands/index.js';
import { codepageNumberForEscPos, codepageSwitchCmd } from './Codepages.js';

/** Encode a single character, for readability of command sequences. */
export function enc(char = '') {
  return Cmds.asUint8Array(char)[0];
}

export function testPrint(cmd: Cmds.TestPrint) { // GS ( A
  let page = 0x03;
  switch (cmd.printType) {
    case 'hexadecimal': page = 0x01; break;
    case 'printerStatus': page = 0x02; break;
    case 'rolling': page = 0x03; break;
  }
  return new Uint8Array([Util.AsciiCodeNumbers.GS, enc('('), enc('A'), 0x02, 0x00, 0x01, page]);
}

export function cutHandler(cmd: Cmds.Cut, docState: Cmds.TranspiledDocumentState) {
  const bladeOffset = cmd.bladeOffsetLines * 2.5;
  let cut = 0x00;
  switch (cmd.cutType) {
    case "Complete": cut = 0x00; break;
    case "Partial": cut = 0x01; break;
  }

  // The cutter and the print head are separated by about 4 lines.
  // Set the line spacing to 4x, newline, cut, then reset line spacing.
  const currentLineSpacing = docState.lineSpacing;
  return new Uint8Array([
    ...setLineSpacing(bladeOffset, docState),
    Util.AsciiCodeNumbers.LF,
    Util.AsciiCodeNumbers.GS, enc('V'), cut,
    ...setLineSpacing(currentLineSpacing, docState)
  ]);
}

export function pulseHandler(cmd: Cmds.PulseCommand) {
  let drawer: number
  switch (cmd.pulsePin) {
    case "Drawer1": drawer = 0x00; break;
    case "Drawer2": drawer = 0x01; break;
  }
  const onMS = Math.floor(cmd.onMS / 2);
  const offMS = Math.floor(cmd.offMS / 2);
  return new Uint8Array([Util.AsciiCodeNumbers.ESC, enc('p'), drawer, onMS, offMS]);
}

export function setTextFormatting(f: Cmds.TextFormat, docState: Cmds.TranspiledDocumentState) {
  const buffer: number[] = [];

  if (f.underline !== undefined || f.resetToDefault) { // ESC - // FS -
    docState.textFormat.underline = f.underline;
    let op: number;
    switch (f.underline) {
      default:
      case 'None'  : op = 0x00; break;
      case 'Single': op = 0x01; break;
      case 'Double': op = 0x02; break;
    }
    buffer.push(Util.AsciiCodeNumbers.ESC, 0x2d, op, Util.AsciiCodeNumbers.FS, 0x2d, op);
  }

  if (f.bold !== undefined || f.resetToDefault) { // ESC E
    docState.textFormat.bold = f.bold ?? 'None';
    const op = f.bold === 'Enable' ? 0x01 : 0x00;
    buffer.push(Util.AsciiCodeNumbers.ESC, enc('E'), op);
  }

  if (f.invert !== undefined || f.resetToDefault) { // GS B
    docState.textFormat.invert = f.invert ?? 'None';
    const op = f.invert === 'Enable' ? 0x01 : 0x00;
    buffer.push(Util.AsciiCodeNumbers.GS, enc('B'), op);
  }

  if (f.alignment !== undefined || f.resetToDefault) { // ESC a
    docState.textFormat.alignment = f.alignment;
    let op: number;
    switch (f.alignment) {
      case 'Left': op = 0x00; break;
      default:
      case 'Center': op = 0x01; break;
      case 'Right': op = 0x02; break;
    }
    buffer.push(Util.AsciiCodeNumbers.ESC, enc('a'), op);
  }

  if (f.width !== undefined || f.height !== undefined || f.resetToDefault) { // GS !
    const resetHeight = f.resetToDefault === true ? 1 : undefined;
    const resetWidth = f.resetToDefault === true ? 1 : undefined;
    const newHeight = f.height ?? resetHeight ?? docState.textFormat.height ?? 1;
    const newWidth  = f.width ?? resetWidth ?? docState.textFormat.width  ?? 1;
    docState.textFormat.height = newHeight;
    docState.textFormat.width = newWidth;
    buffer.push(Util.AsciiCodeNumbers.GS, enc('!'), (newHeight - 1) | (newWidth - 1) << 4);
  }

  return new Uint8Array(buffer);
}

export function setCodepage(
  codepage: Util.Codepage,
  docState: Cmds.TranspiledDocumentState,
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

  return [new Uint8Array([
    // ESC t <codepage ID>, then any other weird commands we might need to set.
    Util.AsciiCodeNumbers.ESC, enc('t')]), code
  ];
}

export function offsetPrintPosition(
  cmd: Cmds.OffsetPrintPosition,
  docState: Cmds.TranspiledDocumentState
) {
  // TODO: Add offset to print position in form
  const offset = (cmd.characters) * docState.characterSize.left;
  switch (cmd.origin) {
    case 'absolute': {
      const abs = Util.clampToRange(offset, 0, 65535);
      // ESC $ lowbyte, highbyte
      return new Uint8Array([Util.AsciiCodeNumbers.ESC, enc('$'), (abs & 255), (abs >> 8 & 255)]);
    }
    case 'relative': {
      const rel = Util.clampToRange(offset, -32768, 32767);
      // ESC \ lowbyte highbyte
      return new Uint8Array([Util.AsciiCodeNumbers.ESC, enc('\\'), (rel & 255), (rel >> 8 & 255)]);
    }
  }
}

export function textDraw(
  textDraw: Cmds.BoxDrawingCharacter[],
  docState: Cmds.TranspiledDocumentState,
) {
  return [
    setTextFormatting({width: 1, height: 1}, docState),
    setFormattingCodepage(),
    ...text(textDraw.join(''), docState),
  ];
}

// TODO: Pull dynamically instead of assuming the printer supports these!
// This list is common to most TM- series printers so will be safe for now..
// https://download4.epson.biz/sec_pubs/pos/reference_en/charcode/supported_codepage.html
const candidateCodepages: Util.Codepage[] = [
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

export function text(
  text: string,
  docState: Cmds.TranspiledDocumentState,
): Uint8Array[] {
  // Auto-switch between encodings for special characters.
  // TODO: Dynamic list of supported encodings based on printer model.
  const fragments = Util.CodepageEncoder
    .autoEncode(text, candidateCodepages)
    .flatMap(f => [
      ...setCodepage(f.codepage, docState),
      f.bytes
    ]);
  return fragments;
}

export function setFormattingCodepage() {
  // FS C 0 to disable kanji
  // FS . to reset katakana mode?
  // FS t 0 to select 'CP437' for line formatting glyphs.
  return new Uint8Array([
    Util.AsciiCodeNumbers.FS, enc('C'), 0x00,
    Util.AsciiCodeNumbers.FS, enc('.'),
    Util.AsciiCodeNumbers.ESC, enc('t'), codepageNumberForEscPos.CP437,
  ]);
}

export function horizontalRule(
  cmd: Cmds.HorizontalRule,
  docState: Cmds.TranspiledDocumentState,
) {
  const width = cmd.width ?? docState.initialConfig.charactersPerLine;
  const char = cmd.lineStyle === 'single' ? '─' : '═';
  return textDraw(
    Util.repeat(char as Cmds.BoxDrawingCharacter, width),
    docState);
}

export function setPrintArea(
  cmd: Cmds.SetPrintArea,
  docState: Cmds.TranspiledDocumentState,
) {
  docState.margin.leftChars = cmd.leftMargin;
  docState.currentPrintWidth = cmd.width;
  docState.margin.rightChars = cmd.rightMargin;
  const leftMarginMotionUnits = cmd.leftMargin * docState.characterSize.left;
  const printSizeMotionsUnits = cmd.width * docState.characterSize.left;
  // ESC/POS can't set a right margin, it doesn't really need to. We set this:
  // |---> text area -->    |
  // GS L sets the area start, GS W sets the area end.
  return new Uint8Array([
    // GS L lowbit, hightbit
    Util.AsciiCodeNumbers.GS, enc('L'), leftMarginMotionUnits & 255, leftMarginMotionUnits >> 8 & 255,
    Util.AsciiCodeNumbers.GS, enc('W'), printSizeMotionsUnits & 255, printSizeMotionsUnits >> 8 & 255,
  ]);
}

export function setLineSpacing(
  spacing: number,
  docState: Cmds.TranspiledDocumentState,
) {
  const spacingInMotionUnits = Util.clampToRange(spacing * docState.characterSize.top, 0, 255);
  docState.lineSpacing = spacing;
  return new Uint8Array([
    // ESC 3
    Util.AsciiCodeNumbers.ESC, enc('3'), spacingInMotionUnits,
  ])
}
