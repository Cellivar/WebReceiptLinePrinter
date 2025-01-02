/** Exception thrown from the WebReceiptLine library. */
export class WebReceiptLineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
