// import * as Commands from "../../Documents/index.js";
// import type { CommandSet, IPrinterExtendedCommandMapping, TranspileCommandDelegate, TranspiledFormState } from "./CommandSet.js";
// import { TranspileCommandError } from "./TranspileCommandError.js";
// import type { PrinterCommandLanguage } from "./index.js";

// export type StringForm = TranspiledFormState<string>;

// /** A class to transpile commands into string-based commands for a printer. */
// export abstract class StringCommandSet implements CommandSet<string> {
//   public abstract encodeCommand(str?: string, withNewline?: boolean): string;

//   private readonly _noop = '';
//   public get noop() {
//     return this._noop;
//   }

//   public abstract get formStartCommand(): string;
//   public abstract get formEndCommand(): string;
//   private cmdLanguage: PrinterCommandLanguage;
//   get commandLanguage() {
//     return this.cmdLanguage;
//   }

//   public abstract getNewFormMetadata(): StringForm;

//   protected extendedCommandMap = new Map<symbol, TranspileCommandDelegate<string>>;

//   protected constructor(
//     implementedLanguage: PrinterCommandLanguage,
//     extendedCommands: Array<IPrinterExtendedCommandMapping<string>> = []
//   ) {
//     this.cmdLanguage = implementedLanguage;

//     for (const newCmd of extendedCommands) {
//       if (newCmd.applicableLanguages.has(this.commandLanguage)) {
//         this.extendedCommandMap.set(newCmd.command.typeExtended, newCmd.delegate);
//       }
//     }
//   }

//   public abstract transpileCommand(
//     cmd: Commands.IPrinterCommand,
//     formMetadata: StringForm): string;

//     protected extendedCommandHandler(
//       cmd: Commands.IPrinterCommand,
//       formMetadata: StringForm
//     ) {
//       const lookup = (cmd as Commands.IPrinterExtendedCommand).typeExtended;
//       if (!lookup) {
//         throw new TranspileCommandError(
//           `Command '${cmd.constructor.name}' did not have a value for typeExtended. If you're trying to implement a custom command check the documentation.`
//         )
//       }

//       const cmdHandler = this.extendedCommandMap.get(lookup);

//       if (cmdHandler === undefined) {
//         throw new TranspileCommandError(
//           // eslint-disable-next-line prettier/prettier
//           `Unknown command '${cmd.constructor.name}' was not found in the command map for ${this.commandLanguage} command language. If you're trying to implement a custom command check the documentation for correctly adding mappings.`
//         );
//       }
//       return cmdHandler(cmd, formMetadata, this);
//     }

//   public combineCommands(...commands: string[]): string {
//     return commands.reduce((all, cmd) => all += cmd, '');
//   }

//   abstract parseConfigurationResponse(
//     rawText: string,
//     commOpts: PrinterCommunicationOptions
//   ): PrinterOptions;
// }

// export class TextCmdFormMetadata implements TranspiledFormState<string> {

// }
