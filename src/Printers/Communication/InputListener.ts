// TODO: Rewrite the entire message handling system as a stream transformer?

import { DeviceCommunicationError } from "./DeviceCommunication.js";

export type DataProvider<TInput> = () => Promise<TInput | DeviceCommunicationError>;
export type InputHandler<TInput> = (input: TInput[]) => IHandlerResponse<TInput>;
export interface IHandlerResponse<TInput> {
  remainderData?: TInput[];
}

export class InputMessageListener<TInput> {
  public start() {
    new Promise<void>(async (resolve, reject) => {
      this._resolveHandle = resolve;
      //this._rejectHandle = reject;

      let aggregate: TInput[] = [];
      do {
        const data = await this._dataProvider();

        if (data instanceof DeviceCommunicationError) {
          console.error(`Error getting data from source: `, data);
          // TODO: Is this right?
          reject(data);
          continue;
        }

        aggregate.push(data);
        this.logIfDebug(`Got data from provider, now has ${aggregate.length} items in receive buffer. Data: `, data);
        // The handler determines if what we got was sufficient, or if we need more.
        const handleResult = this._inputHandler(aggregate);
        this.logIfDebug(`Input handler provided a ${handleResult.remainderData?.length ?? 0} length incomplete buffer.`);

        // The handler is not required to be stateful, this is instead.
        // The handler  may indicate more data is expected by returning incomplete
        // data back. We prefix our buffer with that incomplete data to add more
        // to it and wait again for more.
        aggregate = handleResult.remainderData ?? [];
      } while (!this._disposed);
      resolve();
    })
    .catch((reason) => {
      // TODO: Better logging?
      this.logIfDebug(`Device stream listener stopped listening`, reason);
    });
  }

  private _disposed = false;
  public dispose() {
    if (this._disposed) { return ;}
    this._disposed = true;

    if (this._resolveHandle !== undefined) {
      this._resolveHandle();
    }
  }

  //private _rejectHandle?: (reason?: any) => void;
  private _resolveHandle?: (value: void) => void;

  constructor(
    private readonly _dataProvider: DataProvider<TInput>,
    private readonly _inputHandler: InputHandler<TInput>,
    private readonly _debugLogging: boolean = true, // TODO: false
  ) {}

  private logIfDebug(...obj: unknown[]) {
    if (this._debugLogging) {
      console.debug(...obj);
    }
  }
}
