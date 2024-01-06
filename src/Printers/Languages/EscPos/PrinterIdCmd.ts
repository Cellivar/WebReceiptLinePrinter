import * as Cmds from "../../../Documents/index.js";
import { MessageParsingError, type IMessageHandlerResult, type ISettingUpdateMessage } from "../../Communication/index.js";
import { AsciiCodeNumbers } from "../../Codepages/index.js";
import { EscPos, awaitsEffect } from "./EscPos.js";
import { hasFlag, sliceToNull, type EscPosDocState } from "./index.js";
import type { CommandSet } from "../../../Documents/CommandSet.js";
import { PrinterCommandLanguages } from "../index.js";

export type TransmitPrinterIdCmd
  = 'ModelID'   // 1, 49
  | 'TypeID'    // 2, 50
  | 'VersionID' // 3, 51 (uncommon)
  //| 'InfoAType' // 33, uncommon
  //| 'InfoAModelSpecific35' // uncommon
  //| 'InfoAModelSpecific36' // uncommon
  //| 'InfoAModelSpecific96' // uncommon
  //| 'InfoAModelSpecific110' // uncommon
  | 'InfoBFirmwareVersion' // 65
  | 'InfoBMakerName'       // 66
  | 'InfoBModelName'       // 67
  | 'InfoBSerialNo'        // 68
  | 'InfoBFontLanguage'    // 69 (nice)
  //| 'InfoBModelSpecific111'
  //| 'InfoBModelSpecific112'

export const transmitPrinterIdCmdMap: Record<TransmitPrinterIdCmd, number> = {
  ModelID              : 1,
  TypeID               : 2,
  VersionID            : 3,
  InfoBFirmwareVersion : 65,
  InfoBMakerName       : 66,
  InfoBModelName       : 67,
  InfoBSerialNo        : 68,
  InfoBFontLanguage    : 69, // nice
  //InfoBModelSpecific111: 111
}

export class TransmitPrinterId implements Cmds.IPrinterExtendedCommand {
  public static typeE = Symbol("TransmitPrinterId");
  typeExtended                 = TransmitPrinterId.typeE;
  commandLanguageApplicability = new PrinterCommandLanguages([EscPos]);
  name                         = 'Transmit Printer ID'
  type                         = "CustomCommand" as const;
  effectFlags                  = awaitsEffect;
  toDisplay() { return this.name; }

  constructor(public readonly subcommand: TransmitPrinterIdCmd) {}
}

export function handleTransmitPrinterId(
  cmd: Cmds.IPrinterCommand,
  _docState: EscPosDocState,
  commandSet: CommandSet<Uint8Array>
): Uint8Array {
  const command = cmd as TransmitPrinterId;
  const argnum = transmitPrinterIdCmdMap[command.subcommand];
  return new Uint8Array([
    // GS I <arg>
    AsciiCodeNumbers.GS, ...commandSet.encodeCommand('I'), argnum,
  ]);
}

export interface PrinterTypeIdMessage {
  isMultibyteCharactersSupported: boolean;
  isAutocutterInstalled: boolean;
  isDmdConnected: boolean;
}

enum PrinterId {
  // Multi-byte code characters are supported.
  hasMultiByteSupport = 0x01,
  //Autocutter installed.
  hasAutocutter = 0x02,
  // DM-D is connected.
  hasDmdConnected = 0x04,
}

const PrinterInfoHeaderA = 0x3d;
const PrinterInfoHeaderB = 0x5f;

function setSingleByteData(
  firstByte: number,
  subcommand: TransmitPrinterIdCmd,
  config: ISettingUpdateMessage
) {
  switch (subcommand) {
    // Printer ID
    // Each printer ID is composed of 1 byte.
    case 'ModelID':
      // Printer model ID (n = 1, 49) differs, depending on the printer model.
      // This ends up being a lookup table from Epson's documentation.
      // TODO: run this value through the lookup table for automatic model detect
      // TODO: Is this even useful?
      // config.printerModelId = firstByte;
      break;
    case 'TypeID':
      config.hasMultiByteSupport = hasFlag(firstByte, PrinterId.hasMultiByteSupport);
      config.hasAutocutter = hasFlag(firstByte, PrinterId.hasAutocutter);
      config.hasDmdConnected = hasFlag(firstByte, PrinterId.hasDmdConnected);
      break;
    case 'VersionID':
      // There is a one to one correspondence between the version ID (n = 3, 51) and the firmware version.
      // The details differ, depending on the printer model.
      // TODO: Is this even useful?
      // config.printerFirmwareVersionId = firstByte;
      break;
  }
}

function setPrinterInfoB(
  msg: Uint8Array,
  subcommand: TransmitPrinterIdCmd,
  config: ISettingUpdateMessage,
) {
  // sanity check
  if (msg.at(0) !== PrinterInfoHeaderB || msg.at(-1) !== AsciiCodeNumbers.NUL) {
    return;
  }

  // Each printer information is composed of [header to NUL]
  // (when n = 65 – 69, or n = 112).
  const packetData = msg.slice(1, -1);
  // If the printer information is not prepared, [Header + NUL] (2 bytes) are sent.
  if (packetData.length == 0) {
    return;
  }

  switch (subcommand) {
    // Printer Info B
    case 'InfoBFirmwareVersion':
      // "Firmware version", not a string?
      config.firmwareVersion = [...packetData];
      break;
    case 'InfoBMakerName':
      config.manufacturerName = String.fromCharCode(...packetData);
      break;
    case 'InfoBModelName':
      config.modelName = String.fromCharCode(...packetData);
      break;
    case 'InfoBSerialNo':
      config.serialNumber = String.fromCharCode(...packetData);
      break;
    case 'InfoBFontLanguage':
      config.fontLanguageSupport = String.fromCharCode(...packetData);
      break;
  }
}

export function parseTransmitPrinterId(
  msg: Uint8Array,
  cmd: Cmds.IPrinterCommand,
): IMessageHandlerResult<Uint8Array> {
  // https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/gs_ci.html
  if (cmd.type !== "CustomCommand" || (cmd as TransmitPrinterId).typeExtended !== TransmitPrinterId.typeE) {
    throw new MessageParsingError(
      `Incorrect command '${cmd.name}' passed to parseTransmitPrinterId, expected 'TransmitPrinterId' instead.`,
      msg
    );
  }
  const command = (cmd as TransmitPrinterId);

  const result: IMessageHandlerResult<Uint8Array> = {
    messageIncomplete: false,
    messageMatchedExpectedCommand: false,
    messages: [],
    remainder: msg,
  }

  const config: ISettingUpdateMessage = {
    messageType: "SettingUpdateMessage"
  }

  // The GS I command is broken into three groups:
  // * Basic info, 1-byte responses.
  // * Printer Info A, multi-byte with header 0x3d
  // * Printer info B, multi-byte with header 0x5f

  // Header values will never match a single-byte response.
  const firstByte = msg[0];
  switch (firstByte) {
    case PrinterInfoHeaderA: {
      const infoAPacket = sliceToNull(msg);
      if (infoAPacket.sliced.length === 0) {
        result.messageIncomplete = true;
        break;
      }
      if (infoAPacket.sliced.length === 2) {
        // Valid packet, no content. Indicates printer is busy working on it.
        // Discard the packet and wait for more.
        result.messageIncomplete = true;
        result.remainder = infoAPacket.remainder;
      }

      // TODO: Handle Printer Info A!
      // setPrinterInfoA(infoAPacket.sliced, command.subcommand, config);
      result.remainder = infoAPacket.remainder;
      result.messageMatchedExpectedCommand = true;
      result.messages.push(config);
      break;
    }
    case PrinterInfoHeaderB: {
      const infoBPacket = sliceToNull(msg);
      if (infoBPacket.sliced.length === 0) {
        result.messageIncomplete = true;
        break;
      }
      if (infoBPacket.sliced.length === 2) {
        // Valid packet, no content. Indicates printer is busy working on it.
        // Discard the packet and wait for more.
        result.messageIncomplete = true;
        result.remainder = infoBPacket.remainder;
      }

      setPrinterInfoB(infoBPacket.sliced, command.subcommand, config);
      result.remainder = infoBPacket.remainder;
      result.messageMatchedExpectedCommand = true;
      result.messages.push(config);
      break;
    }
    default:
      setSingleByteData(firstByte, command.subcommand, config);
      result.remainder = msg.slice(1);
      result.messageMatchedExpectedCommand = true;
      result.messages.push(config);
      break;
  }

  return result;
}
