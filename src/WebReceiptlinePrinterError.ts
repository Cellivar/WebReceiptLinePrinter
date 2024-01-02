/** Exception thrown from the WebReceptline library. */
export class WebReceptlinePrinterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
