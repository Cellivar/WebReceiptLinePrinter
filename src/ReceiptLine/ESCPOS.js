//ESCPOS
// https://github.com/NielsLeenheer/EscPosEncoder/blob/master/src/esc-pos-encoder.js
import {createCanvas} from 'canvas';
import Dither from 'canvas-dither';
import Flatten from 'canvas-flatten';

const codepageMappings = {
  epson: {
    'cp437': 0x00,
    'shiftjis': 0x01,
    'cp850': 0x02,
    'cp860': 0x03,
    'cp863': 0x04,
    'cp865': 0x05,
    'cp851': 0x0b,
    'cp853': 0x0c,
    'cp857': 0x0d,
    'cp737': 0x0e,
    'iso88597': 0x0f,
    'windows1252': 0x10,
    'cp866': 0x11,
    'cp852': 0x12,
    'cp858': 0x13,
    'cp720': 0x20,
    'cp775': 0x21,
    'cp855': 0x22,
    'cp861': 0x23,
    'cp862': 0x24,
    'cp864': 0x25,
    'cp869': 0x26,
    'iso88592': 0x27,
    'iso885915': 0x28,
    'cp1098': 0x29,
    'cp1118': 0x2a,
    'cp1119': 0x2b,
    'cp1125': 0x2c,
    'windows1250': 0x2d,
    'windows1251': 0x2e,
    'windows1253': 0x2f,
    'windows1254': 0x30,
    'windows1255': 0x31,
    'windows1256': 0x32,
    'windows1257': 0x33,
    'windows1258': 0x34,
    'rk1048': 0x35,
  },

  zjiang: {
    'cp437': 0x00,
    'shiftjis': 0x01,
    'cp850': 0x02,
    'cp860': 0x03,
    'cp863': 0x04,
    'cp865': 0x05,
    'windows1252': 0x10,
    'cp866': 0x11,
    'cp852': 0x12,
    'cp858': 0x13,
    'windows1255': 0x20,
    'cp861': 0x38,
    'cp855': 0x3c,
    'cp857': 0x3d,
    'cp862': 0x3e,
    'cp864': 0x3f,
    'cp737': 0x40,
    'cp851': 0x41,
    'cp869': 0x42,
    'cp1119': 0x44,
    'cp1118': 0x45,
    'windows1250': 0x48,
    'windows1251': 0x49,
    'cp3840': 0x4a,
    'cp3843': 0x4c,
    'cp3844': 0x4d,
    'cp3845': 0x4e,
    'cp3846': 0x4f,
    'cp3847': 0x50,
    'cp3848': 0x51,
    'cp2001': 0x53,
    'cp3001': 0x54,
    'cp3002': 0x55,
    'cp3011': 0x56,
    'cp3012': 0x57,
    'cp3021': 0x58,
    'cp3041': 0x59,
    'windows1253': 0x5a,
    'windows1254': 0x5b,
    'windows1256': 0x5c,
    'cp720': 0x5d,
    'windows1258': 0x5e,
    'cp775': 0x5f,
  },

  bixolon: {
    'cp437': 0x00,
    'shiftjis': 0x01,
    'cp850': 0x02,
    'cp860': 0x03,
    'cp863': 0x04,
    'cp865': 0x05,
    'cp851': 0x0b,
    'cp858': 0x13,
  },

  star: {
    'cp437': 0x00,
    'shiftjis': 0x01,
    'cp850': 0x02,
    'cp860': 0x03,
    'cp863': 0x04,
    'cp865': 0x05,
    'windows1252': 0x10,
    'cp866': 0x11,
    'cp852': 0x12,
    'cp858': 0x13,
  },

  citizen: {
    'cp437': 0x00,
    'shiftjis': 0x01,
    'cp850': 0x02,
    'cp860': 0x03,
    'cp863': 0x04,
    'cp865': 0x05,
    'cp852': 0x12,
    'cp866': 0x11,
    'cp857': 0x08,
    'windows1252': 0x10,
    'cp858': 0x13,
    'cp864': 0x28,
  },

  legacy: {
    'cp437': 0x00,
    'cp737': 0x40,
    'cp850': 0x02,
    'cp775': 0x5f,
    'cp852': 0x12,
    'cp855': 0x3c,
    'cp857': 0x3d,
    'cp858': 0x13,
    'cp860': 0x03,
    'cp861': 0x38,
    'cp862': 0x3e,
    'cp863': 0x04,
    'cp864': 0x1c,
    'cp865': 0x05,
    'cp866': 0x11,
    'cp869': 0x42,
    'cp936': 0xff,
    'cp949': 0xfd,
    'cp950': 0xfe,
    'cp1252': 0x10,
    'iso88596': 0x16,
    'shiftjis': 0xfc,
    'windows874': 0x1e,
    'windows1250': 0x48,
    'windows1251': 0x49,
    'windows1252': 0x47,
    'windows1253': 0x5a,
    'windows1254': 0x5b,
    'windows1255': 0x20,
    'windows1256': 0x5c,
    'windows1257': 0x19,
    'windows1258': 0x5e,
  },
};

/**
 * Create a byte stream based on commands for ESC/POS printers
 */
class EscPosEncoder {
  /**
     * Create a new object
     *
     * @param  {object}   options   Object containing configuration options
    */
  constructor(options) {
  }

  /**
     * Insert a table
     *
     * @param  {array}           columns  The column definitions
     * @param  {array}           data     Array containing rows. Each row is an array containing cells.
     *                                    Each cell can be a string value, or a callback function.
     *                                    The first parameter of the callback is the encoder object on
     *                                    which the function can call its methods.
     * @return {object}                   Return the object, for easy chaining commands
     *
     */
  table(columns, data) {
    if (this._cursor != 0) {
      this.newline();
    }

    for (let r = 0; r < data.length; r++) {
      const lines = [];
      let maxLines = 0;

      for (let c = 0; c < columns.length; c++) {
        const cell = [];

        if (typeof data[r][c] === 'string') {
          const w = linewrap(columns[c].width, {lineBreak: '\n'});
          const fragments = w(data[r][c]).split('\n');

          for (let f = 0; f < fragments.length; f++) {
            if (columns[c].align == 'right') {
              cell[f] = this._encode(fragments[f].padStart(columns[c].width));
            } else {
              cell[f] = this._encode(fragments[f].padEnd(columns[c].width));
            }
          }
        }

        if (typeof data[r][c] === 'function') {
          const columnEncoder = new EscPosEncoder(Object.assign({}, this._options, {
            width: columns[c].width,
            embedded: true,
          }));

          columnEncoder._codepage = this._codepage;
          columnEncoder.align(columns[c].align);
          data[r][c](columnEncoder);
          const encoded = columnEncoder.encode();

          let fragment = [];

          for (let e = 0; e < encoded.byteLength; e++) {
            if (e < encoded.byteLength - 1) {
              if (encoded[e] === 0x0a && encoded[e + 1] === 0x0d) {
                cell.push(fragment);
                fragment = [];

                e++;
                continue;
              }
            }

            fragment.push(encoded[e]);
          }

          if (fragment.length) {
            cell.push(fragment);
          }
        }

        maxLines = Math.max(maxLines, cell.length);
        lines[c] = cell;
      }

      for (let c = 0; c < columns.length; c++) {
        if (lines[c].length < maxLines) {
          for (let p = lines[c].length; p < maxLines; p++) {
            let verticalAlign = 'top';
            if (typeof columns[c].verticalAlign !== 'undefined') {
              verticalAlign = columns[c].verticalAlign;
            }

            if (verticalAlign == 'bottom') {
              lines[c].unshift((new Array(columns[c].width)).fill(0x20));
            } else {
              lines[c].push((new Array(columns[c].width)).fill(0x20));
            }
          }
        }
      }

      for (let l = 0; l < maxLines; l++) {
        for (let c = 0; c < columns.length; c++) {
          if (typeof columns[c].marginLeft !== 'undefined') {
            this.raw((new Array(columns[c].marginLeft)).fill(0x20));
          }

          this.raw(lines[c][l]);

          if (typeof columns[c].marginRight !== 'undefined') {
            this.raw((new Array(columns[c].marginRight)).fill(0x20));
          }
        }

        this.newline();
      }
    }

    return this;
  }

  /**
     * Insert a box
     *
     * @param  {object}           options   And object with the following properties:
     *                                      - style: The style of the border, either single or double
     *                                      - width: The width of the box, by default the width of the paper
     *                                      - marginLeft: Space between the left border and the left edge
     *                                      - marginRight: Space between the right border and the right edge
     *                                      - paddingLeft: Space between the contents and the left border of the box
     *                                      - paddingRight: Space between the contents and the right border of the box
     * @param  {string|function}  contents  A string value, or a callback function.
     *                                      The first parameter of the callback is the encoder object on
     *                                      which the function can call its methods.
     * @return {object}                     Return the object, for easy chaining commands
     *
     */
  box(options, contents) {
    options = Object.assign({
      style: 'single',
      width: this._options.width || 30,
      marginLeft: 0,
      marginRight: 0,
      paddingLeft: 0,
      paddingRight: 0,
    }, options || {});

    let elements;

    if (options.style == 'double') {
      elements = [0xc9, 0xbb, 0xc8, 0xbc, 0xcd, 0xba]; // ╔╗╚╝═║
    } else {
      elements = [0xda, 0xbf, 0xc0, 0xd9, 0xc4, 0xb3]; // ┌┐└┘─│
    }

    if (this._cursor != 0) {
      this.newline();
    }

    this._restoreState();

    this._queue([
      0x1b, 0x74, this._getCodepageIdentifier('cp437'),
    ]);

    this._queue([
      new Array(options.marginLeft).fill(0x20),
      elements[0],
      new Array(options.width - 2).fill(elements[4]),
      elements[1],
      new Array(options.marginRight).fill(0x20),
    ]);

    this.newline();

    const cell = [];

    if (typeof contents === 'string') {
      const w = linewrap(options.width - 2 - options.paddingLeft - options.paddingRight, {lineBreak: '\n'});
      const fragments = w(contents).split('\n');

      for (let f = 0; f < fragments.length; f++) {
        if (options.align == 'right') {
          cell[f] = this._encode(fragments[f].padStart(options.width - 2 - options.paddingLeft - options.paddingRight));
        } else {
          cell[f] = this._encode(fragments[f].padEnd(options.width - 2 - options.paddingLeft - options.paddingRight));
        }
      }
    }

    if (typeof contents === 'function') {
      const columnEncoder = new EscPosEncoder(Object.assign({}, this._options, {
        width: options.width - 2 - options.paddingLeft - options.paddingRight,
        embedded: true,
      }));

      columnEncoder._codepage = this._codepage;
      columnEncoder.align(options.align);
      contents(columnEncoder);
      const encoded = columnEncoder.encode();

      let fragment = [];

      for (let e = 0; e < encoded.byteLength; e++) {
        if (e < encoded.byteLength - 1) {
          if (encoded[e] === 0x0a && encoded[e + 1] === 0x0d) {
            cell.push(fragment);
            fragment = [];

            e++;
            continue;
          }
        }

        fragment.push(encoded[e]);
      }

      if (fragment.length) {
        cell.push(fragment);
      }
    }

    for (let c = 0; c < cell.length; c++) {
      this._queue([
        new Array(options.marginLeft).fill(0x20),
        elements[5],
        new Array(options.paddingLeft).fill(0x20),
      ]);

      this._queue([
        cell[c],
      ]);

      this._restoreState();

      this._queue([
        0x1b, 0x74, this._getCodepageIdentifier('cp437'),
      ]);

      this._queue([
        new Array(options.paddingRight).fill(0x20),
        elements[5],
        new Array(options.marginRight).fill(0x20),
      ]);

      this.newline();
    }

    this._queue([
      new Array(options.marginLeft).fill(0x20),
      elements[2],
      new Array(options.width - 2).fill(elements[4]),
      elements[3],
      new Array(options.marginRight).fill(0x20),
    ]);

    this._restoreState();

    this.newline();

    return this;
  }

  /**
     * Barcode
     *
     * @param  {string}           value  the value of the barcode
     * @param  {string}           symbology  the type of the barcode
     * @param  {number}           height  height of the barcode
     * @return {object}                  Return the object, for easy chaining commands
     *
     */
  barcode(value, symbology, height) {
    if (this._embedded) {
      throw new Error('Barcodes are not supported in table cells or boxes');
    }

    const symbologies = {
      'upca': 0x00,
      'upce': 0x01,
      'ean13': 0x02,
      'ean8': 0x03,
      'code39': 0x04,
      'coda39': 0x04, /* typo, leave here for backwards compatibility */
      'itf': 0x05,
      'codabar': 0x06,
      'code93': 0x48,
      'code128': 0x49,
      'gs1-128': 0x50,
      'gs1-databar-omni': 0x51,
      'gs1-databar-truncated': 0x52,
      'gs1-databar-limited': 0x53,
      'gs1-databar-expanded': 0x54,
      'code128-auto': 0x55,
    };

    if (symbology in symbologies) {
      const bytes = CodepageEncoder.encode(value, 'ascii');

      if (this._cursor != 0) {
        this.newline();
      }

      this._queue([
        0x1d, 0x68, height,
        0x1d, 0x77, symbology === 'code39' ? 0x02 : 0x03,
      ]);

      if (symbology == 'code128' && bytes[0] !== 0x7b) {
        /* Not yet encodeded Code 128, assume data is Code B, which is similar to ASCII without control chars */

        this._queue([
          0x1d, 0x6b, symbologies[symbology],
          bytes.length + 2,
          0x7b, 0x42,
          bytes,
        ]);
      } else if (symbologies[symbology] > 0x40) {
        /* Function B symbologies */

        this._queue([
          0x1d, 0x6b, symbologies[symbology],
          bytes.length,
          bytes,
        ]);
      } else {
        /* Function A symbologies */

        this._queue([
          0x1d, 0x6b, symbologies[symbology],
          bytes,
          0x00,
        ]);
      }
    } else {
      throw new Error('Symbology not supported by printer');
    }

    this._flush();

    return this;
  }

  /**
     * QR code
     *
     * @param  {string}           value  the value of the qr code
     * @param  {number}           model  model of the qrcode, either 1 or 2
     * @param  {number}           size   size of the qrcode, a value between 1 and 8
     * @param  {string}           errorlevel  the amount of error correction used, either 'l', 'm', 'q', 'h'
     * @return {object}                  Return the object, for easy chaining commands
     *
     */
  qrcode(value, model, size, errorlevel) {
    if (this._embedded) {
      throw new Error('QR codes are not supported in table cells or boxes');
    }

    /* Force printing the print buffer and moving to a new line */

    this._queue([
      0x0a,
    ]);

    /* Model */

    const models = {
      1: 0x31,
      2: 0x32,
    };

    if (typeof model === 'undefined') {
      model = 2;
    }

    if (model in models) {
      this._queue([
        0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, models[model], 0x00,
      ]);
    } else {
      throw new Error('Model must be 1 or 2');
    }

    /* Size */

    if (typeof size === 'undefined') {
      size = 6;
    }

    if (typeof size !== 'number') {
      throw new Error('Size must be a number');
    }

    if (size < 1 || size > 8) {
      throw new Error('Size must be between 1 and 8');
    }

    this._queue([
      0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size,
    ]);

    /* Error level */

    const errorlevels = {
      'l': 0x30,
      'm': 0x31,
      'q': 0x32,
      'h': 0x33,
    };

    if (typeof errorlevel === 'undefined') {
      errorlevel = 'm';
    }

    if (errorlevel in errorlevels) {
      this._queue([
        0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, errorlevels[errorlevel],
      ]);
    } else {
      throw new Error('Error level must be l, m, q or h');
    }

    /* Data */

    const bytes = CodepageEncoder.encode(value, 'iso88591');
    const length = bytes.length + 3;

    this._queue([
      0x1d, 0x28, 0x6b, length % 0xff, length / 0xff, 0x31, 0x50, 0x30, bytes,
    ]);

    /* Print QR code */

    this._queue([
      0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30,
    ]);

    this._flush();

    return this;
  }

  /**
     * Image
     *
     * @param  {object}         element  an element, like a canvas or image that needs to be printed
     * @param  {number}         width  width of the image on the printer
     * @param  {number}         height  height of the image on the printer
     * @param  {string}         algorithm  the dithering algorithm for making the image black and white
     * @param  {number}         threshold  threshold for the dithering algorithm
     * @return {object}                  Return the object, for easy chaining commands
     *
     */
  image(element, width, height, algorithm, threshold) {
    if (this._embedded) {
      throw new Error('Images are not supported in table cells or boxes');
    }

    if (width % 8 !== 0) {
      throw new Error('Width must be a multiple of 8');
    }

    if (height % 8 !== 0) {
      throw new Error('Height must be a multiple of 8');
    }

    if (typeof algorithm === 'undefined') {
      algorithm = 'threshold';
    }

    if (typeof threshold === 'undefined') {
      threshold = 128;
    }

    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    context.drawImage(element, 0, 0, width, height);
    let image = context.getImageData(0, 0, width, height);

    image = Flatten.flatten(image, [0xff, 0xff, 0xff]);

    switch (algorithm) {
      case 'threshold': image = Dither.threshold(image, threshold); break;
      case 'bayer': image = Dither.bayer(image, threshold); break;
      case 'floydsteinberg': image = Dither.floydsteinberg(image); break;
      case 'atkinson': image = Dither.atkinson(image); break;
    }

    const getPixel = (x, y) => x < width && y < height ? (image.data[((width * y) + x) * 4] > 0 ? 0 : 1) : 0;

    const getColumnData = (width, height) => {
      const data = [];

      for (let s = 0; s < Math.ceil(height / 24); s++) {
        const bytes = new Uint8Array(width * 3);

        for (let x = 0; x < width; x++) {
          for (let c = 0; c < 3; c++) {
            for (let b = 0; b < 8; b++) {
              bytes[(x * 3) + c] |= getPixel(x, (s * 24) + b + (8 * c)) << (7 - b);
            }
          }
        }

        data.push(bytes);
      }

      return data;
    };

    const getRowData = (width, height) => {
      const bytes = new Uint8Array((width * height) >> 3);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x = x + 8) {
          for (let b = 0; b < 8; b++) {
            bytes[(y * (width >> 3)) + (x >> 3)] |= getPixel(x + b, y) << (7 - b);
          }
        }
      }

      return bytes;
    };


    if (this._cursor != 0) {
      this.newline();
    }

    /* Encode images with ESC * */

    if (this._options.imageMode == 'column') {
      this._queue([
        0x1b, 0x33, 0x24,
      ]);

      getColumnData(width, height).forEach((bytes) => {
        this._queue([
          0x1b, 0x2a, 0x21,
          (width) & 0xff, (((width) >> 8) & 0xff),
          bytes,
          0x0a,
        ]);
      });

      this._queue([
        0x1b, 0x32,
      ]);
    }

    /* Encode images with GS v */

    if (this._options.imageMode == 'raster') {
      this._queue([
        0x1d, 0x76, 0x30, 0x00,
        (width >> 3) & 0xff, (((width >> 3) >> 8) & 0xff),
        height & 0xff, ((height >> 8) & 0xff),
        getRowData(width, height),
      ]);
    }

    this._flush();

    return this;
  }
}
