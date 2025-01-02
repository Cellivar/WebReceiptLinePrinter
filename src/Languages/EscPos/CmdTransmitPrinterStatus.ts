import * as Util from '../../Util/index.js';
import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';

const awaitsEffect = new Cmds.CommandEffectFlags(['waitsForResponse']);

export type TransmitPrinterStatusCmd
  = 'PaperSensorStatus'
  | 'DrawerKickStatus'
  //| 'InkSensorStatus'

export const transmitPrinterStatusCmdMap: Record<TransmitPrinterStatusCmd, number> = {
  PaperSensorStatus: 1, //49
  DrawerKickStatus : 2, //50
  // InkSensorStatus  : 4, //52
}

export class CmdTransmitPrinterStatus implements Cmds.IPrinterExtendedCommand {
  public static typeE = Symbol('TransmitPrinterStatus');
  typeExtended                 = CmdTransmitPrinterStatus.typeE;
  commandLanguageApplicability = Conf.PrinterCommandLanguage.escPos;
  name                         = 'Transmit Printer Status';
  type                         = "CustomCommand" as const;
  effectFlags                  = awaitsEffect;
  toDisplay() { return this.name; }

  constructor(public readonly subcommand: TransmitPrinterStatusCmd) {}
}

export const mappingCmdTransmitPrinterStatus: Cmds.IPrinterCommandMapping<Uint8Array> = {
  commandType: CmdTransmitPrinterStatus.typeE,
  transpile: handleCmdTransmitPrinterStatus,
  readMessage: parseCmdTransmitPrinterStatus,
}

export function handleCmdTransmitPrinterStatus(
  cmd: Cmds.IPrinterCommand,
): Uint8Array {
  const command = cmd as CmdTransmitPrinterStatus;
  const argnum = transmitPrinterStatusCmdMap[command.subcommand];
  return new Uint8Array([
    // GS r <arg>
    Util.AsciiCodeNumbers.GS, 0x72, argnum,
  ]);
}

// Some paper sensors are not present, depending on the printer model.
// The names of some paper sensors are different, depending on the printer model.
enum PaperSensorByte {
  // Roll paper near end sensor: paper not present
  RollPaperNearEnd = 0x03,
  // Roll paper end sensor: paper not present
  RollPaperEnd     = 0x0c,
}

enum DrawerKickByte {
  // Drawer kick-out connector pin 3 state
  DrawerKickOut = 0x01,
}

// Only present on ink-based printers, uncommon.
// enum InkStatusByte {
//   // Ink near-end detected (1st color)
//   ColorOneNearEnd = 0x01,
//   // Ink near-end detected (2nd color)
//   ColorTwoNearEnd = 0x02,
// }

export function parseCmdTransmitPrinterStatus(
  msg: Uint8Array,
  cmd: Cmds.IPrinterCommand,
): Cmds.IMessageHandlerResult<Uint8Array> {
  // https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/gs_lr.html
  if ((cmd as CmdTransmitPrinterStatus).typeExtended !== CmdTransmitPrinterStatus.typeE) {
    throw new Cmds.MessageParsingError(
      `Incorrect command '${cmd.name}' passed to parseTransmitPrinterStatus, expected 'TransmitPrinterStatus' instead.`,
      msg
    );
  }
  const result: Cmds.IMessageHandlerResult<Uint8Array> = {
    messageIncomplete: false,
    messageMatchedExpectedCommand: true,
    messages: [],
    remainder: msg.slice(1)
  }

  const command = (cmd as CmdTransmitPrinterStatus);

  const status: Cmds.IStatusMessage = {
    messageType: "StatusMessage",
    statuses: new Cmds.StatusStateSet(),
  }
  const error: Cmds.IErrorMessage = {
    messageType: "ErrorMessage",
    errors: new Cmds.ErrorStateSet(),
  }

  // Each status is 1 byte.
  const byte = msg[0];

  switch (command.subcommand) {
    case 'PaperSensorStatus':
      if (Util.hasFlag(byte, PaperSensorByte.RollPaperNearEnd)) {
        error.errors.add(Cmds.ErrorState.MediaNearEnd);
      }
      if (Util.hasFlag(byte, PaperSensorByte.RollPaperEnd)) {
        error.errors.add(Cmds.ErrorState.MediaEmpty);
      }
      if (error.errors.size > 0) { result.messages.push(error); }
      break;
    case 'DrawerKickStatus':
      if (Util.hasFlag(byte, DrawerKickByte.DrawerKickOut)) {
        status.statuses.add(Cmds.StatusState.DrawerOpen);
      }
      if (status.statuses.size > 0) { result.messages.push(status); }
      break;
    // case 'InkSensorStatus':
    //   status.colorOneLow = hasFlag(byte, InkStatusByte.ColorOneNearEnd);
    //   status.colorTwoLow = hasFlag(byte, InkStatusByte.ColorTwoNearEnd);
    //   break;
  }

  return result;
}
