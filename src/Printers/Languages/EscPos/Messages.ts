/// <reference types="vitest/import-meta" />
import * as Cmds from '../../../Documents/index.js'
import { MessageParsingError, type IMessageHandlerResult } from "../../Communication/index.js";
import { AsciiCodeNumbers, hex } from '../../Codepages/index.js';
import { parseAutoStatusBack } from './AutoStatusBack.js';
import { TransmitPrinterId, parseTransmitPrinterId } from './index.js';
import { TransmitPrinterStatus, parseTransmitPrinterStatus } from './PrinterStatusCmd.js';

/**
 * Slice an array from the start to the first NUL character, returning both pieces.
 *
 * If no NUL character is found sliced will have a length of 0.
 */
export function sliceToNull(msg: Uint8Array): {
  sliced: Uint8Array,
  remainder: Uint8Array,
} {
  const idx = msg.indexOf(AsciiCodeNumbers.NUL);
  if (idx === -1) {
    return {
      sliced: new Uint8Array(),
      remainder: msg
    }
  }

  return {
    sliced: msg.slice(0, idx + 1),
    remainder: msg.slice(idx + 1),
  };
}

/* eslint-disable @typescript-eslint/no-duplicate-enum-values */
enum MessageCandidates {
  Response = 0x00,
  ASB2to4  = 0x00,
  Realtime = 0x12,
  AutoStat = 0x10,
  Header   = 0x11,
  // Serial only
  XON      = 0x11,
  XOFF     = 0x13,
}
/* eslint-enable @typescript-eslint/no-duplicate-enum-values */

type MessageCandidate = 'unknown' | 'response' | 'asb' | 'realtime' | 'header' |'xon' | 'xoff'

function checkBits(value: number, xor: number, mask: number) {
  return ((value ^ xor) & mask) === mask;
}

function getMessageCandidate(firstByte: number): MessageCandidate {
  // The basic single-byte responses can be differentiated according to this table:

  // Command     | Status (bits)          | Mask | XOR
  //             | 7  6  5  4  3  2  1  0 |      |
  // --------------------------------------------------
  // GS I        | 0  *  *  0  *  *  *  * | 0x90 | 0x90
  // GS r        | 0  *  *  0  *  *  *  * | 0x90 | 0x90
  // DLE EOT     | 0  *  *  1  *  *  1  0 | 0x93 | 0x81
  // ASB (byte1) | 0  *  *  1  *  *  0  0 | 0x93 | 0x83
  // ASB (b2-4)  | 0  *  *  0  *  *  *  * | 0x90 | 0x90
  // Header      | 0  *  *  1  *  *  *  1 | 0x91 | 0x80
  // -------------SERIAL ONLY ------------------
  // X ON        | 0  0  0  1  0  0  0  1 | 0xFF
  // X OFF       | 0  0  0  1  0  0  1  1 | 0xFF

  // Fancier commands have a header byte first instead, which will always conflict
  // with other first-bytes.
  // Header 0**1***1
  // 0x37 - 00110111 - A whole bunch of commands under GS ( and FS (
  // 0x39 - 00111001 - FS ( e - Extended ASB
  // 0x3d - 00111101 - GS I Printer Info A
  // 0x5f - 01011111 - Maintenance counters / Printer Info B

  // The ESC/POS manual has notes like this:
  // Basic ASB status can be differentiated by other transmission data by
  // Bit 0, 1, 4, and 7 of the first byte. Process the transmitted data from the
  // printer as ASB status which is consecutive 3 byte if it is
  // "0xx1xx00" [x = 0 or 1].

  // Compare what we constructed to expected patterns, paying attention to order
  // we check in to ensure we don't confuse candidates.
  switch (true) {
    // XON/XOFF must be an exact match, guaranteed to conflict with all other first bytes.
    case (firstByte === MessageCandidates.XON):
      return 'xon';
    case (firstByte === MessageCandidates.XOFF):
      return 'xoff';
    // Everything else is a mixture of 1s and 0s, so we can't do basic AND operations.
    // First XOR the value against the inverse of the message we're looking for.
    // This should give us all of the bits set for the mask. AND it with the mask.
    // If the result matches the mask then we found our packet.
    // Check bit 4
    case checkBits(firstByte, 0x90, 0x90):
      return 'response';
    // Check bit 0
    case checkBits(firstByte, 0x80, 0x91):
      return 'header'
    // Check bit 1
    case checkBits(firstByte, 0x83, 0x93):
      return 'asb';
    case checkBits(firstByte, 0x81, 0x93):
      return 'realtime';
    default:
      return 'unknown';
  }
}

type MessageHandlerDelegate = (
  msg: Uint8Array,
  sentCommand: Cmds.IPrinterCommand
) => IMessageHandlerResult<Uint8Array>;

export function handleEscPosMessage(
  msg: Uint8Array,
  sentCommand?: Cmds.IPrinterCommand
): IMessageHandlerResult<Uint8Array> {
  const result: IMessageHandlerResult<Uint8Array> = {
    messageIncomplete: false,
    messageMatchedExpectedCommand: false,
    messages: [],
    remainder: msg,
  }
  if (msg === undefined || msg.length === 0) { return result; }
  // There are several categories of messages ESC/POS can send. Broadly:
  // * Automatic Status Back (ASB) - Sent whenever the printer wants to.
  // * Real-time commands - Processed asap and responded to asap, blocking otherwise.
  // * One byte response - Immediate response to a command in a single byte.
  // * Multibyte response - Immediate response to a command, multiple bytes.

  // To make things even more fun, the message package could contain SEVERAL
  // separate messages. So we must determine what message(s) we've gotten and
  // reply with them individually.

  // The messages we can receive unexpectedly will have a first byte header
  // we can identify reliably. Get that candidate.
  const firstByte = msg.at(0);
  if (firstByte === undefined) { return result; }

  switch (getMessageCandidate(firstByte)) {
    case 'asb': {
      // ASB is always 4 bytes, header of 0**1**00, trailer of 0**0****.
      // We need the next 3 bytes, make sure they're there.
      if (msg.length < 4) {
        result.messageIncomplete = true;
        break;
      }

      result.remainder = msg.slice(4);

      // Confirm the next 3 bytes are trailers.
      const [first, second, third, fourth] = msg;
      if ( (second & 0x90) !== MessageCandidates.ASB2to4
        || (third & 0x90)  !== MessageCandidates.ASB2to4
        || (fourth & 0x90) !== MessageCandidates.ASB2to4
      ) {
        // We got the trailers, but they're wrong! Discard the whole lot since
        // we can't recover them.
        result.messages.push({
          messageType: 'ErrorMessage',
          displayText: `First byte is an ASB (${hex(first)}) but following bytes aren't (${hex(second)} ${hex(third)} ${hex(fourth)}). Discarding invalid message!`,
          isErrored: true,
        });
        break;
      }

      // This is a complete ASB! Parse it!
      result.messages.push(...parseAutoStatusBack(first, second, third, fourth));
      break;
    }
    case 'header':
    case 'realtime':
    case 'response': {
      // We got a response to a sent command. To proceed we need to know what
      // question we asked. Response bytes don't contain enough info to tell.
      // If we don't know what we asked we can't process this command.
      if (sentCommand === undefined) {
        throw new MessageParsingError(
          `Received a command reply message ${hex(firstByte)} without 'sentCommand' being provided, can't handle this message.`,
          msg
        );
      }

      const messageHandlerMap = new Map<symbol | Cmds.CommandType, MessageHandlerDelegate>([
        [TransmitPrinterId.typeE, parseTransmitPrinterId],
        [TransmitPrinterStatus.typeE, parseTransmitPrinterStatus],
      ]);

      // Since we know this is a command response and we have a command to check
      // we can kick this out to a lookup function. That function will need to
      // do the slicing for us as we don't know how long the message might be.
      const cmdRef = sentCommand.type === 'CustomCommand'
        ? (sentCommand as Cmds.IPrinterExtendedCommand).typeExtended
        : sentCommand.type;
      const handler = messageHandlerMap.get(cmdRef);
      if (handler === undefined) {
        throw new MessageParsingError(
          `Command '${sentCommand.name}' has no message handler and should not have been awaited for message ${hex(firstByte)}. This is a bug in the library.`,
          msg
        )
      }

      const handled = handler(msg, sentCommand);
      result.messages.push(...handled.messages);
      result.remainder = handled.remainder;
      result.messageIncomplete = handled.messageIncomplete;
      result.messageMatchedExpectedCommand = handled.messageMatchedExpectedCommand;
      break;
    }
    case 'xoff':
    case 'xon':
      // TODO: Until serial support is figured out if we ever get these drop them.
      result.remainder = msg.slice(1);
      break;

    case 'unknown':
      // We're out of clues. Freak out!
      result.messages.push({
        messageType: 'ErrorMessage',
        displayText: `Received a message that couldn't be identified and will be ignored: ${hex(firstByte)}. This may be a bug.`,
        isErrored: true,
      });
      result.remainder = msg.slice(1);
      break;
  }

  return result;
}

if (import.meta.vitest) {
  const { test, expect, describe } = import.meta.vitest

  describe('escpos message candidates', () => {
    test('xon and xoff are exact', () => {
      expect(getMessageCandidate(MessageCandidates.XON)).toBe('xon');
      expect(getMessageCandidate(MessageCandidates.XOFF)).toBe('xoff');
    });

    test('null byte is a response', () => {
      expect(getMessageCandidate(0x00)).toBe('response');
    });

    test('realtime byte is realtime', () => {
      expect(getMessageCandidate(MessageCandidates.Realtime)).toBe('realtime');
    });

    test('asb byte is asb', () => {
      expect(getMessageCandidate(MessageCandidates.AutoStat)).toBe('asb');
    });

    test('Header byte is Header', () => {
      expect(getMessageCandidate(0x37)).toBe('header');
    });

    test('FF to be unknown', () => {
      expect(getMessageCandidate(0xff)).toBe('unknown');
    });
  });
}
