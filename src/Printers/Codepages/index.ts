export * from './CodepageEncoder.js'
export * from './ASCII.js'

// Help me
export type Codepage
  = 'CP437' // USA! USA! USA!
  | 'CP720'
  | 'CP737' // GREEK
  | 'CP775'
  | 'CP850' // MULTILINGUAL
  | 'CP851' // GREEK
  | 'CP852'
  | 'CP853' // TURKISH
  | 'CP855'
  | 'CP857' // TURKISH
  | 'CP858'
  | 'CP860' // PORTUGUESE
  | 'CP861'
  | 'CP862'
  | 'CP863'
  | 'CP863' // CANADIAN-FRENCH
  | 'CP864'
  | 'CP865'
  | 'CP865' // NORDIC
  | 'CP866' // Cyrillic 2
  | 'CP869'
  //| 'CP932' // Actually shiftjis?
  //| 'CP936' // Simplified Chinese?
  //| 'CP949' // Unified Hangul?
  //| 'CP950' // Traditional Chinese?
  | 'CP1098'
  | 'CP1118'
  | 'CP1119'
  | 'CP1125'
  | 'ISO885915'
  | 'ISO88592'
  | 'ISO88597'
  | 'RK1048'
  | 'WINDOWS1250'
  | 'WINDOWS1251'
  | 'WINDOWS1252'
  | 'WINDOWS1253'
  | 'WINDOWS1254'
  | 'WINDOWS1255'
  | 'WINDOWS1256'
  | 'WINDOWS1257'
  | 'WINDOWS1258'
  // TODO: These ones are hard lol
  // | 'SHIFTJIS'
  // | 'GB18030'
  // | 'KSC5601'
  // | 'BIG5'
  // | 'TIS620'
