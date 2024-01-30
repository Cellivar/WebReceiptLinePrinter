import * as WebReceipt from '../src/index.js';
import * as WebDevices from 'web-device-mux';
// This file exists to test the index.html's typescript. Unfortunately there isn't
// a good way to configure Visual Studio Code to, well, treat it as typescript.
////////////////////////////////////////////////////////////////////////////////

// First import the lib!
//import * as WebReceipt from 'web-receiptline-printer';

      // For this demo we're going to make use of the USB printer manager
      // so it can take care of concerns like the USB connect and disconnect events.
      // It's a handy-dandy feature included from the web-device-mux library!
      // We need to tell it what type of device it's managing, and how to filter
      // USB devices that are receipt printers.
      const printerMgr = new WebDevices.UsbDeviceManager<WebReceipt.ReceiptPrinter>(
  window.navigator.usb,
  WebReceipt.ReceiptPrinter.fromUSBDevice,
  {
    // Enable debugging, so the dev console can fill up with interesting messages!
    debug: true,
    requestOptions: {
      // Limit the USB devices we try to connect to.
      filters: [
        {
          vendorId: 0x2730, // Citizen
        },
        {
          vendorId: 0x04B8 // Epson
        }
      ]
    }
  }
);

// We'll wire up some basic event listeners to the printer manager.
// First, a button to prompt a user to add a printer.
const addPrinterBtn = document.getElementById('addprinter')!;
addPrinterBtn.addEventListener('click', async () => printerMgr.promptForNewDevice());

// Next a button to manually refresh all printers, just in case.
const refreshPrinterBtn = document.getElementById('refreshPrinters')!;
refreshPrinterBtn.addEventListener('click', async () => printerMgr.forceReconnect());

// Next we wire up some events on the device manager itself.
printerMgr.addEventListener('connectedDevice', ({ detail }) => {
  const printer = detail.device;
  const config = printer.printerOptions;
  console.log(`Printer is a ${config.model} by ${config.manufacturer}, serial ${config.serialNumber}`);
  console.log(`Printer has ${config.charactersPerLine} characters per line`);
});

// There's also an event that will tell you when a printer disconnects.
printerMgr.addEventListener('disconnectedDevice', ({ detail }) => {
  const printer = detail.device;
  // TODO: Hide appropriate interface.
  console.log(`Lost printer ${printer.printerModel} (${printer.printerOptions.serialNumber}).`);
});

// The browser will remember printers that were previously connected, and
// when the page loads it will automatically reconnect to them. Our code wasn't
// running yet though, so we missed it. It's good practice to force a
// reconnect once your event handlers are ready. Like this:
//await printerMgr.forceReconnect();
// Before we do that in this demo we first want to set up the UI app.

// And that's all there is to setup! The page can now talk to printers.
// The rest of this demo is an example of a basic receipt printer app.

// The app's logic is wrapped in a class just for ease of reading.
class BasicDocumentPrinterApp {
  constructor(
    private manager: WebDevices.UsbDeviceManager<WebReceipt.ReceiptPrinter>,
    private btnContainer: HTMLElement,
    private labelForm: HTMLElement,
    private labelFormInstructions: HTMLElement,
  ) {
    // Add a second set of event listeners for printer connect and disconnect to redraw
    // the printer list when it changes.
    this.manager.addEventListener('connectedDevice', () => {
      this.activePrinterIndex = -1;
      this.redrawPrinterButtons();
    });
    this.manager.addEventListener('disconnectedDevice', () => {
      this.activePrinterIndex = -1;
      this.redrawPrinterButtons();
    });
  }

  get printers(): readonly WebReceipt.ReceiptPrinter[] {
    return this.manager.devices;
  }

  // Track which printer is currently selected for operations
  private _activePrinter = 0;
  get activePrinter(): WebReceipt.ReceiptPrinter | undefined {
    return this._activePrinter < 0 || this._activePrinter > this.printers.length
      ? undefined
      : this.printers[this._activePrinter];
  }
  set activePrinterIndex(printerIdx: number) {
    this._activePrinter = printerIdx;
    this.redrawTextCanvas();
  }

  /** Initialize the app */
  public async init() {
    this.redrawPrinterButtons();
    this.redrawTextCanvas();
  }

  /** Erase and re-draw the list of printer buttons in the UI. */
  private redrawPrinterButtons() {
    this.btnContainer.innerHTML = '';
    this.printers.forEach((printer, idx) => this.drawPrinterButton(printer, idx));
  }

  /** Highlight only the currently selected printer. */
  private redrawPrinterButtonHighlights() {
    this.printers.forEach((printer, idx) => {
      const highlight = this._activePrinter == idx ? "var(--bs-blue)" : "transparent";
      const element = document.getElementById(`printer_${idx}`)!;
      element.style.background = `linear-gradient(to right, ${highlight}, ${highlight}, grey, grey)`;
    });
  }

  /** Add a printer's button UI to the list of printers. */
  private drawPrinterButton(printer: WebReceipt.ReceiptPrinter, idx: number) {
    const highlight = this._activePrinter == idx ? "var(--bs-blue)" : "transparent";

    // Generate a new label printer button for the given printer.
    const element = document.createElement("div");
    element.innerHTML = `
    <li id="printer_${idx}" data-printer-idx="${idx}"
        class="list-group-item d-flex flex-row justify-content-between sligh-items-start"
        style="background: linear-gradient(to right, ${highlight}, ${highlight}, grey, grey);">
        <div class="col-sm-8">
            <div class="col-sm-12">
                <span data-serial="${printer.printerOptions.serialNumber}">${printer.printerOptions.serialNumber}</span>
            </div>
            <div class="col-sm-12">
                <span>${printer.printerOptions.charactersPerLine} cpl</span>
            </div>
        </div>
        <div class="d-flex flex-row justify-content-end">
            <div class="btn-group" role="group" aria-label="Printer button group">
                <button id="printto_${idx}" class="btn btn-success btn-lg" data-printer-idx="${idx}">🖨</button>
                    <button class="btn btn-success dropdown-toggle dropdown-toggle-split" data-bs-toggle="dropdown" aria-expanded="false">
                        <span class="visually-hidden">Settings</span>
                    </button>
                    <ul class="dropdown-menu">
                        <li><a id="printtest_${idx}"   data-printer-idx="${idx}" class="dropdown-item" href="#">
                            Print test page
                        </a></li>
                        <li><a id="printconfig_${idx}" data-printer-idx="${idx}" class="dropdown-item" href="#">
                            Print config
                        </a></li>
                        <li><a id="drawerkick_${idx}"  data-printer-idx="${idx}" class="dropdown-item" href="#">
                            Kick drawer out
                        </a></li>
                    </ul>
                </div>
            </div>
        </div>
    </li>`;
    // And slap it into the button container.
    this.btnContainer.appendChild(element);

    // Then wire up the button events so they work.
    document.getElementById(`printto_${idx}`)!
      .addEventListener('click', async (e) => {
        e.preventDefault();
        const printerIdx = (e.currentTarget as HTMLAnchorElement).dataset.printerIdx as unknown as number;
        const printer = this.printers[printerIdx];
        const textarea = this.labelForm.querySelector('#labelFormText') as HTMLTextAreaElement;
        const rawReceiptline = textarea.value;
        const doc = WebReceipt.parseReceiptLineToDocument(rawReceiptline, printer.printerOptions);
        await printer.sendDocument(doc);
      });
    document.getElementById(`printer_${idx}`)!
      .addEventListener('click', async (e) => {
        e.preventDefault();
        const printerIdx = (e.currentTarget as HTMLAnchorElement).dataset.printerIdx as unknown as number;
        if (this._activePrinter == printerIdx) {
          // Don't refresh anything if we already have this printer selected..
          return;
        }
        this.activePrinterIndex = printerIdx;
        this.redrawPrinterButtonHighlights();
        this.redrawTextCanvas();
      });
    document.getElementById(`printtest_${idx}`)!
      .addEventListener('click', async (e) => {
        e.preventDefault();
        const printerIdx = (e.currentTarget as HTMLAnchorElement).dataset.printerIdx as unknown as number;
        const printer = this.printers[printerIdx];
        const doc = {
          commands: [new WebReceipt.TestPrint('rolling')]
        };
        await printer.sendDocument(doc);
      });
    document.getElementById(`printconfig_${idx}`)!
      .addEventListener('click', async (e) => {
        e.preventDefault();
        const printerIdx = (e.currentTarget as HTMLAnchorElement).dataset.printerIdx as unknown as number;
        const printer = this.printers[printerIdx];
        const doc = {
          commands: [new WebReceipt.TestPrint('printerStatus')]
        };
        await printer.sendDocument(doc);
      });
    document.getElementById(`drawerkick_${idx}`)!
      .addEventListener('click', async (e) => {
        e.preventDefault();
        const printerIdx = (e.currentTarget as HTMLAnchorElement).dataset.printerIdx as unknown as number;
        const printer = this.printers[printerIdx];
        const doc = {
          commands: [new WebReceipt.PulseCommand()]
        };
        await printer.sendDocument(doc);
      });
  }

  /** Redraw the text canvas size according to the printer. */
  private redrawTextCanvas() {
    const printer = this.activePrinter;
    if (printer == null) {
      this.labelForm.classList.add('d-none');
      this.labelFormInstructions.classList.remove('d-none');
      return;
    } else {
      this.labelForm.classList.remove('d-none');
      this.labelFormInstructions.classList.add('d-none');
    }

    const textarea = this.labelForm.querySelector('#labelFormText') as HTMLTextAreaElement;
    textarea.value = "Enter your ReceiptLine text here!";
  }
}

// With the app class defined we can run it.
// First up collect the basic structure of the app
const btnContainer          = document.getElementById("printerlist")!;
const labelForm             = document.getElementById("labelForm")!;
const labelFormInstructions = document.getElementById("labelFormInstructions")!;

// And feed that into the app class to manage the elements
const app = new BasicDocumentPrinterApp(printerMgr, btnContainer, labelForm, labelFormInstructions);
// and let it take over the UI.
await app.init();

// Make the TypeScript type system happy by adding a property to the Window object.
declare global {
  interface Window { printer_app: BasicDocumentPrinterApp }
}
// Now we can access our printer in the dev console if we want to mess with it!
window.printer_app = app;

// Now we'll fire the reconnect since our UI is wired up.
await printerMgr.forceReconnect();

// We're done here. Bring in the dancing lobsters.
