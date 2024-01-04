import * as Cmds from "../../../Documents/index.js";
import { MessageParsingError, type IErrorMessage, type IMessageHandlerResult, type IStatusMessage } from "../../Communication/index.js";
import type { CommandSet } from "../../../Documents/CommandSet.js";
import { AsciiCodeNumbers, PrinterCommandLanguages } from "../index.js";
import { hasFlag, type EscPosDocState, EscPos } from "./index.js";

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

export class TransmitPrinterStatus implements Cmds.IPrinterExtendedCommand {
  public static typeE = Symbol('TransmitPrinterStatus');
  typeExtended                 = TransmitPrinterStatus.typeE;
  commandLanguageApplicability = new PrinterCommandLanguages([EscPos]);
  name                         = 'Transmit Printer Status';
  type                         = "CustomCommand" as const;
  effectFlags                  = awaitsEffect;
  toDisplay() { return this.name; }

  constructor(public readonly subcommand: TransmitPrinterStatusCmd) {}
}

export function handleTransmitPrinterStatus(
  cmd: Cmds.IPrinterCommand,
  _docState: EscPosDocState,
  commandSet: CommandSet<Uint8Array>,
): Uint8Array {
  const command = cmd as TransmitPrinterStatus;
  const argnum = transmitPrinterStatusCmdMap[command.subcommand];
  return new Uint8Array([
    // GS r <arg>
    AsciiCodeNumbers.GS, ...commandSet.encodeCommand('r'), argnum,
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

export function parseTransmitPrinterStatus(
  msg: Uint8Array,
  cmd: Cmds.IPrinterCommand,
): IMessageHandlerResult<Uint8Array> {
  // https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/gs_lr.html
  if (cmd.type !== "CustomCommand" || (cmd as TransmitPrinterStatus).typeExtended !== TransmitPrinterStatus.typeE) {
    throw new MessageParsingError(
      `Incorrect command '${cmd.name}' passed to parseTransmitPrinterStatus, expected 'TransmitPrinterStatus' instead.`,
      msg
    );
  }
  const command = (cmd as TransmitPrinterStatus);

  const status: IStatusMessage = {
    messageType: "StatusMessage",
  }
  const error: IErrorMessage = {
    messageType: "ErrorMessage",
    displayText: "Status update reported an error",
    isErrored: false,
  }

  // Each status is 1 byte.
  const byte = msg[0];

  switch (command.subcommand) {
    case 'PaperSensorStatus':
      status.paperLow = hasFlag(byte, PaperSensorByte.RollPaperNearEnd);
      error.paperOut = hasFlag(byte, PaperSensorByte.RollPaperEnd);
      error.isErrored = (true && error.paperOut);
      break;
    case 'DrawerKickStatus':
      status.drawerKickStatus = hasFlag(byte, DrawerKickByte.DrawerKickOut);
      break;
    // case 'InkSensorStatus':
    //   status.colorOneLow = hasFlag(byte, InkStatusByte.ColorOneNearEnd);
    //   status.colorTwoLow = hasFlag(byte, InkStatusByte.ColorTwoNearEnd);
    //   break;
  }

  const result: IMessageHandlerResult<Uint8Array> = {
    messageIncomplete: false,
    messageMatchedExpectedCommand: true,
    messages: [status],
    remainder: msg.slice(1)
  }
  if (error.isErrored) { result.messages.push(error); }
  return result;
}
