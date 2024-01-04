import { WebReceiptLineError, type IDeviceInformation } from "../../index.js";

export type PrinterMessage
  = ISettingUpdateMessage
  | IStatusMessage
  | IErrorMessage

export type MessageType = 'SettingUpdateMessage' | 'StatusMessage' | 'ErrorMessage'

/** A printer settings message, describing printer configuration status. */
export interface ISettingUpdateMessage {
  messageType: 'SettingUpdateMessage';

  // Yep it's a giant bundle of optional values to update!
  hasMultiByteSupport?: boolean;
  hasAutocutter?: boolean;
  hasDmdConnected?: boolean;

  firmwareVersion?: number[];
  manufacturerName?: string;
  modelName?: string;
  serialNumber?: string;
  fontLanguageSupport?: string;
}

/** A status message sent by the printer. */
export interface IStatusMessage {
  messageType: 'StatusMessage'

  printerOnline?: boolean,
  drawerKickStatus?: boolean,
  coverOpen?: boolean,
  paperLow?: boolean,
  paperButtonFeedingPaper?: boolean,
}

/** An error message sent by the printer. */
export interface IErrorMessage {
  messageType: 'ErrorMessage',
  displayText: string,
  isErrored: boolean,

  paperOut?: boolean,
  cutterError?: boolean,
  waitForOnlineRecovery?: boolean,
  recoverableError?: boolean,
  autorecoverableError?: boolean,

  turnOffPowerImmediately?: boolean,
}

/** The output of a function for parsing a message. */
export interface IMessageHandlerResult<TInput> {
  messageIncomplete: boolean,
  messageMatchedExpectedCommand: boolean,
  messages: PrinterMessage[],
  remainder: TInput
}

/** An error indicating a problem parsing a received message. */
export class MessageParsingError extends WebReceiptLineError {
  public readonly receivedMessage: Uint8Array;
  constructor(message: string, receivedMessage: Uint8Array) {
    super(message);
    this.receivedMessage = receivedMessage;
  }
}

export function deviceInfoToOptionsUpdate(deviceInfo: IDeviceInformation): ISettingUpdateMessage {
  return {
    messageType: 'SettingUpdateMessage',
    modelName: deviceInfo.productName,
    serialNumber: deviceInfo.serialNumber,
    manufacturerName: deviceInfo.manufacturerName,
  }
}
