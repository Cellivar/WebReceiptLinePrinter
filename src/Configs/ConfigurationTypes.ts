import * as Util from '../Util/index.js';

/** Utility type to create an 'update' object, making all properties optional and not readonly. */
export type UpdateFor<Type> = {
  -readonly [Property in keyof Type]?: Type[Property];
};

/** The darkness of the printer setting, higher being printing darker. */
export type DarknessPercent = Util.Percent;

/** Coordinates on a 2D plane. */
export interface Coordinate {
  /** Offset from the left side of the plane, incrementing to the right. --> */
  left: number;
  /** Offset from the top side of the plane, incrementing down. */
  top: number;
}

/** The orientation of a document as it comes out of the printer. */
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

/** Hardware information about the printer that can't be modified. */
export interface IPrinterHardware {
  /** The firmware version information for the printer. */
  readonly firmware: string;

  /** The manufacturer of the printer. */
  readonly manufacturer: string;

  /** The model name of the printer. */
  readonly model: string;

  /** The raw serial number of the printer. */
  readonly serialNumber: string;

  /** The available codepages this printer supports */
  readonly codepages: ReadonlySet<Util.Codepage>;

  /** The cutter mode the printer supports. */
  readonly cutter: PrintCutter;

  /** Printer supports multi-byte codepages. */
  readonly hasMultiByteSupport: boolean;

  /** Printer font language support. */
  readonly fontLanguageSupport: string;

  /** Whether the printerh as a DMD display connected. */
  readonly hasDmdConnected: boolean;
}

/** Printer options related to the media being printed */
export interface IPrinterMedia {
  /** Number of characters printed per line. Commonly 42. */
  charactersPerLine: number;

  /** How dark to print. 0 is blank, 99 is max darkness */
  darknessPercent: DarknessPercent;

  /** Whether the document prints right-side-up or upside-down. */
  printOrientation: PrintOrientation;
}
