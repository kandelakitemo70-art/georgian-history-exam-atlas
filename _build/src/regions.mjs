// Reusable historical regions (Caucasus & neighbours), built from Natural Earth admin-1 units
// (ids like GE-KA, TR-08, AZ-QAX) plus hand-drawn cut polygons [lon, lat]. Borders are schematic.

const SVANETI_CUT = [[41.75, 42.9], [42.35, 42.86], [42.7, 42.78], [43.4, 42.78], [43.4, 43.6], [41.75, 43.6]];
const HERETI_CUT = [[45.45, 40.9], [45.7, 41.45], [46.05, 41.68], [46.4, 41.92], [47.0, 41.95], [47.0, 40.9]];
const TAO_CUT = [[40.35, 40.32], [41.25, 40.16], [42.0, 40.2], [42.95, 40.45], [42.95, 41.4], [40.35, 41.4]];
const LAZ_CUT = [[40.9, 41.18], [41.56, 41.18], [41.62, 41.7], [40.9, 41.7]];
const MTIULETI_CUT = [[44.25, 42.33], [44.95, 42.33], [45.0, 42.9], [44.25, 42.9]]; // Khevi / Mtiuleti / Gudamakari (north of Ananuri)

export const REGIONS = {
  // ---- Georgia (modern regions as building blocks)
  abkhazeti: { u: ['GE-AB'] },
  samegrelo: { u: ['GE-SZ'], minus: { p: SVANETI_CUT } },
  svaneti: { u: ['GE-SZ'], and: { p: SVANETI_CUT } },
  racha: { u: ['GE-RL'] },
  imereti: { u: ['GE-IM'] },
  guria: { u: ['GE-GU'] },
  adjara: { u: ['GE-AJ'] },
  samtskhe: { u: ['GE-SJ'] },
  shida_kartli: { u: ['GE-SK'] },
  mtskheta: { u: ['GE-MM'], minus: { p: MTIULETI_CUT } },
  mtiuleti: { u: ['GE-MM'], and: { p: MTIULETI_CUT } },
  kvemo_kartli: { u: ['GE-KK', 'GE-TB'] },
  kartli: { u: ['GE-SK', 'GE-MM', 'GE-KK', 'GE-TB'] },
  kakheti: { u: ['GE-KA'], minus: { p: HERETI_CUT } },
  hereti_ge: { u: ['GE-KA'], and: { p: HERETI_CUT } },
  saingilo: { u: ['AZ-BAL', 'AZ-ZAQ', 'AZ-QAX'] },
  hereti: { or: [{ u: ['GE-KA'], and: { p: HERETI_CUT } }, { u: ['AZ-BAL', 'AZ-ZAQ', 'AZ-QAX', 'AZ-SA', 'AZ-OGU'] }] },
  georgia_modern: { u: ['GE-AB', 'GE-SZ', 'GE-RL', 'GE-IM', 'GE-GU', 'GE-AJ', 'GE-SJ', 'GE-SK', 'GE-MM', 'GE-KK', 'GE-TB', 'GE-KA'] },
  west_georgia: { u: ['GE-AB', 'GE-SZ', 'GE-RL', 'GE-IM', 'GE-GU', 'GE-AJ'] },
  east_georgia: { u: ['GE-SK', 'GE-MM', 'GE-KK', 'GE-TB', 'GE-KA'] },

  // ---- historical south-west Georgia (now Turkey)
  tao: { u: ['TR-25'], and: { p: TAO_CUT } },
  klarjeti: { u: ['TR-08'], minus: { p: LAZ_CUT } },
  lazeti: { or: [{ u: ['TR-53'] }, { u: ['TR-08'], and: { p: LAZ_CUT } }] },
  artaani: { u: ['TR-75'] },
  kars: { u: ['TR-36'] },
  speri: { u: ['TR-69'] },
  karin: { u: ['TR-25'], minus: { p: TAO_CUT } },                 // Erzurum / Theodosiopolis
  trapezunt: { u: ['TR-61', 'TR-29'] },
  chaneti: { u: ['TR-53', 'TR-61'] },
  tao_klarjeti: { or: ['tao', 'klarjeti', 'artaani'] },

  // ---- Armenia / Azerbaijan / North Caucasus building blocks
  shirak: { u: ['AM-SH'] },
  tashiri: { u: ['AM-LO', 'AM-TV'] },
  ararat: { u: ['AM-AR', 'AM-AV', 'AM-ER', 'AM-AG', 'AM-KT', 'TR-76'] },
  gegharkunik: { u: ['AM-GR'] },
  syunik: { u: ['AM-SU', 'AM-VD'] },
  nakhchivan: { u: ['AZ-NX', 'AZ-SAR', 'AZ-SAD', 'AZ-KAN', 'AZ-BAB', 'AZ-SAH', 'AZ-CUL', 'AZ-ORD'] },
  armenia_modern: { u: ['AM-TV', 'AM-LO', 'AM-SH', 'AM-GR', 'AM-VD', 'AM-SU', 'AM-AR', 'AM-AG', 'AM-AV', 'AM-KT', 'AM-ER'] },
  ran: { u: ['AZ-QAZ', 'AZ-AGA', 'AZ-TOV', 'AZ-SKR', 'AZ-GA', 'AZ-GYG', 'AZ-SMX', 'AZ-GOR', 'AZ-YEV', 'AZ-NA', 'AZ-GAD', 'AZ-DAS', 'AZ-KAL', 'AZ-TAR', 'AZ-BAR', 'AZ-AGM', 'AZ-AGC', 'AZ-XCI', 'AZ-XA', 'AZ-SUS', 'AZ-X01~', 'AZ-XVD', 'AZ-MI', 'AZ-LAN', 'AZ-QBI', 'AZ-ZAN', 'AZ-CAB', 'AZ-FUZ', 'AZ-BEY'] },
  shirvan: { u: ['AZ-SMI', 'AZ-QOB', 'AZ-ISM', 'AZ-AGU', 'AZ-GOY', 'AZ-KUR', 'AZ-HAC', 'AZ-QBA', 'AZ-QUS', 'AZ-XAC', 'AZ-SIY', 'AZ-SBN', 'AZ-XIZ', 'AZ-ABS', 'AZ-BA', 'AZ-SM', 'AZ-SR', 'AZ-UCA', 'AZ-ZAR', 'AZ-AGS', 'AZ-QAB', 'AZ-SAB', 'AZ-SAT', 'AZ-IMI', 'AZ-SAL', 'AZ-NEF'] },
  mughan_talysh: { u: ['AZ-BIL', 'AZ-CAL', 'AZ-YAR', 'AZ-LER', 'AZ-AST', 'AZ-MAS', 'AZ-LA'] },
  azerbaijan_modern: { c: ['AZE'] },
  derbent: { u: ['RU-DA'], and: { p: [[47.5, 41.1], [48.7, 41.5], [48.6, 42.35], [47.9, 42.4], [47.2, 41.9]] } },
  dagestan: { u: ['RU-DA'] },
  leketi: { u: ['RU-DA'], and: { p: [[45.6, 41.1], [47.3, 41.2], [48.0, 41.9], [47.9, 43.2], [45.6, 43.2]] } },
  ossetia_n: { u: ['RU-SE'] },
  durdzuketi: { u: ['RU-CE', 'RU-IN'] },
  kabarda: { u: ['RU-KB'] },
  karachay: { u: ['RU-KC'] },
  jiketi: { p: [[40.0, 43.38], [39.55, 43.55], [39.2, 43.85], [38.95, 44.1], [39.15, 44.3], [39.7, 44.1], [40.3, 43.8], [40.55, 43.55]] },
  north_caucasus: { u: ['RU-KC', 'RU-KB', 'RU-SE', 'RU-IN', 'RU-CE', 'RU-DA'] },

  // ---- Anatolia / Iran building blocks
  khlat_van: { u: ['TR-13', 'TR-65', 'TR-49', 'TR-04'] },
  erzincan: { u: ['TR-24'] },
  iran_az: { u: ['IR-01', 'IR-02', 'IR-03'] },
  gilan: { u: ['IR-19'] },
  zanjan_qazvin: { u: ['IR-11', 'IR-28'] },
};
