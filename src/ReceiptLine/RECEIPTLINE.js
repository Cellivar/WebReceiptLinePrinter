//ReceiptLine
/*
Copyright 2019 Open Foodservice System Consortium

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// QR Code is a registered trademark of DENSO WAVE INCORPORATED.

(function () {

  let iconv = undefined;
  let PNG = undefined;
  let stream = undefined;
  let decoder = undefined;
  let qrcode = undefined;
  // Node.js
  if (typeof require !== 'undefined') {
      PNG = require('pngjs').PNG;
      stream = require('stream');
      decoder = require('string_decoder');
      qrcode = require('./qrcode-generator/qrcode.js');
  }

  //
  // Command base object
  //
  const _base = {
      /**
       * Character width.
       * @type {number} character width (dots per character)
       */
      charWidth: 12,

      /**
       * Start printing.
       * @param {object} printer printer configuration
       * @returns {string} commands
       */
      open: printer => '',

      /**
       * Finish printing.
       * @returns {string} commands
       */
      close: () => '',

      /**
       * Set print area.
       * @param {number} left left margin (unit: characters)
       * @param {number} width print area (unit: characters)
       * @param {number} right right margin (unit: characters)
       * @returns {string} commands
       */
      area: (left, width, right) => '',

      /**
       * Set line alignment.
       * @param {number} align line alignment (0: left, 1: center, 2: right)
       * @returns {string} commands
       */
      align: align => '',

      /**
       * Set absolute print position.
       * @param {number} position absolute position (unit: characters)
       * @returns {string} commands
       */
      absolute: position => '',

      /**
       * Set relative print position.
       * @param {number} position relative position (unit: characters)
       * @returns {string} commands
       */
      relative: position => '',

      /**
       * Print horizontal rule.
       * @param {number} width line width (unit: characters)
       * @returns {string} commands
       */
      hr: width => '',

      /**
       * Print vertical rules.
       * @param {number[]} widths vertical line spacing
       * @param {number} height text height (1-6)
       * @returns {string} commands
       */
      vr: (widths, height) => '',

      /**
       * Start rules.
       * @param {number[]} widths vertical line spacing
       * @returns {string} commands
       */
      vrstart: widths => '',

      /**
       * Stop rules.
       * @param {number[]} widths vertical line spacing
       * @returns {string} commands
       */
      vrstop: widths => '',

      /**
       * Print vertical and horizontal rules.
       * @param {number[]} widths1 vertical line spacing (stop)
       * @param {number[]} widths2 vertical line spacing (start)
       * @param {number} dl difference in left position
       * @param {number} dr difference in right position
       * @returns {string} commands
       */
      vrhr: (widths1, widths2, dl, dr) => '',

      /**
       * Set line spacing and feed new line.
       * @param {boolean} vr whether vertical ruled lines are printed
       * @returns {string} commands
       */
      vrlf: vr => '',

      /**
       * Cut paper.
       * @returns {string} commands
       */
      cut: () => '',

      /**
       * Underline text.
       * @returns {string} commands
       */
      ul: () => '',

      /**
       * Emphasize text.
       * @returns {string} commands
       */
      em: () => '',

      /**
       * Invert text.
       * @returns {string} commands
       */
      iv: () => '',

      /**
       * Scale up text.
       * @param {number} wh number of special character '^' (1-7)
       * @returns {string} commands
       */
      wh: wh => '',

      /**
       * Cancel text decoration.
       * @returns {string} commands
       */
      normal: () => '',

      /**
       * Print text.
       * @param {string} text string to print
       * @param {string} encoding codepage
       * @returns {string} commands
       */
      text: (text, encoding) => '',

      /**
       * Feed new line.
       * @returns {string} commands
       */
      lf: () => '',

      /**
       * Insert commands.
       * @param {string} command commands to insert
       * @returns {string} commands
       */
      command: command => '',

      /**
       * Print image.
       * @param {string} image image data (base64 png format)
       * @returns {string} commands
       */
      image: image => '',

      /**
       * Print QR Code.
       * @param {object} symbol QR Code information (data, type, cell, level)
       * @param {string} encoding codepage
       * @returns {string} commands
       */
      qrcode: (symbol, encoding) => '',

      /**
       * Print barcode.
       * @param {object} symbol barcode information (data, type, width, height, hri)
       * @param {string} encoding codepage
       * @returns {string} commands
       */
      barcode: (symbol, encoding) => ''
  };

  //
  // SVG
  //
  const _svg = {
      svgWidth: 576,
      svgHeight: 0,
      svgContent: '',
      lineMargin: 0,
      lineAlign: 0,
      lineWidth: 48,
      lineHeight: 1,
      textElement: '',
      textAttributes: {},
      textPosition: 0,
      textScale: 1,
      textEncoding: '',
      feedMinimum: 24,
      // printer configuration
      spacing: false,
      // start printing:
      open: function (printer) {
          this.svgWidth = printer.cpl * this.charWidth;
          this.svgHeight = 0;
          this.svgContent = '';
          this.lineMargin = 0;
          this.lineAlign = 0;
          this.lineWidth = printer.cpl;
          this.lineHeight = 1;
          this.textElement = '';
          this.textAttributes = {};
          this.textPosition = 0;
          this.textScale = 1;
          this.textEncoding = printer.encoding;
          this.feedMinimum = Number(this.charWidth * (printer.spacing ? 2.5 : 2));
          this.spacing = printer.spacing;
          return '';
      },
      // finish printing:
      close: function () {
          const p = { font: 'monospace', size: this.charWidth * 2, style: '', lang: '' };
          switch (this.textEncoding) {
              case 'cp932':
              case 'shiftjis':
                  p.font = `'Kosugi Maru', 'MS Gothic', 'San Francisco', 'Osaka-Mono', monospace`;
                  p.style = '@import url("https://fonts.googleapis.com/css2?family=Kosugi+Maru&display=swap");';
                  p.lang = 'ja';
                  break;
              case 'cp936':
              case 'gb18030':
                  p.size -= 2;
                  p.lang = 'zh-Hans';
                  break;
              case 'cp949':
              case 'ksc5601':
                  p.size -= 2;
                  p.lang = 'ko';
                  break;
              case 'cp950':
              case 'big5':
                  p.size -= 2;
                  p.lang = 'zh-Hant';
                  break;
              case 'tis620':
                  p.font = `'Sarabun', monospace`;
                  p.size -= 4;
                  p.style = '@import url("https://fonts.googleapis.com/css2?family=Sarabun&display=swap");';
                  p.lang = 'th';
                  break;
              default:
                  p.font = `'Courier Prime', 'Courier New', 'Courier', monospace`;
                  p.size -= 2;
                  p.style = '@import url("https://fonts.googleapis.com/css2?family=Courier+Prime&display=swap");';
                  break;
          }
          if (p.style.length > 0) {
              p.style = `<style type="text/css"><![CDATA[${p.style}]]></style>`;
          }
          if (p.lang.length > 0) {
              p.lang = ` xml:lang="${p.lang}"`;
          }
          return `<svg width="${this.svgWidth}px" height="${this.svgHeight}px" viewBox="0 0 ${this.svgWidth} ${this.svgHeight}" preserveAspectRatio="xMinYMin meet" ` +
              `xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1">${p.style}` +
              `<defs><filter id="receiptlineinvert" x="0" y="0" width="100%" height="100%"><feFlood flood-color="#000"/><feComposite in="SourceGraphic" operator="xor"/></filter></defs>` +
              `<g font-family="${p.font}" fill="#000" font-size="${p.size}" dominant-baseline="text-after-edge" text-anchor="middle"${p.lang}>${this.svgContent}</g></svg>\n`;
      },
      // set print area:
      area: function (left, width, right) {
          this.lineMargin = left;
          this.lineWidth = width;
          return '';
      },
      // set line alignment:
      align: function (align) {
          this.lineAlign = align;
          return '';
      },
      // set absolute print position:
      absolute: function (position) {
          this.textPosition = position;
          return '';
      },
      // set relative print position:
      relative: function (position) {
          this.textPosition += position;
          return '';
      },
      // print horizontal rule:
      hr: function (width) {
          const w = this.charWidth;
          const path = `<path d="M0,${w}h${w * width}" fill="none" stroke="#000" stroke-width="2"/>`;
          this.svgContent += `<g transform="translate(${this.lineMargin * w},${this.svgHeight})">${path}</g>`;
          return '';
      },
      // print vertical rules:
      vr: function (widths, height) {
          const w = this.charWidth, u = w / 2, v = (w + w) * height;
          const path = `<path d="` + widths.reduce((a, width) => a + `m${w * width + w},${-v}v${v}`, `M${u},0v${v}`) + `" fill="none" stroke="#000" stroke-width="2"/>`;
          this.svgContent += `<g transform="translate(${this.lineMargin * w},${this.svgHeight})">${path}</g>`;
          return '';
      },
      // start rules:
      vrstart: function (widths) {
          const w = this.charWidth, u = w / 2;
          const path = `<path d="` + widths.reduce((a, width) => a + `h${w * width}h${u}v${w}m0,${-w}h${u}`, `M${u},${w + w}v${-u}q0,${-u},${u},${-u}`).replace(/h\d+v\d+m0,-\d+h\d+$/, `q${u},0,${u},${u}v${u}`) + `" fill="none" stroke="#000" stroke-width="2"/>`;
          this.svgContent += `<g transform="translate(${this.lineMargin * w},${this.svgHeight})">${path}</g>`;
          return '';
      },
      // stop rules:
      vrstop: function (widths) {
          const w = this.charWidth, u = w / 2;
          const path = `<path d="` + widths.reduce((a, width) => a + `h${w * width}h${u}v${-w}m0,${w}h${u}`, `M${u},0v${u}q0,${u},${u},${u}`).replace(/h\d+v-\d+m0,\d+h\d+$/, `q${u},0,${u},${-u}v${-u}`) + `" fill="none" stroke="#000" stroke-width="2"/>`;
          this.svgContent += `<g transform="translate(${this.lineMargin * w},${this.svgHeight})">${path}</g>`;
          return '';
      },
      // print vertical and horizontal rules:
      vrhr: function (widths1, widths2, dl, dr) {
          const w = this.charWidth, u = w / 2;
          const path1 = `<path d="` + widths1.reduce((a, width) => a + `h${w * width}h${u}v${-w}m0,${w}h${u}`, `M${u},0` + (dl > 0 ? `v${u}q0,${u},${u},${u}`: `v${w}h${u}`)).replace(/h\d+v-\d+m0,\d+h\d+$/, dr < 0 ? `q${u},0,${u},${-u}v${-u}` : `h${u}v${-w}`) + `" fill="none" stroke="#000" stroke-width="2"/>`;
          this.svgContent += `<g transform="translate(${(this.lineMargin + Math.max(-dl, 0)) * w},${this.svgHeight})">${path1}</g>`;
          const path2 = `<path d="` + widths2.reduce((a, width) => a + `h${w * width}h${u}v${w}m0,${-w}h${u}`, `M${u},${w + w}` + (dl < 0 ? `v${-u}q0,${-u},${u},${-u}`: `v${-w}h${u}`)).replace(/h\d+v\d+m0,-\d+h\d+$/, dr > 0 ? `q${u},0,${u},${u}v${u}` : `h${u}v${w}`) + `" fill="none" stroke="#000" stroke-width="2"/>`;
          this.svgContent += `<g transform="translate(${(this.lineMargin + Math.max(dl, 0)) * w},${this.svgHeight})">${path2}</g>`;
          return '';
      },
      // set line spacing and feed new line:
      vrlf: function (vr) {
          this.feedMinimum = Number(this.charWidth * (!vr && this.spacing ? 2.5 : 2));
          return this.lf();
      },
      // cut paper:
      cut: function () {
          const path = `<path d="M12,12.5l-7.5,-3a2,2,0,1,1,.5,0M12,11.5l-7.5,3a2,2,0,1,0,.5,0" fill="none" stroke="#000" stroke-width="1"/><path d="M12,12l10,-4q-1,-1,-2.5,-1l-10,4v2l10,4q1.5,0,2.5,-1z" fill="#000"/><path d="M24,12h${this.svgWidth - 24}" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="2"/>`;
          this.svgContent += `<g transform="translate(0,${this.svgHeight})">${path}</g>`;
          return this.lf();
      },
      // underline text:
      ul: function () {
          this.textAttributes['text-decoration'] = 'underline';
          return '';
      },
      // emphasize text:
      em: function () {
          this.textAttributes.stroke = '#000';
          return '';
      },
      // invert text:
      iv: function () {
          this.textAttributes.filter = 'url(#receiptlineinvert)';
          return '';
      },
      // scale up text:
      wh: function (wh) {
          const w = wh < 2 ? wh + 1 : wh - 1;
          const h = wh < 3 ? wh : wh - 1;
          this.textAttributes.transform = `scale(${w},${h})`;
          this.lineHeight = Math.max(this.lineHeight, h);
          this.textScale = w;
          return '';
      },
      // cancel text decoration:
      normal: function () {
          this.textAttributes = {};
          this.textScale = 1;
          return '';
      },
      // print text:
      text: function (text, encoding) {
          let p = this.textPosition;
          const tspan = this.arrayFrom(text, encoding).reduce((a, c) => {
              const q = this.measureText(c, encoding) * this.textScale;
              const r = (p + q / 2) * this.charWidth / this.textScale;
              p += q;
              return a + `<tspan x="${r}">${c.replace(/[ &<>]/g, r => ({' ': '&#xa0;', '&': '&amp;', '<': '&lt;', '>': '&gt;'}[r]))}</tspan>`;
          }, '');
          const attr = Object.keys(this.textAttributes).reduce((a, key) => a + ` ${key}="${this.textAttributes[key]}"`, '');
          this.textElement += `<text${attr}>${tspan}</text>`;
          this.textPosition += this.measureText(text, encoding) * this.textScale;
          return '';
      },
      // feed new line:
      lf: function () {
          const h = this.lineHeight * this.charWidth * 2;
          if (this.textElement.length > 0) {
              this.svgContent += `<g transform="translate(${this.lineMargin * this.charWidth},${this.svgHeight + h})">${this.textElement}</g>`;
          }
          this.svgHeight += Math.max(h, this.feedMinimum);
          this.lineHeight = 1;
          this.textElement = '';
          this.textPosition = 0;
          return '';
      },
      // insert commands:
      command: command => '',
      // print image:
      image: function (image) {
          const png = typeof window !== 'undefined' ? window.atob(image) : Buffer.from(image, 'base64').toString('binary');
          let imgWidth = 0;
          let imgHeight = 0;
          png.replace(/^\x89PNG\x0d\x0a\x1a\x0a\x00\x00\x00\x0dIHDR(.{4})(.{4})/, (match, w, h) => {
              imgWidth = w.charCodeAt(0) << 24 | w.charCodeAt(1) << 16 | w.charCodeAt(2) << 8 | w.charCodeAt(3);
              imgHeight = h.charCodeAt(0) << 24 | h.charCodeAt(1) << 16 | h.charCodeAt(2) << 8 | h.charCodeAt(3);
              return '';
          });
          const imgData = `<image xlink:href="data:image/png;base64,${image}" x="0" y="0" width="${imgWidth}" height="${imgHeight}"/>`;
          const margin = this.lineMargin * this.charWidth + (this.lineWidth * this.charWidth - imgWidth) * this.lineAlign / 2;
          this.svgContent += `<g transform="translate(${margin},${this.svgHeight})">${imgData}</g>`;
          this.svgHeight += imgHeight;
          return '';
      },
      // print QR Code:
      qrcode: function (symbol, encoding) {
          if (typeof qrcode !== 'undefined' && symbol.data.length > 0) {
              const qr = qrcode(0, symbol.level.toUpperCase());
              qr.addData(symbol.data);
              qr.make();
              qr.createSvgTag(symbol.cell, 0).replace(/width="(\d+)px".*height="(\d+)px".*(<path.*?>)/, (match, w, h, path) => {
                  const margin = this.lineMargin * this.charWidth + (this.lineWidth * this.charWidth - Number(w)) * this.lineAlign / 2;
                  this.svgContent += `<g transform="translate(${margin},${this.svgHeight})">${path}</g>`;
                  this.svgHeight += Number(h);
              });
          }
          return '';
      },
      // print barcode:
      barcode: function (symbol, encoding) {
          const bar = barcode.generate(symbol);
          const h = bar.height;
          if ('length' in bar) {
              const width = bar.length;
              const height = h + (bar.hri ? this.charWidth * 2 + 2 : 0);
              // draw barcode
              let path = `<path d="`;
              bar.widths.reduce((p, w, i) => {
                  if (i % 2 === 1) {
                      path += `M${p},${0}h${w}v${h}h${-w}z`;
                  }
                  return p + w;
              }, 0);
              path += '" fill="#000"/>';
              // draw human readable interpretation
              if (bar.hri) {
                  const m = (width - (bar.text.length - 1) * this.charWidth) / 2;
                  const tspan = bar.text.split('').reduce((a, c, i) => a + `<tspan x="${m + this.charWidth * i}">${c.replace(/[ &<>]/g, r => ({' ': '&#xa0;', '&': '&amp;', '<': '&lt;', '>': '&gt;'}[r]))}</tspan>`, '');
                  path += `<text y="${height}">${tspan}</text>`;
              }
              const margin = this.lineMargin * this.charWidth + (this.lineWidth * this.charWidth - width) * this.lineAlign / 2;
              this.svgContent += `<g transform="translate(${margin},${this.svgHeight})">${path}</g>`;
              this.svgHeight += height;
          }
          return '';
      }
  };

  //
  // Barcode Generator
  //
  const barcode = {
      /**
       * Generate barcode.
       * @param {object} symbol barcode information (data, type, width, height, hri, quietZone)
       * @returns {object} barcode form
       */
      generate: function (symbol) {
          let r = {};
          switch (symbol.type) {
              case 'upc':
                  r = symbol.data.length < 9 ? this.upce(symbol) : this.upca(symbol);
                  break;
              case 'ean':
              case 'jan':
                  r = symbol.data.length < 9 ? this.ean8(symbol) : this.ean13(symbol);
                  break;
              case 'code39':
                  r = this.code39(symbol);
                  break;
              case 'itf':
                  r = this.itf(symbol);
                  break;
              case 'codabar':
              case 'nw7':
                  r = this.codabar(symbol);
                  break;
              case 'code93':
                  r = this.code93(symbol);
                  break;
              case 'code128':
                  r = this.code128(symbol);
                  break;
              default:
                  break;
          }
          return r;
      },
      // CODE128 patterns:
      c128: {
          element: '212222,222122,222221,121223,121322,131222,122213,122312,132212,221213,221312,231212,112232,122132,122231,113222,123122,123221,223211,221132,221231,213212,223112,312131,311222,321122,321221,312212,322112,322211,212123,212321,232121,111323,131123,131321,112313,132113,132311,211313,231113,231311,112133,112331,132131,113123,113321,133121,313121,211331,231131,213113,213311,213131,311123,311321,331121,312113,312311,332111,314111,221411,431111,111224,111422,121124,121421,141122,141221,112214,112412,122114,122411,142112,142211,241211,221114,413111,241112,134111,111242,121142,121241,114212,124112,124211,411212,421112,421211,212141,214121,412121,111143,111341,131141,114113,114311,411113,411311,113141,114131,311141,411131,211412,211214,211232,2331112'.split(','),
          starta: 103, startb: 104, startc: 105, atob: 100, atoc: 99, btoa: 101, btoc: 99, ctoa: 101, ctob: 100, shift: 98, stop: 106
      },
      // generate CODE128 data (minimize symbol width):
      code128: function (symbol) {
          const r = {};
          let s = symbol.data.replace(/((?!^[\x00-\x7f]+$).)*/, '');
          if (s.length > 0) {
              // generate HRI
              r.hri = symbol.hri;
              r.text = s.replace(/[\x00- \x7f]/g, ' ');
              // minimize symbol width
              const d = [];
              const p = s.search(/[^ -_]/);
              if (/^\d{2}$/.test(s)) {
                  d.push(this.c128.startc, Number(s));
              }
              else if (/^\d{4,}/.test(s)) {
                  this.code128c(this.c128.startc, s, d);
              }
              else if (p >= 0 && s.charCodeAt(p) < 32) {
                  this.code128a(this.c128.starta, s, d);
              }
              else if (s.length > 0) {
                  this.code128b(this.c128.startb, s, d);
              }
              else {
                  // end
              }
              // calculate check digit and append stop character
              d.push(d.reduce((a, c, i) => a + c * i) % 103, this.c128.stop);
              // generate bars and spaces
              const q = symbol.quietZone ? 'a' : '0';
              const m = d.reduce((a, c) => a + this.c128.element[c], q) + q;
              r.widths = m.split('').map(c => parseInt(c, 16) * symbol.width);
              r.length = symbol.width * (d.length * 11 + (symbol.quietZone ? 22 : 2));
              r.height = symbol.height;
          }
          return r;
      },
      // process CODE128 code set A:
      code128a: function (x, s, d) {
          if (x !== this.c128.shift) {
              d.push(x);
          }
          s = s.replace(/^((?!\d{4,})[\x00-_])+/, m => (m.split('').forEach(c => d.push((c.charCodeAt(0) + 64) % 96)), ''));
          s = s.replace(/^\d(?=(\d\d){2,}(\D|$))/, m => (d.push((m.charCodeAt(0) + 64) % 96), ''));
          const t = s.slice(1);
          const p = t.search(/[^ -_]/);
          if (/^\d{4,}/.test(s)) {
              this.code128c(this.c128.atoc, s, d);
          }
          else if (p >= 0 && t.charCodeAt(p) < 32) {
              d.push(this.c128.shift, s.charCodeAt(0) - 32);
              this.code128a(this.c128.shift, t, d);
          }
          else if (s.length > 0) {
              this.code128b(this.c128.atob, s, d);
          }
          else {
              // end
          }
      },
      // process CODE128 code set B:
      code128b: function (x, s, d) {
          if (x !== this.c128.shift) {
              d.push(x);
          }
          s = s.replace(/^((?!\d{4,})[ -\x7f])+/, m => (m.split('').forEach(c => d.push(c.charCodeAt(0) - 32)), ''));
          s = s.replace(/^\d(?=(\d\d){2,}(\D|$))/, m => (d.push(m.charCodeAt(0) - 32), ''));
          const t = s.slice(1);
          const p = t.search(/[^ -_]/);
          if (/^\d{4,}/.test(s)) {
              this.code128c(this.c128.btoc, s, d);
          }
          else if (p >= 0 && t.charCodeAt(p) > 95) {
              d.push(this.c128.shift, s.charCodeAt(0) + 64);
              this.code128b(this.c128.shift, t, d);
          }
          else if (s.length > 0) {
              this.code128a(this.c128.btoa, s, d);
          }
          else {
              // end
          }
      },
      // process CODE128 code set C:
      code128c: function (x, s, d) {
          if (x !== this.c128.shift) {
              d.push(x);
          }
          s = s.replace(/^\d{4,}/g, m => m.replace(/\d{2}/g, c => (d.push(Number(c)), '')));
          const p = s.search(/[^ -_]/);
          if (p >= 0 && s.charCodeAt(p) < 32) {
              this.code128a(this.c128.ctoa, s, d);
          }
          else if (s.length > 0) {
              this.code128b(this.c128.ctob, s, d);
          }
          else {
              // end
          }
      },
      // CODE93 patterns:
      c93: {
          escape: 'cU,dA,dB,dC,dD,dE,dF,dG,dH,dI,dJ,dK,dL,dM,dN,dO,dP,dQ,dR,dS,dT,dU,dV,dW,dX,dY,dZ,cA,cB,cC,cD,cE, ,sA,sB,sC,$,%,sF,sG,sH,sI,sJ,+,sL,-,.,/,0,1,2,3,4,5,6,7,8,9,sZ,cF,cG,cH,cI,cJ,cV,A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z,cK,cL,cM,cN,cO,cW,pA,pB,pC,pD,pE,pF,pG,pH,pI,pJ,pK,pL,pM,pN,pO,pP,pQ,pR,pS,pT,pU,pV,pW,pX,pY,pZ,cP,cQ,cR,cS,cT'.split(','),
          code: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%dcsp'.split('').reduce((a, c, i) => (a[c] = i, a), {}),
          element: '131112,111213,111312,111411,121113,121212,121311,111114,131211,141111,211113,211212,211311,221112,221211,231111,112113,112212,112311,122112,132111,111123,111222,111321,121122,131121,212112,212211,211122,211221,221121,222111,112122,112221,122121,123111,121131,311112,311211,321111,112131,113121,211131,121221,312111,311121,122211,111141,1111411'.split(','),
          start: 47, stop: 48
      },
      // generate CODE93 data:
      code93: function (symbol) {
          const r = {};
          let s = symbol.data.replace(/((?!^[\x00-\x7f]+$).)*/, '');
          if (s.length > 0) {
              // generate HRI
              r.hri = symbol.hri;
              r.text = s.replace(/[\x00- \x7f]/g, ' ');
              // calculate check digit
              const d = s.split('').reduce((a, c) => a + this.c93.escape[c.charCodeAt(0)], '').split('').map(c => this.c93.code[c]);
              d.push(d.reduceRight((a, c, i) => a + c * ((d.length - 1 - i) % 20 + 1)) % 47);
              d.push(d.reduceRight((a, c, i) => a + c * ((d.length - 1 - i) % 15 + 1)) % 47);
              // append start character and stop character
              d.unshift(this.c93.start);
              d.push(this.c93.stop);
              // generate bars and spaces
              const q = symbol.quietZone ? 'a' : '0';
              const m = d.reduce((a, c) => a + this.c93.element[c], q) + q;
              r.widths = m.split('').map(c => parseInt(c, 16) * symbol.width);
              r.length = symbol.width * (d.length * 9 + (symbol.quietZone ? 21 : 1));
              r.height = symbol.height;
          }
          return r;
      },
      // Codabar(NW-7) patterns:
      nw7: {
          '0': '2222255', '1': '2222552', '2': '2225225', '3': '5522222', '4': '2252252',
          '5': '5222252', '6': '2522225', '7': '2522522', '8': '2552222', '9': '5225222',
          '-': '2225522', '$': '2255222', ':': '5222525', '/': '5252225', '.': '5252522',
          '+': '2252525', 'A': '2255252', 'B': '2525225', 'C': '2225255', 'D': '2225552'
      },
      // generate Codabar(NW-7) data:
      codabar: function (symbol) {
          const r = {};
          let s = symbol.data.replace(/((?!^[A-D][0-9\-$:/.+]+[A-D]$).)*/i, '');
          if (s.length > 0) {
              // generate HRI
              r.hri = symbol.hri;
              r.text = s;
              // generate bars and spaces
              const q = symbol.quietZone ? 'a' : '0';
              const m = s.toUpperCase().split('').reduce((a, c) => a + this.nw7[c] + '2', q).slice(0, -1) + q;
              r.widths = m.split('').map(c => parseInt(c, 16) * symbol.width + 1 >> 1);
              const w = [ 25, 39, 50, 3, 5, 6 ];
              r.length = s.length * w[symbol.width - 2] - (s.match(/[\d\-$]/g) || []).length * w[symbol.width + 1] + symbol.width * (symbol.quietZone ? 19 : -1);
              r.height = symbol.height;
          }
          return r;
      },
      // Interleaved 2 of 5 patterns:
      i25: {
          element: '22552,52225,25225,55222,22525,52522,25522,22255,52252,25252'.split(','),
          start: '2222', stop: '522'
      },
      // generate Interleaved 2 of 5 data:
      itf: function (symbol) {
          const r = {};
          let s = symbol.data.replace(/((?!^(\d{2})+$).)*/, '');
          if (s.length > 0) {
              // generate HRI
              r.hri = symbol.hri;
              r.text = s;
              // generate bars and spaces
              const d = symbol.data.replace(/((?!^(\d{2})+$).)*/, '', '').split('').map(c => Number(c));
              const q = symbol.quietZone ? 'a' : '0';
              let m = q + this.i25.start;
              let i = 0;
              while (i < d.length) {
                  const b = this.i25.element[d[i++]];
                  const s = this.i25.element[d[i++]];
                  m += b.split('').reduce((a, c, j) => a + c + s[j], '');
              }
              m += this.i25.stop + q;
              r.widths = m.split('').map(c => parseInt(c, 16) * symbol.width + 1 >> 1);
              const w = [ 16, 25, 32, 17, 26, 34 ];
              r.length = s.length * w[symbol.width - 2] + w[symbol.width + 1] + symbol.width * (symbol.quietZone ? 20 : 0);
              r.height = symbol.height;
          }
          return r;
      },
      // CODE39 patterns:
      c39: {
          '0': '222552522', '1': '522522225', '2': '225522225', '3': '525522222', '4': '222552225',
          '5': '522552222', '6': '225552222', '7': '222522525', '8': '522522522', '9': '225522522',
          'A': '522225225', 'B': '225225225', 'C': '525225222', 'D': '222255225', 'E': '522255222',
          'F': '225255222', 'G': '222225525', 'H': '522225522', 'I': '225225522', 'J': '222255522',
          'K': '522222255', 'L': '225222255', 'M': '525222252', 'N': '222252255', 'O': '522252252',
          'P': '225252252', 'Q': '222222555', 'R': '522222552', 'S': '225222552', 'T': '222252552',
          'U': '552222225', 'V': '255222225', 'W': '555222222', 'X': '252252225', 'Y': '552252222',
          'Z': '255252222', '-': '252222525', '.': '552222522', ' ': '255222522', '$': '252525222',
          '/': '252522252', '+': '252225252', '%': '222525252', '*': '252252522'
      },
      // generate CODE39 data:
      code39: function (symbol) {
          const r = {};
          let s = symbol.data.replace(/((?!^\*?[0-9A-Z\-. $/+%]+\*?$).)*/, '');
          if (s.length > 0) {
              // append start character and stop character
              s = s.replace(/^\*?([^*]+)\*?$/, '*$1*');
              // generate HRI
              r.hri = symbol.hri;
              r.text = s;
              // generate bars and spaces
              const q = symbol.quietZone ? 'a' : '0';
              const m = s.split('').reduce((a, c) => a + this.c39[c] + '2', q).slice(0, -1) + q;
              r.widths = m.split('').map(c => parseInt(c, 16) * symbol.width + 1 >> 1);
              const w = [ 29, 45, 58 ];
              r.length = s.length * w[symbol.width - 2] + symbol.width * (symbol.quietZone ? 19 : -1);
              r.height = symbol.height;
          }
          return r;
      },
      // UPC/EAN/JAN patterns:
      ean: {
          a: '3211,2221,2122,1411,1132,1231,1114,1312,1213,3112'.split(','),
          b: '1123,1222,2212,1141,2311,1321,4111,2131,3121,2113'.split(','),
          c: '3211,2221,2122,1411,1132,1231,1114,1312,1213,3112'.split(','),
          g: '111,11111,111111,11,112'.split(','),
          p: 'aaaaaa,aababb,aabbab,aabbba,abaabb,abbaab,abbbaa,ababab,ababba,abbaba'.split(','),
          e: 'bbbaaa,bbabaa,bbaaba,bbaaab,babbaa,baabba,baaabb,bababa,babaab,baabab'.split(',')
      },
      // generate UPC-A data:
      upca: function (symbol) {
          const s = Object.assign({}, symbol);
          s.data = '0' + symbol.data;
          const r = this.ean13(s);
          if ('text' in r) {
              r.text = r.text.slice(1);
          }
          return r;
      },
      // generate UPC-E data:
      upce: function (symbol) {
          const r = {};
          const d = symbol.data.replace(/((?!^0\d{6,7}$).)*/, '').split('').map(c => Number(c));
          if (d.length > 0) {
              // calculate check digit
              d[7] = 0;
              d[7] = (10 - this.upcetoa(d).reduce((a, c, i) => a + c * (3 - (i % 2) * 2), 0) % 10) % 10;
              // generate HRI
              r.hri = symbol.hri;
              r.text = d.join('');
              // generate bars and spaces
              const q = symbol.quietZone ? '7' : '0';
              let m = q + this.ean.g[0];
              for (let i = 1; i < 7; i++) m += this.ean[this.ean.e[d[7]][i - 1]][d[i]];
              m += this.ean.g[2] + q;
              r.widths = m.split('').map(c => parseInt(c, 16) * symbol.width);
              r.length = symbol.width * (symbol.quietZone ? 65 : 51);
              r.height = symbol.height;
          }
          return r;
      },
      // convert UPC-E to UPC-A:
      upcetoa: e => {
          const a = e.slice(0, 3);
          switch (e[6]) {
              case 0: case 1: case 2:
                  a.push(e[6], 0, 0, 0, 0, e[3], e[4], e[5]);
                  break;
              case 3:
                  a.push(e[3], 0, 0, 0, 0, 0, e[4], e[5]);
                  break;
              case 4:
                  a.push(e[3], e[4], 0, 0, 0, 0, 0, e[5]);
                  break;
              default:
                  a.push(e[3], e[4], e[5], 0, 0, 0, 0, e[6]);
                  break;
          }
          a.push(e[7]);
          return a;
      },
      // generate EAN-13(JAN-13) data:
      ean13: function (symbol) {
          const r = {};
          const d = symbol.data.replace(/((?!^\d{12,13}$).)*/, '').split('').map(c => Number(c));
          if (d.length > 0) {
              // calculate check digit
              d[12] = 0;
              d[12] = (10 - d.reduce((a, c, i) => a + c * ((i % 2) * 2 + 1)) % 10) % 10;
              // generate HRI
              r.hri = symbol.hri;
              r.text = d.join('');
              // generate bars and spaces
              let m = (symbol.quietZone ? 'b' : '0') + this.ean.g[0];
              for (let i = 1; i < 7; i++) m += this.ean[this.ean.p[d[0]][i - 1]][d[i]];
              m += this.ean.g[1];
              for (let i = 7; i < 13; i++) m += this.ean.c[d[i]];
              m += this.ean.g[0] + (symbol.quietZone ? '7' : '0');
              r.widths = m.split('').map(c => parseInt(c, 16) * symbol.width);
              r.length = symbol.width * (symbol.quietZone ? 113 : 95);
              r.height = symbol.height;
          }
          return r;
      },
      // generate EAN-8(JAN-8) data:
      ean8: function (symbol) {
          const r = {};
          const d = symbol.data.replace(/((?!^\d{7,8}$).)*/, '').split('').map(c => Number(c));
          if (d.length > 0) {
              // calculate check digit
              d[7] = 0;
              d[7] = (10 - d.reduce((a, c, i) => a + c * (3 - (i % 2) * 2), 0) % 10) % 10;
              // generate HRI
              r.hri = symbol.hri;
              r.text = d.join('');
              // generate bars and spaces
              const q = symbol.quietZone ? '7' : '0';
              let m = q + this.ean.g[0];
              for (let i = 0; i < 4; i++) m += this.ean.a[d[i]];
              m += this.ean.g[1];
              for (let i = 4; i < 8; i++) m += this.ean.c[d[i]];
              m += this.ean.g[0] + q;
              r.widths = m.split('').map(c => parseInt(c, 16) * symbol.width);
              r.length = symbol.width * (symbol.quietZone ? 81 : 67);
              r.height = symbol.height;
          }
          return r;
      }
  };

  //
  // multilingual conversion table (cp437, cp852, cp858, cp866, cp1252)
  //
  const multitable = {};
  const multipage = {
      '\x00': 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ',
      '\x10': '€�‚ƒ„…†‡ˆ‰Š‹Œ�Ž��‘’“”•–—˜™š›œ�žŸ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ',
      '\x11': 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмноп░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀рстуфхцчшщъыьэюяЁёЄєЇїЎў°∙·√№¤■ ',
      '\x12': 'ÇüéâäůćçłëŐőîŹÄĆÉĹĺôöĽľŚśÖÜŤťŁ×čáíóúĄąŽžĘę¬źČş«»░▒▓│┤ÁÂĚŞ╣║╗╝Żż┐└┴┬├─┼Ăă╚╔╩╦╠═╬¤đĐĎËďŇÍÎě┘┌█▄ŢŮ▀ÓßÔŃńňŠšŔÚŕŰýÝţ´­˝˛ˇ˘§÷¸°¨˙űŘř■ ',
      '\x13': 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈ€ÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ '
  };
  const starpage = {
      '\x00': '\x01',
      '\x10': '\x20',
      '\x11': '\x0a',
      '\x12': '\x05',
      '\x13': '\x04'
  };
  for (const p of Object.keys(multipage)) {
      const s = multipage[p];
      for (let i = 0; i < 128; i++) {
          const c = s[i];
          if (!multitable[c]) {
              multitable[c] = p + String.fromCharCode(i + 128);
          }
      }
  }

  //
  // ESC/POS Common
  //
  const _escpos = {
      // printer configuration
      upsideDown: false,
      spacing: false,
      cutting: true,
      gradient: true,
      gamma: 1.8,
      threshold: 128,
  };

  //
  // ESC/POS Thermal
  //
  const _thermal = {
      alignment: 0,
      left: 0,
      width: 48,
      right: 0,
      margin: 0,
      marginRight: 0,
      // start printing:
      // ESC @ - Reset printer
      // GS a n  - Disable automatic status back (????)
      // ESC M n - Font A, or 'special font A' (0x61/97) for TIS6320
      // FS ( A pL pH fn m - 2, 0, 48, 0 - Kanji Font A (South America models only)
      // ESC SP n - Set right side character spacing to 0
      // FS S n1 n2 - Kanji character spacing to 0,0 (South America models only)
      // (ESC 2) - If 'spacing' is enabled use 'default' line spacing of
      // (ESC 3 n) - If 'spacing' is disabled set the line spacing to 0
      // ESC { n - Set upside-down print mode to 1 or 0 if printer.upsideDown is enabled
      // FS . - Cancel Kanji character mode
      open: function (printer) {
          this.upsideDown = printer.upsideDown;
          this.spacing = printer.spacing;
          this.cutting = printer.cutting;
          this.gradient = printer.gradient;
          this.gamma = printer.gamma;
          this.threshold = printer.threshold;
          this.alignment = 0;
          this.left = 0;
          this.width = printer.cpl;
          this.right = 0;
          this.margin = printer.margin;
          this.marginRight = printer.marginRight;
          return '\x1b@'+
          '\x1da\x00'+
          '\x1bM' + (printer.encoding === 'tis620' ? 'a' : '0') +
          + '\x1c(A' + String.fromCharCode(2, 0, 48, 0) +
          '\x1b \x00'+
          '\x1cS\x00\x00' +
          (this.spacing ? '\x1b2' : '\x1b3\x00') +
          '\x1b{' + String.fromCharCode(this.upsideDown) +
          '\x1c.';
      },
      // image split size
      split: 512,
      // print image: GS 8 L p1 p2 p3 p4 m fn a bx by c xL xH yL yH d1 ... dk GS ( L pL pH m fn
      image: function (image) {
          const align = arguments[1] || this.alignment;
          const left = arguments[2] || this.left;
          const width = arguments[3] || this.width;
          const right = arguments[4] || this.right;
          let r = this.upsideDown ? this.area(right + this.marginRight - this.margin, width, left) + this.align(2 - align) : '';
          const img = PNG.sync.read(Buffer.from(image, 'base64'));
          const w = img.width;
          const d = Array(w).fill(0);
          let j = this.upsideDown ? img.data.length - 4 : 0;
          for (let z = 0; z < img.height; z += this.split) {
              const h = Math.min(this.split, img.height - z);
              const l = (w + 7 >> 3) * h + 10;
              r += '\x1d8L' + String.fromCharCode(l & 255, l >> 8 & 255, l >> 16 & 255, l >> 24 & 255, 48, 112, 48, 1, 1, 49, w & 255, w >> 8 & 255, h & 255, h >> 8 & 255);
              for (let y = 0; y < h; y++) {
                  let i = 0, e = 0;
                  for (let x = 0; x < w; x += 8) {
                      let b = 0;
                      const q = Math.min(w - x, 8);
                      for (let p = 0; p < q; p++) {
                          const f = Math.floor((d[i] + e * 5) / 16 + Math.pow(((img.data[j] * .299 + img.data[j + 1] * .587 + img.data[j + 2] * .114 - 255) * img.data[j + 3] + 65525) / 65525, 1 / this.gamma) * 255);
                          j += this.upsideDown ? -4 : 4;
                          if (this.gradient) {
                              d[i] = e * 3;
                              e = f < this.threshold ? (b |= 128 >> p, f) : f - 255;
                              if (i > 0) {
                                  d[i - 1] += e;
                              }
                              d[i++] += e * 7;
                          }
                          else {
                              if (f < this.threshold) {
                                  b |= 128 >> p;
                              }
                          }
                      }
                      r += String.fromCharCode(b);
                  }
              }
              r += '\x1d(L' + String.fromCharCode(2, 0, 48, 50);
          }
          return r;
      },
      // print QR Code: GS ( k pL pH cn fn n1 n2 GS ( k pL pH cn fn n GS ( k pL pH cn fn n GS ( k pL pH cn fn m d1 ... dk GS ( k pL pH cn fn m
      qrcode: function (symbol, encoding) {
          if (typeof qrcode !== 'undefined') {
              let r = this.upsideDown ? this.area(this.right + this.marginRight - this.margin, this.width, this.left) + this.align(2 - this.alignment) : '';
              if (symbol.data.length > 0) {
                  const qr = qrcode(0, symbol.level.toUpperCase());
                  qr.addData(symbol.data);
                  qr.make();
                  let img = qr.createASCII(2, 0);
                  if (this.upsideDown) {
                      img = img.split('').reverse().join('');
                  }
                  img = img.split('\n');
                  const w = img.length * symbol.cell;
                  const h = w;
                  const l = (w + 7 >> 3) * h + 10;
                  r += '\x1d8L' + String.fromCharCode(l & 255, l >> 8 & 255, l >> 16 & 255, l >> 24 & 255, 48, 112, 48, 1, 1, 49, w & 255, w >> 8 & 255, h & 255, h >> 8 & 255);
                  for (let i = 0; i < img.length; i++) {
                      let d = '';
                      for (let j = 0; j < w; j += 8) {
                          let b = 0;
                          const q = Math.min(w - j, 8);
                          for (let p = 0; p < q; p++) {
                              if (img[i][Math.floor((j + p) / symbol.cell) * 2] === ' ') {
                                  b |= 128 >> p;
                              }
                          }
                          d += String.fromCharCode(b);
                      }
                      for (let k = 0; k < symbol.cell; k++) {
                          r += d;
                      }
                  }
                  r += '\x1d(L' + String.fromCharCode(2, 0, 48, 50);
              }
              return r;
          }
          else {
              const d = iconv.encode(symbol.data, encoding === 'multilingual' ? 'ascii' : encoding).toString('binary').slice(0, 7089);
              return d.length > 0 ? '\x1d(k' + String.fromCharCode(4, 0, 49, 65, 50, 0) + '\x1d(k' + String.fromCharCode(3, 0, 49, 67, symbol.cell) + '\x1d(k' + String.fromCharCode(3, 0, 49, 69, this.qrlevel[symbol.level]) + '\x1d(k' + String.fromCharCode(d.length + 3 & 255, d.length + 3 >> 8 & 255, 49, 80, 48) + d + '\x1d(k' + String.fromCharCode(3, 0, 49, 81, 48) : '';
          }
      },
      // QR Code error correction level:
      qrlevel: {
          l: 48, m: 49, q: 50, h: 51
      },
      // print barcode: GS w n GS h n GS H n GS k m n d1 ... dn
      barcode: function (symbol, encoding) {
          let d = iconv.encode(symbol.data, encoding === 'multilingual' ? 'ascii' : encoding).toString('binary');
          const b = this.bartype[symbol.type] + Number(/upc|[ej]an/.test(symbol.type) && symbol.data.length < 9);
          switch (b) {
              case this.bartype.ean:
                  d = d.slice(0, 12);
                  break;
              case this.bartype.upc:
                  d = d.slice(0, 11);
                  break;
              case this.bartype.ean + 1:
                  d = d.slice(0, 7);
                  break;
              case this.bartype.upc + 1:
                  d = this.upce(d);
                  break;
              case this.bartype.code128:
                  d = this.code128(d);
                  break;
              default:
                  break;
          }
          d = d.slice(0, 255);
          return d.length > 0 ? '\x1dw' + String.fromCharCode(symbol.width) + '\x1dh' + String.fromCharCode(symbol.height) + '\x1dH' + String.fromCharCode(symbol.hri ? 2 : 0) + '\x1dk' + String.fromCharCode(b, d.length) + d : '';
      },
      // barcode types:
      bartype: {
          upc: 65, ean: 67, jan: 67, code39: 69, itf: 70, codabar: 71, nw7: 71, code93: 72, code128: 73
      },
      // generate UPC-E data (convert UPC-E to UPC-A):
      upce: data => {
          let r = '';
          let s = data.replace(/((?!^0\d{6,7}$).)*/, '');
          if (s.length > 0) {
              r += s.slice(0, 3);
              switch (s[6]) {
                  case '0': case '1': case '2':
                      r += s[6] + '0000' + s[3] + s[4] + s[5];
                      break;
                  case '3':
                      r += s[3] + '00000' + s[4] + s[5];
                      break;
                  case '4':
                      r += s[3] + s[4] + '00000' + s[5];
                      break;
                  default:
                      r += s[3] + s[4] + s[5] + '0000' + s[6];
                      break;
              }
          }
          return r;
      },
      // CODE128 special characters:
      c128: {
          special: 123, codea: 65, codeb: 66, codec: 67, shift: 83
      },
      // generate CODE128 data (minimize symbol width):
      code128: function (data) {
          let r = '';
          let s = data.replace(/((?!^[\x00-\x7f]+$).)*/, '').replace(/{/g, '{{');
          if (s.length > 0) {
              const d = [];
              const p = s.search(/[^ -_]/);
              if (/^\d{2}$/.test(s)) {
                  d.push(this.c128.special, this.c128.codec, Number(s));
              }
              else if (/^\d{4,}/.test(s)) {
                  this.code128c(this.c128.codec, s, d);
              }
              else if (p >= 0 && s.charCodeAt(p) < 32) {
                  this.code128a(this.c128.codea, s, d);
              }
              else if (s.length > 0) {
                  this.code128b(this.c128.codeb, s, d);
              }
              else {
                  // end
              }
              r = d.reduce((a, c) => a + String.fromCharCode(c), '');
          }
          return r;
      },
      // process CODE128 code set A:
      code128a: function (x, s, d) {
          if (x !== this.c128.shift) {
              d.push(this.c128.special, x);
          }
          s = s.replace(/^((?!\d{4,})[\x00-_])+/, m => (m.split('').forEach(c => d.push(c.charCodeAt(0))), ''));
          s = s.replace(/^\d(?=(\d\d){2,}(\D|$))/, m => (d.push(m.charCodeAt(0)), ''));
          const t = s.slice(1);
          const p = t.search(/[^ -_]/);
          if (/^\d{4,}/.test(s)) {
              this.code128c(this.c128.codec, s, d);
          }
          else if (p >= 0 && t.charCodeAt(p) < 32) {
              d.push(this.c128.special, this.c128.shift, s.charCodeAt(0));
              this.code128a(this.c128.shift, t, d);
          }
          else if (s.length > 0) {
              this.code128b(this.c128.codeb, s, d);
          }
          else {
              // end
          }
      },
      // process CODE128 code set B:
      code128b: function (x, s, d) {
          if (x !== this.c128.shift) {
              d.push(this.c128.special, x);
          }
          s = s.replace(/^((?!\d{4,})[ -\x7f])+/, m => (m.split('').forEach(c => d.push(c.charCodeAt(0))), ''));
          s = s.replace(/^\d(?=(\d\d){2,}(\D|$))/, m => (d.push(m.charCodeAt(0)), ''));
          const t = s.slice(1);
          const p = t.search(/[^ -_]/);
          if (/^\d{4,}/.test(s)) {
              this.code128c(this.c128.codec, s, d);
          }
          else if (p >= 0 && t.charCodeAt(p) > 95) {
              d.push(this.c128.special, this.c128.shift, s.charCodeAt(0));
              this.code128b(this.c128.shift, t, d);
          }
          else if (s.length > 0) {
              this.code128a(this.c128.codea, s, d);
          }
          else {
              // end
          }
      },
      // process CODE128 code set C:
      code128c: function (x, s, d) {
          if (x !== this.c128.shift) {
              d.push(this.c128.special, x);
          }
          s = s.replace(/^\d{4,}/g, m => m.replace(/\d{2}/g, c => (d.push(Number(c)), '')));
          const p = s.search(/[^ -_]/);
          if (p >= 0 && s.charCodeAt(p) < 32) {
              this.code128a(this.c128.codea, s, d);
          }
          else if (s.length > 0) {
              this.code128b(this.c128.codeb, s, d);
          }
          else {
              // end
          }
      }
  };

  //
  // SII
  //
  const _sii = {
      // start printing: ESC @ GS a n ESC M n ESC SP n FS S n1 n2 (ESC 2) (ESC 3 n) ESC { n FS .
      open: function (printer) {
          this.upsideDown = printer.upsideDown;
          this.spacing = printer.spacing;
          this.cutting = printer.cutting;
          this.gradient = printer.gradient;
          this.gamma = printer.gamma;
          this.threshold = printer.threshold;
          this.alignment = 0;
          this.left = 0;
          this.width = printer.cpl;
          this.right = 0;
          this.margin = printer.margin;
          this.marginRight = printer.marginRight;
          return '\x1b@\x1da\x00\x1bM0\x1b \x00\x1cS\x00\x00' + (this.spacing ? '\x1b2' : '\x1b3\x00') + '\x1b{' + String.fromCharCode(this.upsideDown) + '\x1c.';
      },
      // finish printing: DC2 q n
      close: function () {
          return (this.cutting ? this.cut() : '') + '\x12q\x00';
      },
      // set print area: GS L nL nH GS W nL nH
      area: function (left, width, right) {
          this.left = left;
          this.width = width;
          this.right = right;
          const m = (this.upsideDown ? this.marginRight + right : this.margin + left) * this.charWidth;
          const w = width * this.charWidth;
          return '\x1dL' + String.fromCharCode(m & 255, m >> 8 & 255) + '\x1dW' + String.fromCharCode(w & 255, w >> 8 & 255);
      },
      // image split size
      split: 1662,
      // print image: GS 8 L p1 p2 p3 p4 m fn a bx by c xL xH yL yH d1 ... dk GS ( L pL pH m fn
      image: function (image) {
          const align = arguments[1] || this.alignment;
          const left = arguments[2] || this.left;
          const width = arguments[3] || this.width;
          const right = arguments[4] || this.right;
          let r = this.upsideDown ? this.area(right, width, left) + this.align(2 - align) : '';
          const img = PNG.sync.read(Buffer.from(image, 'base64'));
          const w = img.width;
          const d = Array(w).fill(0);
          let j = this.upsideDown ? img.data.length - 4 : 0;
          for (let z = 0; z < img.height; z += this.split) {
              const h = Math.min(this.split, img.height - z);
              const l = (w + 7 >> 3) * h + 10;
              r += '\x1d8L' + String.fromCharCode(l & 255, l >> 8 & 255, l >> 16 & 255, l >> 24 & 255, 48, 112, 48, 1, 1, 49, w & 255, w >> 8 & 255, h & 255, h >> 8 & 255);
              for (let y = 0; y < h; y++) {
                  let i = 0, e = 0;
                  for (let x = 0; x < w; x += 8) {
                      let b = 0;
                      const q = Math.min(w - x, 8);
                      for (let p = 0; p < q; p++) {
                          const f = Math.floor((d[i] + e * 5) / 16 + Math.pow(((img.data[j] * .299 + img.data[j + 1] * .587 + img.data[j + 2] * .114 - 255) * img.data[j + 3] + 65525) / 65525, 1 / this.gamma) * 255);
                          j += this.upsideDown ? -4 : 4;
                          if (this.gradient) {
                              d[i] = e * 3;
                              e = f < this.threshold ? (b |= 128 >> p, f) : f - 255;
                              if (i > 0) {
                                  d[i - 1] += e;
                              }
                              d[i++] += e * 7;
                          }
                          else {
                              if (f < this.threshold) {
                                  b |= 128 >> p;
                              }
                          }
                      }
                      r += String.fromCharCode(b);
                  }
              }
              r += '\x1d(L' + String.fromCharCode(2, 0, 48, 50);
          }
          return r;
      },
      // print QR Code: DC2 ; n GS p 1 model e v mode nl nh dk
      qrcode: function (symbol, encoding) {
          if (typeof qrcode !== 'undefined') {
              let r = this.upsideDown ? this.area(this.right, this.width, this.left) + this.align(2 - this.alignment) : '';
              if (symbol.data.length > 0) {
                  const qr = qrcode(0, symbol.level.toUpperCase());
                  qr.addData(symbol.data);
                  qr.make();
                  let img = qr.createASCII(2, 0);
                  if (this.upsideDown) {
                      img = img.split('').reverse().join('');
                  }
                  img = img.split('\n');
                  const w = img.length * symbol.cell;
                  const h = w;
                  const l = (w + 7 >> 3) * h + 10;
                  r += '\x1d8L' + String.fromCharCode(l & 255, l >> 8 & 255, l >> 16 & 255, l >> 24 & 255, 48, 112, 48, 1, 1, 49, w & 255, w >> 8 & 255, h & 255, h >> 8 & 255);
                  for (let i = 0; i < img.length; i++) {
                      let d = '';
                      for (let j = 0; j < w; j += 8) {
                          let b = 0;
                          const q = Math.min(w - j, 8);
                          for (let p = 0; p < q; p++) {
                              if (img[i][Math.floor((j + p) / symbol.cell) * 2] === ' ') {
                                  b |= 128 >> p;
                              }
                          }
                          d += String.fromCharCode(b);
                      }
                      for (let k = 0; k < symbol.cell; k++) {
                          r += d;
                      }
                  }
                  r += '\x1d(L' + String.fromCharCode(2, 0, 48, 50);
              }
              return r;
          }
          else {
              const d = iconv.encode(symbol.data, encoding === 'multilingual' ? 'ascii' : encoding).toString('binary').slice(0, 7089);
              return d.length > 0 ? '\x12;' + String.fromCharCode(symbol.cell) + '\x1dp' + String.fromCharCode(1, 2, this.qrlevel[symbol.level], 0, 77, d.length & 255, d.length >> 8 & 255) + d : '';
          }
      },
      // QR Code error correction levels:
      qrlevel: {
          l: 76, m: 77, q: 81, h: 72
      },
      // print barcode: GS w n GS h n GS H n GS k m n d1 ... dn
      barcode: function (symbol, encoding) {
          let d = iconv.encode(symbol.data, encoding === 'multilingual' ? 'ascii' : encoding).toString('binary');
          const b = this.bartype[symbol.type] + Number(/upc|[ej]an/.test(symbol.type) && symbol.data.length < 9);
          switch (b) {
              case this.bartype.upc + 1:
                  d = this.upce(d);
                  break;
              case this.bartype.codabar:
                  d = this.codabar(d);
                  break;
              case this.bartype.code93:
                  d = this.code93(d);
                  break;
              case this.bartype.code128:
                  d = this.code128(d);
                  break;
              default:
                  break;
          }
          d = d.slice(0, 255);
          return d.length > 0 ? '\x1dw' + String.fromCharCode(symbol.width) + '\x1dh' + String.fromCharCode(symbol.height) + '\x1dH' + String.fromCharCode(symbol.hri ? 2 : 0) + '\x1dk' + String.fromCharCode(b, d.length) + d : '';
      },
      // generate Codabar data:
      codabar: data => data.toUpperCase(),
      // CODE93 special characters:
      c93: {
          escape: 'cU,dA,dB,dC,dD,dE,dF,dG,dH,dI,dJ,dK,dL,dM,dN,dO,dP,dQ,dR,dS,dT,dU,dV,dW,dX,dY,dZ,cA,cB,cC,cD,cE, ,sA,sB,sC,$,%,sF,sG,sH,sI,sJ,+,sL,-,.,/,0,1,2,3,4,5,6,7,8,9,sZ,cF,cG,cH,cI,cJ,cV,A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z,cK,cL,cM,cN,cO,cW,pA,pB,pC,pD,pE,pF,pG,pH,pI,pJ,pK,pL,pM,pN,pO,pP,pQ,pR,pS,pT,pU,pV,pW,pX,pY,pZ,cP,cQ,cR,cS,cT'.split(','),
          code: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%dcsp'.split('').reduce((a, c, i) => (a[c] = i, a), {}),
          start: 47, stop: 48
      },
      // generate CODE93 data:
      code93: function (data) {
          let r = '';
          let s = data.replace(/((?!^[\x00-\x7f]+$).)*/, '');
          if (s.length > 0) {
              const d = s.split('').reduce((a, c) => a + this.c93.escape[c.charCodeAt(0)], '').split('').map(c => this.c93.code[c]);
              d.push(this.c93.stop);
              r = d.reduce((a, c) => a + String.fromCharCode(c), '');
          }
          return r;
      },
      // CODE128 special characters:
      c128: {
          starta: 103, startb: 104, startc: 105, atob: 100, atoc: 99, btoa: 101, btoc: 99, ctoa: 101, ctob: 100, shift: 98, stop: 105
      },
      // generate CODE128 data (minimize symbol width):
      code128: function (data) {
          let r = '';
          let s = data.replace(/((?!^[\x00-\x7f]+$).)*/, '');
          if (s.length > 0) {
              const d = [];
              const p = s.search(/[^ -_]/);
              if (/^\d{2}$/.test(s)) {
                  d.push(this.c128.startc, Number(s));
              }
              else if (/^\d{4,}/.test(s)) {
                  this.code128c(this.c128.startc, s, d);
              }
              else if (p >= 0 && s.charCodeAt(p) < 32) {
                  this.code128a(this.c128.starta, s, d);
              }
              else if (s.length > 0) {
                  this.code128b(this.c128.startb, s, d);
              }
              else {
                  // end
              }
              d.push(this.c128.stop);
              r = d.reduce((a, c) => a + String.fromCharCode(c), '');
          }
          return r;
      },
      // process CODE128 code set A:
      code128a: function (x, s, d) {
          if (x !== this.c128.shift) {
              d.push(x);
          }
          s = s.replace(/^((?!\d{4,})[\x00-_])+/, m => (m.split('').forEach(c => d.push((c.charCodeAt(0) + 64) % 96)), ''));
          s = s.replace(/^\d(?=(\d\d){2,}(\D|$))/, m => (d.push((m.charCodeAt(0) + 64) % 96), ''));
          const t = s.slice(1);
          const p = t.search(/[^ -_]/);
          if (/^\d{4,}/.test(s)) {
              this.code128c(this.c128.atoc, s, d);
          }
          else if (p >= 0 && t.charCodeAt(p) < 32) {
              d.push(this.c128.shift, s.charCodeAt(0) - 32);
              this.code128a(this.c128.shift, t, d);
          }
          else if (s.length > 0) {
              this.code128b(this.c128.atob, s, d);
          }
          else {
              // end
          }
      },
      // process CODE128 code set B:
      code128b: function (x, s, d) {
          if (x !== this.c128.shift) {
              d.push(x);
          }
          s = s.replace(/^((?!\d{4,})[ -\x7f])+/, m => (m.split('').forEach(c => d.push(c.charCodeAt(0) - 32)), ''));
          s = s.replace(/^\d(?=(\d\d){2,}(\D|$))/, m => (d.push(m.charCodeAt(0) - 32), ''));
          const t = s.slice(1);
          const p = t.search(/[^ -_]/);
          if (/^\d{4,}/.test(s)) {
              this.code128c(this.c128.btoc, s, d);
          }
          else if (p >= 0 && t.charCodeAt(p) > 95) {
              d.push(this.c128.shift, s.charCodeAt(0) + 64);
              this.code128b(this.c128.shift, t, d);
          }
          else if (s.length > 0) {
              this.code128a(this.c128.btoa, s, d);
          }
          else {
              // end
          }
      },
      // process CODE128 code set c:
      code128c: function (x, s, d) {
          if (x !== this.c128.shift) {
              d.push(x);
          }
          s = s.replace(/^\d{4,}/g, m => m.replace(/\d{2}/g, c => (d.push(Number(c)), '')));
          const p = s.search(/[^ -_]/);
          if (p >= 0 && s.charCodeAt(p) < 32) {
              this.code128a(this.c128.ctoa, s, d);
          }
          else if (s.length > 0) {
              this.code128b(this.c128.ctob, s, d);
          }
          else {
              // end
          }
      }
  };

  //
  // Citizen
  //
  const _citizen = {
      // image split size
      split: 1662,
      // print barcode: GS w n GS h n GS H n GS k m n d1 ... dn
      barcode: function (symbol, encoding) {
          let d = iconv.encode(symbol.data, encoding === 'multilingual' ? 'ascii' : encoding).toString('binary');
          const b = this.bartype[symbol.type] + Number(/upc|[ej]an/.test(symbol.type) && symbol.data.length < 9);
          switch (b) {
              case this.bartype.ean:
                  d = d.slice(0, 12);
                  break;
              case this.bartype.upc:
                  d = d.slice(0, 11);
                  break;
              case this.bartype.ean + 1:
                  d = d.slice(0, 7);
                  break;
              case this.bartype.upc + 1:
                  d = this.upce(d);
                  break;
              case this.bartype.codabar:
                  d = this.codabar(d);
                  break;
              case this.bartype.code128:
                  d = this.code128(d);
                  break;
              default:
                  break;
          }
          d = d.slice(0, 255);
          return d.length > 0 ? '\x1dw' + String.fromCharCode(symbol.width) + '\x1dh' + String.fromCharCode(symbol.height) + '\x1dH' + String.fromCharCode(symbol.hri ? 2 : 0) + '\x1dk' + String.fromCharCode(b, d.length) + d : '';
      },
      // generate Codabar data:
      codabar: data => data.toUpperCase()
  };

  //
  // Fujitsu Isotec
  //
  const _fit = {
      // image split size
      split: 1662,
      // print image: GS 8 L p1 p2 p3 p4 m fn a bx by c xL xH yL yH d1 ... dk GS ( L pL pH m fn
      image: function (image) {
          const align = arguments[1] || this.alignment;
          const left = arguments[2] || this.left;
          const width = arguments[3] || this.width;
          const right = arguments[4] || this.right;
          const img = PNG.sync.read(Buffer.from(image, 'base64'));
          const w = img.width;
          const d = Array(w).fill(0);
          const s = [];
          let j = 0;
          for (let z = 0; z < img.height; z += this.split) {
              const h = Math.min(this.split, img.height - z);
              const l = (w + 7 >> 3) * h + 10;
              let r = '\x1d8L' + String.fromCharCode(l & 255, l >> 8 & 255, l >> 16 & 255, l >> 24 & 255, 48, 112, 48, 1, 1, 49, w & 255, w >> 8 & 255, h & 255, h >> 8 & 255);
              for (let y = 0; y < h; y++) {
                  let i = 0, e = 0;
                  for (let x = 0; x < w; x += 8) {
                      let b = 0;
                      const q = Math.min(w - x, 8);
                      for (let p = 0; p < q; p++) {
                          const f = Math.floor((d[i] + e * 5) / 16 + Math.pow(((img.data[j] * .299 + img.data[j + 1] * .587 + img.data[j + 2] * .114 - 255) * img.data[j + 3] + 65525) / 65525, 1 / this.gamma) * 255);
                          j += 4;
                          if (this.gradient) {
                              d[i] = e * 3;
                              e = f < this.threshold ? (b |= 128 >> p, f) : f - 255;
                              if (i > 0) {
                                  d[i - 1] += e;
                              }
                              d[i++] += e * 7;
                          }
                          else {
                              if (f < this.threshold) {
                                  b |= 128 >> p;
                              }
                          }
                      }
                      r += String.fromCharCode(b);
                  }
              }
              r += '\x1d(L' + String.fromCharCode(2, 0, 48, 50);
              s.push(r);
          }
          if (this.upsideDown) {
              s.reverse();
          }
          return (this.upsideDown && align === 2 ? this.area(right, width, left) : '') + s.join('');
      },
      // print QR Code: GS ( k pL pH cn fn n1 n2 GS ( k pL pH cn fn n GS ( k pL pH cn fn n GS ( k pL pH cn fn m d1 ... dk GS ( k pL pH cn fn m
      qrcode: function (symbol, encoding) {
          if (typeof qrcode !== 'undefined') {
              let r = this.upsideDown && this.alignment === 2 ? this.area(this.right, this.width, this.left) : '';
              if (symbol.data.length > 0) {
                  const qr = qrcode(0, symbol.level.toUpperCase());
                  qr.addData(symbol.data);
                  qr.make();
                  const img = qr.createASCII(2, 0).split('\n');
                  const w = img.length * symbol.cell;
                  const h = w;
                  const l = (w + 7 >> 3) * h + 10;
                  r += '\x1d8L' + String.fromCharCode(l & 255, l >> 8 & 255, l >> 16 & 255, l >> 24 & 255, 48, 112, 48, 1, 1, 49, w & 255, w >> 8 & 255, h & 255, h >> 8 & 255);
                  for (let i = 0; i < img.length; i++) {
                      let d = '';
                      for (let j = 0; j < w; j += 8) {
                          let b = 0;
                          const q = Math.min(w - j, 8);
                          for (let p = 0; p < q; p++) {
                              if (img[i][Math.floor((j + p) / symbol.cell) * 2] === ' ') {
                                  b |= 128 >> p;
                              }
                          }
                          d += String.fromCharCode(b);
                      }
                      for (let k = 0; k < symbol.cell; k++) {
                          r += d;
                      }
                  }
                  r += '\x1d(L' + String.fromCharCode(2, 0, 48, 50);
              }
              return r;
          }
          else {
              const d = iconv.encode(symbol.data, encoding === 'multilingual' ? 'ascii' : encoding).toString('binary').slice(0, 7089);
              return d.length > 0 ? '\x1d(k' + String.fromCharCode(4, 0, 49, 65, 50, 0) + '\x1d(k' + String.fromCharCode(3, 0, 49, 67, symbol.cell) + '\x1d(k' + String.fromCharCode(3, 0, 49, 69, this.qrlevel[symbol.level]) + '\x1d(k' + String.fromCharCode(d.length + 3 & 255, d.length + 3 >> 8 & 255, 49, 80, 48) + d + '\x1d(k' + String.fromCharCode(3, 0, 49, 81, 48) : '';
          }
      }
  };

  //
  // ESC/POS Impact
  //
  const _impact = {
      font: 0,
      style: 0,
      color: 0,
      left: 0,
      right: 0,
      position: 0,
      margin: 0,
      marginRight: 0,
      red: [],
      black: [],
      // start printing: ESC @ GS a n ESC M n (ESC 2) (ESC 3 n) ESC { n
      open: function (printer) {
          this.style = this.font;
          this.color = 0;
          this.left = 0;
          this.right = 0;
          this.position = 0;
          this.margin = printer.margin;
          this.marginRight = printer.marginRight;
          this.red = [];
          this.black = [];
          this.upsideDown = printer.upsideDown;
          this.spacing = printer.spacing;
          this.cutting = printer.cutting;
          this.gradient = printer.gradient;
          this.gamma = printer.gamma;
          this.threshold = printer.threshold;
          return '\x1b@\x1da\x00\x1bM' + String.fromCharCode(this.font) + (this.spacing ? '\x1b2' : '\x1b3\x12') + '\x1b{' + String.fromCharCode(this.upsideDown) + '\x1c.';
      },
      // finish printing: GS r n
      close: function () {
          return (this.cutting ? this.cut() : '') + '\x1dr1';
      },
      // set print area:
      area: function (left, width, right) {
          this.left = this.margin + left;
          this.right = right + this.marginRight;
          return '';
      },
      // set line alignment: ESC a n
      align: align => '\x1ba' + String.fromCharCode(align),
      // set absolute print position:
      absolute: function (position) {
          this.position = position;
          return '';
      },
      // set relative print position:
      relative: function (position) {
          this.position += Math.round(position);
          return '';
      },
      // print horizontal rule: ESC t n ...
      hr: function (width) {
          return '\x1b!' + String.fromCharCode(this.font) + ' '.repeat(this.left) + '\x1bt\x01' + '\x95'.repeat(width);
      },
      // print vertical rules: ESC ! n ESC t n ...
      vr: function (widths, height) {
          const d = '\x1b!' + String.fromCharCode(this.font + (height > 1 ? 16 : 0)) + '\x1bt\x01\x96';
          this.black.push({ data: d, index: this.position, length: 1 });
          widths.forEach(w => {
              this.position += w + 1;
              this.black.push({ data: d, index: this.position, length: 1 });
          });
          return '';
      },
      // start rules: ESC ! n ESC t n ...
      vrstart: function (widths) {
          return '\x1b!' + String.fromCharCode(this.font) + ' '.repeat(this.left) + '\x1bt\x01' + widths.reduce((a, w) => a + '\x95'.repeat(w) + '\x91', '\x9c').slice(0, -1) + '\x9d';
      },
      // stop rules: ESC ! n ESC t n ...
      vrstop: function (widths) {
          return '\x1b!' + String.fromCharCode(this.font) + ' '.repeat(this.left) + '\x1bt\x01' + widths.reduce((a, w) => a + '\x95'.repeat(w) + '\x90', '\x9e').slice(0, -1) + '\x9f';
      },
      // print vertical and horizontal rules: ESC ! n ESC t n ...
      vrhr: function (widths1, widths2, dl, dr) {
          const r1 = ' '.repeat(Math.max(-dl, 0)) + widths1.reduce((a, w) => a + '\x95'.repeat(w) + '\x90', dl > 0 ? '\x9e' : '\x9a').slice(0, -1) + (dr < 0 ? '\x9f' : '\x9b') + ' '.repeat(Math.max(dr, 0));
          const r2 = ' '.repeat(Math.max(dl, 0)) + widths2.reduce((a, w) => a + '\x95'.repeat(w) + '\x91', dl < 0 ? '\x9c' : '\x98').slice(0, -1) + (dr > 0 ? '\x9d' : '\x99') + ' '.repeat(Math.max(-dr, 0));
          return '\x1b!' + String.fromCharCode(this.font) + ' '.repeat(this.left) + '\x1bt\x01' + r2.split('').reduce((a, c, i) => a + this.vrtable[c][r1[i]], '');
      },
      // set line spacing and feed new line: (ESC 2) (ESC 3 n)
      vrlf: function (vr) {
          return (vr === this.upsideDown && this.spacing ? '\x1b2' : '\x1b3\x12') + this.lf();
      },
      // cut paper: GS V m n
      cut: () => '\x1dVB\x00',
      // underline text:
      ul: function () {
          this.style += 128;
          return '';
      },
      // emphasize text:
      em: function () {
          this.style += 8;
          return '';
      },
      // invert text:
      iv: function () {
          this.color = 1;
          return '';
      },
      // scale up text:
      wh: function (wh) {
          if (wh > 0) {
              this.style += wh < 3 ? 64 >> wh : 48;
          }
          return '';
      },
      // cancel text decoration:
      normal: function () {
          this.style = this.font;
          this.color = 0;
          return '';
      },
      // print text:
      text: function (text, encoding) {
          const t = iconv.encode(text, encoding === 'multilingual' ? 'ascii' : encoding).toString('binary');
          const d = '\x1b!' + String.fromCharCode(this.style) + (encoding === 'multilingual' ? this.multiconv(text) : this.codepage[encoding] + iconv.encode(text, encoding).toString('binary'));
          const l = t.length * (this.style & 32 ? 2 : 1);
          if (this.color > 0) {
              this.red.push({ data: d, index: this.position, length: l });
          }
          else {
              this.black.push({ data: d, index: this.position, length: l });
          }
          this.position += l;
          return '';
      },
      // feed new line: LF
      lf: function () {
          let r = '';
          if (this.red.length > 0) {
              let p = 0;
              r += this.red.sort((a, b) => a.index - b.index).reduce((a, c) => {
                  const s = a + '\x1b!' + String.fromCharCode(this.font) + ' '.repeat(c.index - p) + c.data;
                  p = c.index + c.length;
                  return s;
              }, '\x1br\x01\x1b!' + String.fromCharCode(this.font) + ' '.repeat(this.left)) + '\x0d\x1br\x00';
          }
          if (this.black.length > 0) {
              let p = 0;
              r += this.black.sort((a, b) => a.index - b.index).reduce((a, c) => {
                  const s = a + '\x1b!' + String.fromCharCode(this.font) + ' '.repeat(c.index - p) + c.data;
                  p = c.index + c.length;
                  return s;
              }, '\x1b!' + String.fromCharCode(this.font) + ' '.repeat(this.left));
          }
          r += '\x0a';
          this.position = 0;
          this.red = [];
          this.black = [];
          return r;
      },
      // insert commands:
      command: command => command,
      // print image: ESC * 0 wL wH d1 ... dk ESC J n
      image: function (image) {
          let r = '';
          const img = PNG.sync.read(Buffer.from(image, 'base64'));
          const w = img.width;
          if (w < 1024) {
              const d = Array(w).fill(0);
              let j = this.upsideDown ? img.data.length - 4 : 0;
              for (let y = 0; y < img.height; y += 8) {
                  const b = Array(w).fill(0);
                  const h = Math.min(8, img.height - y);
                  for (let p = 0; p < h; p++) {
                      let i = 0, e = 0;
                      for (let x = 0; x < w; x++) {
                          const f = Math.floor((d[i] + e * 5) / 16 + Math.pow(((img.data[j] * .299 + img.data[j + 1] * .587 + img.data[j + 2] * .114 - 255) * img.data[j + 3] + 65525) / 65525, 1 / this.gamma) * 255);
                          j += this.upsideDown ? -4 : 4;
                          if (this.gradient) {
                              d[i] = e * 3;
                              e = f < this.threshold ? (this.upsideDown ? b[w - x - 1] |= 1 << p : b[x] |= 128 >> p, f) : f - 255;
                              if (i > 0) {
                                  d[i - 1] += e;
                              }
                              d[i++] += e * 7;
                          }
                          else {
                              if (f < this.threshold) {
                                  this.upsideDown ? b[w - x - 1] |= 1 << p : b[x] |= 128 >> p;
                              }
                          }
                      }
                  }
                  r += ' '.repeat(this.left) + '\x1b*\x00' + String.fromCharCode(w & 255, w >> 8 & 255) + b.reduce((a, c) => a + String.fromCharCode(c), '') + ' '.repeat(this.right) + '\x1bJ' + String.fromCharCode(h * 2);
              }
          }
          return r;
      }
  };

  //
  // ESC/POS Impact Font B
  //
  const _fontb = {
      font: 1
  };

  //
  // StarPRNT Common
  //
  const _star = {
      // printer configuration
      upsideDown: false,
      spacing: false,
      cutting: true,
      gradient: true,
      gamma: 1.8,
      threshold: 128,
      margin: 0,
      // start printing: ESC @ ESC RS a n (ESC RS R n) ESC RS F n ESC SP n ESC s n1 n2 (ESC z n) (ESC 0) (SI) (DC2)
      open: function (printer) {
          this.upsideDown = printer.upsideDown;
          this.spacing = printer.spacing;
          this.cutting = printer.cutting;
          this.gradient = printer.gradient;
          this.gamma = printer.gamma;
          this.threshold = printer.threshold;
          this.margin = printer.margin;
          return '\x1b@\x1b\x1ea\x00' + (printer.encoding === 'tis620' ? '\x1b\x1eR\x01': '') + '\x1b\x1eF\x00\x1b 0\x1bs00' + (this.spacing ? '\x1bz1' : '\x1b0') + (this.upsideDown ? '\x0f' : '\x12');
      },
      // finish printing: ESC GS ETX s n1 n2
      close: function () {
          return (this.cutting ? this.cut() : '') + '\x1b\x1d\x03\x01\x00\x00';
      },
      // set print area: ESC l n ESC Q n
      area: function (left, width, right) {
          return '\x1bl' + String.fromCharCode(0) + '\x1bQ' + String.fromCharCode(this.margin + left + width + right) + '\x1bl' + String.fromCharCode(this.margin + left) + '\x1bQ' + String.fromCharCode(this.margin + left + width);
      },
      // set line alignment: ESC GS a n
      align: align => '\x1b\x1da' + String.fromCharCode(align),
      // set absolute print position: ESC GS A n1 n2
      absolute: function (position) {
          const p = position * this.charWidth;
          return '\x1b\x1dA' + String.fromCharCode(p & 255, p >> 8 & 255);
      },
      // set relative print position: ESC GS R n1 n2
      relative: function (position) {
          const p = position * this.charWidth;
          return '\x1b\x1dR' + String.fromCharCode(p & 255, p >> 8 & 255);
      },
      // set line spacing and feed new line: (ESC z n) (ESC 0)
      vrlf: function (vr) {
          return (this.upsideDown ? this.lf() : '') + (vr === this.upsideDown && this.spacing ? '\x1bz1' : '\x1b0') + (this.upsideDown ? '' : this.lf());
      },
      // cut paper: ESC d n
      cut: () => '\x1bd3',
      // underline text: ESC - n
      ul: () => '\x1b-1',
      // emphasize text: ESC E
      em: () => '\x1bE',
      // invert text: ESC 4
      iv: () => '\x1b4',
      // scale up text: ESC i n1 n2
      wh: wh => '\x1bi' + (wh < 3 ? String.fromCharCode(wh >> 1 & 1, wh & 1) : String.fromCharCode(wh - 2, wh - 2)),
      // cancel text decoration: ESC - n ESC F ESC 5 ESC i n1 n2
      normal: () => '\x1b-0\x1bF\x1b5\x1bi' + String.fromCharCode(0, 0),
      // print text:
      text: function (text, encoding) {
          return encoding === 'multilingual' ? this.multiconv(text) : this.codepage[encoding] + iconv.encode(text, encoding).toString('binary');
      },
      // codepages: (ESC GS t n) (ESC $ n) (ESC R n)
      codepage: {
          cp437: '\x1b\x1dt\x01', cp852: '\x1b\x1dt\x05', cp858: '\x1b\x1dt\x04', cp860: '\x1b\x1dt\x06',
          cp863: '\x1b\x1dt\x08', cp865: '\x1b\x1dt\x09', cp866: '\x1b\x1dt\x0a', cp1252: '\x1b\x1dt\x20',
          cp932: '\x1b$1\x1bR8', cp936: '', cp949: '\x1bRD', cp950: '',
          shiftjis: '\x1b$1\x1bR8', gb18030: '', ksc5601: '\x1bRD', big5: '', tis620: '\x1b\x1dt\x61'
      },
      // convert to multiple codepage characters: (ESC GS t n)
      multiconv: text => {
          let p = '', r = '';
          for (let i = 0; i < text.length; i++) {
              const c = text[i];
              if (c > '\x7f') {
                  const d = multitable[c];
                  if (d) {
                      const q = d[0];
                      if (p === q) {
                          r += d[1];
                      }
                      else {
                          r += '\x1b\x1dt' + starpage[q] + d[1];
                          p = q;
                      }
                  }
                  else {
                      r += '?';
                  }
              }
              else {
                  r += c;
              }
          }
          return r;
      },
      // feed new line: LF
      lf: () => '\x0a',
      // insert commands:
      command: command => command,
      // image split size
      split: 2400,
      // print image: ESC GS S m xL xH yL yH n [d11 d12 ... d1k]
      image: function (image) {
          const img = PNG.sync.read(Buffer.from(image, 'base64'));
          const w = img.width;
          const d = Array(w).fill(0);
          const l = w + 7 >> 3;
          const s = [];
          let j = 0;
          for (let z = 0; z < img.height; z += this.split) {
              const h = Math.min(this.split, img.height - z);
              let r = '\x1b\x1dS' + String.fromCharCode(1, l & 255, l >> 8 & 255, h & 255, h >> 8 & 255, 0);
              for (let y = 0; y < h; y++) {
                  let i = 0, e = 0;
                  for (let x = 0; x < w; x += 8) {
                      let b = 0;
                      const q = Math.min(w - x, 8);
                      for (let p = 0; p < q; p++) {
                          const f = Math.floor((d[i] + e * 5) / 16 + Math.pow(((img.data[j] * .299 + img.data[j + 1] * .587 + img.data[j + 2] * .114 - 255) * img.data[j + 3] + 65525) / 65525, 1 / this.gamma) * 255);
                          j += 4;
                          if (this.gradient) {
                              d[i] = e * 3;
                              e = f < this.threshold ? (b |= 128 >> p, f) : f - 255;
                              if (i > 0) {
                                  d[i - 1] += e;
                              }
                              d[i++] += e * 7;
                          }
                          else {
                              if (f < this.threshold) {
                                  b |= 128 >> p;
                              }
                          }
                      }
                      r += String.fromCharCode(b);
                  }
              }
              s.push(r);
          }
          if (this.upsideDown) {
              s.reverse();
          }
          return s.join('');
      },
      // print QR Code: ESC GS y S 0 n ESC GS y S 1 n ESC GS y S 2 n ESC GS y D 1 m nL nH d1 d2 ... dk ESC GS y P
      qrcode: function (symbol, encoding) {
          if (typeof qrcode !== 'undefined') {
              let r = '';
              if (symbol.data.length > 0) {
                  const qr = qrcode(0, symbol.level.toUpperCase());
                  qr.addData(symbol.data);
                  qr.make();
                  const img = qr.createASCII(2, 0).split('\n');
                  const w = img.length * symbol.cell;
                  const h = w;
                  const l = w + 7 >> 3;
                  r += '\x1b\x1dS' + String.fromCharCode(1, l & 255, l >> 8 & 255, h & 255, h >> 8 & 255, 0);
                  for (let i = 0; i < img.length; i++) {
                      let d = '';
                      for (let j = 0; j < w; j += 8) {
                          let b = 0;
                          const q = Math.min(w - j, 8);
                          for (let p = 0; p < q; p++) {
                              if (img[i][Math.floor((j + p) / symbol.cell) * 2] === ' ') {
                                  b |= 128 >> p;
                              }
                          }
                          d += String.fromCharCode(b);
                      }
                      for (let k = 0; k < symbol.cell; k++) {
                          r += d;
                      }
                  }
              }
              return r;
          }
          else {
              const d = iconv.encode(symbol.data, encoding === 'multilingual' ? 'ascii' : encoding).toString('binary').slice(0, 7089);
              return d.length > 0 ? '\x1b\x1dyS0' + String.fromCharCode(2) + '\x1b\x1dyS1' + String.fromCharCode(this.qrlevel[symbol.level]) + '\x1b\x1dyS2' + String.fromCharCode(symbol.cell) + '\x1b\x1dyD1' + String.fromCharCode(0, d.length & 255, d.length >> 8 & 255) + d + '\x1b\x1dyP' : '';
          }
      },
      // QR Code error correction levels:
      qrlevel: {
          l: 0, m: 1, q: 2, h: 3
      },
      // print barcode: ESC b n1 n2 n3 n4 d1 ... dk RS
      barcode: function (symbol, encoding) {
          let d = iconv.encode(symbol.data, encoding === 'multilingual' ? 'ascii' : encoding).toString('binary');
          const b = this.bartype[symbol.type] - Number(/upc|[ej]an/.test(symbol.type) && symbol.data.length < 9);
          switch (b) {
              case this.bartype.upc - 1:
                  d = this.upce(d);
                  break;
              case this.bartype.code128:
                  d = this.code128(d);
                  break;
              default:
                  break;
          }
          const u = symbol.type === 'itf' ? [ 49, 56, 50 ][symbol.width - 2] : symbol.width + (/^(code39|codabar|nw7)$/.test(symbol.type) ? 50 : 47);
          return d.length > 0 ? '\x1bb' + String.fromCharCode(b, symbol.hri ? 50 : 49, u, symbol.height) + d + '\x1e' : '';
      },
      // barcode types:
      bartype: {
          upc: 49, ean: 51, jan: 51, code39: 52, itf: 53, codabar: 56, nw7: 56, code93: 55, code128: 54
      },
      // generate UPC-E data (convert UPC-E to UPC-A):
      upce: data => {
          let r = '';
          let s = data.replace(/((?!^0\d{6,7}$).)*/, '');
          if (s.length > 0) {
              r += s.slice(0, 3);
              switch (s[6]) {
                  case '0': case '1': case '2':
                      r += s[6] + '0000' + s[3] + s[4] + s[5];
                      break;
                  case '3':
                      r += s[3] + '00000' + s[4] + s[5];
                      break;
                  case '4':
                      r += s[3] + s[4] + '00000' + s[5];
                      break;
                  default:
                      r += s[3] + s[4] + s[5] + '0000' + s[6];
                      break;
              }
          }
          return r;
      },
      // generate CODE128 data:
      code128: data => data.replace(/((?!^[\x00-\x7f]+$).)*/, '').replace(/%/g, '%0').replace(/[\x00-\x1f]/g, m => '%' + String.fromCharCode(m.charCodeAt(0) + 64)).replace(/\x7f/g, '%5')
  };

  //
  // Star Line Mode
  //
  const _line = {
      // finish printing: ESC GS ETX s n1 n2 EOT
      close: function () {
          return (this.cutting ? this.cut() : '') + '\x1b\x1d\x03\x01\x00\x00\x04';
      },
      // print image: ESC k n1 n2 d1 ... dk
      image: function (image) {
          const img = PNG.sync.read(Buffer.from(image, 'base64'));
          const w = img.width;
          const h = img.height;
          const d = Array(w).fill(0);
          const l = w + 7 >> 3;
          const s = [];
          let j = 0;
          for (let y = 0; y < h; y += 24) {
              let r = '\x1bk' + String.fromCharCode(l & 255, l >> 8 & 255);
              for (let z = 0; z < 24; z++) {
                  if (y + z < h) {
                      let i = 0, e = 0;
                      for (let x = 0; x < w; x += 8) {
                          let b = 0;
                          const q = Math.min(w - x, 8);
                          for (let p = 0; p < q; p++) {
                              const f = Math.floor((d[i] + e * 5) / 16 + Math.pow(((img.data[j] * .299 + img.data[j + 1] * .587 + img.data[j + 2] * .114 - 255) * img.data[j + 3] + 65525) / 65525, 1 / this.gamma) * 255);
                              j += 4;
                              if (this.gradient) {
                                  d[i] = e * 3;
                                  e = f < this.threshold ? (b |= 128 >> p, f) : f - 255;
                                  if (i > 0) {
                                      d[i - 1] += e;
                                  }
                                  d[i++] += e * 7;
                              }
                              else {
                                  if (f < this.threshold) {
                                      b |= 128 >> p;
                                  }
                              }
                          }
                          r += String.fromCharCode(b);
                      }
                  }
                  else {
                      r += '\x00'.repeat(l);
                  }
              }
              s.push(r + '\x0a');
          }
          if (this.upsideDown) {
              s.reverse();
          }
          return '\x1b0' + s.join('') + (this.spacing ? '\x1bz1' : '\x1b0');
      },
      // print QR Code: ESC GS y S 0 n ESC GS y S 1 n ESC GS y S 2 n ESC GS y D 1 m nL nH d1 d2 ... dk ESC GS y P
      qrcode: function (symbol, encoding) {
          if (typeof qrcode !== 'undefined') {
              let r = '';
              if (symbol.data.length > 0) {
                  const qr = qrcode(0, symbol.level.toUpperCase());
                  qr.addData(symbol.data);
                  qr.make();
                  const img = qr.createASCII(2, 0).split('\n');
                  const w = img.length * symbol.cell;
                  const l = w + 7 >> 3;
                  const s = [];
                  for (let i = 0; i < img.length; i++) {
                      let d = '';
                      for (let j = 0; j < w; j += 8) {
                          let b = 0;
                          const q = Math.min(w - j, 8);
                          for (let p = 0; p < q; p++) {
                              if (img[i][Math.floor((j + p) / symbol.cell) * 2] === ' ') {
                                  b |= 128 >> p;
                              }
                          }
                          d += String.fromCharCode(b);
                      }
                      for (let k = 0; k < symbol.cell; k++) {
                          s.push(d);
                      }
                  }
                  while (s.length % 24) {
                      const d = '\x00'.repeat(l);
                      s.push(d);
                  }
                  if (this.upsideDown) {
                      s.reverse();
                  }
                  r += '\x1b0';
                  for (let k = 0; k < s.length; k += 24) {
                      const a = s.slice(k, k + 24);
                      if (this.upsideDown) {
                          a.reverse();
                      }
                      r += '\x1bk' + String.fromCharCode(l & 255, l >> 8 & 255) + a.join('') + '\x0a';
                  }
                  r += (this.spacing ? '\x1bz1' : '\x1b0');
              }
              return r;
          }
          else {
              const d = iconv.encode(symbol.data, encoding === 'multilingual' ? 'ascii' : encoding).toString('binary').slice(0, 7089);
              return '\x1b\x1dyS0' + String.fromCharCode(2) + '\x1b\x1dyS1' + String.fromCharCode(this.qrlevel[symbol.level]) + '\x1b\x1dyS2' + String.fromCharCode(symbol.cell) + '\x1b\x1dyD1' + String.fromCharCode(0, d.length & 255, d.length >> 8 & 255) + d + '\x1b\x1dyP';
          }
      }
  };

  //
  // Star Mode on dot impact printers
  //
  const _dot = {
      font: 0,
      // start printing: ESC @ ESC RS a n (ESC M) (ESC P) (ESC :) ESC SP n ESC s n1 n2 (ESC z n) (ESC 0) (SI) (DC2)
      open: function (printer) {
          this.upsideDown = printer.upsideDown;
          this.spacing = printer.spacing;
          this.cutting = printer.cutting;
          this.gradient = printer.gradient;
          this.gamma = printer.gamma;
          this.threshold = printer.threshold;
          this.margin = printer.margin;
          return '\x1b@\x1b\x1ea\x00\x1b' + [ 'M', 'P', ':' ][this.font] + '\x1b \x00\x1bs\x00\x00' + (this.spacing ? '\x1bz\x01' : '\x1b0') + (this.upsideDown ? '\x0f' : '\x12');
      },
      // finish printing: ESC GS ETX s n1 n2 EOT
      close: function () {
          return (this.cutting ? this.cut() : '') + '\x1b\x1d\x03\x01\x00\x00\x04';
      },
      // scale up text: ESC W n ESC h n
      wh: wh => '\x1bW' + String.fromCharCode(wh < 3 ? wh & 1 : 1) + '\x1bh' + String.fromCharCode(wh < 3 ? wh >> 1 & 1 : 1),
      // cancel text decoration: ESC - n ESC F ESC 5 ESC W n ESC h n
      normal: () => '\x1b-\x00\x1bF\x1b5\x1bW' + String.fromCharCode(0) + '\x1bh' + String.fromCharCode(0),
      // print image: ESC 0 ESC K n NUL d1 ... dn LF (ESC z n) (ESC 0)
      image: function (image) {
          const img = PNG.sync.read(Buffer.from(image, 'base64'));
          const w = Math.min(img.width, 255);
          const d = Array(w).fill(0);
          const s = [];
          for (let y = 0; y < img.height; y += 8) {
              const b = Array(w).fill(0);
              const h = Math.min(8, img.height - y);
              for (let p = 0; p < h; p++) {
                  let i = 0, e = 0;
                  let j = (y + p) * img.width * 4;
                  for (let x = 0; x < w; x++) {
                      const f = Math.floor((d[i] + e * 5) / 16 + Math.pow(((img.data[j] * .299 + img.data[j + 1] * .587 + img.data[j + 2] * .114 - 255) * img.data[j + 3] + 65525) / 65525, 1 / this.gamma) * 255);
                      j += 4;
                      if (this.gradient) {
                          d[i] = e * 3;
                          e = f < this.threshold ? (b[x] |= 128 >> p, f) : f - 255;
                          if (i > 0) {
                              d[i - 1] += e;
                          }
                          d[i++] += e * 7;
                      }
                      else {
                          if (f < this.threshold) {
                              b[x] |= 128 >> p;
                          }
                      }
                  }
              }
              s.push('\x1bK' + String.fromCharCode(w) + '\x00' + b.reduce((a, c) => a + String.fromCharCode(c), '') + '\x0a');
          }
          if (this.upsideDown) {
              s.reverse();
          }
          return '\x1b0' + s.join('') + (this.spacing ? '\x1bz\x01' : '\x1b0');
      },
      // print QR Code:
      qrcode: (symbol, encoding) => '',
      // print barcode:
      barcode: (symbol, encoding) => ''
  };

  //
  // Star Mode on dot impact printers (Font 5x9 2P-1)
  //
  const _font2 = {
      font: 1,
  };

  //
  // Star Mode on dot impact printers (Font 5x9 3P-1)
  //
  const _font3 = {
      font: 2,
  };

  //
  // Command Emulator Star Line Mode
  //
  const _emu = {
      // set line spacing and feed new line: (ESC z n) (ESC 0)
      vrlf: function (vr) {
          return (vr === this.upsideDown && this.spacing ? '\x1bz1' : '\x1b0') + this.lf();
      }
  };

  //
  // Star SBCS
  //
  const _sbcs = {
      // print horizontal rule: ESC GS t n ...
      hr: width => '\x1b\x1dt\x01' + '\xc4'.repeat(width),
      // print vertical rules: ESC i n1 n2 ESC GS t n ...
      vr: function (widths, height) {
          return widths.reduce((a, w) => a + this.relative(w) + '\xb3', '\x1bi' + String.fromCharCode(height - 1, 0) + '\x1b\x1dt\x01\xb3');
      },
      // start rules: ESC GS t n ...
      vrstart: widths => '\x1b\x1dt\x01' + widths.reduce((a, w) => a + '\xc4'.repeat(w) + '\xc2', '\xda').slice(0, -1) + '\xbf',
      // stop rules: ESC GS t n ...
      vrstop: widths => '\x1b\x1dt\x01' + widths.reduce((a, w) => a + '\xc4'.repeat(w) + '\xc1', '\xc0').slice(0, -1) + '\xd9',
      // print vertical and horizontal rules: ESC GS t n ...
      vrhr: function (widths1, widths2, dl, dr) {
          const r1 = ' '.repeat(Math.max(-dl, 0)) + widths1.reduce((a, w) => a + '\xc4'.repeat(w) + '\xc1', '\xc0').slice(0, -1) + '\xd9' + ' '.repeat(Math.max(dr, 0));
          const r2 = ' '.repeat(Math.max(dl, 0)) + widths2.reduce((a, w) => a + '\xc4'.repeat(w) + '\xc2', '\xda').slice(0, -1) + '\xbf' + ' '.repeat(Math.max(-dr, 0));
          return '\x1b\x1dt\x01' + r2.split('').reduce((a, c, i) => a + this.vrtable[c][r1[i]], '');
      },
      // ruled line composition
      vrtable: {
          ' '    : { ' ' : ' ',    '\xc0' : '\xc0', '\xc1' : '\xc1', '\xc4' : '\xc4', '\xd9' : '\xd9' },
          '\xbf' : { ' ' : '\xbf', '\xc0' : '\xc5', '\xc1' : '\xc5', '\xc4' : '\xc2', '\xd9' : '\xb4' },
          '\xc2' : { ' ' : '\xc2', '\xc0' : '\xc5', '\xc1' : '\xc5', '\xc4' : '\xc2', '\xd9' : '\xc5' },
          '\xc4' : { ' ' : '\xc4', '\xc0' : '\xc1', '\xc1' : '\xc1', '\xc4' : '\xc4', '\xd9' : '\xc1' },
          '\xda' : { ' ' : '\xda', '\xc0' : '\xc3', '\xc1' : '\xc5', '\xc4' : '\xc2', '\xd9' : '\xc5' }
      }
  };

  //
  // Star MBCS Japanese
  //
  const _mbcs = {
      // print horizontal rule: ESC $ n ...
      hr: width => '\x1b$0' + '\x95'.repeat(width),
      // print vertical rules: ESC i n1 n2 ESC $ n ...
      vr: function (widths, height) {
          return widths.reduce((a, w) => a + this.relative(w) + '\x96', '\x1bi' + String.fromCharCode(height - 1, 0) + '\x1b$0\x96');
      },
      // start rules: ESC $ n ...
      vrstart: widths => '\x1b$0' + widths.reduce((a, w) => a + '\x95'.repeat(w) + '\x91', '\x9c').slice(0, -1) + '\x9d',
      // stop rules: ESC $ n ...
      vrstop: widths => '\x1b$0' + widths.reduce((a, w) => a + '\x95'.repeat(w) + '\x90', '\x9e').slice(0, -1) + '\x9f',
      // print vertical and horizontal rules: ESC $ n ...
      vrhr: function (widths1, widths2, dl, dr) {
          const r1 = ' '.repeat(Math.max(-dl, 0)) + widths1.reduce((a, w) => a + '\x95'.repeat(w) + '\x90', dl > 0 ? '\x9e' : '\x9a').slice(0, -1) + (dr < 0 ? '\x9f' : '\x9b') + ' '.repeat(Math.max(dr, 0));
          const r2 = ' '.repeat(Math.max(dl, 0)) + widths2.reduce((a, w) => a + '\x95'.repeat(w) + '\x91', dl < 0 ? '\x9c' : '\x98').slice(0, -1) + (dr > 0 ? '\x9d' : '\x99') + ' '.repeat(Math.max(-dr, 0));
          return '\x1b$0' + r2.split('').reduce((a, c, i) => a + this.vrtable[c][r1[i]], '');
      },
      // ruled line composition
      vrtable: {
          ' '    : { ' ' : ' ',    '\x90' : '\x90', '\x95' : '\x95', '\x9a' : '\x9a', '\x9b' : '\x9b', '\x9e' : '\x9e', '\x9f' : '\x9f' },
          '\x91' : { ' ' : '\x91', '\x90' : '\x8f', '\x95' : '\x91', '\x9a' : '\x8f', '\x9b' : '\x8f', '\x9e' : '\x8f', '\x9f' : '\x8f' },
          '\x95' : { ' ' : '\x95', '\x90' : '\x90', '\x95' : '\x95', '\x9a' : '\x90', '\x9b' : '\x90', '\x9e' : '\x90', '\x9f' : '\x90' },
          '\x98' : { ' ' : '\x98', '\x90' : '\x8f', '\x95' : '\x91', '\x9a' : '\x93', '\x9b' : '\x8f', '\x9e' : '\x93', '\x9f' : '\x8f' },
          '\x99' : { ' ' : '\x99', '\x90' : '\x8f', '\x95' : '\x91', '\x9a' : '\x8f', '\x9b' : '\x92', '\x9e' : '\x8f', '\x9f' : '\x92' },
          '\x9c' : { ' ' : '\x9c', '\x90' : '\x8f', '\x95' : '\x91', '\x9a' : '\x93', '\x9b' : '\x8f', '\x9e' : '\x93', '\x9f' : '\x8f' },
          '\x9d' : { ' ' : '\x9d', '\x90' : '\x8f', '\x95' : '\x91', '\x9a' : '\x8f', '\x9b' : '\x92', '\x9e' : '\x8f', '\x9f' : '\x92' }
      }
  };

  //
  // Star MBCS Chinese Korean
  //
  const _mbcs2 = {
      // print horizontal rule: - ...
      hr: width => '-'.repeat(width),
      // print vertical rules: ESC i n1 n2 | ...
      vr: function (widths, height) {
          return widths.reduce((a, w) => a + this.relative(w) + '|', '\x1bi' + String.fromCharCode(height - 1, 0) + '|');
      },
      // start rules: + - ...
      vrstart: widths => widths.reduce((a, w) => a + '-'.repeat(w) + '+', '+'),
      // stop rules: + - ...
      vrstop: widths => widths.reduce((a, w) => a + '-'.repeat(w) + '+', '+'),
      // print vertical and horizontal rules: + - ...
      vrhr: function (widths1, widths2, dl, dr) {
          const r1 = ' '.repeat(Math.max(-dl, 0)) + widths1.reduce((a, w) => a + '-'.repeat(w) + '+', '+') + ' '.repeat(Math.max(dr, 0));
          const r2 = ' '.repeat(Math.max(dl, 0)) + widths2.reduce((a, w) => a + '-'.repeat(w) + '+', '+') + ' '.repeat(Math.max(-dr, 0));
          return r2.split('').reduce((a, c, i) => a + this.vrtable[c][r1[i]], '');
      },
      // ruled line composition
      vrtable: {
          ' ' : { ' ' : ' ', '+' : '+', '-' : '-' },
          '+' : { ' ' : '+', '+' : '+', '-' : '+' },
          '-' : { ' ' : '-', '+' : '+', '-' : '-' }
      }
  };

  //
  // Star Graphic Mode
  //
  const _stargraphic = {
      // printer configuration
      upsideDown: false,
      spacing: false,
      cutting: true,
      gradient: true,
      gamma: 1.8,
      threshold: 128,
      alignment: 0,
      left: 0,
      width: 48,
      right: 0,
      margin: 0,
      // start printing: ESC RS a n ESC * r A ESC * r P n NUL (ESC * r E n NUL)
      open: function (printer) {
          this.upsideDown = printer.upsideDown;
          this.spacing = printer.spacing;
          this.cutting = printer.cutting;
          this.gradient = printer.gradient;
          this.gamma = printer.gamma;
          this.threshold = printer.threshold;
          this.alignment = 0;
          this.left = 0;
          this.width = printer.cpl;
          this.right = 0;
          this.margin = (printer.upsideDown ? printer.marginRight : printer.margin) * this.charWidth;
          return '\x1b\x1ea\x00\x1b*rA\x1b*rP0\x00' + (this.cutting ? '' : '\x1b*rE1\x00');
      },
      // finish printing: ESC * r B ESC ACK SOH
      close: function () {
          return '\x1b*rB\x1b\x06\x01';
      },
      // set print area:
      area: function (left, width, right) {
          this.left = left;
          this.width = width;
          this.right = right;
          return '';
      },
      // set line alignment:
      align: function (align) {
          this.alignment = align;
          return '';
      },
      // cut paper: ESC FF NUL
      cut: () => '\x1b\x0c\x00',
      // feed new line: ESC * r Y n NUL
      lf: function () {
          return '\x1b*rY' + this.charWidth * (this.spacing ? 2.5 : 2) + '\x00';
      },
      // insert commands:
      command: command => command,
      // print image: b n1 n2 data
      image: function (image) {
          const align = arguments[1] || this.alignment;
          const left = arguments[2] || this.left;
          const width = arguments[3] || this.width;
          const right = arguments[4] || this.right;
          let r = '';
          const img = PNG.sync.read(Buffer.from(image, 'base64'));
          const w = img.width;
          const d = Array(w).fill(0);
          const m = this.margin + Math.max((this.upsideDown ? right : left) * this.charWidth + (width * this.charWidth - w) * (this.upsideDown ? 2 - align : align) >> 1, 0);
          const l = m + w + 7 >> 3;
          let j = this.upsideDown ? img.data.length - 4 : 0;
          for (let y = 0; y < img.height; y++) {
              let i = 0, e = 0;
              r += 'b' + String.fromCharCode(l & 255, l >> 8 & 255);
              for (let x = 0; x < m + w; x += 8) {
                  let b = 0;
                  const q = Math.min(m + w - x, 8);
                  for (let p = 0; p < q; p++) {
                      if (m <= x + p) {
                          const f = Math.floor((d[i] + e * 5) / 16 + Math.pow(((img.data[j] * .299 + img.data[j + 1] * .587 + img.data[j + 2] * .114 - 255) * img.data[j + 3] + 65525) / 65525, 1 / this.gamma) * 255);
                          j += this.upsideDown ? -4 : 4;
                          if (this.gradient) {
                              d[i] = e * 3;
                              e = f < this.threshold ? (b |= 128 >> p, f) : f - 255;
                              if (i > 0) {
                                  d[i - 1] += e;
                              }
                              d[i++] += e * 7;
                          }
                          else {
                              if (f < this.threshold) {
                                  b |= 128 >> p;
                              }
                          }
                      }
                  }
                  r += String.fromCharCode(b);
              }
          }
          return r;
      }
  };

  //
  // Plain Text
  //
  const _text = {
      left: 0,
      width: 48,
      position: 0,
      scale: 1,
      buffer: [],
      // start printing:
      open: function (printer) {
          this.left = 0;
          this.width = printer.cpl;
          this.position = 0;
          this.scale = 1;
          this.buffer = [];
          return '';
      },
      // set print area:
      area: function (left, width, right) {
          this.left = left;
          this.width = width;
          return '';
      },
      // set absolute print position:
      absolute: function (position) {
          this.position = position;
          return '';
      },
      // set relative print position:
      relative: function (position) {
          this.position += Math.round(position);
          return '';
      },
      // print horizontal rule:
      hr: function (width) {
          return ' '.repeat(this.left) + '-'.repeat(width);
      },
      // print vertical rules:
      vr: function (widths, height) {
          this.buffer.push({ data: '|', index: this.position, length: 1 });
          widths.forEach(w => {
              this.position += w + 1;
              this.buffer.push({ data: '|', index: this.position, length: 1 });
          });
          return '';
      },
      // start rules:
      vrstart: function (widths) {
          return ' '.repeat(this.left) + widths.reduce((a, w) => a + '-'.repeat(w) + '+', '+');
      },
      // stop rules:
      vrstop: function (widths) {
          return ' '.repeat(this.left) + widths.reduce((a, w) => a + '-'.repeat(w) + '+', '+');
      },
      // print vertical and horizontal rules:
      vrhr: function (widths1, widths2, dl, dr) {
          const r1 = ' '.repeat(Math.max(-dl, 0)) + widths1.reduce((a, w) => a + '-'.repeat(w) + '+', '+') + ' '.repeat(Math.max(dr, 0));
          const r2 = ' '.repeat(Math.max(dl, 0)) + widths2.reduce((a, w) => a + '-'.repeat(w) + '+', '+') + ' '.repeat(Math.max(-dr, 0));
          return ' '.repeat(this.left) + r2.split('').reduce((a, c, i) => a + this.vrtable[c][r1[i]], '');
      },
      // ruled line composition
      vrtable: {
          ' ' : { ' ' : ' ', '+' : '+', '-' : '-' },
          '+' : { ' ' : '+', '+' : '+', '-' : '+' },
          '-' : { ' ' : '-', '+' : '+', '-' : '-' }
      },
      // set line spacing and feed new line:
      vrlf: function(vr) {
          return this.lf();
      },
      // scale up text:
      wh: function (wh) {
          const w = wh < 2 ? wh + 1 : wh - 1;
          this.scale = w;
          return '';
      },
      // cancel text decoration:
      normal: function () {
          this.scale = 1;
          return '';
      },
      // print text:
      text: function (text, encoding) {
          const d = this.arrayFrom(text, encoding).reduce((a, c) => a + c + ' '.repeat(this.measureText(c, encoding) * (this.scale - 1)), '');
          const l = this.measureText(text, encoding) * this.scale;
          this.buffer.push({ data: d, index: this.position, length: l });
          this.position += l;
          return '';
      },
      // feed new line:
      lf: function () {
          let r = '';
          if (this.buffer.length > 0) {
              let p = 0;
              r += this.buffer.sort((a, b) => a.index - b.index).reduce((a, c) => {
                  const s = a + ' '.repeat(c.index - p) + c.data;
                  p = c.index + c.length;
                  return s;
              }, ' '.repeat(this.left));
          }
          r += '\n';
          this.position = 0;
          this.buffer = [];
          return r;
      }
  };

  //
  // ESC/POS Generic
  //
  const _generic = {
      // start printing: ESC @ GS a n ESC M n ESC SP n FS S n1 n2 (ESC 2) (ESC 3 n) ESC { n FS .
      open: function (printer) {
          this.upsideDown = printer.upsideDown;
          this.spacing = printer.spacing;
          this.cutting = printer.cutting;
          this.gradient = printer.gradient;
          this.gamma = printer.gamma;
          this.threshold = printer.threshold;
          this.alignment = 0;
          this.left = 0;
          this.width = printer.cpl;
          this.right = 0;
          this.margin = printer.margin;
          this.marginRight = printer.marginRight;
          return '\x1b@\x1da\x00\x1bM\x00\x1b \x00\x1cS\x00\x00' + (this.spacing ? '\x1b2' : '\x1b3\x00') + '\x1b{' + String.fromCharCode(this.upsideDown) + '\x1c.';
      },
      // finish printing: GS r n
      close: function () {
          return (this.cutting ? this.cut() : '') + '\x1dr\x01';
      },
      // print horizontal rule: FS C n FS . ESC t n ...
      hr: width => '\x1cC\x00\x1c.\x1bt\x01' + '\x95'.repeat(width),
      // print vertical rules: GS ! n FS C n FS . ESC t n ...
      vr: function (widths, height) {
          return widths.reduce((a, w) => a + this.relative(w) + '\x96', '\x1d!' + String.fromCharCode(height - 1) + '\x1cC\x00\x1c.\x1bt\x01\x96');
      },
      // start rules: FS C n FS . ESC t n ...
      vrstart: widths => '\x1cC\x00\x1c.\x1bt\x01' + widths.reduce((a, w) => a + '\x95'.repeat(w) + '\x91', '\x9c').slice(0, -1) + '\x9d',
      // stop rules: FS C n FS . ESC t n ...
      vrstop: widths => '\x1cC\x00\x1c.\x1bt\x01' + widths.reduce((a, w) => a + '\x95'.repeat(w) + '\x90', '\x9e').slice(0, -1) + '\x9f',
      // print vertical and horizontal rules: FS C n FS . ESC t n ...
      vrhr: function (widths1, widths2, dl, dr) {
          const r1 = ' '.repeat(Math.max(-dl, 0)) + widths1.reduce((a, w) => a + '\x95'.repeat(w) + '\x90', dl > 0 ? '\x9e' : '\x9a').slice(0, -1) + (dr < 0 ? '\x9f' : '\x9b') + ' '.repeat(Math.max(dr, 0));
          const r2 = ' '.repeat(Math.max(dl, 0)) + widths2.reduce((a, w) => a + '\x95'.repeat(w) + '\x91', dl < 0 ? '\x9c' : '\x98').slice(0, -1) + (dr > 0 ? '\x9d' : '\x99') + ' '.repeat(Math.max(-dr, 0));
          return '\x1cC\x00\x1c.\x1bt\x01' + r2.split('').reduce((a, c, i) => a + this.vrtable[c][r1[i]], '');
      },
      // underline text: ESC - n FS - n
      ul: () => '\x1b-\x02\x1c-\x02',
      // emphasize text: ESC E n
      em: () => '\x1bE\x01',
      // invert text: GS B n
      iv: () => '\x1dB\x01',
      // scale up text: GS ! n
      wh: wh => '\x1d!' + (wh < 3 ? String.fromCharCode((wh & 1) << 4 | wh >> 1 & 1) : String.fromCharCode(wh - 2 << 4 | wh - 2)),
      // cancel text decoration: ESC - n FS - n ESC E n GS B n GS ! n
      normal: () => '\x1b-\x00\x1c-\x00\x1bE\x00\x1dB\x00\x1d!\x00',
      // image split size
      split: 2048,
      // print image: GS v 0 m xL xH yL yH d1 ... dk
      image: function (image) {
          const align = arguments[1] || this.alignment;
          const left = arguments[2] || this.left;
          const width = arguments[3] || this.width;
          const right = arguments[4] || this.right;
          let r = this.upsideDown ? this.area(right + this.marginRight - this.margin, width, left) + this.align(2 - align) : '';
          const img = PNG.sync.read(Buffer.from(image, 'base64'));
          const w = img.width;
          const d = Array(w).fill(0);
          let j = this.upsideDown ? img.data.length - 4 : 0;
          for (let z = 0; z < img.height; z += this.split) {
              const h = Math.min(this.split, img.height - z);
              const l = w + 7 >> 3;
              r += '\x1dv0' + String.fromCharCode(0, l & 255, l >> 8 & 255, h & 255, h >> 8 & 255);
              for (let y = 0; y < h; y++) {
                  let i = 0, e = 0;
                  for (let x = 0; x < w; x += 8) {
                      let b = 0;
                      const q = Math.min(w - x, 8);
                      for (let p = 0; p < q; p++) {
                          const f = Math.floor((d[i] + e * 5) / 16 + Math.pow(((img.data[j] * .299 + img.data[j + 1] * .587 + img.data[j + 2] * .114 - 255) * img.data[j + 3] + 65525) / 65525, 1 / this.gamma) * 255);
                          j += this.upsideDown ? -4 : 4;
                          if (this.gradient) {
                              d[i] = e * 3;
                              e = f < this.threshold ? (b |= 128 >> p, f) : f - 255;
                              if (i > 0) {
                                  d[i - 1] += e;
                              }
                              d[i++] += e * 7;
                          }
                          else {
                              if (f < this.threshold) {
                                  b |= 128 >> p;
                              }
                          }
                      }
                      r += String.fromCharCode(b);
                  }
              }
          }
          return r;
      },
      // print QR Code: GS ( k pL pH cn fn n1 n2 GS ( k pL pH cn fn n GS ( k pL pH cn fn n GS ( k pL pH cn fn m d1 ... dk GS ( k pL pH cn fn m
      qrcode: function (symbol, encoding) {
          if (typeof qrcode !== 'undefined') {
              let r = this.upsideDown ? this.area(this.right + this.marginRight - this.margin, this.width, this.left) + this.align(2 - this.alignment) : '';
              if (symbol.data.length > 0) {
                  const qr = qrcode(0, symbol.level.toUpperCase());
                  qr.addData(symbol.data);
                  qr.make();
                  let img = qr.createASCII(2, 0);
                  if (this.upsideDown) {
                      img = img.split('').reverse().join('');
                  }
                  img = img.split('\n');
                  const w = img.length * symbol.cell;
                  const h = w;
                  const l = w + 7 >> 3;
                  r += '\x1dv0' + String.fromCharCode(0, l & 255, l >> 8 & 255, h & 255, h >> 8 & 255);
                  for (let i = 0; i < img.length; i++) {
                      let d = '';
                      for (let j = 0; j < w; j += 8) {
                          let b = 0;
                          const q = Math.min(w - j, 8);
                          for (let p = 0; p < q; p++) {
                              if (img[i][Math.floor((j + p) / symbol.cell) * 2] === ' ') {
                                  b |= 128 >> p;
                              }
                          }
                          d += String.fromCharCode(b);
                      }
                      for (let k = 0; k < symbol.cell; k++) {
                          r += d;
                      }
                  }
              }
              return r;
          }
          else {
              const d = iconv.encode(symbol.data, encoding === 'multilingual' ? 'ascii' : encoding).toString('binary').slice(0, 7089);
              return d.length > 0 ? '\x1d(k' + String.fromCharCode(4, 0, 49, 65, 50, 0) + '\x1d(k' + String.fromCharCode(3, 0, 49, 67, symbol.cell) + '\x1d(k' + String.fromCharCode(3, 0, 49, 69, this.qrlevel[symbol.level]) + '\x1d(k' + String.fromCharCode(d.length + 3 & 255, d.length + 3 >> 8 & 255, 49, 80, 48) + d + '\x1d(k' + String.fromCharCode(3, 0, 49, 81, 48) : '';
          }
      }
  }

  // command set
  const _commands = {
      base: Object.assign({}, _base),
      svg: Object.assign({}, _base, _svg),
      text: Object.assign({}, _base, _text),
      escpos: Object.assign({}, _base, _escpos, _thermal),
      epson: Object.assign({}, _base, _escpos, _thermal),
      sii: Object.assign({}, _base, _escpos, _thermal, _sii),
      citizen: Object.assign({}, _base, _escpos, _thermal, _citizen),
      fit: Object.assign({}, _base, _escpos, _thermal, _fit),
      impact: Object.assign({}, _base, _escpos, _impact),
      impactb: Object.assign({}, _base, _escpos, _impact, _fontb),
      generic: Object.assign({}, _base, _escpos, _thermal, _generic),
      starsbcs: Object.assign({}, _base, _star, _sbcs),
      starmbcs: Object.assign({}, _base, _star, _mbcs),
      starmbcs2: Object.assign({}, _base, _star, _mbcs2),
      starlinesbcs: Object.assign({}, _base, _star, _line, _sbcs),
      starlinembcs: Object.assign({}, _base, _star, _line, _mbcs),
      starlinembcs2: Object.assign({}, _base, _star, _line, _mbcs2),
      emustarlinesbcs: Object.assign({}, _base, _star, _line, _emu, _sbcs),
      emustarlinembcs: Object.assign({}, _base, _star, _line, _emu, _mbcs),
      emustarlinembcs2: Object.assign({}, _base, _star, _line, _emu, _mbcs2),
      stargraphic: Object.assign({}, _base, _stargraphic),
      starimpact: Object.assign({}, _base, _star, _dot, _sbcs),
      starimpact2: Object.assign({}, _base, _star, _dot, _font2, _sbcs),
      starimpact3: Object.assign({}, _base, _star, _dot, _font3, _sbcs)
  };
  const commands = Object.assign(Object.create(null), _commands);

})();
