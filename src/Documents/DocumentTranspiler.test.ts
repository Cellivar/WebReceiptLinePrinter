import { expect, describe, it } from 'vitest';
import {ReadyToPrintDocuments} from '../ReadyToPrintDocuments.js';
import { getNewTranspileState, PrinterConfig, type TranspiledDocumentState } from '../Commands/index.js';
import { transpileDocument } from './DocumentTranspiler.js';
import { EscPos } from '../Languages/index.js';

function getFakeState(): TranspiledDocumentState {
  return getNewTranspileState(new PrinterConfig());
}

describe('DocumentTranspiler', () => {
  describe('escpos', () => {
    const escpos = new EscPos.EscPos();

    describe('ReadyToPrint Docs', () => {
      it('configDocument', () => {
        const state = getFakeState();
        expect(transpileDocument(ReadyToPrintDocuments.getConfig, escpos, state))
          .toMatchInlineSnapshot(`
            CompiledDocument {
              "effects": Set {
                "waitsForResponse",
              },
              "language": 1,
              "transactions": [
                Transaction {
                  "awaitedCommands": [
                    CmdTransmitPrinterId {
                      "commandLanguageApplicability": 1,
                      "effectFlags": Set {
                        "waitsForResponse",
                      },
                      "name": "Transmit Printer ID",
                      "subcommand": "TypeID",
                      "type": "CustomCommand",
                      "typeExtended": Symbol(CmdTransmitPrinterId),
                    },
                  ],
                  "commands": Uint8Array [
                    29,
                    73,
                    2,
                  ],
                },
                Transaction {
                  "awaitedCommands": [
                    CmdTransmitPrinterId {
                      "commandLanguageApplicability": 1,
                      "effectFlags": Set {
                        "waitsForResponse",
                      },
                      "name": "Transmit Printer ID",
                      "subcommand": "InfoBMakerName",
                      "type": "CustomCommand",
                      "typeExtended": Symbol(CmdTransmitPrinterId),
                    },
                  ],
                  "commands": Uint8Array [
                    29,
                    73,
                    66,
                  ],
                },
                Transaction {
                  "awaitedCommands": [
                    CmdTransmitPrinterId {
                      "commandLanguageApplicability": 1,
                      "effectFlags": Set {
                        "waitsForResponse",
                      },
                      "name": "Transmit Printer ID",
                      "subcommand": "InfoBModelName",
                      "type": "CustomCommand",
                      "typeExtended": Symbol(CmdTransmitPrinterId),
                    },
                  ],
                  "commands": Uint8Array [
                    29,
                    73,
                    67,
                  ],
                },
                Transaction {
                  "awaitedCommands": [
                    CmdTransmitPrinterId {
                      "commandLanguageApplicability": 1,
                      "effectFlags": Set {
                        "waitsForResponse",
                      },
                      "name": "Transmit Printer ID",
                      "subcommand": "InfoBSerialNo",
                      "type": "CustomCommand",
                      "typeExtended": Symbol(CmdTransmitPrinterId),
                    },
                  ],
                  "commands": Uint8Array [
                    29,
                    73,
                    68,
                  ],
                },
                Transaction {
                  "awaitedCommands": [
                    CmdTransmitPrinterId {
                      "commandLanguageApplicability": 1,
                      "effectFlags": Set {
                        "waitsForResponse",
                      },
                      "name": "Transmit Printer ID",
                      "subcommand": "InfoBFirmwareVersion",
                      "type": "CustomCommand",
                      "typeExtended": Symbol(CmdTransmitPrinterId),
                    },
                  ],
                  "commands": Uint8Array [
                    29,
                    73,
                    65,
                  ],
                },
              ],
            }
          `);
      });

      it('printerStatus', () => {
        const state = getFakeState();
        expect(transpileDocument(ReadyToPrintDocuments.getStatus, escpos, state))
          .toMatchInlineSnapshot(`
            CompiledDocument {
              "effects": Set {
                "waitsForResponse",
              },
              "language": 1,
              "transactions": [
                Transaction {
                  "awaitedCommands": [
                    CmdTransmitPrinterStatus {
                      "commandLanguageApplicability": 1,
                      "effectFlags": Set {
                        "waitsForResponse",
                      },
                      "name": "Transmit Printer Status",
                      "subcommand": "PaperSensorStatus",
                      "type": "CustomCommand",
                      "typeExtended": Symbol(TransmitPrinterStatus),
                    },
                  ],
                  "commands": Uint8Array [
                    29,
                    114,
                    1,
                  ],
                },
                Transaction {
                  "awaitedCommands": [
                    CmdTransmitPrinterStatus {
                      "commandLanguageApplicability": 1,
                      "effectFlags": Set {
                        "waitsForResponse",
                      },
                      "name": "Transmit Printer Status",
                      "subcommand": "DrawerKickStatus",
                      "type": "CustomCommand",
                      "typeExtended": Symbol(TransmitPrinterStatus),
                    },
                  ],
                  "commands": Uint8Array [
                    29,
                    114,
                    2,
                  ],
                },
              ],
            }
          `);
      });

      it('printerStatus', () => {
        const state = getFakeState();
        expect(transpileDocument(ReadyToPrintDocuments.feedMedia, escpos, state))
          .toMatchInlineSnapshot(`
            CompiledDocument {
              "effects": Set {
                "feedsPaper",
                "waitsForResponse",
              },
              "language": 1,
              "transactions": [
                Transaction {
                  "awaitedCommands": [],
                  "commands": Uint8Array [
                    10,
                    10,
                    10,
                    10,
                  ],
                },
                Transaction {
                  "awaitedCommands": [
                    CmdTransmitPrinterStatus {
                      "commandLanguageApplicability": 1,
                      "effectFlags": Set {
                        "waitsForResponse",
                      },
                      "name": "Transmit Printer Status",
                      "subcommand": "PaperSensorStatus",
                      "type": "CustomCommand",
                      "typeExtended": Symbol(TransmitPrinterStatus),
                    },
                  ],
                  "commands": Uint8Array [
                    29,
                    114,
                    1,
                  ],
                },
                Transaction {
                  "awaitedCommands": [
                    CmdTransmitPrinterStatus {
                      "commandLanguageApplicability": 1,
                      "effectFlags": Set {
                        "waitsForResponse",
                      },
                      "name": "Transmit Printer Status",
                      "subcommand": "DrawerKickStatus",
                      "type": "CustomCommand",
                      "typeExtended": Symbol(TransmitPrinterStatus),
                    },
                  ],
                  "commands": Uint8Array [
                    29,
                    114,
                    2,
                  ],
                },
              ],
            }
          `);
      });

      it('printerStatus', () => {
        const state = getFakeState();
        expect(transpileDocument(ReadyToPrintDocuments.printConfig, escpos, state))
          .toMatchInlineSnapshot(`
            CompiledDocument {
              "effects": Set {
                "feedsPaper",
                "waitsForResponse",
              },
              "language": 1,
              "transactions": [
                Transaction {
                  "awaitedCommands": [],
                  "commands": Uint8Array [
                    29,
                    40,
                    65,
                    2,
                    0,
                    1,
                    2,
                  ],
                },
                Transaction {
                  "awaitedCommands": [
                    CmdTransmitPrinterStatus {
                      "commandLanguageApplicability": 1,
                      "effectFlags": Set {
                        "waitsForResponse",
                      },
                      "name": "Transmit Printer Status",
                      "subcommand": "PaperSensorStatus",
                      "type": "CustomCommand",
                      "typeExtended": Symbol(TransmitPrinterStatus),
                    },
                  ],
                  "commands": Uint8Array [
                    29,
                    114,
                    1,
                  ],
                },
                Transaction {
                  "awaitedCommands": [
                    CmdTransmitPrinterStatus {
                      "commandLanguageApplicability": 1,
                      "effectFlags": Set {
                        "waitsForResponse",
                      },
                      "name": "Transmit Printer Status",
                      "subcommand": "DrawerKickStatus",
                      "type": "CustomCommand",
                      "typeExtended": Symbol(TransmitPrinterStatus),
                    },
                  ],
                  "commands": Uint8Array [
                    29,
                    114,
                    2,
                  ],
                },
              ],
            }
          `);
      });
    });
  });
});
