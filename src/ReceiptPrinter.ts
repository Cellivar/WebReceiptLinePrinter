import * as Util from './Util/index.js';
import * as Conf from './Configs/index.js';
import * as Cmds from './Commands/index.js';
import * as Docs from './Documents/index.js';
import * as Lang from './Languages/index.js';
import * as Mux from 'web-device-mux';
import { ReadyToPrintDocuments } from './ReadyToPrintDocuments.js';

export interface ReceiptPrinterEventMap {
  //disconnectedDevice: CustomEvent<string>;
  reportedStatus: CustomEvent<Cmds.IStatusMessage>;
  reportedError: CustomEvent<Cmds.IErrorMessage>;
}

function promiseWithTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutError = new Error('Promise timed out')
): Promise<T> {
  // create a promise that rejects in milliseconds
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(timeoutError);
    }, ms);
  });

  // returns a race between timeout and the passed promise
  return Promise.race<T>([promise, timeout]);
}

/** Type alias for a Receipt Printer that communicates over USB. */
export type ReceiptPrinterUsb = ReceiptPrinter<Uint8Array>;

/** A class for working with a receipt printer. */
export class ReceiptPrinter<TChannelType extends Conf.MessageArrayLike> extends EventTarget implements Mux.IDevice {
  private _channel: Mux.IDeviceChannel<TChannelType, TChannelType>;
  private _channelType: Conf.MessageArrayLikeType;
  private _channelMessageTransformer: Cmds.MessageTransformer<TChannelType>;
  private _streamListener?: Mux.InputMessageListener<TChannelType>;
  private _commandSet?: Cmds.CommandSet<Conf.MessageArrayLike>;

  private _awaitedCommands: Cmds.AwaitedCommand[] = [];
  private _awaitedCommandTimeoutMS = 5000;

  private _printerOptions: Cmds.PrinterConfig;
  /** Gets the read-only copy of the current config of the printer. To modify use getConfigDocument. */
  get printerOptions() { return this._printerOptions; }
  /** Gets the model of the printer, detected from the printer's config. */
  get printerModel() { return this._printerOptions.model; }
  /** Gets the manufacturer of the printer, detected from the printer's config. */
  get printerManufacturer() { return this._printerOptions.manufacturer; }
  /** Gets the serial number of the printer, detected from the printer's config. */
  get printerSerial() { return this._printerOptions.serialNumber; }

  private _deviceCommOpts: Mux.IDeviceCommunicationOptions;
  /** Gets the configured printer communication options. */
  get printerCommunicationOptions() {
    return this._deviceCommOpts;
  }

  private _disposed = false;
  get connected() {
    return !this._disposed
      && this._channel.connected
  }

  get ready() {
    return Promise.resolve(this.connected);
  }

  /** Construct a new printer from a given USB device. */
  static async fromUSBDevice(
    device: USBDevice,
    options: Mux.IDeviceCommunicationOptions
  ): Promise<ReceiptPrinterUsb> {
    const c = await Mux.UsbDeviceChannel.fromDevice(device, options);
    const p = new ReceiptPrinter(
      c,
      new Cmds.RawMessageTransformer(),
      'Uint8Array',
      options);
    await p.setup();
    return p;
  }

  /** Construct a new printer from a raw channel object */
  static async fromChannel<TChannelType extends Conf.MessageArrayLike>(
    channel: Mux.IDeviceChannel<TChannelType, TChannelType>,
    channelMessageTransformer: Cmds.MessageTransformer<TChannelType>,
    channelType: Conf.MessageArrayLikeType,
    deviceCommunicationOptions: Mux.IDeviceCommunicationOptions = { debug: false },
    printerOptions?: Cmds.PrinterConfig,
  ) {
    const p = new ReceiptPrinter(
      channel,
      channelMessageTransformer,
      channelType,
      deviceCommunicationOptions,
      printerOptions);
    await p.setup();
    return p;
  }

  protected constructor(
    channel: Mux.IDeviceChannel<TChannelType, TChannelType>,
    channelMessageTransformer: Cmds.MessageTransformer<TChannelType>,
    channelMessageType: Conf.MessageArrayLikeType,
    deviceCommunicationOptions: Mux.IDeviceCommunicationOptions = { debug: false },
    printerOptions?: Cmds.PrinterConfig,
  ) {
    super();
    this._channel = channel;
    this._channelMessageTransformer = channelMessageTransformer;
    this._channelType = channelMessageType;
    this._deviceCommOpts = deviceCommunicationOptions;
    this._printerOptions = printerOptions ?? new Cmds.PrinterConfig();
  }

  public override addEventListener<T extends keyof ReceiptPrinterEventMap>(
    type: T,
    listener: EventListenerObject | null | ((this: ReceiptPrinter<TChannelType>, ev: ReceiptPrinterEventMap[T]) => void),
    options?: boolean | AddEventListenerOptions
  ): void;
  public override addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    super.addEventListener(type, callback, options);
  }

  public override removeEventListener<T extends keyof ReceiptPrinterEventMap>(
    type: T,
    listener: EventListenerObject | null | ((this: ReceiptPrinter<TChannelType>, ev: ReceiptPrinterEventMap[T]) => void),
    options?: boolean | AddEventListenerOptions
  ): void;
  public override removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions | undefined
  ): void {
    super.removeEventListener(type, callback, options);
  }

  private sendEvent(
    eventName: keyof ReceiptPrinterEventMap,
    detail: Cmds.IErrorMessage | Cmds.IStatusMessage
  ): boolean {
    return super.dispatchEvent(new CustomEvent<Cmds.IErrorMessage | Cmds.IStatusMessage>(eventName, { detail }));
  }

  private async setup() {
    if (!this._channel.connected) {
      // If the channel failed to connect we have no hope.
      await this.dispose();
      return false;
    }

    const devInfo = await this._channel.getDeviceInfo();
    this._printerOptions.update(Cmds.deviceInfoToOptionsUpdate(devInfo));

    this._streamListener = new Mux.InputMessageListener<TChannelType>(
      this._channel.receive.bind(this._channel),
      this.parseAndDispatchMessage.bind(this),
      this.handleInputError.bind(this),
      this._deviceCommOpts.debug,
    );
    this._streamListener.start();

    this._commandSet = await this.detectLanguage(devInfo);
    // Get the language-specific config object, which may have more options than
    // the common config object.
    this._printerOptions = this._commandSet.getConfig(this._printerOptions);

    // Now that we're listening for messages we can query for the full config.
    await this.refreshPrinterConfiguration();

    return true;
  }

  public async dispose() {
    this._disposed = true;
    this._streamListener?.dispose();
    await this._channel.dispose();
  }

  /** Refresh the printer information cache directly from the printer. */
  public async refreshPrinterConfiguration(): Promise<Cmds.PrinterConfig> {
    // Querying for a config doesn't always.. work? Like, just straight up
    // for reasons I can't figure out some printers will refuse to return
    // a valid config. Mostly EPL models.
    // Give it 3 chances before we give up.
    let retryLimit = 3;
    do {
      retryLimit--;
      try {
        await this.sendDocument(ReadyToPrintDocuments.getConfig);
        return this.printerOptions;
      }
      catch (e) {
        this.logIfDebug(`Error trying to read printer config, trying ${retryLimit} more times.`, e);
      }
    } while (retryLimit > 0);

    throw new Mux.DeviceCommunicationError(`Tried ${retryLimit} times to read config and failed.`);
  }

  /** Send a document to the printer, applying the commands. */
  public async sendDocument(
    doc: Docs.IDocument,
    commandSet = this._commandSet
  ) {
    if (!this.connected) {
      throw new Mux.DeviceNotReadyError("Printer is not ready to communicate.");
    }
    if (commandSet === undefined) {
      throw new Mux.DeviceNotReadyError("No command set provided to send, is the printer connected?");
    }

    this.logResultIfDebug(() => 'SENDING DOCUMENT TO PRINTER:\n' + doc.commands.map((c) => c.toDisplay()).join('\n'));

    // Exceptions are thrown and handled elsewhere.
    const state = Cmds.getNewTranspileState(this._printerOptions);
    const compiledDocument = Docs.transpileDocument(doc, commandSet, state);

    return this.sendCompiledDocument(compiledDocument);
  }

  /** Send a compiled document to the printer. */
  public async sendCompiledDocument(doc: Docs.CompiledDocument): Promise<boolean> {
    if (!this.connected) {
      throw new Mux.DeviceNotReadyError("Printer is not ready to communicate.");
    }

    // TODO: deal with errors halfway through document sending?
    for (const trans of doc.transactions) {
      const result = await this.sendTransactionAndWait(trans);
      if (!result) { return false; }
    }

    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async detectLanguage(_deviceInfo?: Mux.IDeviceInformation): Promise<Cmds.CommandSet<Conf.MessageArrayLike>> {

    // TODO: language detection
    return Promise.resolve(new Lang.EscPos.EscPos());
  }

  private async sendTransactionAndWait(
    transaction: Docs.Transaction
  ): Promise<boolean> {
    this._awaitedCommands = transaction.awaitedCommands.map(cmd => {
      let awaitResolve;
      let awaitReject;
      const awaiter: Cmds.AwaitedCommand = {
        cmd,
        promise: new Promise<boolean>((resolve, reject) => {
          awaitResolve = resolve;
          awaitReject = reject;
        })
      };
      awaiter.reject = awaitReject;
      awaiter.resolve = awaitResolve;
      return awaiter;
    });

    this.logResultIfDebug(() => {
      const debugMsg = Cmds.asString(transaction.commands);
      return `Transaction being sent to printer:\n${debugMsg}\n--end of transaction--`;
    });

    // TODO: Better type guards??
    let sendCmds: TChannelType;
    switch(this._channelType) {
      default:
        Util.exhaustiveMatchGuard(this._channelType);
        break;
      case 'Uint8Array':
        sendCmds = Cmds.asUint8Array(transaction.commands) as TChannelType;
        break;
      case 'string':
        sendCmds = Cmds.asString(transaction.commands) as TChannelType;
        break;
    }

    await promiseWithTimeout(
      this._channel.send(sendCmds),
      5000,
      new Mux.DeviceCommunicationError(`Timed out sending commands to printer, is there a problem with the printer?`)
    );

    try {
      if (this._awaitedCommands.length > 0) {
        this.logIfDebug(`Awaiting response to ${this._awaitedCommands.length} commands for up to ${this._awaitedCommandTimeoutMS}ms...`);
        await promiseWithTimeout(
          Promise.all(this._awaitedCommands.map(c => c.promise)),
          this._awaitedCommandTimeoutMS,
          new Mux.DeviceCommunicationError(`Timed out waiting for sent command response, expected ${this._awaitedCommands.length} responses.`)
        );
      }
    }
    finally {
      this._awaitedCommands = [];
    }
    return true;
  }

  private async handleInputError(error: Mux.DeviceCommunicationError) {
    // TODO: Something?
    console.error("Printer saw error from InputListener!", error.message, error.innerException);
  }

  private async parseAndDispatchMessage(
    input: TChannelType[]
  ): Promise<Mux.IHandlerResponse<TChannelType>> {
    if (this._commandSet === undefined) {
      // TODO: Better option than hoping..
      await new Promise(r => setTimeout(r, 500));
      return { remainderData: input }
    }

    if (this._awaitedCommands.length > 0) {
      this.logIfDebug(`Checking if the messages is a response to one of ${this._awaitedCommands.length} messages.`);
    } else {
      this.logIfDebug(`Not awaiting a command. This message was a surprise, to be sure, but a welcome one.`);
    }

    // When a device can return multiple messages there's no safety in relying on
    // deterministic message order. It's a happy accident if it happens.
    // Iterate through the response message and the command candidates in order,
    // but always validate the message is the format we wanted.
    const msg = this._channelMessageTransformer.combineMessages(...input);
    const parsed = await Cmds.parseRaw(
      msg,
      this._commandSet,
      this._printerOptions,
      this._awaitedCommands);

    parsed.messages.forEach(m => {
      switch (m.messageType) {
        case 'ErrorMessage':
          this.sendEvent('reportedError', m);
          this.logIfDebug('Error message sent.', m);
          break;
        case 'StatusMessage':
          this.sendEvent('reportedStatus', m);
          this.logIfDebug('Status message sent.', m);
          break;
        case 'SettingUpdateMessage':
          this._printerOptions.update(m);
          this.logIfDebug('Settings update message applied.', m);
          break;
      }
    });

    this.logIfDebug(`Returning unused ${parsed.remainderMsg.length} bytes.`);
    const remainderData = parsed.remainderMsg.length === 0 ? [] : [parsed.remainderMsg];
    return { remainderData }
  }

  private logIfDebug(...obj: unknown[]) {
    if (this._deviceCommOpts.debug) {
      console.debug(...obj);
    }
  }

  private logResultIfDebug(fn: () => string) {
    if (this._deviceCommOpts.debug) {
      console.debug(fn());
    }
  }
}
