# Epson Standard Code for Point of Sale Printers (ESC/POS)

* [Technical Reference](https://download4.epson.biz/sec_pubs/pos/reference_en/)

## Overview

ESC/POS is a variant of the original ESC/P [page description language](https://en.wikipedia.org/wiki/Page_description_language). While ESC/P was designed for dot-matrix and impact printers, ESC/POS was designed specifically with the Point-of-Sale and receipt printer businesses in mind.

Since its introduction many years ago ESC/POS has enjoyed widespread support both among Epson equipment, but also many different manufacturers. You may find ESC/POS emulation modes on everything from high quality Brother printers down to cheap no-name printers off Amazon or AliExpress.

### Support

This library supports communicating over USb to devices that can speak ESC/POS or very similar derivatives. Support has been fully tested on Epson TM-T88V printers.

Keeping tabs on what printers actually support what commands is, thus, quite difficult. This library attempts to manage support for features according to Epson's official support notes. Other manufacturers and devices are less known, and instead you may need to adjust supported command fallback rules yourself.

## Commands and Processing

[Command Classification](https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/command_classification.html)

[Data Processing](https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/data_processing.html)

[Real Time commands](https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/realtime_commands.html)

[Glossary](https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/glossary.html)

## Trademarks

Portions of this repository may reference ESC/POS and/or Seiko Epson Corporation. All references are for the purpose of clarification only, and all ownership of EPSON and related trademarks remain property of Seiko Epson Corporation.

Epson makes good stuff! Their equipment is rock solid and their support is great. Consider purchasing their equipment for the best support with this library.
