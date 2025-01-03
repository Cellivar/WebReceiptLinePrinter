import * as Util from '../../Util/index.js';
import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';
import * as Basic from './BasicCommands.js';

import { handleMessage } from './Messages.js';
import { CmdTransmitPrinterId, mappingCmdTransmitPrinterId } from "./CmdTransmitPrinterId.js";
import { CmdTransmitPrinterStatus, mappingCmdTransmitPrinterStatus } from "./CmdTransmitPrinterStatus.js";
import { mappingCmdSetAutoStatusBack } from "./CmdSetAutoStatusBack.js";

/** PCL handler for ESC/POS */
export class EscPos extends Cmds.RawCommandSet {
  override get documentStartPrefix() { return this.noop; };
  override get documentEndSuffix() { return this.noop; };

  constructor(
    extendedCommands: Cmds.IPrinterCommandMapping<Uint8Array>[] = []
  ) {
    super(
      Conf.PrinterCommandLanguage.escPos,
      handleMessage,
      {
        NoOp: { commandType: 'NoOp' },
        CustomCommand: {
          commandType: 'CustomCommand',
          transpile: (c, d) => this.getExtendedCommand(c)(c, d, this),
        },
        Identify: {
          commandType: 'Identify',
          expand: () => [new CmdTransmitPrinterId('TypeID')],
        },
        Reset: {
          commandType: 'Reset',
          transpile: () =>new Uint8Array([Util.AsciiCodeNumbers.ESC, Basic.enc('@')]),
        },
        Raw: {
          commandType: 'Raw',
          transpile: (c) => (c as Cmds.RawCommand<Uint8Array>).command,
        },
        GetStatus: {
          commandType: 'GetStatus',
          expand: () => [
            new CmdTransmitPrinterStatus('PaperSensorStatus'),
            new CmdTransmitPrinterStatus('DrawerKickStatus'),
          ],
        },
        PrintConfiguration: {
          commandType: 'PrintConfiguration',
          transpile: () => Basic.testPrint(new Cmds.TestPrint('printerStatus'))
        },
        QueryConfiguration: {
          commandType: 'QueryConfiguration',
          expand: () => [
            // TODO: Dynamically figure out what subcommands to send to the printer
            // TODO: Add support for model-specific info?
            // Getting the complete active config from ESC/POS requires multiple
            // back-and-forth steps.
            new CmdTransmitPrinterId('TypeID'),
            new CmdTransmitPrinterId('InfoBMakerName'),
            new CmdTransmitPrinterId('InfoBModelName'),
            new CmdTransmitPrinterId('InfoBSerialNo'),
            new CmdTransmitPrinterId('InfoBFirmwareVersion'),
          ]
        },
        TestPrint: {
          commandType: 'TestPrint',
          transpile: (c) => Basic.testPrint(c as Cmds.TestPrint),
        },
        PulseOutput: {
          commandType: 'PulseOutput',
          transpile: (c) => Basic.pulseHandler(c as Cmds.PulseCommand),
        },
        OffsetPrintPosition: {
          commandType: 'OffsetPrintPosition',
          transpile: (c, d) => Basic.offsetPrintPosition((c as Cmds.OffsetPrintPosition), d),
        },
        Cut: {
          commandType: 'Cut',
          transpile: (c, d) => Basic.cutHandler(c as Cmds.Cut, d),
        },
        Newline: {
          commandType: 'Newline',
          transpile: () => new Uint8Array([Util.AsciiCodeNumbers.LF]),
        },
        StartReceipt: { commandType: 'StartReceipt' },
        EndReceipt: {
          commandType: 'EndReceipt',
          // ESC/POS doesn't have any special form end handling. Assume the document
          // provided a cut command or whatever the user intended, don't guess.

          // The manual indicates always getting the paper status is a good practice
          // as it tells you when the printer is done printing. This also ensures we
          // always have something to await at the end of a document.
        },
        Barcode: {
          commandType: 'Barcode',
          transpile: (c) => { throw new Cmds.TranspileDocumentError(`Command not implemented: ${c.constructor.name}`) },
        },
        Codepage: {
          commandType: 'Codepage',
          transpile: (c, d) => this.combineCommands(...Basic.setCodepage((c as Cmds.SetCodepage).codepage, d)),
        },
        HorizontalRule: {
          commandType: 'HorizontalRule',
          transpile: (c, d) => this.combineCommands(...Basic.horizontalRule((c as Cmds.HorizontalRule), d))
        },
        Image: {
          commandType: 'Image',
          transpile: (c) => { throw new Cmds.TranspileDocumentError(`Command not implemented: ${c.constructor.name}`) },
        },
        SetLineSpacing: {
          commandType: 'SetLineSpacing',
          transpile: (c, d) => Basic.setLineSpacing((c as Cmds.SetLineSpacing).spacing, d),
        },
        SetPrintArea: {
          commandType: 'SetPrintArea',
          transpile: (c, d) => Basic.setPrintArea((c as Cmds.SetPrintArea), d),
        },
        Text: {
          commandType: 'Text',
          transpile: (c, d) => this.combineCommands(...Basic.text((c as Cmds.Text).text, d)),
        },
        TextDraw: {
          commandType: 'TextDraw',
          transpile: (c, d) => this.combineCommands(...Basic.textDraw((c as Cmds.TextDraw).text, d)),
        },
        TextFormatting: {
          commandType: 'TextFormatting',
          transpile: (c, d) => Basic.setTextFormatting((c as Cmds.TextFormatting).format, d),
        },
        TwoDCode: {
          commandType: 'TwoDCode',
          transpile: (c) => { throw new Cmds.TranspileDocumentError(`Command not implemented: ${c.constructor.name}`) },
        }
      },
      [
        mappingCmdTransmitPrinterStatus,
        mappingCmdTransmitPrinterId,
        mappingCmdSetAutoStatusBack,
        ...extendedCommands,
      ]
    );
  }
}
