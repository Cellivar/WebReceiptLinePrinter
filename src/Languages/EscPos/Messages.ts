import * as Util from '../../Util/index.js';
import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';

import { CmdSetAutoStatusBack } from './CmdSetAutoStatusBack.js';

/* eslint-disable @typescript-eslint/no-duplicate-enum-values */
export enum MessageCandidates {
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

export function getMessageCandidate(firstByte: number): MessageCandidate {
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

export function handleMessage<TReceived extends Conf.MessageArrayLike>(
  cmdSet: Cmds.CommandSet<Uint8Array>,
  message: TReceived,
  _config: Cmds.PrinterConfig,
  sentCommand?: Cmds.IPrinterCommand,
): Cmds.IMessageHandlerResult<TReceived> {
  const result: Cmds.IMessageHandlerResult<TReceived> = {
    messageIncomplete: false,
    messageMatchedExpectedCommand: false,
    messages: [],
    remainder: message,
  }
  const msg = Cmds.asUint8Array(message);
  let remainder = msg;
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
      const handled = cmdSet.callMessageHandler(msg, new CmdSetAutoStatusBack());
      result.messages.push(...handled.messages);
      result.messageIncomplete = handled.messageIncomplete;
      result.messageMatchedExpectedCommand = handled.messageMatchedExpectedCommand;
      remainder = handled.remainder;

      break;
    }
    case 'header':
    case 'realtime':
    case 'response': {
      // We got a response to a sent command. To proceed we need to know what
      // question we asked. Response bytes don't contain enough info to tell.
      // If we don't know what we asked we can't process this command.
      const handled = cmdSet.callMessageHandler(msg, sentCommand);
      result.messages.push(...handled.messages);
      result.messageIncomplete = handled.messageIncomplete;
      result.messageMatchedExpectedCommand = handled.messageMatchedExpectedCommand;
      remainder = handled.remainder;

      break;
    }
    case 'xoff':
    case 'xon':
      // TODO: Until serial support is figured out if we ever get these drop them.
      remainder = msg.slice(1);
      break;

    case 'unknown':
      // We're out of clues. Freak out!
      result.messages.push({
        messageType: 'ErrorMessage',
        errors: new Cmds.ErrorStateSet([Cmds.ErrorState.MessageReceiveException]),
        exceptions: [
          new Cmds.MessageParsingError(
            `Received a message that couldn't be identified and will be ignored: ${Util.hex(firstByte)}. This may be a bug.`,
            msg,
          )
        ]
      });
      remainder = msg.slice(1);
      break;
  }

  // Put the remainder message back into its native format.
  result.remainder = Cmds.asTargetMessageType(remainder, message);
  return result;
}
