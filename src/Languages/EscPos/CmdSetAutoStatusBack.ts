import * as Util from '../../Util/index.js';
import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';
import { MessageCandidates } from './Messages.js';

export interface AutoStatusBackSetting {
  drawerKickStatus: boolean,
  onlineStatus: boolean,
  errorStatus: boolean,
  rollPaperStatus: boolean,
  panelSwitchStatus: boolean,
}

export class CmdSetAutoStatusBack implements Cmds.IPrinterExtendedCommand {
  public static typeE = Symbol("CmdSetAutoStatusBack");
  typeExtended                 = CmdSetAutoStatusBack.typeE;
  commandLanguageApplicability = Conf.PrinterCommandLanguage.escPos;
  name                         = 'Set Automatic Status Back setting'
  type                         = 'CustomCommand' as const;
  effectFlags                  = Cmds.NoEffect;
  toDisplay() { return this.name; }

  constructor(public readonly settings: AutoStatusBackSetting = {
    drawerKickStatus : true,
    errorStatus      : true,
    onlineStatus     : true,
    panelSwitchStatus: true,
    rollPaperStatus  : true
  }) {}
}

export const mappingCmdSetAutoStatusBack: Cmds.IPrinterCommandMapping<Uint8Array> = {
  commandType: CmdSetAutoStatusBack.typeE,
  transpile: handleCmdSetAutoStatusBack,
  readMessage: parseCmdSetAutoStatusBack
}

export function handleCmdSetAutoStatusBack(
  cmd: Cmds.IPrinterCommand,
): Uint8Array {
  const settings = (cmd as CmdSetAutoStatusBack).settings;
  let setting = 0x00;
  setting |= (settings.drawerKickStatus  ? 0x01 : 0x00);
  setting |= (settings.onlineStatus      ? 0x02 : 0x00);
  setting |= (settings.errorStatus       ? 0x04 : 0x00);
  setting |= (settings.rollPaperStatus   ? 0x08 : 0x00);
  setting |= (settings.panelSwitchStatus ? 0x40 : 0x00);
  return new Uint8Array([
    // GS a <arg>
    Util.AsciiCodeNumbers.GS, 0x61, setting,
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

export function parseCmdSetAutoStatusBack(
  msg: Uint8Array,
): Cmds.IMessageHandlerResult<Uint8Array> {
  // https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/gs_la.html
  const result: Cmds.IMessageHandlerResult<Uint8Array> = {
    messageIncomplete: false,
    messageMatchedExpectedCommand: false,
    messages: [],
    remainder: msg,
  }

  // ASB is always 4 bytes, header of 0**1**00, trailer of 0**0****.
  // We need the next 3 bytes, make sure they're there.
  if (msg.length < 4) {
    result.messageIncomplete = true;
    return result;
  }

  result.remainder = msg.slice(4);

  // Confirm the next 3 bytes are trailers.
  const [first, second, third, fourth] = msg;
  if ( (second & 0x90) !== MessageCandidates.ASB2to4
    || (third  & 0x90) !== MessageCandidates.ASB2to4
    || (fourth & 0x90) !== MessageCandidates.ASB2to4
  ) {
    // We got the trailers, but they're wrong! Discard the whole lot since
    // we can't recover them.
    result.messages.push({
      messageType: 'ErrorMessage',
      errors: new Cmds.ErrorStateSet([Cmds.ErrorState.MessageReceiveException]),
      exceptions: [
        new Cmds.MessageParsingError(
          `First byte is an ASB (${Util.hex(first)}) but following bytes aren't (${Util.hex(second)} ${Util.hex(third)} ${Util.hex(fourth)}). Discarding invalid message!`,
          msg,
        )
      ],
    });
  }

  const statuses = new Cmds.StatusStateSet();

  if (Util.hasFlag(first, FirstAsbByte.PrinterOnline)) {
    statuses.add(Cmds.StatusState.PrinterOnline);
  }
  if (Util.hasFlag(first, FirstAsbByte.PaperFedByButton)) {
    statuses.add(Cmds.StatusState.PaperButtonFeedingPaper);
  }
  if (Util.hasFlag(first, FirstAsbByte.DrawerKickStatus)) {
    statuses.add(Cmds.StatusState.DrawerOpen);
  }
  if (statuses.size > 0) {
    result.messages.push({
      messageType: 'StatusMessage',
      statuses,
    });
  }

  const errors = new Cmds.ErrorStateSet();
  if (Util.hasFlag(first, FirstAsbByte.CoverOpen)) {
    errors.add(Cmds.ErrorState.PrintheadUp);
  }
  if (Util.hasFlag(third, ThirdAsbByte.RollPaperNearEnd)) {
    errors.add(Cmds.ErrorState.MediaNearEnd);
  }
  if (Util.hasFlag(third, ThirdAsbByte.RollPaperEnd)) {
    errors.add(Cmds.ErrorState.MediaEmpty);
  }
  if (Util.hasFlag(second, SecondAsbByte.AutocutterError)) {
    errors.add(Cmds.ErrorState.CutterJammedOrNotInstalled);
  }
  if (Util.hasFlag(second, SecondAsbByte.RecoverableError)) {
    errors.add(Cmds.ErrorState.PressFeedButtonToRecover);
  }
  if (Util.hasFlag(second, SecondAsbByte.WaitingForOnlineRecovery)) {
    errors.add(Cmds.ErrorState.PressFeedButtonToRecover);
  }
  if (Util.hasFlag(second, SecondAsbByte.UnrecoverableError)) {
    errors.add(Cmds.ErrorState.UnrecoverableError);
  }
  if (Util.hasFlag(second, SecondAsbByte.AutomaticallyRecoverableError)) {
    errors.add(Cmds.ErrorState.PressFeedButtonToRecover);
  }
  if (errors.size > 0) {
    result.messages.push({
      messageType: 'ErrorMessage',
      errors,
    });
  }

  return result;
}
