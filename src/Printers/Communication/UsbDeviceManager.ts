/// <reference types="w3c-web-usb" />

import type { IDevice, IDeviceCommunicationOptions } from "./DeviceCommunication.js";
import { WebReceiptLineError } from "../../WebReceiptLineError.js";

export interface IUsbDeviceManagerEventMap<TDevice> {
  connectedDevice: CustomEvent<{ detail: TDevice }>;
  disconnectedDevice: CustomEvent<{ detail: TDevice }>;
}

export interface IUsbDeviceCommunicationOptions extends IDeviceCommunicationOptions {
  /** Connection parameters to limit what devices can connect. */
  requestOptions: USBDeviceRequestOptions;
}

type DeviceGetter<TDevice> = (
  device: USBDevice,
  deviceCommunicationOptions: IUsbDeviceCommunicationOptions
) => TDevice;

export class UsbDeviceManager<TDevice extends IDevice> extends EventTarget {
  private usb: USB;

  /** Map of tracked devices to their wrapper objects. */
  private _devices = new Map<USBDevice, TDevice>();
  public get devices() { return [...this._devices.values()]; }

  private deviceGetter: DeviceGetter<TDevice>;

  /** Communication behavior when communicating with devices. */
  public deviceCommunicationOptions: IUsbDeviceCommunicationOptions;

  constructor(
    navigatorUsb: USB,
    deviceConstructor: DeviceGetter<TDevice>,
    commOpts: IUsbDeviceCommunicationOptions
  ) {
    super();
    this.usb = navigatorUsb;
    this.deviceGetter = deviceConstructor;
    this.deviceCommunicationOptions = commOpts;

    this.usb.addEventListener('connect', this.handleConnect.bind(this));
    this.usb.addEventListener('disconnect', this.handleDisconnect.bind(this));
  }

  public addEventListener<T extends keyof IUsbDeviceManagerEventMap<TDevice>>(
    type: T,
    listener: EventListenerObject | null | ((this: UsbDeviceManager<TDevice>, ev: IUsbDeviceManagerEventMap<TDevice>[T]) => void),
    options?: boolean | AddEventListenerOptions
  ): void;
  public addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    super.addEventListener(type, callback, options);
  }

  /** Ask the user to select a device to connect to. */
  public async promptForNewDevice(options?: USBDeviceRequestOptions): Promise<boolean> {
    try {
      const device = await this.usb.requestDevice(options ?? this.deviceCommunicationOptions.requestOptions);
      await this.handleConnect(new USBConnectionEvent('connect', { device }));
    } catch (e) {
      // User cancelled
      if (
        e instanceof DOMException &&
        e.name === 'NotFoundError' &&
        e.message.endsWith('No device selected.')
      ) {
        return false;
      }
      throw e;
    }
    return true;
  }

  /** Disconnect then reconnect all devices */
  public async forceReconnect() {
    const oldList = Array.from(this._devices.values());
    this._devices.clear();
    await Promise.all([...oldList].map(async (value) => value.dispose()));

    const newDevices = await this.usb.getDevices();
    await Promise.all(
      newDevices
        .map((d) => new USBConnectionEvent('connect', { device: d }))
        .map(async (e) => await this.handleConnect(e))
    );
  }

  /** Handler for device connection events. */
  public async handleConnect({ device }: USBConnectionEvent): Promise<void> {
    // Only handle registration if we aren't already tracking a device
    if (!this._devices.has(device)) {
      const dev = this.deviceGetter(device, this.deviceCommunicationOptions);
      this._devices.set(device, dev);
    }

    // Can't be undefined, we just set it!
    const dev = this._devices.get(device)!;

    // Don't notify that the printer exists until it's ready to exist.
    await dev.ready;

    const event = new CustomEvent<TDevice>('connectedDevice', { detail: dev });
    this.dispatchEvent(event);
  }

  /** Handler for device disconnection events. */
  public async handleDisconnect({ device }: USBConnectionEvent): Promise<void> {
    const dev = this._devices.get(device);
    if (dev === undefined) {
      return;
    }
    this._devices.delete(device);
    await dev.dispose();

    const event = new CustomEvent<TDevice>('disconnectedPrinter', { detail: dev });
    this.dispatchEvent(event);
  }
}

export class UserCancelledConnectionError extends WebReceiptLineError {
  constructor() {
    super("User cancelled the connection request.");
  }
}
