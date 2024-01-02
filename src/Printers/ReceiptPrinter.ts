import { type CompiledDocument, type IDocument, Transaction } from "../Documents/index.js";
import * as Cmds from "../Documents/index.js";
import { UsbDeviceChannel, type IDeviceChannel, type IDeviceCommunicationOptions, InputMessageListener, type IHandlerResponse, DeviceCommunicationError, DeviceNotReadyError, type IStatusMessage, type IErrorMessage } from "./Communication/index.js";
import { transpileDocument } from "../Documents/DocumentTranspiler.js";
import { EscPos, type CommandSet } from "./Languages/index.js";
import { PrinterOptions } from "./Options/index.js";

export interface ReceiptPrinterEventMap {
  disconnectedDevice: CustomEvent<string>;
  reportedStatus: CustomEvent<IStatusMessage>;
  reportedError: CustomEvent<IErrorMessage>;
}

type AwaitedCommand = {
  cmd: Cmds.IPrinterCommand,
  promise: Promise<boolean>,
  resolve?: (value: boolean) => void,
  reject?: (reason?: any) => void,
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

export class ReceiptPrinter extends EventTarget {
  private _channel: IDeviceChannel<Uint8Array, Uint8Array>;

  private _streamListener?: InputMessageListener<Uint8Array>;
  private _commandSet?: CommandSet<Uint8Array>;

  private _awaitedCommand?: AwaitedCommand;

  private _printerOptions: PrinterOptions;
  /** Gets the model of the printer, detected from the printer's config. */
  get printerModel() {
    return this._printerOptions?.model;
  }
  /** Gets the read-only copy of the current config of the printer. */
  get printerConfig() {
    return this._printerOptions.copy();
  }

  private _deviceCommOpts: IDeviceCommunicationOptions;
  /** Gets the configured printer communication options. */
  get printerCommunicationOptions() {
    return this._channel;
  }

  private _disposed = false;
  private _ready: Promise<boolean>;
  /** A promise indicating this printer is ready to be used. */
  get ready() {
    return this._ready;
  }

  /** Construct a new printer from a given USB device. */
  static fromUSBDevice(device: USBDevice, options: IDeviceCommunicationOptions): ReceiptPrinter {
    return new this(new UsbDeviceChannel(device, options), options);
  }

  constructor(
    channel: IDeviceChannel<Uint8Array, Uint8Array>,
    deviceCommunicationOptions: IDeviceCommunicationOptions = {debug: false},
    printerOptions?: PrinterOptions,
  ) {
    super();
    this._channel = channel;
    this._deviceCommOpts = deviceCommunicationOptions
    this._printerOptions = printerOptions ?? new PrinterOptions();
    this._ready = this.setup();

    // Once the printer is set up we should immediately query the printer config.
    this._ready.then((ready) => {
      if (!ready) {
        return;
      }
      return this.sendDocument({
        commands: [
          new Cmds.GetConfiguration(),
          new Cmds.GetStatus(),
        ]
      });
    })
  }

  public addEventListener<T extends keyof ReceiptPrinterEventMap>(
    type: T,
    listener: EventListenerObject | null | ((this: ReceiptPrinter, ev: ReceiptPrinterEventMap[T]) => void),
    options?: boolean | AddEventListenerOptions
  ): void;
  public addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    super.addEventListener(type, callback, options);
  }

  private async setup() {
    const channelReady = await this._channel.ready;
    if (!channelReady) {
      // If the channel failed to connect we have no hope.
      return false;
    }

    // TODO: language detection
    this._commandSet = new EscPos();
    this._streamListener = new InputMessageListener<Uint8Array>(
      this._channel.getInput,
      this.parseMessage,
      this._deviceCommOpts.debug,
    );
    this._streamListener.start();

    return true;
  }

  /** Close the connection to this printer, preventing future communication. */
  public async dispose() {
    this._disposed = true;
    this._streamListener?.dispose();
    await this._channel.dispose();
  }

  /** Compile then send a document to the printer. */
  public async sendDocument(doc: IDocument): Promise<boolean> {
    await this.ready;
    if (this._disposed == true || this._commandSet === undefined) {
      throw new DeviceNotReadyError("Printer is not ready to communicate.");
    }

    this.logIfDebug('SENDING DOCUMENT TO PRINTER:');
    this.logResultIfDebug(() => doc.commands.map((c) => c.toDisplay()).join('\n'));

    const state = this._commandSet.getNewTranspileState(this._printerOptions);
    const compiledDocument = transpileDocument(
      doc,
      this._commandSet,
      state);

    return this.sendCompiledDocument(compiledDocument);
  }

  /** Send a compiled document to the printer. */
  public async sendCompiledDocument(doc: CompiledDocument<Uint8Array>): Promise<boolean> {
    await this.ready;
    if (this._disposed == true || this._commandSet === undefined) {
      throw new DeviceNotReadyError("Printer is not ready to communicate.");
    }

    for (const trans of doc.transactions) {
      try {
        const result = await this.sendTransactionAndWait(trans);
        if (!result) { return false; }
      } catch (e) {
        if (e instanceof DeviceCommunicationError) {
          console.error(e);
          return false;
        } else {
          throw e;
        }
      }
    }

    return true;
  }

  private async sendTransactionAndWait(
    transaction: Transaction<Uint8Array>
  ): Promise<boolean> {
    this.logIfDebug('RAW TRANSACTION:');
    this.logResultIfDebug(() => new TextDecoder('ascii').decode(transaction.commands));

    if (transaction.awaitedCommand !== undefined) {
      this.logIfDebug(`Transaction will await a response to '${transaction.awaitedCommand.toDisplay()}'.`);
      const awaiter: AwaitedCommand = {
        cmd: transaction.awaitedCommand,
        promise: new Promise<boolean>((resolve, reject) => {
          awaiter.resolve = resolve;
          awaiter.reject = reject;
        })
      };
      this._awaitedCommand = awaiter;
    }

    await promiseWithTimeout(
      this._channel.sendCommands(transaction.commands),
      5000,
      new DeviceCommunicationError(`Timed out sending commands to printer, is there a problem with the printer?`)
    );

    // TODO: timeout!
    if (this._awaitedCommand) {
      this.logIfDebug(`Awaiting response to command '${this._awaitedCommand.cmd.name}'...`);
      await promiseWithTimeout(
        this._awaitedCommand.promise,
        5000,
        new DeviceCommunicationError(`Timed out waiting for '${this._awaitedCommand.cmd.name}' response.`)
      );
      this.logIfDebug(`Got a response to command '${this._awaitedCommand.cmd.name}'!`);
    }
    return true;
  }

  private parseMessage(input: Uint8Array[]): IHandlerResponse<Uint8Array> {
    if (this._commandSet === undefined) { return { remainderData: input } }
    let msg = this._commandSet.combineCommands(...input);
    if (msg.length === 0) { return {}; }
    let incomplete = false;

    do {
      this.logIfDebug(`Parsing ${msg.length} long message from printer: `, msg);
      if (this._awaitedCommand !== undefined) {
        this.logIfDebug(`Checking if the messages is a response to '${this._awaitedCommand.cmd.name}'.`);
      } else {
        this.logIfDebug(`Message was a surprise, to be sure, but a welcome one.`);
      }

      const parseResult = this._commandSet.parseMessage(msg, this._awaitedCommand?.cmd);
      this.logIfDebug(`Raw parse result: `, parseResult);

      msg = parseResult.remainder;
      incomplete = parseResult.messageIncomplete;

      if (parseResult.messageMatchedExpectedCommand) {
        this.logIfDebug('Received message was expected, marking awaited response resolved.');
        if (this._awaitedCommand?.resolve === undefined) {
          console.error('Resolve callback was undefined for awaited command, this may cause a deadlock! This is a bug in the library.');
        } else {
          this._awaitedCommand.resolve(true);
        }
      }

      parseResult.messages.forEach(m => {
        switch (m.messageType) {
          case 'ErrorMessage':
            this.sendError(m);
            break;
          case 'StatusMessage':
            this.sendStatus(m);
            break;
          case 'SettingUpdateMessage':
            this._printerOptions.update(m);
            this.logIfDebug('Settings update message applied.');
            break;
        }
      });

    } while (incomplete === false && msg.length > 0)

    this.logIfDebug(`Returning ${msg.length} bytes.`);
    return { remainderData: [msg] }
  }

  private sendError(msg: IErrorMessage) {
    return this.dispatchEvent(new CustomEvent<IErrorMessage>('reportedError', { detail: msg }));
  }
  private sendStatus(msg: IStatusMessage) {
    return this.dispatchEvent(new CustomEvent<IStatusMessage>('reportedStatus', { detail: msg }));
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