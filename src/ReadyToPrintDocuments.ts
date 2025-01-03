import * as Docs from './Documents/index.js';
import * as Cmds from './Commands/index.js';

export class ReadyToPrintDocuments {
  /** A command document to query the printer for configuration. */
  static get getConfig(): Docs.IDocument {
    return {
      commands: [
        new Cmds.QueryConfiguration(),
      ]
    };
  }

  /** A command document to query the printer's status. */
  static get getStatus(): Docs.IDocument {
    return {
      commands: [
        new Cmds.GetStatus(),
      ]
    };
  }

  /** A command document to make the printer print its configuration. */
  static get printConfig(): Docs.IDocument {
    return {
      commands: [
        new Cmds.PrintConfiguration(),
      ]
    };
  }

  /** A command document to make the printer print a test pattern. */
  static get printTest(): Docs.IDocument {
    return {
      commands: [
        new Cmds.TestPrint(),
      ]
    };
  }

  /** A command  document to feed some paper. */
  static get feedMedia(): Docs.IDocument {
    return {
      commands: [
        new Cmds.Newline(),
        new Cmds.Newline(),
        new Cmds.Newline(),
        new Cmds.Newline(),
      ]
    }
  }

  /** A command document to open a connected cash drawer. */
  static get drawerKick(): Docs.IDocument {
    return {
      commands: [
        new Cmds.PulseCommand(),
      ]
    };
  }
}
