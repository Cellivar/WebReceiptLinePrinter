import * as Conf from '../Configs/index.js';
import type { ISettingUpdateMessage } from './Messages.js';

/** Configured options for a label printer */
export class PrinterConfig extends Conf.BasePrinterConfig {
  public constructor() {
    super();
  }

  /** Update these options with newly transmitted settings. */
  public update(msg: ISettingUpdateMessage) {
    const h = msg.printerHardware;
    this._codepages    = h?.codepages    ?? this._codepages;
    this._cutter       = h?.cutter       ?? this._cutter;
    this._firmware     = h?.firmware     ?? this._firmware;
    this._manufacturer = h?.manufacturer ?? this._manufacturer;
    this._model        = h?.model        ?? this._model;
    this._serial       = h?.serialNumber ?? this._serial;

    this._hasMultiByteSupport = h?.hasMultiByteSupport ?? this._hasMultiByteSupport;
    this._hasDmdConnected     = h?.hasDmdConnected     ?? this._hasDmdConnected;
    this._fontLanguageSupport = h?.fontLanguageSupport ?? this._fontLanguageSupport;

    const m = msg.printerMedia;
    this._cpl              = m?.charactersPerLine ?? this._cpl
    this._darkness         = m?.darknessPercent   ?? this._darkness;
    this._printOrientation = m?.printOrientation  ?? this._printOrientation;
  }

  public toUpdate(): ISettingUpdateMessage {
    return {
      messageType: 'SettingUpdateMessage',

      printerHardware: this,
      printerMedia:    this,
    }
  }
}
