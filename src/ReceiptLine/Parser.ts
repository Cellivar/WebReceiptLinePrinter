import * as Cmds from "../Documents/index.js"
import { clampToRange, numberInRange, repeat } from "../NumericRange.js";
import type { IMediaOptions } from "../Printers/Options/index.js";

type LineRuleNext = "stopped" | "addVertical" | "addHorizontal" | "initialize"

interface optionState {
  barcodeType: string,
  oneDwidth: number,
  oneDheight: number,
  showHumanReadable: boolean,
  cellSize: number,
  errorCorrectionLevel: string
}

interface rulesSize {
  left: number,
  width: number,
  right: number,
  widths: number[]
}

interface parseState {
  wrap: boolean,
  border: number,
  widths: number[],
  align: Cmds.Alignment,
  nextRuleOperation: LineRuleNext,
  rules: rulesSize,
  barcodeOptions: optionState,
}

interface lineElement {
  enableWrapping: boolean;
  align: Cmds.Alignment;
  width: number;
  border: number;
  lineAlignment: Cmds.Alignment;
  error?: string;
  code?: object;
  image?: string;
  comment?: string;
  command?: string;
  text?: string[];
  vr?: LineRuleNext;
  hr?: boolean;
  cut?: boolean;
  drawerKick?: Cmds.PulsePin;
}

interface formattedText {
  decor: Cmds.TextFormat,
  text: string,
}

interface wrappedTextLine {
  data: formattedText[],
  leftMargin: number,
  maxHeight: number,
}

function getLeftAlignmentMultiplier(align: Cmds.Alignment) {
  const alignMultiplier: Record<Cmds.Alignment, number> = {
    Left: 0,
    Center: 0.5,
    Right: 1
  };
  return alignMultiplier[align];
}

function getAlignmentFromWhitespace(str: string): Cmds.Alignment {
  const prefixWhitespace = /^[\t ]/.test(str);
  const suffixWhitespace = /[\t ]$/.test(str);
  switch (true) {
    default:
    case (prefixWhitespace && suffixWhitespace):
      // | a | or |a|
      return 'Center';
    case (prefixWhitespace):
      // | a|
      return 'Right';
    case (suffixWhitespace):
      // |a |
      return 'Left';
  }
}

/** Encode escape characters in a text element into strings. */
function escapeTextElement(str: string): string[] {
  return str
    // remove control codes and hexadecimal control codes
    .replace(/[\x00-\x1f\x7f]|\\x[01][\dA-Fa-f]|\\x7[Ff]/g, '')
    // convert escape characters ('\-', '\=', '\_', '\"', \`', '\^', '\~') to hexadecimal escape characters
    .replace(/\\[-=_"`^~]/g, match => '\\x' + match.charCodeAt(1).toString(16))
    // convert escape character ('\n') to LF
    .replace(/\\n/g, '\n')
    // convert escape character ('~') to space
    .replace(/~/g, ' ')
    // separate text with '_', '"', '`', '^'(1 or more), '\n'
    .split(/([_"`\n]|\^+)/)
    // convert escape characters to normal characters
    .map(text => parseEscape(text));
}

enum LinePoints {
  None  = 0,
  Up    = 1 << 0,
  Right = 1 << 1,
  Down  = 1 << 2,
  Left  = 1 << 3,

  Flat  = Right | Left,
  Vert  = Up | Down,
  Cross = Up | Down | Left | Right,

  TDown  = Down | Left | Right,
  TLeft  = Up | Down | Left,
  TRight = Up | Down | Right,
  TUp    = Up | Left | Right
}

function getCharacterFromLinePoints(
  points: LinePoints
): Cmds.BoxDrawingCharacter {
  switch (points) {
    default:
    case LinePoints.None : return ' ';
    case LinePoints.Flat : return '─';
    case LinePoints.Vert : return '│';
    case LinePoints.Cross: return '┼';

    case LinePoints.Down | LinePoints.Right: return '┌';
    case LinePoints.Up   | LinePoints.Right: return '└';
    case LinePoints.Down | LinePoints.Left : return '┐';
    case LinePoints.Up   | LinePoints.Left : return '┘';

    case LinePoints.TRight: return '├';
    case LinePoints.TLeft : return '┤';
    case LinePoints.TDown : return '┬';
    case LinePoints.TUp   : return '┴';
  }
}

/** Add commands for the edge of a vertical rule section. */
function verticalRuleEdge(columnWidths: number[], edge: 'top' | 'bottom') {
  const dir = edge === 'top' ? LinePoints.Down : LinePoints.Up;

  const middleText = columnWidths
    .flatMap((width) => [...repeat(LinePoints.Flat, width), dir | LinePoints.Flat])
    .slice(0, -1);

  return [dir | LinePoints.Right, ...middleText, LinePoints.Left | dir];
}

/** Add vertical rules according to column widths in a vertical rule section. */
function verticalRuleAroundText(columnWidths: number[], textHeight: Cmds.Height) {
  const verticalLine = getCharacterFromLinePoints(LinePoints.Up | LinePoints.Down);
  return [
    // Don't use text drawing mode as we want to preserve the font height
    new Cmds.TextFormatting({
      height: textHeight,
    }),
    // First column's vertical line
    new Cmds.Text(verticalLine),
    ...columnWidths.flatMap((w) => [
      new Cmds.OffsetPrintPosition('relative', w),
      new Cmds.Text(verticalLine)
    ])
  ];
}

/** Add vertical rules intersecting a horizontal rule. */
function verticalRuleWithHorizontalRule(
  aboveColumnWidths: number[],
  belowColumnWidths: number[],
  leftMarginDifference: number,
  rightMarginDifference: number,
): LinePoints[] {
  // Pad the usual upper/lower rules ends with spaces for even arrays
  const aboveLine = [
    ...repeat(LinePoints.None, Math.max(-leftMarginDifference, 0)),
    ...verticalRuleEdge(aboveColumnWidths, 'bottom'),
    ...repeat(LinePoints.None, Math.max(rightMarginDifference, 0))
  ];
  const belowLine = [
    ...repeat(LinePoints.None, Math.max(leftMarginDifference, 0)),
    ...verticalRuleEdge(belowColumnWidths, 'top'),
    ...repeat(LinePoints.None, Math.max(-rightMarginDifference, 0))
  ];
  // Now merge the points to get the right character.
  return belowLine.map((c, i) => c | aboveLine[i]);
}

function getTextSizeMultiplier(
  sizeSetting: number
): {
  width: Cmds.Height,
  height: Cmds.Width
} {
  // 1 = double width
  // 2 = double height
  // 3-7 = double both dimensions, then triple, etc.
  switch (sizeSetting) {
    default:
    case 0: return {width: 1, height: 1};
    case 1: return {width: 2, height: 1};
    case 2: return {width: 1, height: 2};
    case 3: return {width: 2, height: 2};
    case 4: return {width: 3, height: 3};
    case 5: return {width: 4, height: 4};
    case 6: return {width: 5, height: 5};
    case 7: return {width: 6, height: 6};
  }
}

/** Parse raw column strings into line elements for further processing. */
function columnsToLine(
  column: string,
  index: number,
  array: string[],
  state: parseState): lineElement {
  // parsed column object
  let lineElement: lineElement = {
    align: getAlignmentFromWhitespace(column),
    width: -1,
    enableWrapping: state.wrap,
    border: 0,
    lineAlignment: 'Center'
  };

  // trim whitespace
  //const element = column.replace(/^[\t ]+|[\t ]+$/g, '');
  const element = column.trim();

  // parse properties
  // {key1:val1; key2:val2}
  // Props must be the only item on the line, otherwise the WHOLE LINE IS IGNORED.
  if (array.length === 1 && /^\{[^{}]*\}$/.test(element)) {
    // extract members
    const propMembers = element
      // trim property delimiters
      .slice(1, -1)
      // convert escape character ('\;') to hexadecimal escape characters
      .replace(/\\;/g, '\\x3b')
      // separate property with ';'
      .split(';')
      // parse members
      .reduce((obj, member) => {
        // parse key-value pair
        if (
          // If the member isn't all whitespace..
          !/^[\t ]*$/.test(member) &&
          // This abuses the .replace() method to find the key/value pair,
          // add the value to the map, then returns an empty string.
          // If this replace failed to find anything it won't replace anything
          // and return the unmodified member, tripping the invalid member detect.
          // This is insane.
          member.replace(
            /^[\t ]*([A-Za-z_]\w*)[\t ]*:[\t ]*([^\t ].*?)[\t ]*$/,
            (_match, key, value) => {
              obj.set(
                dealiasPropertyKey(key),
                parseEscape(value.replace(/\\n/g, '\n')));
              return '';
            }
          ) === member
        ) {
          // invalid members
          lineElement.error = element;
        }
        return obj;
      }, new Map<string, string>());

    // parse text property
    if (propMembers.has('text')) {
      switch (propMembers.get('text')?.toLowerCase()) {
        case 'nowrap': state.wrap = false; break;
      }
    }

    // parse border property
    if (propMembers.has('border')) {
      const previous = state.border;
      const val = propMembers.get('border')?.toLowerCase() ?? '';
      switch (val) {
        case 'line': state.border = -1; break;
        case 'space': state.border = 1; break;
        case 'none': state.border = 0; break;
        default:
          state.border = numberInRange(val, -1, 2) ?? 1;
      }
      // Toggling borders also toggles vertical rules.
      // start rules
      if (previous >= 0 && state.border < 0) {
        lineElement.vr = 'initialize';
      }
      // stop rules
      if (previous < 0 && state.border >= 0) {
        lineElement.vr = 'stopped';
      }
    }

    // parse width property
    if (propMembers.has('width')) {
      const widths = propMembers.get('width')?.toLowerCase().split(/[\t ]+|,/) ?? [];
      state.widths = widths.find(c => /^auto$/.test(c))
        ? []
        : widths.map(c => /^\*$/.test(c) ? -1 : numberInRange(c) ?? 0);
    }

    // parse align property
    if (propMembers.has('align')) {
      switch (propMembers.get('align')?.toLowerCase()) {
        case 'left': state.align = 'Left'; break;
        default:
        case 'center': state.align = 'Center'; break;
        case 'right': state.align = 'Right'; break;
      }
    }

    // parse option property
    if (propMembers.has('option')) {
      const option = propMembers.get('option')?.toLowerCase().split(/[\t ]+|,/) ?? [];
      state.barcodeOptions = {
        barcodeType      : (option.find(c => /^(upc|ean|jan|code39|itf|codabar|nw7|code93|code128|qrcode)$/.test(c)) || 'code128'),
        showHumanReadable: !!option.find(c => /^hri$/.test(c)),
        oneDwidth        : Number(option.find(c => numberInRange(c, 2, 4)) || '2' ),
        oneDheight       : Number(option.find(c => numberInRange(c, 24, 240)) || '72'),
        // QR Codes have mutually exclusive fields
        cellSize            : Number(option.find(c => numberInRange(c, 3, 8)) || '3'),
        errorCorrectionLevel: (option.find(c => /^[lmqh]$/.test(c)) || 'l'),
      };
    }

    // parse code property
    if (propMembers.has('code')) {
      lineElement.code = Object.assign({ data: propMembers.get('code') }, state.barcodeOptions);
    }

    // parse drawer kick property
    if (propMembers.has('drawer')) {
      switch (propMembers.get('drawer')) {
        case 'kick':
        case 'pin2':
          lineElement.drawerKick = 'Pin2';
          break;
        case 'pin5':
          lineElement.drawerKick = 'Pin5';
          break;
      }
    }

    // parse image property
    if (propMembers.has('image')) {
      const c = propMembers.get('image')?.replace(/=.*|[^A-Za-z0-9+/]/g, '') ?? '';
      switch (c.length % 4) {
        case 1:
          lineElement.image = c.slice(0, -1);
          break;
        case 2:
          lineElement.image = c + '==';
          break;
        case 3:
          lineElement.image = c + '=';
          break;
        default:
          lineElement.image = c;
          break;
      }
    }

    lineElement.command = propMembers.get('command');
    lineElement.comment = propMembers.get('comment');
  }
  // remove invalid property delimiter
  else if (/[{}]/.test(element)) {
    lineElement.error = element;
  }
  // parse horizontal rule
  else if (array.length === 1 && /^-+$/.test(element)) {
    lineElement.hr = true;
  }
  // parse cut
  else if (array.length === 1 && /^=+$/.test(element)) {
    lineElement.cut = true;
  }
  // parse text
  else {
    lineElement.text = escapeTextElement(element);
  }

  // Drop carried state into line element state.
  lineElement.enableWrapping = state.wrap;
  lineElement.border = state.border;
  // set line alignment
  lineElement.lineAlignment = state.align;

  // set current column width
  if (state.widths.length === 0) {
    // set '*' for all columns when the width property is 'auto'
    lineElement.width = -1;
  }
  else if (lineElement.text !== undefined) {
    // text: set column width
    lineElement.width = index < state.widths.length ? state.widths[index] : 0;
  }
  else if (state.widths.find(c => c < 0)) {
    // image, code, command: when the width property includes '*', set '*'
    lineElement.width = -1;
  }
  else {
    // image, code, command: when the width property does not include '*',
    // set the sum of column width and border width
    const w = state.widths.filter(c => c > 0);
    lineElement.width = w.length <= 0
      ? 0
      : w.reduce(
        (a, c) => a + c,
        lineElement.border < 0
          ? w.length + 1
          : (w.length - 1) * lineElement.border);
  }

  return lineElement;
}

/**
 * Transform ReceiptLine document to command document.
 * @param {string} doc ReceiptLine document
 * @param {IMediaOptions} mediaOptions Label media configuration
 * @returns {IDocument} PCL document to give to a printer.
 */
export function parseReceiptLineToDocument(doc: string, mediaOptions: IMediaOptions): Cmds.IDocument {
  // initialize state variables
  const state: parseState = {
    wrap: true,
    border: 1,
    widths: [],
    align: 'Center',
    barcodeOptions: { barcodeType: 'code128', oneDwidth: 2, oneDheight: 72, showHumanReadable: false, cellSize: 3, errorCorrectionLevel: 'l' },
    nextRuleOperation: 'stopped',
    rules: { left: 0, width: 0, right: 0, widths: [] }
  };

  // append commands to start printing
  // strip bom
  if (doc[0] === '\ufeff') {
    doc = doc.slice(1);
  }

  // parse each line and generate commands
  const res: Cmds.IPrinterCommand[] = doc
    .normalize()
    .split(/\n|\r\n|\r/)
    .flatMap(line => createLine(parseLine(line, state), mediaOptions, state));

  // Clean up any lingering table formatting
  switch (state.nextRuleOperation) {
    case 'initialize':
      // set state to cancel rules
      state.nextRuleOperation = 'stopped';
      break;
    case 'addVertical':
    case 'addHorizontal':
      // append commands to stop rules
      res.push(
        ...resetFormattingCmds(state.rules.left, state.rules.width, state.rules.right),
        new Cmds.TextDraw(
          ...verticalRuleEdge(state.rules.widths, 'bottom')
          .map(getCharacterFromLinePoints)),
        new Cmds.SetLineSpacing(1),
        new Cmds.Newline(),
      );
      state.nextRuleOperation = 'stopped';
      break;
    default:
      break;
  }

  return {
    commands: res
  }
}

/** Convert a property alias to the full name. */
function dealiasPropertyKey(key: string) {
  switch (key) {
    case 'a': return 'align';
    case 'b': return 'border';
    case 'c': return 'code';
    case 'i': return 'image';
    case 'o': return 'option';
    case 't': return 'text';
    case 'w': return 'width';
    case 'x': return 'command';
    case '_': return 'comment';
    default: return key;
  }
}

/** Get commands to reset text formatting and print area. */
function resetFormattingCmds(
  leftMargin: number,
  printWidth: number,
  rightMargin: number,
  alignment: Cmds.Alignment = 'Left'): Cmds.IPrinterCommand[] {
    return [
      new Cmds.SetPrintArea(leftMargin, printWidth, rightMargin),
      new Cmds.TextFormatting({ resetToDefault: true, alignment: alignment}),
    ]
}

/**
 * Parse lines.
 * @param {string} columns line text without line breaks
 * @param {object} state state variables
 * @returns {object} parsed line object
 */
function parseLine(columns: string, state: parseState) {
  // extract columns
  const line = columns
    // trim whitespace
    //.replace(/^[\t ]+|[\t ]+$/g, '')
    .trim()
    // convert escape characters ('\\', '\{', '\|', '\}') to hexadecimal escape characters
    .replace(/\\[\\{|}]/g, match => '\\x' + match.charCodeAt(1).toString(16))
    // append a space if the first column does not start with '|' and is right-aligned
    .replace(/^[^|]*[^\t |]\|/, ' $&')
    // append a space if the last column does not end with '|' and is left-aligned
    .replace(/\|[^\t |][^|]*$/, '$& ')
    // remove '|' at the beginning of the first column
    .replace(/^\|(.*)$/, '$1')
    // remove '|' at the end of the last column
    .replace(/^(.*)\|$/, '$1')
    // separate text with '|' into individual columns
    .split('|')
    // parse columns to line elements
    .map((column, index, array) => columnsToLine(column, index, array, state));

  // if the line is text and the width property is not 'auto'
  if (line.every(el => el.text !== undefined) && state.widths.length > 0) {
    // if the line has fewer columns
    while (line.length < state.widths.length) {
      // fill empty columns
      line.push({
        align: 'Center',
        lineAlignment: 'Center',
        text: [''],
        enableWrapping: state.wrap,
        border: state.border,
        width: state.widths[line.length],
      });
    }
  }

  return line;
}

/**
 * Parse escape characters.
 * @param {string} str string containing escape characters
 * @returns {string} unescaped string
 */
function parseEscape(str: string) {
  return str
    // remove invalid escape sequences
    .replace(/\\$|\\x(.?$|[^\dA-Fa-f].|.[^\dA-Fa-f])/g, '')
    // ignore invalid escape characters
    .replace(/\\[^x]/g, '')
    // convert hexadecimal escape characters to normal characters
    .replace(/\\x([\dA-Fa-f]{2})/g, (_match, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Generate commands from line objects.
 * @param {object} line parsed line object
 * @param {object} mediaOptions printer configuration
 * @param {object} state state variables
 * @returns {string} printer command fragment or SVG image fragment
 */
function createLine(
  line: lineElement[],
  mediaOptions: IMediaOptions,
  state: parseState
): Cmds.IPrinterCommand[] {
  const lineCmds: Cmds.IPrinterCommand[] = [];

  const isTextLine = line.every(el => el.text !== undefined);
  const firstColumn = line[0];
  console.warn('First column', firstColumn);

  // remove zero width columns
  let columns = line.filter(el => el.width !== 0);
  // remove overflowing columns
  if (isTextLine) {
    columns = columns.slice(
      0,
      Math.floor(
        firstColumn.border < 0
        ? (mediaOptions.charactersPerLine - 1) / 2
        : (mediaOptions.charactersPerLine + firstColumn.border) / (firstColumn.border + 1)
      )
    );
  }

  const fixedSizeColumns    = columns.filter(el => el.width > 0);
  const variableSizeColumns = columns.filter(el => el.width < 0);
  // Print space explicitly occupied
  let reservedWidth = fixedSizeColumns.reduce((a, el) => a + el.width, 0);
  // Remaining space for auto-sizing
  let freeWidth = mediaOptions.charactersPerLine - reservedWidth;
  // Borders occupy free space
  if (isTextLine && columns.length > 0) {
    freeWidth -= firstColumn.border < 0
      ? columns.length + 1
      : (columns.length - 1) * (firstColumn.border);
  }

  // reduce the width of fixed columns when reserved width is too many
  while (variableSizeColumns.length > freeWidth) {
    fixedSizeColumns.reduce((a, el) => a.width > el.width ? a : el).width--;
    freeWidth++;
  }
  // allocate free width among variable columns
  if (variableSizeColumns.length > 0) {
    variableSizeColumns.forEach((el, i) => el.width = Math.floor((freeWidth + i) / variableSizeColumns.length));
    freeWidth = 0;
  }

  // Calculate margins for entire line.
  const left = Math.floor(freeWidth * getLeftAlignmentMultiplier(firstColumn.lineAlignment));
  const width = mediaOptions.charactersPerLine - freeWidth;
  const right = freeWidth - left;
  console.warn(`Line margins are | ${left} [ ${width} ] ${right} |`);

  // process text
  if (isTextLine) {
    // wrap text in cols
    const wrappedCols = columns.map(c => ({col: c, wrappedLines: wrapText(c)}));
    // vertical line spacing
    const widths = columns.map(c => c.width);

    // rules
    switch (state.nextRuleOperation) {
      case 'initialize':
        // append commands to start rules
        lineCmds.push(
          ...resetFormattingCmds(left, width, right),
          new Cmds.TextDraw(...verticalRuleEdge(widths, 'top').map(getCharacterFromLinePoints)),
          new Cmds.SetLineSpacing(1),
          new Cmds.Newline()
        );
        state.nextRuleOperation = 'addVertical';
        break;
      case 'addHorizontal':
        // append commands to print horizontal rule
        const leftMarginDiff = left - state.rules.left;
        const widthDiff = width - state.rules.width;
        const minLeftMargin = Math.min(left, state.rules.left);
        const minRightMargin = Math.min(right, state.rules.right);
        const maxSpace = mediaOptions.charactersPerLine - minLeftMargin - minRightMargin;
        lineCmds.push(
          ...resetFormattingCmds(minLeftMargin, maxSpace, minRightMargin),
          new Cmds.TextDraw(
            ...verticalRuleWithHorizontalRule(
              state.rules.widths,
              widths,
              leftMarginDiff,
              leftMarginDiff + widthDiff)
            .map(getCharacterFromLinePoints)),
          new Cmds.Newline(),
        );
        state.nextRuleOperation = 'addVertical';
        break;
      default:
        break;
    }

    // Store active rules in state
    state.rules = { left: left, width: width, right: right, widths: widths };

    // The printer can't jump backwards, so we must print the full contents of a
    // line horizontally at a time. If any columns have wrapped text we must print
    // a new line for each wrap, printing all of the wrapped text at that line.
    const maxWrappedLines = firstColumn.enableWrapping
      ? wrappedCols.reduce((a, col) => Math.max(a, col.wrappedLines.length), 1)
      : 1;
    for (let wrapIdx = 0; wrapIdx < maxWrappedLines; wrapIdx++) {
      // Reset formatting to the start of the new line
      const wrappedLineCmds = resetFormattingCmds(left, width, right);
      let printPosition = 0;

      // process vertical rules
      if (state.nextRuleOperation === 'addVertical') {
        // maximum height of any text on this line
        const height: Cmds.Height = wrappedCols.reduce(
          (a: number, col) => clampToRange(col.wrappedLines.at(wrapIdx)?.maxHeight ?? 1, a, 7),
          1
        ) as Cmds.Height;

        // append commands to print vertical rules
        wrappedLineCmds.push(
          new Cmds.OffsetPrintPosition('absolute', printPosition++),
          ...verticalRuleAroundText(widths, height),
        );
      }

      // Add the text for each column, at the wrap level we're at.
      wrappedCols.forEach((col) => {
        // If the column doesn't have a wrapped line at this wrapped line index
        // we use a default one.
        const wrappedCol = col.wrappedLines.at(wrapIdx) ?? {
          data: [{
            text: ' ',
            decor: { resetToDefault: true }
          }],
          maxHeight: 1,
          leftMargin: 0
        };

        // Move to the print position of the column
        wrappedLineCmds.push(
          new Cmds.OffsetPrintPosition('absolute', printPosition));

        // Jump forward if there's a left margin
        if (wrappedCol.leftMargin !== 0) {
          wrappedLineCmds.push(
            new Cmds.OffsetPrintPosition('relative', wrappedCol.leftMargin)
          );
        }

        // Push the formatting, then the text, for all of the text in the column.
        wrappedLineCmds.push(...wrappedCol.data.flatMap((text) => [
          new Cmds.TextFormatting(text.decor),
          new Cmds.Text(text.text)
        ]));

        // Offset print position to next column after this one.
        printPosition += col.col.width + Math.abs(firstColumn.border);
      });

      // Finish the wrapped line with a newline
      lineCmds.push(...wrappedLineCmds, new Cmds.Newline());
    }
  }

  // process horizontal rule
  if (firstColumn.hr === true) {
    switch (state.nextRuleOperation) {
      case 'stopped':
        lineCmds.push(
          new Cmds.TextFormatting({ resetToDefault: true }),
          new Cmds.SetPrintArea(left, width, right),
          new Cmds.HorizontalRule(width),
          new Cmds.Newline()
        );
        break;
      case 'addVertical':
        // Queue an intersection between horizontal and vertical for the next line
        state.nextRuleOperation = 'addHorizontal';
        break;
      default:
        break;
    }
  }

  // process cut
  if (firstColumn.cut === true) {
    switch (state.nextRuleOperation) {
      case 'addVertical':
      case 'addHorizontal':
        // append commands to stop rules
        lineCmds.push(
          ...resetFormattingCmds(state.rules.left, state.rules.width, state.rules.right),
          new Cmds.TextDraw(...verticalRuleEdge(state.rules.widths, 'bottom').map(getCharacterFromLinePoints)),
          new Cmds.SetLineSpacing(1),
          new Cmds.Newline(),
          new Cmds.Cut(),
        );
        // Reset rules after the cut
        state.nextRuleOperation = 'initialize';
        break;
      default:
        lineCmds.push(new Cmds.Cut());
        break;
    }
  }

  // process rules
  if (firstColumn.vr !== undefined) {
    // start rules
    if (firstColumn.vr === 'initialize') {
      state.nextRuleOperation = 'initialize';
    }
    // stop rules
    else {
      switch (state.nextRuleOperation) {
        case 'initialize':
          // set state to cancel rules
          state.nextRuleOperation = 'stopped';
          break;
        case 'addVertical':
        case 'addHorizontal':
          // append commands to stop rules
          lineCmds.push(
            ...resetFormattingCmds(state.rules.left, state.rules.width, state.rules.right),
            new Cmds.TextDraw(...verticalRuleEdge(state.rules.widths, 'bottom').map(getCharacterFromLinePoints)),
            new Cmds.SetLineSpacing(1),
            new Cmds.Newline(),
          );
          state.nextRuleOperation = 'stopped';
          break;
        default:
          break;
      }
    }
  }

  if (firstColumn.drawerKick !== undefined) {
    lineCmds.push(
      new Cmds.PulseCommand(firstColumn.drawerKick)
    )
  }

  // process image
  if (firstColumn.image !== undefined) {
    // append commands to print image
    lineCmds.push(
      ...resetFormattingCmds(left, width, right, firstColumn.align),
      new Cmds.ImageCommand(firstColumn.image),
    );
  }

  // process barcode or 2D code
  if (firstColumn.code !== undefined) {
    // append commands to print barcode
    lineCmds.push(
      ...resetFormattingCmds(left, width, right, firstColumn.align),
      new Cmds.Barcode(firstColumn.code),
    );
  }

  // process command
  if (firstColumn.command !== undefined) {
    // append commands to insert commands
    lineCmds.push(
      ...resetFormattingCmds(left, width, right, firstColumn.align),
      new Cmds.RawCommand(firstColumn.command)
    );
  }

  return lineCmds;
}

// TODO: Move this out into an ICodepage system.
function measureText(text: string, encoding: string) {
  let r = 0;
  const t = Array.from(text);
  switch (encoding) {
    case 'cp932':
    case 'shiftjis':
      r = t.reduce((a, c) => {
        const d = c.codePointAt(0) ?? 0x20;
        return a + (d < 0x80 || d === 0xa5 || d === 0x203e || (d > 0xff60 && d < 0xffa0) ? 1 : 2);
      }, 0);
      break;
    case 'cp936':
    case 'gb18030':
    case 'cp949':
    case 'ksc5601':
    case 'cp950':
    case 'big5':
      r = t.reduce((a, c) => a + (c.codePointAt(0) ?? 0x20 < 0x80 ? 1 : 2), 0);
      break;
    case 'tis620':
      const a = t.reduce((a, c) => {
        const d = c.codePointAt(0) ?? 0x20;
        if (a.consonant) {
          if (d === 0xe31 || d >= 0xe34 && d <= 0xe3a || d === 0xe47) {
            if (a.vowel) {
              a.length += 2;
              a.consonant = a.vowel = a.tone = false;
            }
            else {
              a.vowel = true;
            }
          }
          else if (d >= 0xe48 && d <= 0xe4b) {
            if (a.tone) {
              a.length += 2;
              a.consonant = a.vowel = a.tone = false;
            }
            else {
              a.tone = true;
            }
          }
          else if (d === 0xe33 || d >= 0xe4c && d <= 0xe4e) {
            if (a.vowel || a.tone) {
              a.length += 2;
              a.consonant = a.vowel = a.tone = false;
            }
            else {
              a.length += d === 0xe33 ? 2 : 1;
              a.consonant = false;
            }
          }
          else if (d >= 0xe01 && d <= 0xe2e) {
            a.length++;
            a.vowel = a.tone = false;
          }
          else {
            a.length += 2;
            a.consonant = a.vowel = a.tone = false;
          }
        }
        else if (d >= 0xe01 && d <= 0xe2e) {
          a.consonant = true;
        }
        else {
          a.length++;
        }
        return a;
      }, { length: 0, consonant: false, vowel: false, tone: false });
      if (a.consonant) {
        a.length++;
        a.consonant = a.vowel = a.tone = false;
      }
      r = a.length;
      break;
    default:
      r = t.length;
      break;
  }
  return r;
}

/**
 * Wrap text.
 * @param {lineElement} column parsed column object
 * @returns {wrappedTextLine[]} Array of wrapped lines in the same column
 */
function wrapText(
  column: lineElement,
  // TODO: Make this method handle code pages and dynamic code page switching
  //codepage: ICodepage
): wrappedTextLine[] {
  const result: wrappedTextLine[] = [];
  // remaining spaces
  let space = column.width;
  // text height
  let maxLineHeight = 1;
  // text data
  let res: formattedText[] = [];
  // Count of ^ characters currently active
  let sizeSetting = 0;
  const decor: Cmds.TextFormat = {
    underline: 'None',
    bold: 'None',
    invert: 'None',
    width: 1,
    height: 1
  };

  // process text and text decoration
  (column.text ?? []).forEach((text, i) => {
    // process text
    // The original string of text is split by the text decoration characters.
    // This results in an array of <text>, <decor character> and we can rely on
    // that ordering. Text we may be interested in is always on even indices.
    if (i % 2 === 0) {
      // TODO: arrayFrom should handle thai combining characters
      //printer.command.arrayFrom(text, printer.encoding);
      let t = Array.from(text)
      while (t.length > 0) {
        // measure character width
        let w = 0;
        let j = 0;
        while (j < t.length) {
          // TODO: make this handle dynamic encoding values
          w = measureText(t[j], 'cp437') * (decor.width!);
          // output before protruding
          if (w > space) {
            break;
          }
          space -= w;
          w = 0;
          j++;
        }

        // if characters fit
        if (j > 0) {
          // Copy formatting setup to retain its settings
          res.push({
            decor: structuredClone(decor),
            text: t.slice(0, j).join('')
          });
          // update text height
          maxLineHeight = Math.max(maxLineHeight, decor.height!);
          // remaining text
          t = t.slice(j);
        }

        // if character is too big
        if (w > column.width) {
          // do not output
          t = t.slice(1);
          continue;
        }

        // if there is no space left
        if (w > space || space === 0) {
          // wrap text automatically
          result.push({
            data: res,
            leftMargin: space * getLeftAlignmentMultiplier(column.align),
            maxHeight: maxLineHeight
          });
          space = column.width;
          res = [];
          maxLineHeight = 1;
        }
      }
    }
    // process text decoration
    else {
      // update text decoration flags
      switch (true) {
        case text === '\n':
          // wrap text manually
          result.push({
            data: res,
            leftMargin: space * getLeftAlignmentMultiplier(column.align),
            maxHeight: maxLineHeight
          });
          space = column.width;
          res = [];
          maxLineHeight = 1;
          break;
        case text === '_':
          decor.underline = decor.underline === 'None' ? 'Single' : 'None';
          break;
        case text === '"':
          decor.bold = decor.bold === 'None' ? 'Enable' : 'None';
          break;
        case text === '`':
          decor.invert = decor.invert === 'None' ? 'Enable' : 'None';
          break;
        case /^\^+$/.test(text):
          const d = Math.min(text.length, 7);
          // The same number as the current setting is a reset.
          sizeSetting = sizeSetting === d ? 0 : d;
          const sizes = getTextSizeMultiplier(sizeSetting);
          decor.width = sizes.width;
          decor.height = sizes.height;
          break;
      }
    }
  });

  // output last text
  if (res.length > 0) {
    result.push({
      data: res,
      leftMargin: space * getLeftAlignmentMultiplier(column.align),
      maxHeight: maxLineHeight
    });
  }

  return result;
}
