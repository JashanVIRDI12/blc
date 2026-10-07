// Where places are, for the "Across India" map: cities, and each state at
// its capital (or a central city). A place not listed can be written with its
// coordinates, "Leh (34.15, 77.58)". Names match without case, "&" or "and".
export const ORIGIN = { name: 'Paschim Vihar, New Delhi', at: [28.6692, 77.0947] };

const CITIES = {
  'new delhi': [28.6139, 77.209], delhi: [28.6139, 77.209], 'delhi ncr': [28.6139, 77.209], gurugram: [28.4595, 77.0266], gurgaon: [28.4595, 77.0266], noida: [28.5355, 77.391], faridabad: [28.4089, 77.3178], ghaziabad: [28.6692, 77.4538], sonipat: [28.9931, 77.0151], panipat: [29.3909, 76.9635], karnal: [29.6857, 76.9905], ambala: [30.3782, 76.7767], hisar: [29.1492, 75.7217], rohtak: [28.8955, 76.6066],
  meerut: [28.9845, 77.7064], aligarh: [27.8974, 78.088], agra: [27.1767, 78.0081], bareilly: [28.367, 79.4304], moradabad: [28.8386, 78.7733], lucknow: [26.8467, 80.9462], kanpur: [26.4499, 80.3319], varanasi: [25.3176, 82.9739], prayagraj: [25.4358, 81.8463],
  chandigarh: [30.7333, 76.7794], mohali: [30.7046, 76.7179], ludhiana: [30.901, 75.8573], amritsar: [31.634, 74.8723], jalandhar: [31.326, 75.5762], patiala: [30.3398, 76.3869],
  shimla: [31.1048, 77.1734], manali: [32.2432, 77.1892], dharamshala: [32.219, 76.3234], dehradun: [30.3165, 78.0322], haridwar: [29.9457, 78.1642], rishikesh: [30.0869, 78.2676], nainital: [29.3803, 79.4636], rudrapur: [28.9845, 79.4006], haldwani: [29.2183, 79.513],
  srinagar: [34.0837, 74.7973], jammu: [32.7266, 74.857], leh: [34.1526, 77.5771],
  jaipur: [26.9124, 75.7873], jodhpur: [26.2389, 73.0243], udaipur: [24.5854, 73.7125], kota: [25.2138, 75.8648], ajmer: [26.4499, 74.6399],
  ahmedabad: [23.0225, 72.5714], surat: [21.1702, 72.8311], vadodara: [22.3072, 73.1812], rajkot: [22.3039, 70.8022],
  mumbai: [19.076, 72.8777], pune: [18.5204, 73.8567], nagpur: [21.1458, 79.0882], nashik: [19.9975, 73.7898], 'chhatrapati sambhajinagar': [19.8762, 75.3433], aurangabad: [19.8762, 75.3433],
  bhopal: [23.2599, 77.4126], indore: [22.7196, 75.8577], gwalior: [26.2183, 78.1828], jabalpur: [23.1815, 79.9864],
  raipur: [21.2514, 81.6296], bilaspur: [22.0797, 82.1409], ranchi: [23.3441, 85.3096], jamshedpur: [22.8046, 86.2029], dhanbad: [23.7957, 86.4304], patna: [25.5941, 85.1376],
  bhubaneswar: [20.2961, 85.8245], cuttack: [20.4625, 85.883], kolkata: [22.5726, 88.3639], siliguri: [26.7271, 88.3953], gangtok: [27.3389, 88.6065],
  guwahati: [26.1445, 91.7362], shillong: [25.5788, 91.8933], imphal: [24.817, 93.9368], aizawl: [23.7271, 92.7176], agartala: [23.8315, 91.2868], itanagar: [27.0844, 93.6053], kohima: [25.6751, 94.1086],
  hyderabad: [17.385, 78.4867], vijayawada: [16.5062, 80.648], amaravati: [16.5131, 80.5165], visakhapatnam: [17.6868, 83.2185], tirupati: [13.6288, 79.4192],
  bengaluru: [12.9716, 77.5946], bangalore: [12.9716, 77.5946], mysuru: [12.2958, 76.6394], mangaluru: [12.9141, 74.856], chennai: [13.0827, 80.2707], coimbatore: [11.0168, 76.9558], madurai: [9.9252, 78.1198],
  kochi: [9.9312, 76.2673], thiruvananthapuram: [8.5241, 76.9366], kozhikode: [11.2588, 75.7804], panaji: [15.4909, 73.8278], goa: [15.4909, 73.8278], puducherry: [11.9416, 79.8083], 'port blair': [11.6234, 92.7265],
};
const STATES = {
  'jammu kashmir': 'srinagar', ladakh: 'leh', 'himachal pradesh': 'shimla', punjab: 'ludhiana', haryana: 'rohtak', uttarakhand: 'dehradun', 'uttar pradesh': 'lucknow',
  rajasthan: 'jaipur', gujarat: 'ahmedabad', 'madhya pradesh': 'bhopal', maharashtra: 'mumbai', karnataka: 'bengaluru', kerala: 'kochi', 'tamil nadu': 'chennai',
  'andhra pradesh': 'amaravati', telangana: 'hyderabad', odisha: 'bhubaneswar', chhattisgarh: 'raipur', jharkhand: 'ranchi', bihar: 'patna', 'west bengal': 'kolkata',
  sikkim: 'gangtok', assam: 'guwahati', meghalaya: 'shillong', manipur: 'imphal', mizoram: 'aizawl', tripura: 'agartala', 'arunachal pradesh': 'itanagar', nagaland: 'kohima',
  'andaman nicobar islands': 'port blair', 'andaman nicobar': 'port blair',
};
const key = name => String(name).toLowerCase().replace(/&/g, ' ').replace(/\band\b/g, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();

// "Jammu & Kashmir" → { name, at: [lat, lng] }; null when unknown.
export function findPlace(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const given = raw.match(/^(.*?)\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)\s*$/);
  if (given) return { name: given[1].trim() || raw, at: [Number(given[2]), Number(given[3])] };
  const k = key(raw);
  const at = CITIES[k] || CITIES[STATES[k]];
  return at ? { name: raw, at } : null;
}

// The places the map shows: one per line or comma; unknown ones are returned
// apart, for the admin to fix.
export function readPlaces(text) {
  const places = [], unknown = [];
  for (const part of String(text || '').split(/[\n,](?![^(]*\))/).map(item => item.trim()).filter(Boolean)) {
    const place = findPlace(part);
    if (place) { if (!places.some(other => other.name.toLowerCase() === place.name.toLowerCase())) places.push(place); }
    else unknown.push(part);
  }
  return { places, unknown };
}

// The registration state code of a place (HR, DL, HP…), to find the cars in
// the collection registered there.
const CODES = {
  JK: ['jammu kashmir', 'srinagar', 'jammu'], LA: ['ladakh', 'leh'], HP: ['himachal pradesh', 'shimla', 'manali', 'dharamshala'],
  PB: ['punjab', 'ludhiana', 'amritsar', 'jalandhar', 'patiala', 'mohali'], CH: ['chandigarh'],
  HR: ['haryana', 'gurugram', 'gurgaon', 'faridabad', 'sonipat', 'panipat', 'karnal', 'ambala', 'hisar', 'rohtak'],
  DL: ['delhi', 'new delhi', 'delhi ncr'], UK: ['uttarakhand', 'dehradun', 'haridwar', 'rishikesh', 'nainital', 'rudrapur', 'haldwani'],
  UP: ['uttar pradesh', 'lucknow', 'kanpur', 'varanasi', 'prayagraj', 'agra', 'meerut', 'aligarh', 'bareilly', 'moradabad', 'noida', 'ghaziabad'],
  RJ: ['rajasthan', 'jaipur', 'jodhpur', 'udaipur', 'kota', 'ajmer'], GJ: ['gujarat', 'ahmedabad', 'surat', 'vadodara', 'rajkot'],
  MH: ['maharashtra', 'mumbai', 'pune', 'nagpur', 'nashik', 'aurangabad', 'chhatrapati sambhajinagar'],
  MP: ['madhya pradesh', 'bhopal', 'indore', 'gwalior', 'jabalpur'], CG: ['chhattisgarh', 'raipur', 'bilaspur'],
  JH: ['jharkhand', 'ranchi', 'jamshedpur', 'dhanbad'], BR: ['bihar', 'patna'], OD: ['odisha', 'bhubaneswar', 'cuttack'],
  WB: ['west bengal', 'kolkata', 'siliguri'], AS: ['assam', 'guwahati'], TS: ['telangana', 'hyderabad'],
  AP: ['andhra pradesh', 'vijayawada', 'amaravati', 'visakhapatnam', 'tirupati'], KA: ['karnataka', 'bengaluru', 'bangalore', 'mysuru', 'mangaluru'],
  TN: ['tamil nadu', 'chennai', 'coimbatore', 'madurai'], KL: ['kerala', 'kochi', 'thiruvananthapuram', 'kozhikode'], GA: ['goa', 'panaji'],
};
const CODE_OF = Object.fromEntries(Object.entries(CODES).flatMap(([code, names]) => names.map(name => [name, code])));
export const stateCode = name => CODE_OF[key(name)] || '';
