/** String-based ASCII control codes. */
export const enum AsciiCodeStrings {
  NUL = '\x00',
  SOH = '\x01',
  STX = '\x02',
  ETX = '\x03',
  EOT = '\x04',
  ENQ = '\x05',
  ACK = '\x06',
  BEL = '\x07',
  BS  = '\x08',
  TAB = '\x09',
  LF  = '\x0a',
  VT  = '\x0b',
  FF  = '\x0c',
  CR  = '\x0d',
  SO  = '\x0e',
  SI  = '\x0f',
  DLE = '\x10',
  DC1 = '\x11',
  DC2 = '\x12',
  DC3 = '\x13',
  DC4 = '\x14',
  NAK = '\x15',
  SYN = '\x16',
  ETB = '\x17',
  CAN = '\x18',
  EM  = '\x19',
  SUB = '\x1a',
  ESC = '\x1b',
  FS  = '\x1c',
  GS  = '\x1d',
  RS  = '\x1e',
  US  = '\x1f',
  DEL = '\x7F',
}

/** Number-based ASCII control codes. */
export const enum AsciiCodeNumbers {
  NUL = 0x00,
  SOH = 0x01,
  STX = 0x02,
  ETX = 0x03,
  EOT = 0x04,
  ENQ = 0x05,
  ACK = 0x06,
  BEL = 0x07,
  BS  = 0x08,
  TAB = 0x09,
  LF  = 0x0a,
  VT  = 0x0b,
  FF  = 0x0c,
  CR  = 0x0d,
  SO  = 0x0e,
  SI  = 0x0f,
  DLE = 0x10,
  DC1 = 0x11,
  DC2 = 0x12,
  DC3 = 0x13,
  DC4 = 0x14,
  NAK = 0x15,
  SYN = 0x16,
  ETB = 0x17,
  CAN = 0x18,
  EM  = 0x19,
  SUB = 0x1a,
  ESC = 0x1b,
  FS  = 0x1c,
  GS  = 0x1d,
  RS  = 0x1e,
  US  = 0x1f,
  DEL = 0x7F,
}

export const AsciiToDisplayLookup: Record<AsciiCodeNumbers, string> = {
  [AsciiCodeNumbers.NUL]: "[NUL]",
  [AsciiCodeNumbers.SOH]: "[SOH]",
  [AsciiCodeNumbers.STX]: "[STX]",
  [AsciiCodeNumbers.ETX]: "[ETX]",
  [AsciiCodeNumbers.EOT]: "[EOT]",
  [AsciiCodeNumbers.ENQ]: "[ENQ]",
  [AsciiCodeNumbers.ACK]: "[ACK]",
  [AsciiCodeNumbers.BEL]: "[BEL]",
  [AsciiCodeNumbers.BS]:  "[BS]",
  [AsciiCodeNumbers.TAB]: "[TAB]",
  [AsciiCodeNumbers.LF]:  "[LF]",
  [AsciiCodeNumbers.VT]:  "[VT]",
  [AsciiCodeNumbers.FF]:  "[FF]",
  [AsciiCodeNumbers.CR]:  "[CR]",
  [AsciiCodeNumbers.SO]:  "[SO]",
  [AsciiCodeNumbers.SI]:  "[SI]",
  [AsciiCodeNumbers.DLE]: "[DLE]",
  [AsciiCodeNumbers.DC1]: "[DC1]",
  [AsciiCodeNumbers.DC2]: "[DC2]",
  [AsciiCodeNumbers.DC3]: "[DC3]",
  [AsciiCodeNumbers.DC4]: "[DC4]",
  [AsciiCodeNumbers.NAK]: "[NAK]",
  [AsciiCodeNumbers.SYN]: "[SYN]",
  [AsciiCodeNumbers.ETB]: "[ETB]",
  [AsciiCodeNumbers.CAN]: "[CAN]",
  [AsciiCodeNumbers.EM]:  "[EM]",
  [AsciiCodeNumbers.SUB]: "[SUB]",
  [AsciiCodeNumbers.ESC]: "[ESC]",
  [AsciiCodeNumbers.FS]:  "[FS]",
  [AsciiCodeNumbers.GS]:  "[GS]",
  [AsciiCodeNumbers.RS]:  "[RS]",
  [AsciiCodeNumbers.US]:  "[US]",
  [AsciiCodeNumbers.DEL]: "[DEL]"
}

export function asciiToDisplay(...codes: number[]) {
  return codes.map(c => {
    const controlcode = c < 0x20 ? AsciiToDisplayLookup[c as AsciiCodeNumbers] : '';
    return ("0x" + (c + 0x100).toString(16).slice(-2)) + controlcode;
  }).join(', ');
}
