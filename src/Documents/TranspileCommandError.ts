import { WebReceiptLineError } from "../WebReceiptLineError.js";

/** Represents an error when validating a document against a printer's capabilities. */
export class TranspileDocumentError extends WebReceiptLineError {
  private _innerErrors: TranspileDocumentError[] = [];
  get innerErrors() {
    return this._innerErrors;
  }

  constructor(message: string, innerErrors?: TranspileDocumentError[]) {
    super(message);
    this._innerErrors = innerErrors ?? [];
  }
}
