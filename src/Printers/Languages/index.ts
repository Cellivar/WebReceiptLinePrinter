import type { EscPos } from "./EscPos/index.js";
//import type { SvgGenerator } from "./SvgGenerator.js";

export * from "../Codepages/ASCII.js";
export * from "./EscPos/index.js";
export * from "./LanguageDetector.js";
export * from "../../Documents/CommandSet.js";

export type PrinterCommandLanguage = typeof EscPos //| typeof SvgGenerator;
export class PrinterCommandLanguages extends Set<PrinterCommandLanguage> { }
