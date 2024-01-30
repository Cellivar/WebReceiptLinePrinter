import type { IDeviceInformation } from "web-device-mux";
import { type PrinterCommandLanguage } from "./index.js";

export interface ILanguageDetector {
  detectLanguage(deviceInfo: IDeviceInformation): PrinterCommandLanguage | undefined;
}

export function detectLanguage(
  deviceInfo: IDeviceInformation,
  candidates: ILanguageDetector[]
): PrinterCommandLanguage | undefined {
  return candidates
    .map(c => c.detectLanguage(deviceInfo))
    .filter(l => l !== undefined)
    .at(0);
}
