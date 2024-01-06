import * as Cmds from "../../../Documents/index.js";
import type { IErrorMessage, IStatusMessage, PrinterMessage } from "../../Communication/Messages.js";
import { hasFlag, type EscPosDocState, EscPos } from "./index.js";
import type { CommandSet } from "../../../Documents/CommandSet.js";
import { AsciiCodeNumbers, PrinterCommandLanguages } from "../index.js";

export interface AutoStatusBackSetting {
  drawerKickStatus: boolean,
  onlineStatus: boolean,
  errorStatus: boolean,
  rollPaperStatus: boolean,
  panelSwitchStatus: boolean,
}

export class SetAutoStatusBack implements Cmds.IPrinterExtendedCommand {
  public static typeE = Symbol("SetAutoStatusBack");
  typeExtended                 = SetAutoStatusBack.typeE;
  commandLanguageApplicability = new PrinterCommandLanguages([EscPos]);
  name                         = 'Set Automatic Status Back setting'
  type                         = 'CustomCommand' as const;
  effectFlags                  = Cmds.NoEffect;
  toDisplay() { return this.name; }

  constructor(public readonly settings: AutoStatusBackSetting = {
    drawerKickStatus: true,
    errorStatus: true,
    onlineStatus: true,
    panelSwitchStatus: true,
    rollPaperStatus: true
  }) {}
}

export function setAutoStatusBack(
  cmd: Cmds.IPrinterCommand,
  _docState: EscPosDocState,
  commandSet: CommandSet<Uint8Array>,
): Uint8Array {
  const settings = (cmd as SetAutoStatusBack).settings;
  let setting = 0x00;
  setting |= (settings.drawerKickStatus ? 0x01 : 0x00);
  setting |= (settings.onlineStatus ? 0x02 : 0x00);
  setting |= (settings.errorStatus ? 0x04 : 0x00);
  setting |= (settings.rollPaperStatus ? 0x08 : 0x00);
  setting |= (settings.panelSwitchStatus ? 0x40 : 0x00);
  return new Uint8Array([
    // GS a <arg>
    AsciiCodeNumbers.GS, ...commandSet.encodeCommand('a'), setting,
  ])
}

enum FirstAsbByte {
  DrawerKickStatus = 0x04,
  PrinterOnline    = 0x08,
  CoverOpen        = 0x20,
  PaperFedByButton = 0x40,
}

enum SecondAsbByte {
  WaitingForOnlineRecovery      = 0x01,
  PaperFeedButtonPushed         = 0x02,
  RecoverableError              = 0x04,
  AutocutterError               = 0x08,
  UnrecoverableError            = 0x20,
  AutomaticallyRecoverableError = 0x40,
}

enum ThirdAsbByte {
  RollPaperNearEnd = 0x03,
  RollPaperEnd     = 0x0c,
}

export function parseAutoStatusBack(
  firstByte: number,
  secondByte: number,
  thirdByte: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _fourthByte: number,
): PrinterMessage[] {
  // https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/gs_la.html
  const messages: PrinterMessage[] = [];

  const statusMsg: IStatusMessage = {
    messageType: "StatusMessage",

    printerOnline: hasFlag(firstByte, FirstAsbByte.PrinterOnline),
    drawerKickStatus: hasFlag(firstByte, FirstAsbByte.DrawerKickStatus),
    coverOpen: hasFlag(firstByte, FirstAsbByte.CoverOpen),
    paperLow: hasFlag(thirdByte, ThirdAsbByte.RollPaperNearEnd),
    paperButtonFeedingPaper: hasFlag(firstByte, FirstAsbByte.PaperFedByButton),
  }

  messages.push(statusMsg);

  const cutErr = hasFlag(secondByte, SecondAsbByte.AutocutterError);
  const recoverError = hasFlag(secondByte, SecondAsbByte.RecoverableError);
  const onlineRecover = hasFlag(secondByte, SecondAsbByte.WaitingForOnlineRecovery);
  const unrecoverError = hasFlag(secondByte, SecondAsbByte.UnrecoverableError);
  const autorecoverError = hasFlag(secondByte, SecondAsbByte.AutomaticallyRecoverableError);
  const paperOut = hasFlag(thirdByte, ThirdAsbByte.RollPaperEnd);

  const errorMsg: IErrorMessage = {
    messageType: "ErrorMessage",
    displayText: 'Error report from printer.',

    isErrored: cutErr || recoverError || onlineRecover || unrecoverError || autorecoverError || paperOut,

    paperOut: paperOut,

    cutterError: cutErr,
    waitForOnlineRecovery: onlineRecover,
    recoverableError: recoverError,
    autorecoverableError: autorecoverError,

    turnOffPowerImmediately: unrecoverError
  }

  if (errorMsg.isErrored) {
    messages.push(errorMsg);
  }

  return messages;
}
