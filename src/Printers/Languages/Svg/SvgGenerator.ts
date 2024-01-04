// import * as Cmds from "../../Documents/index.js";
// import { exhaustiveMatchGuard, type CommandSet, type IPrinterExtendedCommandMapping, type TranspileCommandArgs, type TranspileCommandDelegate, type TranspiledFormState } from "./CommandSet.js";
// import { StringCommandSet, type StringForm } from "./StringCommandSet.js";

// export class SvgGenerator extends StringCommandSet {
//   encodeCommand(str = '', withNewline = false): string {
//     return str + (withNewline ? '\n' : '');
//   }
//   get formStartCommand(): string {
//     throw new Error("Method not implemented.");
//   }
//   get formEndCommand(): string {
//     throw new Error("Method not implemented.");
//   }

//   public transpileCommand(
//     cmd: Cmds.IPrinterCommand,
//     formMetadata: StringForm): string {
//     // I have given up on type systems. All hail reams of code. Do not suggest
//     // a better way to do this unless it's in the form of a complete PR.

//     switch (cmd.type) {
//       case "CommandLanguageSpecificCommand":
//       case "CustomCommand":
//         return this.extendedCommandHandler(cmd, formMetadata);
//       // Printer control operations don't have much meaning for SVGs.
//       case "Reset":
//         return '';
//       case "Raw":
//         return (cmd as Cmds.RawCommand<string>).command;

//       case "Cut":
//         return this.cutHandler(formMetadata);
//       default:
//         exhaustiveMatchGuard(cmd.type);
//     }
//   }

//   constructor(extendedCommands: Array<IPrinterExtendedCommandMapping<string>> = []) {
//     super(SvgGenerator, extendedCommands);
//   }

//   parseConfigurationResponse(rawText: string, commOpts: PrinterCommunicationOptions) {
//     throw new Error("Method not implemented.");
//   }

//   cutHandler(formDoc: StringForm): string {
//     const path = `<path d="M12,12.5l-7.5,-3a2,2,0,1,1,.5,0M12,11.5l-7.5,3a2,2,0,1,0,.5,0" fill="none" stroke="#000" stroke-width="1"/><path d="M12,12l10,-4q-1,-1,-2.5,-1l-10,4v2l10,4q1.5,0,2.5,-1z" fill="#000"/><path d="M24,12h${formDoc.paperWidth - 24}" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="2"/>`;
//     const str = `<g transform="translate(0,${formDoc.formHeight})">${path}</g>`;
//     return this.combineCommands(str, this.newlineHandler(formDoc));
//   }

//   newlineHandler(formDoc: StringForm): string {
//     let out = '';
//     const h = formDoc.lineHeight * formDoc.charWidth * 2;
//     if (formDoc.currentLine.length > 0) {
//       out += `<g transform="translate(${this.lineMargin * this.charWidth},${this.svgHeight + h})">${this.textElement}</g>`;
//     }
//     formDoc.formHeight += Math.max(h, form.feedMinimum);
//     formDoc.lineHeight = 1;
//     formDoc.currentLine = '';
//     formDoc.textPosition = 0;
//   }
// }
