import * as Util from '../Util/index.js';
import { PrintCutter, PrintOrientation, type DarknessPercent, type IPrinterHardware, type IPrinterMedia } from "./ConfigurationTypes.js";

/** Configured options for a label printer */
export abstract class BasePrinterConfig implements IPrinterHardware, IPrinterMedia {

  // Read-only printer config info
  protected _serial = 'no_serial_nm';
  get serialNumber() { return this._serial; }

  protected _model = 'Unknown Model';
  get model() { return this._model; }

  protected _manufacturer = 'Unknown Manufacturer';
  get manufacturer() { return this._manufacturer; }

  protected _firmware = '';
  get firmware() { return this._firmware; }

  protected _darkness: DarknessPercent = 50;
  get darknessPercent() { return this._darkness; }

  protected _printOrientation = PrintOrientation.normal;
  get printOrientation() { return this._printOrientation; }

  public constructor() {}

  protected _cpl: number = 42;
  get charactersPerLine() { return this._cpl; }

  protected _hasMultiByteSupport = false;
  get hasMultiByteSupport() { return this._hasMultiByteSupport; }

  protected _fontLanguageSupport = '';
  get fontLanguageSupport() { return this._fontLanguageSupport; }

  protected _hasDmdConnected = false;
  get hasDmdConnected() { return this._hasDmdConnected; }

  protected _codepages: ReadonlySet<Util.Codepage> = new Set<Util.Codepage>([
    "CP437",
    "CP720",
    "CP737",
    "CP775",
    "CP850",
    "CP851",
    "CP852",
    "CP853",
    "CP855",
    "CP857",
    "CP858",
    "CP860",
    "CP861",
    "CP862",
    "CP863",
    "CP864",
    "CP865",
    "CP866",
    "CP869",
    "CP1098",
    "CP1118",
    "CP1119",
    "CP1125",
    "ISO88592",
    "ISO88597",
    "ISO885915",
    "RK1048",
    "WINDOWS1250",
    "WINDOWS1251",
    "WINDOWS1252",
    "WINDOWS1253",
    "WINDOWS1254",
    "WINDOWS1255",
    "WINDOWS1256",
    "WINDOWS1257",
    "WINDOWS1258",
  ]);
  get codepages(): ReadonlySet<Util.Codepage> { return this._codepages; }

  protected _cutter = PrintCutter.none;
  get cutter() { return this._cutter; }
}
