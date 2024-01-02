import type { TranspiledDocumentState } from '../../../Documents/CommandSet.js';

export * from './PrinterIdCmd.js'
export * from './PrinterStatusCmd.js'
export * from './Messages.js'
export * from './EscPos.js'

export function hasFlag(val: number, flag: number) {
  return (val & flag) === flag;
}

export type EscPosDocState = TranspiledDocumentState;
