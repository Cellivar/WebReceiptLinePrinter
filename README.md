# Web-ReceiptLine-Printer

![NPM Version](https://img.shields.io/npm/v/web-receiptline-printer) | [![Build](https://github.com/Cellivar/WebReceiptLinePrinter/actions/workflows/build_npm.yml/badge.svg?branch=main)](https://github.com/Cellivar/WebReceiptLinePrinter/actions/workflows/build_npm.yml)


Print receipts on receipt printers directly from your browser. No need to install drivers, extensions, or anything else.

![image](https://github.com/Cellivar/WebReceiptLinePrinter/assets/1441553/4072cc21-5d9e-4c96-a47c-feb26f81ff59)

## Demo

See [the demo](https://cellivar.github.io/WebReceiptLinePrinter/demo) that runs in your browser. Note that you will need a browser that supports WebUSB, such as Chrome, Edge, Chrome on Android, Opera, [etc](https://developer.mozilla.org/en-US/docs/Web/API/USB#browser_compatibility).

### Supported Printers

Tested:

* Epson TM-T88V

Theoretical:

* All Epson ESC/POS printers with 42 characters per line

This library has been tested with Epson TM-T88V printers, it may not work with other brands at this time. Have a particular printer you'd like to use? [Drop me a note about it!](https://github.com/Cellivar/WebReceiptLinePrinter/issues).

## Docs

Read more [about ReceiptLine.](./docs/ReceiptLine.md).

This repo contains some docs and findings related to receipt printers and their various quirks. I'm interested in collecting as much of this information as I can as I just think they're neat. If you have something to add please feel free to open an issue!

## Local development

To facilitate local dev you can spin up a local static webserver that will end up operating very similar to GitHub Pages. Clone the repo, run `npm ci` and `npm run serve-local`. On the first time this will run `mkcert` and save the certificate to your machine store, subsequently it will re-use this same cert. Open the server at https://localhost:4443/demo/ to test the app.

* `npm run test` to run the tests.
* `npm run build` to run the typescript compiler.
