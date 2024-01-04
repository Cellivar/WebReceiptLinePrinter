import type { Codepage } from "../Codepages/index.js";
import type { ISettingUpdateMessage } from "../Communication/Messages.js";
import { EscPos, hex, type PrinterCommandLanguage } from "../Languages/index.js";

/** Coordinates on a 2D plane. */
export interface Coordinate {
  /** Offset from the left side of the plane, incrementing to the right. --> */
  left: number;
  /** Offset from the top side of the plane, incrementing down. */
  top: number;
}

/** The orientation of a label as it comes out of the printer. */
export enum PrintOrientation {
  /** Right-side up when the printer faces the user. */
  normal,
  /** Upside-down when the printer faces the user. */
  inverted
}

export enum PrintCutter {
  /** No cutter available. */
  none,
  /** Only supports partial cuts. */
  partial,
  /** Only supports full cuts. */
  full,
  /** Supports switching between cutter modes. */
  multiple
}

export interface IPrinterFeatures {
  /** The cutter mode the printer supports. */
  get cutter(): PrintCutter;
}

/** Firmware information about the printer that can't be modified. */
export interface IPrinterFactoryInformation {
  /** The raw serial number of the printer. */
  get serialNumber(): string;
  /** The model of the printer. */
  get model(): string;
  /** The firmware version information for the printer. */
  get firmware(): string;
  /** The command languages the printer supports. */
  get language(): PrinterCommandLanguage;
}

export interface IPrinterEncoding {
  /** The available codepages this printer supports */
  get codepages(): Set<Codepage>;
}

export interface IMediaOptions {
  /** Number of characters printed per line. Commonly 42. */
  charactersPerLine: number;

  /** The orientation of page contents. */
  orientation: PrintOrientation;
}

export class PrinterOptions implements IMediaOptions, IPrinterEncoding, IPrinterFactoryInformation {
  charactersPerLine: number = 42; // TODO: dynamic!
  orientation: PrintOrientation = PrintOrientation.normal;
  private _codepages = new Set<Codepage>([
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
  get codepages() { return this._codepages; }

  private _serial?: string;
  get serialNumber() { return this._serial ?? ''}

  private _model?: string;
  get model() { return this._model ?? '' }

  private _manufacturer?: string;
  get manufacturer() { return this._manufacturer ?? '' }

  private _hasMultiByteSupport?: boolean;
  get hasMultByteSupport() { return this._hasMultiByteSupport ?? false }
  private _fontLanguageSupport?: string;
  get fontLanugageSupport() { return this._fontLanguageSupport ?? '' }

  private _hasAutocutter?: boolean;
  get hasAutocutter() { return this._hasAutocutter ?? false }

  private _firmware?: string;
  get firmware() { return this._firmware ?? '' }

  get language() { return EscPos }

  /** Update these options with newly transmitted settings. */
  update(msg: ISettingUpdateMessage) {

    this._firmware = msg.firmwareVersion?.map(hex).join('') ?? this.firmware;
    this._fontLanguageSupport = msg.fontLanguageSupport ?? this._fontLanguageSupport;
    this._hasAutocutter = msg.hasAutocutter ?? this._hasAutocutter;
    //this._hasDmdConnected = msg.hasDmdConnected ?? this._hasDmdConnected;
    this._hasMultiByteSupport = msg.hasMultiByteSupport ?? this._hasMultiByteSupport;
    this._manufacturer = msg.manufacturerName ?? this._manufacturer;
    this._model = msg.modelName ?? this._model;
    this._serial = msg.serialNumber ?? this._serial;
  }

  copy(): PrinterOptions {
    return structuredClone(this);
  }
}

