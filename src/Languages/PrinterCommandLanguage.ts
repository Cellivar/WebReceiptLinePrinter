import * as Util from '../Util/index.js';
import * as Conf from '../Configs/index.js';
import * as Cmds from "../Commands/index.js";

import * as EscPos from './EscPos/index.js';
import type { IDeviceInformation } from 'web-device-mux';

export function getCommandSetForLanguage(lang: Conf.PrinterCommandLanguage): Cmds.CommandSet<Conf.MessageArrayLike> | undefined {
  // In order of preferred communication method
  if (Util.hasFlag(lang, Conf.PrinterCommandLanguage.escPos)) {
    return new EscPos.EscPos();
  }
  return undefined;
}

export function guessLanguageFromModelHint(deviceInfo?: IDeviceInformation): Conf.PrinterCommandLanguage {
  if (deviceInfo === undefined) { return Conf.PrinterCommandLanguage.none; }

  // TODO: Anything more clever.
  return Conf.PrinterCommandLanguage.escPos;
}
