import fs from "node:fs";
import path from "node:path";

interface RawSpot {
  id: string;
  slug: string;
  name: string;
  city: string;
  city_slug: string;
  address: string;
  image_url: string | null;
  images: string[];
  country_code: string;
  location: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  instagram: string | null;
  verification_count: number;
  sports: string[];
  types: { name: string; slug: string }[];
}

interface CuratedCity {
  country_code: string;
  slug: string;
  name: string;
  admin1: string | null;
  lat: number;
  lon: number;
  spot_count: number;
  sort_order: number;
  featured: boolean;
}

interface GazetteerHub {
  country: string;
  name: string;
  admin1?: string | null;
  lat: number;
  lon: number;
  radiusKm?: number;
  featured?: boolean;
}

export function slugifyCity(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[łŁ]/g, "l")
    .replace(/[đĐ]/g, "d")
    .replace(/[øØ]/g, "o")
    .replace(/[æÆ]/g, "ae")
    .replace(/[œŒ]/g, "oe")
    .replace(/[ß]/g, "ss")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "unknown";
}

function decodeEwkb(value: string): { lat: number; lon: number } {
  const bytes = Buffer.from(value, "hex");
  const littleEndian = bytes[0] === 1;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const lon = view.getFloat64(9, littleEndian);
  const lat = view.getFloat64(17, littleEndian);
  return { lat, lon };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Explicit city name overrides by "CC:raw_slug" or "CC:Raw Name"
const EXPLICIT_CITY_OVERRIDES: Record<string, { name: string; admin1?: string }> = {
  // UAE
  "AE:dby": { name: "Dubai" },
  "AE:jzyr-ys": { name: "Abu Dhabi" },
  "AE:lhidayryt": { name: "Abu Dhabi" },
  "AE:lhisin": { name: "Abu Dhabi" },
  "AE:mdyn-khlyf": { name: "Abu Dhabi" },
  "AE:lfjyr": { name: "Fujairah" },
  "AE:mwylh": { name: "Sharjah" },
  "AE:falaj-hazwa": { name: "Al Ain" },
  // Israel
  "IL:rmt-gn": { name: "Tel Aviv" },
  "IL:yrvshlym-lqds": { name: "Jerusalem" },
  "IL:mv-tsh-zvryt-mth-yhvdh": { name: "Jerusalem" },
  "IL:khyph": { name: "Haifa" },
  "IL:qryt-t": { name: "Haifa" },
  "IL:shdvd": { name: "Ashdod" },
  "IL:gn-ybnh": { name: "Ashdod" },
  "IL:gdrh": { name: "Ashdod" },
  "IL:shqlvn": { name: "Ashkelon" },
  "IL:mv-tsh-zvryt-khvp-shqlvn": { name: "Ashkelon" },
  "IL:mvdy-yn-mkbym-r-vt": { name: "Modi'in" },
  "IL:nhryh": { name: "Nahariya" },
  "IL:ntnyh": { name: "Netanya" },
  "IL:kpr-yvnh": { name: "Netanya" },
  "IL:qdymh-tsvrn": { name: "Netanya" },
  "IL:npt-hshrvn": { name: "Netanya" },
  "IL:r-nnh": { name: "Ra'anana" },
  "IL:hvd-hshrvn": { name: "Hod HaSharon" },
  "IL:kvkb-yyr": { name: "Kfar Saba" },
  "IL:dymvnh": { name: "Dimona" },
  "IL:yqn-m-ylyt": { name: "Yokneam" },
  "IL:prds-khnh-krkvr": { name: "Pardes Hanna-Karkur" },
  // Morocco
  "MA:rabat-lrbt": { name: "Rabat" },
  "MA:sale-sl": { name: "Salé" },
  "MA:temara-tmr": { name: "Rabat" },
  "MA:casablanca-ldr-lbyd": { name: "Casablanca" },
  "MA:tit-mellil-tyt-mlyl": { name: "Casablanca" },
  "MA:mohammedia-lmhmdy": { name: "Mohammedia" },
  "MA:marrakech-mrksh": { name: "Marrakech" },
  "MA:mechouar-kasbah-lmshwr-lqsb": { name: "Marrakech" },
  "MA:harbil-hrbyl": { name: "Marrakech" },
  "MA:agadir-kdyr": { name: "Agadir" },
  "MA:aourir-wryr": { name: "Agadir" },
  "MA:taghazout-tgzwt": { name: "Taghazout" },
  "MA:tanger-tnj": { name: "Tangier" },
  "MA:fes-fs": { name: "Fes" },
  "MA:kenitra-lqnytr": { name: "Kenitra" },
  "MA:mirleft-myrlft": { name: "Mirleft" },
  "MA:azilal-zyll": { name: "Azilal" },
  "MA:pachalik-d-el-jadida-ljdyd": { name: "El Jadida" },
  "MA:pachalik-de-safi-bshwy-asfy": { name: "Safi" },
  // Algeria / Tunisia / Egypt / Middle East
  "DZ:setif-styf": { name: "Sétif" },
  "DZ:bab-ezzouar-bb-lzwr": { name: "Algiers" },
  "DZ:sidi-abdellah-sydy-bd-llh": { name: "Algiers" },
  "DZ:dy-r-myl": { name: "Mila" },
  "TN:qrtj": { name: "Tunis" },
  "TN:lmnzh-6": { name: "Tunis" },
  "EG:mdyn-lqhr-ljdyd": { name: "Cairo" },
  "EG:lshykh-zyd": { name: "Giza" },
  "EG:wdy-lntrwn": { name: "Wadi El Natrun" },
  "SA:ldr-y": { name: "Riyadh" },
  "SA:ldmm": { name: "Dammam" },
  "SA:mhfz-ljbyl": { name: "Jubail" },
  "SA:mhfz-r-s-tnwrh": { name: "Ras Tanura" },
  "QA:lryn": { name: "Doha" },
  "BH:lmhrq": { name: "Manama" },
  "BH:jidhfs": { name: "Manama" },
  "OM:lwdy-lkbyr": { name: "Muscat" },
  "OM:wly-lsyb": { name: "Muscat" },
  "JO:mn": { name: "Amman" },
  "JO:nhy-lqwysm": { name: "Amman" },
  "IQ:haewlyr": { name: "Erbil" },
  "IQ:slymny": { name: "Sulaymaniyah" },
  "IQ:bgdd": { name: "Baghdad" },
  "IR:shhr-thrn": { name: "Tehran" },
  "IR:tjrysh": { name: "Tehran" },
  "IR:shhr-mshhd": { name: "Mashhad" },
  "IR:shhr-qm": { name: "Qom" },
  "IR:shyrz": { name: "Shiraz" },
  // Thailand
  "TH:krungethphmhaankhr": { name: "Bangkok" },
  "TH:tamblaephrksaa": { name: "Bangkok" },
  "TH:ethsbaaltambldaansamorng": { name: "Bangkok" },
  "TH:ethsbaalemuue-ngbaangsriiemuue-ng": { name: "Bangkok" },
  "TH:ethsbaalnkhrpaakekrd": { name: "Bangkok" },
  "TH:tamblbaanaihm": { name: "Bangkok" },
  "TH:ethsbaalemuue-ngthaaokhlng": { name: "Bangkok" },
  "TH:emuue-ngphathyaa": { name: "Pattaya" },
  "TH:ekhaaaimaekw": { name: "Pattaya" },
  "TH:ethsbaalemuue-ngsriiraachaa": { name: "Chonburi" },
  "TH:ehmuue-ng": { name: "Chonburi" },
  "TH:hwykapi": { name: "Chonburi" },
  "TH:ameph-ekaaasmuy": { name: "Koh Samui" },
  "TH:ethsbaalnkhrhawhin": { name: "Hua Hin" },
  "TH:ethsbaalemuue-ngcha-am": { name: "Cha-Am" },
  "TH:ethsbaalemuue-ngaemehiiya": { name: "Chiang Mai" },
  "TH:hn-ngaekw": { name: "Chiang Mai" },
  "TH:ethsbaalnkhrphuuekt": { name: "Phuket" },
  "TH:tamblraaaiwy": { name: "Phuket" },
  "TH:tamblechingthael": { name: "Phuket" },
  "TH:sriisunthr": { name: "Phuket" },
  "TH:tamblsriisunthr": { name: "Phuket" },
  "TH:khuekkhak": { name: "Khao Lak" },
  "TH:ethsbaalnkhrsuraasdrthaanii": { name: "Surat Thani" },
  "TH:ethsbaalemuue-ng-oythyaa": { name: "Ayutthaya" },
  "TH:ethsbaalemuue-ngmukdaahaar": { name: "Mukdahan" },
  "TH:ethsbaalemuue-ngnkhrphnm": { name: "Nakhon Phanom" },
  "TH:maabtaaphud": { name: "Rayong" },
  "TH:naataakhway": { name: "Rayong" },
  "TH:baanchaang": { name: "Rayong" },
  "TH:ekhtr-udmsakdi": { name: "Sattahip" },
  "TH:baanepd": { name: "Khon Kaen" },
  "TH:tambl-isaan": { name: "Buriram" },
  "TH:thaamakhaam": { name: "Kanchanaburi" },
  "TH:hlakemuue-ng": { name: "Ratchaburi" },
  "TH:tamblpracchwbkhiiriikhanth": { name: "Prachuap Khiri Khan" },
  "TH:saalaadaan": { name: "Koh Lanta" },
  "TH:cch-ngthnn": { name: "Phatthalung" },
  "TH:baanaa": { name: "Pattani" },
  "TH:baanaihmhn-ngaithr": { name: "Sa Kaeo" },
  "TH:phrhmburii": { name: "Sing Buri" },
  "TH:ephchremuue-ngth-ng": { name: "Ang Thong" },
  // South Korea
  "KR:seoulteugbyeolsi": { name: "Seoul" },
  "KR:inceongwangyeogsi": { name: "Incheon" },
  "KR:busangwangyeogsi": { name: "Busan" },
  "KR:gimhaesi": { name: "Gimhae" },
  "KR:daejeongwangyeogsi": { name: "Daejeon" },
  "KR:ulsangwangyeogsi": { name: "Ulsan" },
  "KR:hwaseongsi": { name: "Hwaseong" },
  "KR:suweonsi": { name: "Suwon" },
  "KR:ansansi": { name: "Ansan" },
  "KR:yonginsi": { name: "Yongin" },
  "KR:ceongjusi": { name: "Cheongju" },
  "KR:gumisi": { name: "Gumi" },
  "KR:gyeongsansi": { name: "Gyeongsan" },
  "KR:pohangsi": { name: "Pohang" },
  "KR:yeojusi": { name: "Yeoju" },
  "KR:gyeongjusi": { name: "Gyeongju" },
  "KR:sanceonggun": { name: "Sancheong" },
  "KR:yeongweoleub": { name: "Yeongwol" },
  // Taiwan & China & Vietnam
  "TW:tai-bei-shi": { name: "Taipei" },
  "TW:tai-zhong-shi": { name: "Taichung" },
  "TW:tao-yuan-shi": { name: "Taoyuan" },
  "TW:tai-nan-shi": { name: "Tainan" },
  "TW:gao-xiong-shi": { name: "Kaohsiung" },
  "TW:zhu-bei-shi": { name: "Zhubei" },
  "TW:hua-lian-shi": { name: "Hualien" },
  "TW:luo-dong-zhen": { name: "Luodong" },
  "TW:tong-xiao-zhen": { name: "Tongxiao" },
  "TW:yuan-lin-shi": { name: "Changhua" },
  "TW:zhang-hua-shi": { name: "Changhua" },
  "CN:zhao-yang-qu": { name: "Beijing" },
  "CN:yang-pu-qu": { name: "Shanghai" },
  "CN:xu-hui-qu": { name: "Shanghai" },
  "CN:pu-tuo-qu": { name: "Shanghai" },
  "CN:long-gang-qu": { name: "Shenzhen" },
  "CN:fan-yu-qu": { name: "Guangzhou" },
  "CN:su-zhou-gong-ye-yuan-qu": { name: "Suzhou" },
  "CN:de-qing-xian": { name: "Huzhou" },
  "CN:long-you-xian": { name: "Quzhou" },
  "CN:wei-ping-jie-dao": { name: "Zigong" },
  "CN:bao-qing-xian": { name: "Shuangyashan" },
  "VN:thanh-pho-ho-chi-minh": { name: "Ho Chi Minh City" },
  "VN:thanh-pho-ha-noi": { name: "Hanoi" },
  "VN:hoi-an": { name: "Hoi An" },
  "VN:phan-thiet": { name: "Phan Thiet" },
  // Europe & Americas canonicalizations
  "AL:tirane": { name: "Tirana" },
  "AT:wien": { name: "Vienna" },
  "BE:antwerpen": { name: "Antwerp" },
  "BE:bruxelles-brussel": { name: "Brussels" },
  "BE:gent": { name: "Ghent" },
  "BG:sofiia": { name: "Sofia" },
  "BO:municipio-nuestra-senora-de-la-paz": { name: "La Paz" },
  "BO:municipio-santa-cruz-de-la-sierra": { name: "Santa Cruz de la Sierra" },
  "BO:municipio-tarija": { name: "Tarija" },
  "BR:sao-paulo": { name: "São Paulo" },
  "CO:cali-ciudad": { name: "Cali" },
  "CO:soacha-ciudad": { name: "Bogota" },
  "CR:area-metropolitana-de-san-jose": { name: "San José" },
  "CU:la-habana": { name: "Havana" },
  "CY:leukosia": { name: "Nicosia" },
  "CY:lakatameia": { name: "Nicosia" },
  "CY:lemesos": { name: "Limassol" },
  "CY:demos-germasogeias": { name: "Limassol" },
  "CY:demos-larnakas": { name: "Larnaca" },
  "CY:demos-paphou": { name: "Paphos" },
  "CZ:praha": { name: "Prague" },
  "DE:munchen": { name: "Munich" },
  "DE:koln": { name: "Cologne" },
  "DE:frankfurt-am-main": { name: "Frankfurt" },
  "DK:kobenhavn": { name: "Copenhagen" },
  "DO:santo-domingo-de-guzman": { name: "Santo Domingo" },
  "DO:santo-domingo-norte": { name: "Santo Domingo" },
  "DO:santo-domingo-este": { name: "Santo Domingo" },
  "ES:sevilla": { name: "Seville" },
  "ES:malaga": { name: "Málaga" },
  "ES:donostia-san-sebastian": { name: "San Sebastián" },
  "GB:greater-london": { name: "London" },
  "GB:kernow-cornwall": { name: "Cornwall" },
  "GE:t-bilisi": { name: "Tbilisi" },
  "GE:bat-umi": { name: "Batumi" },
  "GE:p-ot-i": { name: "Poti" },
  "GE:chiat-ura": { name: "Chiatura" },
  "GR:athena": { name: "Athens" },
  "GR:demotike-enoteta-thesalonikes": { name: "Thessaloniki" },
  "GR:demotike-enoteta-panoramatos": { name: "Thessaloniki" },
  "GR:demotike-enoteta-ioanniton": { name: "Ioannina" },
  "GR:demotike-enoteta-phlorinas": { name: "Florina" },
  "GR:demotike-enoteta-korinthion": { name: "Corinth" },
  "GR:demotike-enoteta-larisaion": { name: "Larissa" },
  "GR:demotike-enoteta-ksanthes": { name: "Xanthi" },
  "GR:demotike-enoteta-dramas": { name: "Drama" },
  "GR:demotike-enoteta-patreon": { name: "Patras" },
  "GR:demotike-enoteta-spartiaton": { name: "Sparta" },
  "GR:demotike-enoteta-agriniou": { name: "Agrinio" },
  "GR:demos-bolou": { name: "Volos" },
  "GR:demos-katerines": { name: "Katerini" },
  "GR:kerkura": { name: "Corfu" },
  "GR:kabala": { name: "Kavala" },
  "GT:ciudad-de-guatemala": { name: "Guatemala City" },
  "HR:grad-zagreb": { name: "Zagreb" },
  "ID:daerah-khusus-ibukota-jakarta": { name: "Jakarta" },
  "IN:bengaluru": { name: "Bangalore" },
  "IS:reykjavikurborg": { name: "Reykjavik" },
  "IS:kopavogsbaer": { name: "Reykjavik" },
  "IS:hafnarfjardarkaupstadur": { name: "Reykjavik" },
  "IS:akureyrarbaer": { name: "Akureyri" },
  "IT:roma": { name: "Rome" },
  "IT:milano": { name: "Milan" },
  "IT:firenze": { name: "Florence" },
  "IT:napoli": { name: "Naples" },
  "IT:torino": { name: "Turin" },
  "IT:genova": { name: "Genoa" },
  "IT:venezia": { name: "Venice" },
  "LU:luxembourg": { name: "Luxembourg City" },
  "MT:l-imsida": { name: "Msida" },
  "MX:ciudad-de-mexico": { name: "Mexico City" },
  "MY:george-town": { name: "Penang" },
  "NL:den-haag": { name: "The Hague" },
  "NL:s-gravenhage": { name: "The Hague" },
  "PA:parque-lefevre": { name: "Panama City" },
  "PA:el-chorrillo": { name: "Panama City" },
  "PA:arraijan": { name: "Panama City" },
  "PL:warszawa": { name: "Warsaw" },
  "PL:krakow": { name: "Kraków" },
  "PL:lodz": { name: "Łódź" },
  "PL:wroclaw": { name: "Wrocław" },
  "PL:gdansk": { name: "Gdańsk" },
  "PT:lisboa": { name: "Lisbon" },
  "PY:luque": { name: "Asunción" },
  "PY:nemby": { name: "Asunción" },
  "RO:bucuresti": { name: "Bucharest" },
  "RS:beograd": { name: "Belgrade" },
  "RS:gradska-opshtina-palilula": { name: "Belgrade" },
  "RS:gradska-opshtina-vrachar": { name: "Belgrade" },
  "RS:gradska-opshtina-chukaritsa": { name: "Belgrade" },
  "RS:grad-novi-sad": { name: "Novi Sad" },
  "RS:grad-nish": { name: "Niš" },
  "RS:grad-kragujevats": { name: "Kragujevac" },
  "RU:moskva": { name: "Moscow" },
  "RU:sankt-peterburg": { name: "Saint Petersburg" },
  "RU:ekaterinburg": { name: "Yekaterinburg" },
  "SE:goteborg": { name: "Gothenburg" },
  "SE:malmo": { name: "Malmö" },
  "SE:malmo-kommun": { name: "Malmö" },
  "SK:kosice": { name: "Košice" },
  "UA:kiyiv": { name: "Kyiv" },
  "UA:l-vivs-ka-mis-ka-gromada": { name: "Lviv" },
  "UA:ivano-frankivs-ka-mis-ka-gromada": { name: "Ivano-Frankivsk" },
  "UA:ternopil-s-ka-mis-ka-gromada": { name: "Ternopil" },
  "UA:luts-k": { name: "Lutsk" },
  "ZA:city-of-cape-town": { name: "Cape Town" },
  "ZA:city-of-ekurhuleni-metropolitan-municipality": { name: "Johannesburg" },
};

// Canonical Metro Gazetteer for spatial consolidation & featured city coordinates
const GAZETTEER_HUBS: readonly GazetteerHub[] = [
  // United States — Top Metros & Action Sports Hubs
  { country: "US", name: "Los Angeles", admin1: "CA", lat: 34.0522, lon: -118.2437, radiusKm: 32, featured: true },
  { country: "US", name: "New York", admin1: "NY", lat: 40.7128, lon: -74.006, radiusKm: 28, featured: true },
  { country: "US", name: "San Francisco", admin1: "CA", lat: 37.7749, lon: -122.4194, radiusKm: 24, featured: true },
  { country: "US", name: "San Jose", admin1: "CA", lat: 37.3382, lon: -121.8863, radiusKm: 24 },
  { country: "US", name: "Oakland", admin1: "CA", lat: 37.8044, lon: -122.2712, radiusKm: 18 },
  { country: "US", name: "San Diego", admin1: "CA", lat: 32.7157, lon: -117.1611, radiusKm: 28, featured: true },
  { country: "US", name: "Anaheim", admin1: "CA", lat: 33.8366, lon: -117.9143, radiusKm: 22 },
  { country: "US", name: "Riverside", admin1: "CA", lat: 33.9806, lon: -117.3755, radiusKm: 25 },
  { country: "US", name: "Sacramento", admin1: "CA", lat: 38.5816, lon: -121.4944, radiusKm: 26 },
  { country: "US", name: "Santa Cruz", admin1: "CA", lat: 36.9741, lon: -122.0308, radiusKm: 22 },
  { country: "US", name: "Santa Rosa", admin1: "CA", lat: 38.4404, lon: -122.7141, radiusKm: 24 },
  { country: "US", name: "Stockton", admin1: "CA", lat: 37.9577, lon: -121.2908, radiusKm: 22 },
  { country: "US", name: "Modesto", admin1: "CA", lat: 37.6391, lon: -120.9969, radiusKm: 22 },
  { country: "US", name: "Fresno", admin1: "CA", lat: 36.7378, lon: -119.7871, radiusKm: 24 },
  { country: "US", name: "Bakersfield", admin1: "CA", lat: 35.3733, lon: -119.0187, radiusKm: 24 },
  { country: "US", name: "San Luis Obispo", admin1: "CA", lat: 35.2828, lon: -120.6596, radiusKm: 24 },
  { country: "US", name: "Santa Barbara", admin1: "CA", lat: 34.4208, lon: -119.6982, radiusKm: 22 },
  { country: "US", name: "Ventura", admin1: "CA", lat: 34.2805, lon: -119.2945, radiusKm: 22 },
  { country: "US", name: "Palm Springs", admin1: "CA", lat: 33.8303, lon: -116.5453, radiusKm: 24 },
  { country: "US", name: "Redding", admin1: "CA", lat: 40.5865, lon: -122.3917, radiusKm: 24 },
  { country: "US", name: "Chico", admin1: "CA", lat: 39.7285, lon: -121.8375, radiusKm: 22 },
  { country: "US", name: "Eureka", admin1: "CA", lat: 40.8021, lon: -124.1637, radiusKm: 24 },
  { country: "US", name: "South Lake Tahoe", admin1: "CA", lat: 38.9399, lon: -119.9772, radiusKm: 24 },
  { country: "US", name: "Mammoth Lakes", admin1: "CA", lat: 37.6485, lon: -118.9721, radiusKm: 24 },
  { country: "US", name: "Portland", admin1: "OR", lat: 45.5152, lon: -122.6784, radiusKm: 28, featured: true },
  { country: "US", name: "Salem", admin1: "OR", lat: 44.9429, lon: -123.0351, radiusKm: 24 },
  { country: "US", name: "Bend", admin1: "OR", lat: 44.0582, lon: -121.3153, radiusKm: 24 },
  { country: "US", name: "Eugene", admin1: "OR", lat: 44.0521, lon: -123.0868, radiusKm: 24 },
  { country: "US", name: "Medford", admin1: "OR", lat: 42.3265, lon: -122.8756, radiusKm: 24 },
  { country: "US", name: "Seattle", admin1: "WA", lat: 47.6062, lon: -122.3321, radiusKm: 28, featured: true },
  { country: "US", name: "Tacoma", admin1: "WA", lat: 47.2529, lon: -122.4443, radiusKm: 22 },
  { country: "US", name: "Olympia", admin1: "WA", lat: 47.0379, lon: -122.9007, radiusKm: 22 },
  { country: "US", name: "Bellingham", admin1: "WA", lat: 48.7519, lon: -122.4787, radiusKm: 24 },
  { country: "US", name: "Spokane", admin1: "WA", lat: 47.6588, lon: -117.426, radiusKm: 26 },
  { country: "US", name: "Yakima", admin1: "WA", lat: 46.6021, lon: -120.5059, radiusKm: 24 },
  { country: "US", name: "Miami", admin1: "FL", lat: 25.7617, lon: -80.1918, radiusKm: 28, featured: true },
  { country: "US", name: "Fort Lauderdale", admin1: "FL", lat: 26.1224, lon: -80.1373, radiusKm: 22 },
  { country: "US", name: "West Palm Beach", admin1: "FL", lat: 26.7153, lon: -80.0534, radiusKm: 24 },
  { country: "US", name: "Tampa", admin1: "FL", lat: 27.9506, lon: -82.4572, radiusKm: 26 },
  { country: "US", name: "St. Petersburg", admin1: "FL", lat: 27.7676, lon: -82.6403, radiusKm: 22 },
  { country: "US", name: "Sarasota", admin1: "FL", lat: 27.3364, lon: -82.5307, radiusKm: 24 },
  { country: "US", name: "Fort Myers", admin1: "FL", lat: 26.6406, lon: -81.8723, radiusKm: 26 },
  { country: "US", name: "Orlando", admin1: "FL", lat: 28.5383, lon: -81.3792, radiusKm: 28 },
  { country: "US", name: "Daytona Beach", admin1: "FL", lat: 29.2108, lon: -81.0228, radiusKm: 24 },
  { country: "US", name: "Melbourne", admin1: "FL", lat: 28.0836, lon: -80.6081, radiusKm: 24 },
  { country: "US", name: "Jacksonville", admin1: "FL", lat: 30.3322, lon: -81.6557, radiusKm: 28 },
  { country: "US", name: "Gainesville", admin1: "FL", lat: 29.6516, lon: -82.3248, radiusKm: 24 },
  { country: "US", name: "Tallahassee", admin1: "FL", lat: 30.4383, lon: -84.2807, radiusKm: 24 },
  { country: "US", name: "Pensacola", admin1: "FL", lat: 30.4213, lon: -87.2169, radiusKm: 24 },
  { country: "US", name: "Chicago", admin1: "IL", lat: 41.8781, lon: -87.6298, radiusKm: 30, featured: true },
  { country: "US", name: "Rockford", admin1: "IL", lat: 42.2711, lon: -89.094, radiusKm: 24 },
  { country: "US", name: "Peoria", admin1: "IL", lat: 40.6936, lon: -89.589, radiusKm: 24 },
  { country: "US", name: "Springfield", admin1: "IL", lat: 39.7817, lon: -89.6501, radiusKm: 24 },
  { country: "US", name: "Champaign", admin1: "IL", lat: 40.1164, lon: -88.2434, radiusKm: 22 },
  { country: "US", name: "Las Vegas", admin1: "NV", lat: 36.1699, lon: -115.1398, radiusKm: 28, featured: true },
  { country: "US", name: "Reno", admin1: "NV", lat: 39.5296, lon: -119.8138, radiusKm: 24 },
  { country: "US", name: "Phoenix", admin1: "AZ", lat: 33.4484, lon: -112.074, radiusKm: 32, featured: true },
  { country: "US", name: "Tucson", admin1: "AZ", lat: 32.2226, lon: -110.9747, radiusKm: 26 },
  { country: "US", name: "Flagstaff", admin1: "AZ", lat: 35.1983, lon: -111.6513, radiusKm: 24 },
  { country: "US", name: "Denver", admin1: "CO", lat: 39.7392, lon: -104.9903, radiusKm: 28, featured: true },
  { country: "US", name: "Boulder", admin1: "CO", lat: 40.015, lon: -105.2705, radiusKm: 20 },
  { country: "US", name: "Colorado Springs", admin1: "CO", lat: 38.8339, lon: -104.8214, radiusKm: 24 },
  { country: "US", name: "Fort Collins", admin1: "CO", lat: 40.5853, lon: -105.0844, radiusKm: 22 },
  { country: "US", name: "Grand Junction", admin1: "CO", lat: 39.0639, lon: -108.5506, radiusKm: 24 },
  { country: "US", name: "Salt Lake City", admin1: "UT", lat: 40.7608, lon: -111.891, radiusKm: 28 },
  { country: "US", name: "Ogden", admin1: "UT", lat: 41.223, lon: -111.9738, radiusKm: 22 },
  { country: "US", name: "Provo", admin1: "UT", lat: 40.2338, lon: -111.6585, radiusKm: 22 },
  { country: "US", name: "St. George", admin1: "UT", lat: 37.0965, lon: -113.5684, radiusKm: 24 },
  { country: "US", name: "Houston", admin1: "TX", lat: 29.7604, lon: -95.3698, radiusKm: 32, featured: true },
  { country: "US", name: "Dallas", admin1: "TX", lat: 32.7767, lon: -96.797, radiusKm: 28, featured: true },
  { country: "US", name: "Fort Worth", admin1: "TX", lat: 32.7555, lon: -97.3308, radiusKm: 24 },
  { country: "US", name: "Austin", admin1: "TX", lat: 30.2672, lon: -97.7431, radiusKm: 28, featured: true },
  { country: "US", name: "San Antonio", admin1: "TX", lat: 29.4241, lon: -98.4936, radiusKm: 28 },
  { country: "US", name: "El Paso", admin1: "TX", lat: 31.7619, lon: -106.485, radiusKm: 24 },
  { country: "US", name: "Corpus Christi", admin1: "TX", lat: 27.8006, lon: -97.3964, radiusKm: 24 },
  { country: "US", name: "Lubbock", admin1: "TX", lat: 33.5779, lon: -101.8552, radiusKm: 24 },
  { country: "US", name: "Philadelphia", admin1: "PA", lat: 39.9526, lon: -75.1652, radiusKm: 26, featured: true },
  { country: "US", name: "Pittsburgh", admin1: "PA", lat: 40.4406, lon: -79.9959, radiusKm: 26 },
  { country: "US", name: "Allentown", admin1: "PA", lat: 40.6023, lon: -75.4714, radiusKm: 22 },
  { country: "US", name: "Harrisburg", admin1: "PA", lat: 40.2732, lon: -76.8867, radiusKm: 24 },
  { country: "US", name: "Erie", admin1: "PA", lat: 42.1292, lon: -80.0851, radiusKm: 22 },
  { country: "US", name: "Boston", admin1: "MA", lat: 42.3601, lon: -71.0589, radiusKm: 26, featured: true },
  { country: "US", name: "Worcester", admin1: "MA", lat: 42.2626, lon: -71.8023, radiusKm: 22 },
  { country: "US", name: "Springfield", admin1: "MA", lat: 42.1015, lon: -72.5898, radiusKm: 22 },
  { country: "US", name: "Providence", admin1: "RI", lat: 41.824, lon: -71.4128, radiusKm: 22 },
  { country: "US", name: "Hartford", admin1: "CT", lat: 41.7658, lon: -72.6734, radiusKm: 22 },
  { country: "US", name: "New Haven", admin1: "CT", lat: 41.3083, lon: -72.9279, radiusKm: 20 },
  { country: "US", name: "Bridgeport", admin1: "CT", lat: 41.1865, lon: -73.1952, radiusKm: 20 },
  { country: "US", name: "Buffalo", admin1: "NY", lat: 42.8864, lon: -78.8784, radiusKm: 26 },
  { country: "US", name: "Rochester", admin1: "NY", lat: 43.1566, lon: -77.6088, radiusKm: 26 },
  { country: "US", name: "Syracuse", admin1: "NY", lat: 43.0481, lon: -76.1474, radiusKm: 24 },
  { country: "US", name: "Albany", admin1: "NY", lat: 42.6526, lon: -73.7562, radiusKm: 24 },
  { country: "US", name: "Newark", admin1: "NJ", lat: 40.7357, lon: -74.1724, radiusKm: 18 },
  { country: "US", name: "Trenton", admin1: "NJ", lat: 40.2206, lon: -74.7597, radiusKm: 20 },
  { country: "US", name: "Atlantic City", admin1: "NJ", lat: 39.3643, lon: -74.4229, radiusKm: 22 },
  { country: "US", name: "Washington", admin1: "DC", lat: 38.9072, lon: -77.0369, radiusKm: 24 },
  { country: "US", name: "Baltimore", admin1: "MD", lat: 39.2904, lon: -76.6122, radiusKm: 24 },
  { country: "US", name: "Atlanta", admin1: "GA", lat: 33.749, lon: -84.388, radiusKm: 28, featured: true },
  { country: "US", name: "Savannah", admin1: "GA", lat: 32.0809, lon: -81.0912, radiusKm: 24 },
  { country: "US", name: "Augusta", admin1: "GA", lat: 33.4735, lon: -82.0105, radiusKm: 24 },
  { country: "US", name: "Charlotte", admin1: "NC", lat: 35.2271, lon: -80.8431, radiusKm: 26 },
  { country: "US", name: "Raleigh", admin1: "NC", lat: 35.7796, lon: -78.6382, radiusKm: 24 },
  { country: "US", name: "Greensboro", admin1: "NC", lat: 36.0726, lon: -79.792, radiusKm: 24 },
  { country: "US", name: "Asheville", admin1: "NC", lat: 35.5951, lon: -82.5515, radiusKm: 24 },
  { country: "US", name: "Wilmington", admin1: "NC", lat: 34.2104, lon: -77.8868, radiusKm: 24 },
  { country: "US", name: "Charleston", admin1: "SC", lat: 32.7765, lon: -79.9311, radiusKm: 24 },
  { country: "US", name: "Columbia", admin1: "SC", lat: 34.0007, lon: -81.0348, radiusKm: 24 },
  { country: "US", name: "Greenville", admin1: "SC", lat: 34.8526, lon: -82.394, radiusKm: 24 },
  { country: "US", name: "Myrtle Beach", admin1: "SC", lat: 33.6891, lon: -78.8867, radiusKm: 24 },
  { country: "US", name: "Virginia Beach", admin1: "VA", lat: 36.8529, lon: -75.978, radiusKm: 26 },
  { country: "US", name: "Richmond", admin1: "VA", lat: 37.5407, lon: -77.436, radiusKm: 24 },
  { country: "US", name: "Roanoke", admin1: "VA", lat: 37.271, lon: -79.9414, radiusKm: 24 },
  { country: "US", name: "Nashville", admin1: "TN", lat: 36.1627, lon: -86.7816, radiusKm: 26 },
  { country: "US", name: "Memphis", admin1: "TN", lat: 35.1495, lon: -90.049, radiusKm: 24 },
  { country: "US", name: "Knoxville", admin1: "TN", lat: 35.9606, lon: -83.9207, radiusKm: 24 },
  { country: "US", name: "Chattanooga", admin1: "TN", lat: 35.0456, lon: -85.3097, radiusKm: 24 },
  { country: "US", name: "Birmingham", admin1: "AL", lat: 33.5186, lon: -86.8104, radiusKm: 26 },
  { country: "US", name: "Huntsville", admin1: "AL", lat: 34.7304, lon: -86.5861, radiusKm: 24 },
  { country: "US", name: "Mobile", admin1: "AL", lat: 30.6954, lon: -88.0399, radiusKm: 24 },
  { country: "US", name: "Detroit", admin1: "MI", lat: 42.3314, lon: -83.0458, radiusKm: 28 },
  { country: "US", name: "Grand Rapids", admin1: "MI", lat: 42.9634, lon: -85.6681, radiusKm: 24 },
  { country: "US", name: "Lansing", admin1: "MI", lat: 42.7325, lon: -84.5555, radiusKm: 24 },
  { country: "US", name: "Ann Arbor", admin1: "MI", lat: 42.2808, lon: -83.743, radiusKm: 20 },
  { country: "US", name: "Kalamazoo", admin1: "MI", lat: 42.2917, lon: -85.5872, radiusKm: 22 },
  { country: "US", name: "Minneapolis", admin1: "MN", lat: 44.9778, lon: -93.265, radiusKm: 28 },
  { country: "US", name: "Duluth", admin1: "MN", lat: 46.7867, lon: -92.1005, radiusKm: 24 },
  { country: "US", name: "Milwaukee", admin1: "WI", lat: 43.0389, lon: -87.9065, radiusKm: 26 },
  { country: "US", name: "Madison", admin1: "WI", lat: 43.0731, lon: -89.4012, radiusKm: 24 },
  { country: "US", name: "Green Bay", admin1: "WI", lat: 44.5133, lon: -88.0133, radiusKm: 24 },
  { country: "US", name: "St. Louis", admin1: "MO", lat: 38.627, lon: -90.1994, radiusKm: 28 },
  { country: "US", name: "Kansas City", admin1: "MO", lat: 39.0997, lon: -94.5786, radiusKm: 28 },
  { country: "US", name: "Springfield", admin1: "MO", lat: 37.209, lon: -93.2923, radiusKm: 24 },
  { country: "US", name: "Columbus", admin1: "OH", lat: 39.9612, lon: -82.9988, radiusKm: 26 },
  { country: "US", name: "Cleveland", admin1: "OH", lat: 41.4993, lon: -81.6944, radiusKm: 26 },
  { country: "US", name: "Cincinnati", admin1: "OH", lat: 39.1031, lon: -84.512, radiusKm: 26 },
  { country: "US", name: "Toledo", admin1: "OH", lat: 41.6528, lon: -83.5379, radiusKm: 24 },
  { country: "US", name: "Dayton", admin1: "OH", lat: 39.7589, lon: -84.1916, radiusKm: 24 },
  { country: "US", name: "Akron", admin1: "OH", lat: 41.0814, lon: -81.519, radiusKm: 22 },
  { country: "US", name: "Indianapolis", admin1: "IN", lat: 39.7684, lon: -86.1581, radiusKm: 28 },
  { country: "US", name: "Fort Wayne", admin1: "IN", lat: 41.0793, lon: -85.1394, radiusKm: 24 },
  { country: "US", name: "Louisville", admin1: "KY", lat: 38.2527, lon: -85.7585, radiusKm: 24 },
  { country: "US", name: "Lexington", admin1: "KY", lat: 38.0406, lon: -84.5037, radiusKm: 24 },
  { country: "US", name: "New Orleans", admin1: "LA", lat: 29.9511, lon: -90.0715, radiusKm: 26 },
  { country: "US", name: "Baton Rouge", admin1: "LA", lat: 30.4515, lon: -91.1871, radiusKm: 24 },
  { country: "US", name: "Little Rock", admin1: "AR", lat: 34.7465, lon: -92.2896, radiusKm: 24 },
  { country: "US", name: "Fayetteville", admin1: "AR", lat: 36.0822, lon: -94.1719, radiusKm: 24 },
  { country: "US", name: "Oklahoma City", admin1: "OK", lat: 35.4676, lon: -97.5164, radiusKm: 26 },
  { country: "US", name: "Tulsa", admin1: "OK", lat: 36.154, lon: -95.9928, radiusKm: 24 },
  { country: "US", name: "Wichita", admin1: "KS", lat: 37.6872, lon: -97.3301, radiusKm: 24 },
  { country: "US", name: "Albuquerque", admin1: "NM", lat: 35.0844, lon: -106.6504, radiusKm: 26 },
  { country: "US", name: "Santa Fe", admin1: "NM", lat: 35.687, lon: -105.9378, radiusKm: 22 },
  { country: "US", name: "Boise", admin1: "ID", lat: 43.615, lon: -116.2023, radiusKm: 26 },
  { country: "US", name: "Missoula", admin1: "MT", lat: 46.8721, lon: -113.994, radiusKm: 24 },
  { country: "US", name: "Bozeman", admin1: "MT", lat: 45.677, lon: -111.0429, radiusKm: 24 },
  { country: "US", name: "Billings", admin1: "MT", lat: 45.7833, lon: -108.5007, radiusKm: 24 },
  { country: "US", name: "Omaha", admin1: "NE", lat: 41.2565, lon: -95.9345, radiusKm: 24 },
  { country: "US", name: "Lincoln", admin1: "NE", lat: 40.8136, lon: -96.7026, radiusKm: 22 },
  { country: "US", name: "Des Moines", admin1: "IA", lat: 41.5868, lon: -93.625, radiusKm: 24 },
  { country: "US", name: "Sioux Falls", admin1: "SD", lat: 43.546, lon: -96.7313, radiusKm: 24 },
  { country: "US", name: "Fargo", admin1: "ND", lat: 46.8772, lon: -96.7898, radiusKm: 24 },
  { country: "US", name: "Burlington", admin1: "VT", lat: 44.4759, lon: -73.2121, radiusKm: 22 },
  { country: "US", name: "Manchester", admin1: "NH", lat: 42.9956, lon: -71.4548, radiusKm: 22 },
  { country: "US", name: "Portland", admin1: "ME", lat: 43.6591, lon: -70.2568, radiusKm: 24 },
  { country: "US", name: "Honolulu", admin1: "HI", lat: 21.3069, lon: -157.8583, radiusKm: 26 },
  { country: "US", name: "Anchorage", admin1: "AK", lat: 61.2181, lon: -149.9003, radiusKm: 28 },

  // Canada
  { country: "CA", name: "Toronto", admin1: "ON", lat: 43.6532, lon: -79.3832, radiusKm: 28, featured: true },
  { country: "CA", name: "Mississauga", admin1: "ON", lat: 43.589, lon: -79.6441, radiusKm: 18, featured: true },
  { country: "CA", name: "Ottawa", admin1: "ON", lat: 45.4215, lon: -75.6972, radiusKm: 26, featured: true },
  { country: "CA", name: "Hamilton", admin1: "ON", lat: 43.2557, lon: -79.8711, radiusKm: 22 },
  { country: "CA", name: "Vancouver", admin1: "BC", lat: 49.2827, lon: -123.1207, radiusKm: 28, featured: true },
  { country: "CA", name: "Victoria", admin1: "BC", lat: 48.4284, lon: -123.3656, radiusKm: 22 },
  { country: "CA", name: "Kelowna", admin1: "BC", lat: 49.888, lon: -119.496, radiusKm: 22 },
  { country: "CA", name: "Montreal", admin1: "QC", lat: 45.5017, lon: -73.5673, radiusKm: 28, featured: true },
  { country: "CA", name: "Quebec City", admin1: "QC", lat: 46.8139, lon: -71.208, radiusKm: 24 },
  { country: "CA", name: "Calgary", admin1: "AB", lat: 51.0447, lon: -114.0719, radiusKm: 28, featured: true },
  { country: "CA", name: "Edmonton", admin1: "AB", lat: 53.5461, lon: -113.4938, radiusKm: 28 },
  { country: "CA", name: "Banff", admin1: "AB", lat: 51.1784, lon: -115.5708, radiusKm: 18, featured: true },
  { country: "CA", name: "Winnipeg", admin1: "MB", lat: 49.8951, lon: -97.1384, radiusKm: 26 },
  { country: "CA", name: "Halifax", admin1: "NS", lat: 44.6488, lon: -63.5752, radiusKm: 24 },

  // Australia & New Zealand
  { country: "AU", name: "Sydney", admin1: "NSW", lat: -33.8688, lon: 151.2093, radiusKm: 32, featured: true },
  { country: "AU", name: "Newcastle", admin1: "NSW", lat: -32.9283, lon: 151.7817, radiusKm: 28 },
  { country: "AU", name: "Wollongong", admin1: "NSW", lat: -34.4278, lon: 150.8931, radiusKm: 24 },
  { country: "AU", name: "Melbourne", admin1: "VIC", lat: -37.8136, lon: 144.9631, radiusKm: 32, featured: true },
  { country: "AU", name: "Geelong", admin1: "VIC", lat: -38.1499, lon: 144.3617, radiusKm: 24 },
  { country: "AU", name: "Brisbane", admin1: "QLD", lat: -27.4705, lon: 153.026, radiusKm: 32, featured: true },
  { country: "AU", name: "Gold Coast", admin1: "QLD", lat: -28.0167, lon: 153.4, radiusKm: 28 },
  { country: "AU", name: "Sunshine Coast", admin1: "QLD", lat: -26.65, lon: 153.0667, radiusKm: 28 },
  { country: "AU", name: "Perth", admin1: "WA", lat: -31.9505, lon: 115.8605, radiusKm: 32, featured: true },
  { country: "AU", name: "Adelaide", admin1: "SA", lat: -34.9285, lon: 138.6007, radiusKm: 28, featured: true },
  { country: "AU", name: "Hobart", admin1: "TAS", lat: -42.8821, lon: 147.3272, radiusKm: 24 },
  { country: "AU", name: "Canberra", admin1: "ACT", lat: -35.2809, lon: 149.13, radiusKm: 26 },
  { country: "NZ", name: "Auckland", lat: -36.8485, lon: 174.7633, radiusKm: 32, featured: true },
  { country: "NZ", name: "Wellington", lat: -41.2866, lon: 174.7756, radiusKm: 28, featured: true },
  { country: "NZ", name: "Christchurch", lat: -43.532, lon: 172.6306, radiusKm: 28, featured: true },
  { country: "NZ", name: "Dunedin", lat: -45.8788, lon: 170.5028, radiusKm: 24 },
  { country: "NZ", name: "Tauranga", lat: -37.6878, lon: 176.1651, radiusKm: 24 },
  { country: "NZ", name: "Queenstown", lat: -45.0312, lon: 168.6626, radiusKm: 28 },
  { country: "NZ", name: "Hamilton", lat: -37.787, lon: 175.2793, radiusKm: 24 },

  // United Kingdom & Ireland
  { country: "GB", name: "London", lat: 51.5074, lon: -0.1278, radiusKm: 30, featured: true },
  { country: "GB", name: "Manchester", lat: 53.4808, lon: -2.2426, radiusKm: 24, featured: true },
  { country: "GB", name: "Birmingham", lat: 52.4862, lon: -1.8904, radiusKm: 24 },
  { country: "GB", name: "Leeds", lat: 53.8008, lon: -1.5491, radiusKm: 24 },
  { country: "GB", name: "Glasgow", lat: 55.8642, lon: -4.2518, radiusKm: 26, featured: true },
  { country: "GB", name: "Edinburgh", lat: 55.9533, lon: -3.1883, radiusKm: 24 },
  { country: "GB", name: "Liverpool", lat: 53.4084, lon: -2.9916, radiusKm: 22, featured: true },
  { country: "GB", name: "Bristol", lat: 51.4545, lon: -2.5879, radiusKm: 24, featured: true },
  { country: "GB", name: "Sheffield", lat: 53.3811, lon: -1.4701, radiusKm: 22 },
  { country: "GB", name: "Newcastle upon Tyne", lat: 54.9783, lon: -1.6178, radiusKm: 22 },
  { country: "GB", name: "Nottingham", lat: 52.9548, lon: -1.1581, radiusKm: 22 },
  { country: "GB", name: "Cardiff", lat: 51.4816, lon: -3.1791, radiusKm: 22 },
  { country: "GB", name: "Belfast", lat: 54.5973, lon: -5.9301, radiusKm: 24 },
  { country: "GB", name: "Brighton", lat: 50.8225, lon: -0.1372, radiusKm: 20 },
  { country: "GB", name: "Plymouth", lat: 50.3755, lon: -4.1427, radiusKm: 22 },
  { country: "GB", name: "Bournemouth", lat: 50.7208, lon: -1.9047, radiusKm: 22 },
  { country: "IE", name: "Dublin", lat: 53.3498, lon: -6.2603, radiusKm: 28, featured: true },
  { country: "IE", name: "Cork", lat: 51.8985, lon: -8.4756, radiusKm: 24, featured: true },
  { country: "IE", name: "Galway", lat: 53.2707, lon: -9.0568, radiusKm: 22 },

  // Western & Central Europe
  { country: "FR", name: "Paris", lat: 48.8566, lon: 2.3522, radiusKm: 30, featured: true },
  { country: "FR", name: "Lyon", lat: 45.764, lon: 4.8357, radiusKm: 26, featured: true },
  { country: "FR", name: "Marseille", lat: 43.2965, lon: 5.3698, radiusKm: 26, featured: true },
  { country: "FR", name: "Toulouse", lat: 43.6047, lon: 1.4442, radiusKm: 26, featured: true },
  { country: "FR", name: "Bordeaux", lat: 44.8378, lon: -0.5792, radiusKm: 26, featured: true },
  { country: "FR", name: "Lille", lat: 50.6292, lon: 3.0573, radiusKm: 24 },
  { country: "FR", name: "Nice", lat: 43.7102, lon: 7.262, radiusKm: 24 },
  { country: "FR", name: "Nantes", lat: 47.2184, lon: -1.5536, radiusKm: 26 },
  { country: "FR", name: "Strasbourg", lat: 48.5734, lon: 7.7521, radiusKm: 24 },
  { country: "FR", name: "Rennes", lat: 48.1173, lon: -1.6778, radiusKm: 24 },
  { country: "FR", name: "Montpellier", lat: 43.6108, lon: 3.8767, radiusKm: 24, featured: true },
  { country: "FR", name: "Grenoble", lat: 45.1885, lon: 5.7245, radiusKm: 22 },
  { country: "DE", name: "Berlin", lat: 52.52, lon: 13.405, radiusKm: 30, featured: true },
  { country: "DE", name: "Hamburg", lat: 53.5511, lon: 9.9937, radiusKm: 28, featured: true },
  { country: "DE", name: "Munich", lat: 48.1351, lon: 11.582, radiusKm: 28, featured: true },
  { country: "DE", name: "Cologne", lat: 50.9375, lon: 6.9603, radiusKm: 24, featured: true },
  { country: "DE", name: "Frankfurt", lat: 50.1109, lon: 8.6821, radiusKm: 26, featured: true },
  { country: "DE", name: "Stuttgart", lat: 48.7758, lon: 9.1829, radiusKm: 26, featured: true },
  { country: "DE", name: "Düsseldorf", lat: 51.2277, lon: 6.7735, radiusKm: 20 },
  { country: "DE", name: "Dortmund", lat: 51.5136, lon: 7.4653, radiusKm: 20 },
  { country: "DE", name: "Leipzig", lat: 51.3397, lon: 12.3731, radiusKm: 24 },
  { country: "DE", name: "Dresden", lat: 51.0504, lon: 13.7373, radiusKm: 24 },
  { country: "DE", name: "Hannover", lat: 52.3759, lon: 9.732, radiusKm: 24 },
  { country: "DE", name: "Nuremberg", lat: 49.4521, lon: 11.0767, radiusKm: 24 },
  { country: "DE", name: "Bremen", lat: 53.0793, lon: 8.8017, radiusKm: 24 },
  { country: "ES", name: "Madrid", lat: 40.4168, lon: -3.7038, radiusKm: 28, featured: true },
  { country: "ES", name: "Barcelona", lat: 41.3874, lon: 2.1686, radiusKm: 28, featured: true },
  { country: "ES", name: "Valencia", lat: 39.4699, lon: -0.3763, radiusKm: 26, featured: true },
  { country: "ES", name: "Seville", lat: 37.3891, lon: -5.9845, radiusKm: 26, featured: true },
  { country: "ES", name: "Málaga", lat: 36.7213, lon: -4.4214, radiusKm: 26, featured: true },
  { country: "ES", name: "Bilbao", lat: 43.263, lon: -2.935, radiusKm: 24, featured: true },
  { country: "ES", name: "Zaragoza", lat: 41.6488, lon: -0.8891, radiusKm: 24, featured: true },
  { country: "ES", name: "Vigo", lat: 42.2406, lon: -8.7207, radiusKm: 22 },
  { country: "ES", name: "San Sebastián", lat: 43.3183, lon: -1.9812, radiusKm: 20 },
  { country: "ES", name: "Palma de Mallorca", lat: 39.5696, lon: 2.6502, radiusKm: 24 },
  { country: "ES", name: "Las Palmas", lat: 28.1235, lon: -15.4363, radiusKm: 24 },
  { country: "ES", name: "Santa Cruz de Tenerife", lat: 28.4636, lon: -16.2518, radiusKm: 22 },
  { country: "IT", name: "Rome", lat: 41.9028, lon: 12.4964, radiusKm: 28, featured: true },
  { country: "IT", name: "Milan", lat: 45.4642, lon: 9.19, radiusKm: 28, featured: true },
  { country: "IT", name: "Turin", lat: 45.0703, lon: 7.6869, radiusKm: 26 },
  { country: "IT", name: "Naples", lat: 40.8518, lon: 14.2681, radiusKm: 26, featured: true },
  { country: "IT", name: "Bologna", lat: 44.4949, lon: 11.3426, radiusKm: 24, featured: true },
  { country: "IT", name: "Florence", lat: 43.7696, lon: 11.2558, radiusKm: 24, featured: true },
  { country: "IT", name: "Genoa", lat: 44.4056, lon: 8.9463, radiusKm: 24 },
  { country: "IT", name: "Venice", lat: 45.4408, lon: 12.3155, radiusKm: 24 },
  { country: "NL", name: "Amsterdam", lat: 52.3676, lon: 4.9041, radiusKm: 22, featured: true },
  { country: "NL", name: "Rotterdam", lat: 51.9244, lon: 4.4777, radiusKm: 20, featured: true },
  { country: "NL", name: "The Hague", lat: 52.0705, lon: 4.3007, radiusKm: 16, featured: true },
  { country: "NL", name: "Utrecht", lat: 52.0907, lon: 5.1214, radiusKm: 18, featured: true },
  { country: "NL", name: "Eindhoven", lat: 51.4416, lon: 5.4697, radiusKm: 20 },
  { country: "BE", name: "Brussels", lat: 50.8503, lon: 4.3517, radiusKm: 20, featured: true },
  { country: "BE", name: "Antwerp", lat: 51.2194, lon: 4.4025, radiusKm: 20, featured: true },
  { country: "BE", name: "Ghent", lat: 51.0543, lon: 3.7174, radiusKm: 18 },
  { country: "BE", name: "Brugge", lat: 51.2093, lon: 3.2247, radiusKm: 18, featured: true },
  { country: "CH", name: "Zurich", lat: 47.3769, lon: 8.5417, radiusKm: 22, featured: true },
  { country: "CH", name: "Geneva", lat: 46.2044, lon: 6.1432, radiusKm: 20 },
  { country: "CH", name: "Basel", lat: 47.5596, lon: 7.5886, radiusKm: 20, featured: true },
  { country: "CH", name: "Bern", lat: 46.948, lon: 7.4474, radiusKm: 20, featured: true },
  { country: "CH", name: "Lausanne", lat: 46.5197, lon: 6.6323, radiusKm: 20, featured: true },
  { country: "AT", name: "Vienna", lat: 48.2082, lon: 16.3738, radiusKm: 26, featured: true },
  { country: "AT", name: "Graz", lat: 47.0707, lon: 15.4395, radiusKm: 22, featured: true },
  { country: "AT", name: "Linz", lat: 48.3069, lon: 14.2858, radiusKm: 22, featured: true },
  { country: "AT", name: "Salzburg", lat: 47.8095, lon: 13.055, radiusKm: 20 },
  { country: "AT", name: "Innsbruck", lat: 47.2692, lon: 11.4041, radiusKm: 22 },
  { country: "PT", name: "Lisbon", lat: 38.7223, lon: -9.1393, radiusKm: 26, featured: true },
  { country: "PT", name: "Porto", lat: 41.1579, lon: -8.6291, radiusKm: 24, featured: true },

  // Nordics & Eastern Europe
  { country: "SE", name: "Stockholm", lat: 59.3293, lon: 18.0686, radiusKm: 28, featured: true },
  { country: "SE", name: "Gothenburg", lat: 57.7089, lon: 11.9746, radiusKm: 26, featured: true },
  { country: "SE", name: "Malmö", lat: 55.605, lon: 13.0038, radiusKm: 24, featured: true },
  { country: "NO", name: "Oslo", lat: 59.9139, lon: 10.7522, radiusKm: 28, featured: true },
  { country: "NO", name: "Bergen", lat: 60.3913, lon: 5.3221, radiusKm: 24, featured: true },
  { country: "NO", name: "Trondheim", lat: 63.4305, lon: 10.3951, radiusKm: 24, featured: true },
  { country: "NO", name: "Stavanger", lat: 58.97, lon: 5.7331, radiusKm: 22, featured: true },
  { country: "DK", name: "Copenhagen", lat: 55.6761, lon: 12.5683, radiusKm: 28, featured: true },
  { country: "DK", name: "Aarhus", lat: 56.1629, lon: 10.2039, radiusKm: 24, featured: true },
  { country: "DK", name: "Odense", lat: 55.4038, lon: 10.4024, radiusKm: 22 },
  { country: "FI", name: "Helsinki", lat: 60.1699, lon: 24.9384, radiusKm: 28, featured: true },
  { country: "FI", name: "Tampere", lat: 61.4978, lon: 23.761, radiusKm: 24, featured: true },
  { country: "FI", name: "Turku", lat: 60.4518, lon: 22.2666, radiusKm: 24, featured: true },
  { country: "PL", name: "Warsaw", lat: 52.2297, lon: 21.0122, radiusKm: 28, featured: true },
  { country: "PL", name: "Kraków", lat: 50.0647, lon: 19.945, radiusKm: 26, featured: true },
  { country: "PL", name: "Wrocław", lat: 51.1079, lon: 17.0385, radiusKm: 26, featured: true },
  { country: "PL", name: "Gdańsk", lat: 54.352, lon: 18.6466, radiusKm: 26, featured: true },
  { country: "PL", name: "Łódź", lat: 51.7592, lon: 19.456, radiusKm: 24, featured: true },
  { country: "PL", name: "Poznań", lat: 52.4064, lon: 16.9252, radiusKm: 24 },
  { country: "CZ", name: "Prague", lat: 50.0755, lon: 14.4378, radiusKm: 28, featured: true },
  { country: "CZ", name: "Brno", lat: 49.1951, lon: 16.6068, radiusKm: 24, featured: true },
  { country: "HU", name: "Budapest", lat: 47.4979, lon: 19.0402, radiusKm: 28, featured: true },
  { country: "RO", name: "Bucharest", lat: 44.4268, lon: 26.1025, radiusKm: 28, featured: true },
  { country: "RO", name: "Cluj-Napoca", lat: 46.7712, lon: 23.6236, radiusKm: 24, featured: true },
  { country: "BG", name: "Sofia", lat: 42.6977, lon: 23.3219, radiusKm: 26, featured: true },
  { country: "GR", name: "Athens", lat: 37.9838, lon: 23.7275, radiusKm: 28, featured: true },
  { country: "GR", name: "Thessaloniki", lat: 40.6401, lon: 22.9444, radiusKm: 26, featured: true },
  { country: "HR", name: "Zagreb", lat: 45.815, lon: 15.9819, radiusKm: 26, featured: true },
  { country: "HR", name: "Split", lat: 43.5081, lon: 16.4402, radiusKm: 22, featured: true },
  { country: "SK", name: "Bratislava", lat: 48.1486, lon: 17.1077, radiusKm: 24, featured: true },
  { country: "SK", name: "Košice", lat: 48.7164, lon: 21.2611, radiusKm: 22, featured: true },
  { country: "EE", name: "Tallinn", lat: 59.437, lon: 24.7536, radiusKm: 26, featured: true },
  { country: "LV", name: "Riga", lat: 56.9496, lon: 24.1052, radiusKm: 26, featured: true },
  { country: "LT", name: "Vilnius", lat: 54.6872, lon: 25.2797, radiusKm: 26, featured: true },
  { country: "UA", name: "Kyiv", lat: 50.4501, lon: 30.5234, radiusKm: 30, featured: true },
  { country: "UA", name: "Lviv", lat: 49.8397, lon: 24.0297, radiusKm: 26, featured: true },
  { country: "UA", name: "Odesa", lat: 46.4825, lon: 30.7233, radiusKm: 26 },
  { country: "UA", name: "Kharkiv", lat: 49.9935, lon: 36.2304, radiusKm: 26, featured: true },
  { country: "RU", name: "Moscow", lat: 55.7558, lon: 37.6173, radiusKm: 35, featured: true },
  { country: "RU", name: "Saint Petersburg", lat: 59.9311, lon: 30.3609, radiusKm: 32, featured: true },
  { country: "RU", name: "Krasnodar", lat: 45.0355, lon: 38.9753, radiusKm: 26, featured: true },
  { country: "RU", name: "Kazan", lat: 55.7887, lon: 49.1221, radiusKm: 26 },
  { country: "TR", name: "Istanbul", lat: 41.0082, lon: 28.9784, radiusKm: 35, featured: true },
  { country: "TR", name: "Ankara", lat: 39.9334, lon: 32.8597, radiusKm: 28, featured: true },
  { country: "TR", name: "İzmir", lat: 38.4237, lon: 27.1428, radiusKm: 28, featured: true },
  { country: "TR", name: "Antalya", lat: 36.8969, lon: 30.7133, radiusKm: 26 },

  // Latin America & Caribbean
  { country: "BR", name: "São Paulo", admin1: "SP", lat: -23.5505, lon: -46.6333, radiusKm: 32, featured: true },
  { country: "BR", name: "Rio de Janeiro", admin1: "RJ", lat: -22.9068, lon: -43.1729, radiusKm: 32, featured: true },
  { country: "BR", name: "Belo Horizonte", admin1: "MG", lat: -19.9167, lon: -43.9345, radiusKm: 28, featured: true },
  { country: "BR", name: "Curitiba", admin1: "PR", lat: -25.4284, lon: -49.2733, radiusKm: 28, featured: true },
  { country: "BR", name: "Porto Alegre", admin1: "RS", lat: -30.0346, lon: -51.2177, radiusKm: 28, featured: true },
  { country: "BR", name: "Florianópolis", admin1: "SC", lat: -27.5954, lon: -48.548, radiusKm: 26 },
  { country: "BR", name: "Fortaleza", admin1: "CE", lat: -3.7172, lon: -38.5433, radiusKm: 26 },
  { country: "BR", name: "Recife", admin1: "PE", lat: -8.0476, lon: -34.877, radiusKm: 26 },
  { country: "BR", name: "Brasília", admin1: "DF", lat: -15.7975, lon: -47.8919, radiusKm: 28 },
  { country: "BR", name: "Campinas", admin1: "SP", lat: -22.9099, lon: -47.0626, radiusKm: 24 },
  { country: "MX", name: "Mexico City", lat: 19.4326, lon: -99.1332, radiusKm: 32, featured: true },
  { country: "MX", name: "Guadalajara", lat: 20.6597, lon: -103.3496, radiusKm: 28, featured: true },
  { country: "MX", name: "Monterrey", lat: 25.6866, lon: -100.3161, radiusKm: 28, featured: true },
  { country: "MX", name: "Tijuana", lat: 32.5149, lon: -117.0382, radiusKm: 26, featured: true },
  { country: "MX", name: "Cancún", lat: 21.1619, lon: -86.8515, radiusKm: 24 },
  { country: "MX", name: "Puebla", lat: 19.0414, lon: -98.2063, radiusKm: 26 },
  { country: "MX", name: "Morelia", lat: 19.706, lon: -101.195, radiusKm: 24 },
  { country: "AR", name: "Buenos Aires", lat: -34.6037, lon: -58.3816, radiusKm: 32, featured: true },
  { country: "AR", name: "Córdoba", lat: -31.4201, lon: -64.1888, radiusKm: 28, featured: true },
  { country: "AR", name: "Rosario", lat: -32.9442, lon: -60.6505, radiusKm: 26, featured: true },
  { country: "AR", name: "Mar del Plata", lat: -38.0055, lon: -57.5426, radiusKm: 24 },
  { country: "CL", name: "Santiago", lat: -33.4489, lon: -70.6693, radiusKm: 32, featured: true },
  { country: "CL", name: "Valparaíso", lat: -33.0472, lon: -71.6127, radiusKm: 24, featured: true },
  { country: "CL", name: "Concepción", lat: -36.8201, lon: -73.0444, radiusKm: 24, featured: true },
  { country: "CO", name: "Bogota", lat: 4.711, lon: -74.0721, radiusKm: 30, featured: true },
  { country: "CO", name: "Medellin", lat: 6.2442, lon: -75.5812, radiusKm: 26, featured: true },
  { country: "CO", name: "Cali", lat: 3.4516, lon: -76.532, radiusKm: 26, featured: true },
  { country: "CO", name: "Barranquilla", lat: 10.9685, lon: -74.7813, radiusKm: 24, featured: true },
  { country: "PE", name: "Lima", lat: -12.0464, lon: -77.0428, radiusKm: 32, featured: true },
  { country: "PE", name: "Arequipa", lat: -16.409, lon: -71.5375, radiusKm: 24, featured: true },
  { country: "EC", name: "Quito", lat: -0.1807, lon: -78.4678, radiusKm: 28, featured: true },
  { country: "EC", name: "Guayaquil", lat: -2.171, lon: -79.9224, radiusKm: 28, featured: true },
  { country: "UY", name: "Montevideo", lat: -34.9011, lon: -56.1645, radiusKm: 28, featured: true },
  { country: "VE", name: "Caracas", lat: 10.4806, lon: -66.9036, radiusKm: 28, featured: true },
  { country: "CR", name: "San José", lat: 9.9281, lon: -84.0907, radiusKm: 28, featured: true },
  { country: "PA", name: "Panama City", lat: 8.9824, lon: -79.5199, radiusKm: 28, featured: true },
  { country: "PR", name: "San Juan", lat: 18.4655, lon: -66.1057, radiusKm: 26, featured: true },

  // Asia & Africa
  { country: "HK", name: "Hong Kong", lat: 22.3193, lon: 114.1694, radiusKm: 35, featured: true },
  { country: "SG", name: "Singapore", lat: 1.3521, lon: 103.8198, radiusKm: 35, featured: true },
  { country: "KR", name: "Seoul", lat: 37.5665, lon: 126.978, radiusKm: 28, featured: true },
  { country: "KR", name: "Busan", lat: 35.1796, lon: 129.0756, radiusKm: 28, featured: true },
  { country: "KR", name: "Incheon", lat: 37.4563, lon: 126.7052, radiusKm: 22, featured: true },
  { country: "TW", name: "Taipei", lat: 25.033, lon: 121.5654, radiusKm: 28, featured: true },
  { country: "TW", name: "Taichung", lat: 24.1477, lon: 120.6736, radiusKm: 26, featured: true },
  { country: "TW", name: "Kaohsiung", lat: 22.6273, lon: 120.3014, radiusKm: 26, featured: true },
  { country: "TW", name: "Taoyuan", lat: 24.9936, lon: 121.301, radiusKm: 22 },
  { country: "TW", name: "Tainan", lat: 22.9997, lon: 120.227, radiusKm: 24 },
  { country: "CN", name: "Beijing", lat: 39.9042, lon: 116.4074, radiusKm: 35, featured: true },
  { country: "CN", name: "Shanghai", lat: 31.2304, lon: 121.4737, radiusKm: 35, featured: true },
  { country: "CN", name: "Shenzhen", lat: 22.5431, lon: 114.0579, radiusKm: 32, featured: true },
  { country: "CN", name: "Guangzhou", lat: 23.1291, lon: 113.2644, radiusKm: 32, featured: true },
  { country: "TH", name: "Bangkok", lat: 13.7563, lon: 100.5018, radiusKm: 35, featured: true },
  { country: "TH", name: "Chiang Mai", lat: 18.7883, lon: 98.9853, radiusKm: 28, featured: true },
  { country: "TH", name: "Phuket", lat: 7.8804, lon: 98.3923, radiusKm: 30, featured: true },
  { country: "TH", name: "Pattaya", lat: 12.9236, lon: 100.8825, radiusKm: 24 },
  { country: "ID", name: "Jakarta", lat: -6.2088, lon: 106.8456, radiusKm: 32, featured: true },
  { country: "ID", name: "Denpasar", lat: -8.6705, lon: 115.2126, radiusKm: 28, featured: true },
  { country: "ID", name: "Surabaya", lat: -7.2575, lon: 112.7521, radiusKm: 28, featured: true },
  { country: "MY", name: "Kuala Lumpur", lat: 3.139, lon: 101.6869, radiusKm: 32, featured: true },
  { country: "MY", name: "Penang", lat: 5.4141, lon: 100.3288, radiusKm: 26, featured: true },
  { country: "PH", name: "Manila", lat: 14.5995, lon: 120.9842, radiusKm: 32, featured: true },
  { country: "VN", name: "Ho Chi Minh City", lat: 10.8231, lon: 106.6297, radiusKm: 32, featured: true },
  { country: "VN", name: "Hanoi", lat: 21.0278, lon: 105.8342, radiusKm: 30, featured: true },
  { country: "IN", name: "Mumbai", lat: 19.076, lon: 72.8777, radiusKm: 32, featured: true },
  { country: "IN", name: "Delhi", lat: 28.6139, lon: 77.209, radiusKm: 32, featured: true },
  { country: "IN", name: "Bangalore", lat: 12.9716, lon: 77.5946, radiusKm: 30, featured: true },
  { country: "IN", name: "Pune", lat: 18.5204, lon: 73.8567, radiusKm: 26, featured: true },
  { country: "AE", name: "Dubai", lat: 25.2048, lon: 55.2708, radiusKm: 32, featured: true },
  { country: "AE", name: "Abu Dhabi", lat: 24.4539, lon: 54.3773, radiusKm: 32, featured: true },
  { country: "IL", name: "Tel Aviv", lat: 32.0853, lon: 34.7818, radiusKm: 22, featured: true },
  { country: "IL", name: "Jerusalem", lat: 31.7683, lon: 35.2137, radiusKm: 24, featured: true },
  { country: "IL", name: "Haifa", lat: 32.794, lon: 34.9896, radiusKm: 22, featured: true },
  { country: "MA", name: "Rabat", lat: 34.0209, lon: -6.8416, radiusKm: 22, featured: true },
  { country: "MA", name: "Casablanca", lat: 33.5731, lon: -7.5898, radiusKm: 26, featured: true },
  { country: "MA", name: "Marrakech", lat: 31.6295, lon: -7.9811, radiusKm: 26, featured: true },
  { country: "MA", name: "Agadir", lat: 30.4278, lon: -9.5981, radiusKm: 24, featured: true },
  { country: "MA", name: "Tangier", lat: 35.7595, lon: -5.834, radiusKm: 24, featured: true },
  { country: "ZA", name: "Cape Town", lat: -33.9249, lon: 18.4241, radiusKm: 35, featured: true },
  { country: "ZA", name: "Johannesburg", lat: -26.2041, lon: 28.0473, radiusKm: 32, featured: true },
  { country: "ZA", name: "Pretoria", lat: -25.7479, lon: 28.2293, radiusKm: 26, featured: true },
  { country: "ZA", name: "Durban", lat: -29.8587, lon: 31.0218, radiusKm: 30, featured: true },

  // Japan — Comprehensive Gazetteer so all Mandarin-Pinyin Kanji strings snap to real Romaji cities
  { country: "JP", name: "Tokyo", lat: 35.6762, lon: 139.6503, radiusKm: 30, featured: true },
  { country: "JP", name: "Hachioji", lat: 35.6664, lon: 139.316, radiusKm: 18, featured: true },
  { country: "JP", name: "Yokohama", lat: 35.4437, lon: 139.638, radiusKm: 24, featured: true },
  { country: "JP", name: "Yokosuka", lat: 35.2815, lon: 139.6722, radiusKm: 18 },
  { country: "JP", name: "Fujisawa", lat: 35.3392, lon: 139.49, radiusKm: 18 },
  { country: "JP", name: "Hadano", lat: 35.3742, lon: 139.2575, radiusKm: 18 },
  { country: "JP", name: "Saitama", lat: 35.8617, lon: 139.6455, radiusKm: 24 },
  { country: "JP", name: "Kumagaya", lat: 36.1473, lon: 139.3886, radiusKm: 24 },
  { country: "JP", name: "Chiba", lat: 35.6074, lon: 140.1065, radiusKm: 26 },
  { country: "JP", name: "Kisarazu", lat: 35.3759, lon: 139.9168, radiusKm: 22 },
  { country: "JP", name: "Minamiboso", lat: 35.0441, lon: 139.8433, radiusKm: 26 },
  { country: "JP", name: "Isumi", lat: 35.29, lon: 140.41, radiusKm: 26 },
  { country: "JP", name: "Narita", lat: 35.7767, lon: 140.3183, radiusKm: 26 },
  { country: "JP", name: "Koga", lat: 36.1783, lon: 139.7556, radiusKm: 24 },
  { country: "JP", name: "Mito", lat: 36.3659, lon: 140.4712, radiusKm: 32 },
  { country: "JP", name: "Hitachi", lat: 36.5992, lon: 140.6514, radiusKm: 28 },
  { country: "JP", name: "Utsunomiya", lat: 36.5551, lon: 139.8828, radiusKm: 28 },
  { country: "JP", name: "Nasushiobara", lat: 36.92, lon: 139.98, radiusKm: 28 },
  { country: "JP", name: "Maebashi", lat: 36.3895, lon: 139.0634, radiusKm: 30 },
  { country: "JP", name: "Numata", lat: 36.6439, lon: 139.0425, radiusKm: 28 },
  { country: "JP", name: "Sapporo", lat: 43.0618, lon: 141.3545, radiusKm: 32, featured: true },
  { country: "JP", name: "Otaru", lat: 43.1907, lon: 140.9947, radiusKm: 28 },
  { country: "JP", name: "Iwamizawa", lat: 43.1961, lon: 141.7758, radiusKm: 30 },
  { country: "JP", name: "Tomakomai", lat: 42.6343, lon: 141.6054, radiusKm: 28 },
  { country: "JP", name: "Hakodate", lat: 41.7687, lon: 140.7291, radiusKm: 28 },
  { country: "JP", name: "Obihiro", lat: 42.9239, lon: 143.1961, radiusKm: 28 },
  { country: "JP", name: "Kushiro", lat: 42.9849, lon: 144.3814, radiusKm: 28 },
  { country: "JP", name: "Monbetsu", lat: 44.3458, lon: 143.3511, radiusKm: 28 },
  { country: "JP", name: "Aomori", lat: 40.8222, lon: 140.7474, radiusKm: 28 },
  { country: "JP", name: "Noshiro", lat: 40.2039, lon: 140.0267, radiusKm: 28 },
  { country: "JP", name: "Akita", lat: 39.72, lon: 140.1025, radiusKm: 28 },
  { country: "JP", name: "Yokote", lat: 39.3136, lon: 140.5533, radiusKm: 28 },
  { country: "JP", name: "Sakata", lat: 38.9144, lon: 139.8364, radiusKm: 32 },
  { country: "JP", name: "Morioka", lat: 39.702, lon: 141.1545, radiusKm: 32 },
  { country: "JP", name: "Sendai", lat: 38.2682, lon: 140.8694, radiusKm: 32 },
  { country: "JP", name: "Ishinomaki", lat: 38.4344, lon: 141.3028, radiusKm: 30 },
  { country: "JP", name: "Yamagata", lat: 38.2554, lon: 140.3396, radiusKm: 32 },
  { country: "JP", name: "Fukushima", lat: 37.7608, lon: 140.4747, radiusKm: 30 },
  { country: "JP", name: "Soma", lat: 37.7967, lon: 140.9194, radiusKm: 26 },
  { country: "JP", name: "Koriyama", lat: 37.398, lon: 140.388, radiusKm: 28 },
  { country: "JP", name: "Iwaki", lat: 37.0504, lon: 140.8877, radiusKm: 32 },
  { country: "JP", name: "Niigata", lat: 37.9161, lon: 139.0364, radiusKm: 35 },
  { country: "JP", name: "Murakami", lat: 38.21, lon: 139.44, radiusKm: 26 },
  { country: "JP", name: "Nagaoka", lat: 37.4463, lon: 138.8513, radiusKm: 32 },
  { country: "JP", name: "Minamiuonuma", lat: 37.06, lon: 138.85, radiusKm: 28 },
  { country: "JP", name: "Itoigawa", lat: 37.03, lon: 137.82, radiusKm: 28 },
  { country: "JP", name: "Toyama", lat: 36.6953, lon: 137.2113, radiusKm: 32 },
  { country: "JP", name: "Kurobe", lat: 36.85, lon: 137.56, radiusKm: 26 },
  { country: "JP", name: "Kanazawa", lat: 36.5613, lon: 136.6562, radiusKm: 28 },
  { country: "JP", name: "Fukui", lat: 36.0641, lon: 136.2195, radiusKm: 30 },
  { country: "JP", name: "Nagano", lat: 36.6485, lon: 138.1942, radiusKm: 30 },
  { country: "JP", name: "Hakuba", lat: 36.6982, lon: 137.8619, radiusKm: 26 },
  { country: "JP", name: "Ueda", lat: 36.4019, lon: 138.2489, radiusKm: 28 },
  { country: "JP", name: "Fujiyoshida", lat: 35.4875, lon: 138.8078, radiusKm: 24 },
  { country: "JP", name: "Shizuoka", lat: 34.9756, lon: 138.3828, radiusKm: 28 },
  { country: "JP", name: "Fuji", lat: 35.1614, lon: 138.6763, radiusKm: 26 },
  { country: "JP", name: "Makinohara", lat: 34.73, lon: 138.23, radiusKm: 26 },
  { country: "JP", name: "Hamamatsu", lat: 34.7108, lon: 137.7261, radiusKm: 28 },
  { country: "JP", name: "Toyohashi", lat: 34.7692, lon: 137.3914, radiusKm: 26 },
  { country: "JP", name: "Nagoya", lat: 35.1815, lon: 136.9066, radiusKm: 30, featured: true },
  { country: "JP", name: "Handa", lat: 34.89, lon: 136.93, radiusKm: 24 },
  { country: "JP", name: "Gifu", lat: 35.4233, lon: 136.7607, radiusKm: 26 },
  { country: "JP", name: "Nagahama", lat: 35.38, lon: 136.27, radiusKm: 24 },
  { country: "JP", name: "Yokkaichi", lat: 34.965, lon: 136.6244, radiusKm: 26 },
  { country: "JP", name: "Ise", lat: 34.4875, lon: 136.7094, radiusKm: 28 },
  { country: "JP", name: "Otsu", lat: 35.0178, lon: 135.8547, radiusKm: 24 },
  { country: "JP", name: "Kyoto", lat: 35.0116, lon: 135.7681, radiusKm: 24, featured: true },
  { country: "JP", name: "Maizuru", lat: 35.48, lon: 135.4, radiusKm: 28 },
  { country: "JP", name: "Osaka", lat: 34.6937, lon: 135.5023, radiusKm: 26, featured: true },
  { country: "JP", name: "Sakai", lat: 34.5733, lon: 135.483, radiusKm: 20 },
  { country: "JP", name: "Nara", lat: 34.6851, lon: 135.8048, radiusKm: 24 },
  { country: "JP", name: "Wakayama", lat: 34.2305, lon: 135.1708, radiusKm: 26 },
  { country: "JP", name: "Susami", lat: 33.56, lon: 135.53, radiusKm: 26 },
  { country: "JP", name: "Kobe", lat: 34.6901, lon: 135.1955, radiusKm: 26, featured: true },
  { country: "JP", name: "Himeji", lat: 34.8151, lon: 134.6853, radiusKm: 28 },
  { country: "JP", name: "Tottori", lat: 35.5011, lon: 134.2351, radiusKm: 35 },
  { country: "JP", name: "Matsue", lat: 35.4681, lon: 133.0484, radiusKm: 35 },
  { country: "JP", name: "Okayama", lat: 34.6551, lon: 133.9195, radiusKm: 32 },
  { country: "JP", name: "Fukuyama", lat: 34.4859, lon: 133.3623, radiusKm: 28 },
  { country: "JP", name: "Onomichi", lat: 34.4089, lon: 133.205, radiusKm: 26 },
  { country: "JP", name: "Hiroshima", lat: 34.3853, lon: 132.4553, radiusKm: 32 },
  { country: "JP", name: "Iwakuni", lat: 34.15, lon: 132.23, radiusKm: 26 },
  { country: "JP", name: "Shunan", lat: 34.05, lon: 131.8, radiusKm: 30 },
  { country: "JP", name: "Hofu", lat: 34.05, lon: 131.56, radiusKm: 26 },
  { country: "JP", name: "Tokushima", lat: 34.0703, lon: 134.5548, radiusKm: 32 },
  { country: "JP", name: "Takamatsu", lat: 34.3428, lon: 134.0466, radiusKm: 30 },
  { country: "JP", name: "Marugame", lat: 34.2894, lon: 133.7975, radiusKm: 28 },
  { country: "JP", name: "Niihama", lat: 33.9603, lon: 133.2833, radiusKm: 28 },
  { country: "JP", name: "Matsuyama", lat: 33.8392, lon: 132.7656, radiusKm: 28 },
  { country: "JP", name: "Kochi", lat: 33.5597, lon: 133.5311, radiusKm: 28 },
  { country: "JP", name: "Shimanto", lat: 33.01, lon: 132.94, radiusKm: 28 },
  { country: "JP", name: "Kitakyushu", lat: 33.8835, lon: 130.8752, radiusKm: 28 },
  { country: "JP", name: "Fukuoka", lat: 33.5902, lon: 130.4017, radiusKm: 28, featured: true },
  { country: "JP", name: "Omuta", lat: 33.03, lon: 130.44, radiusKm: 26 },
  { country: "JP", name: "Karatsu", lat: 33.4494, lon: 129.9686, radiusKm: 28 },
  { country: "JP", name: "Sasebo", lat: 33.1799, lon: 129.7151, radiusKm: 28 },
  { country: "JP", name: "Nagasaki", lat: 32.7503, lon: 129.8779, radiusKm: 28 },
  { country: "JP", name: "Kumamoto", lat: 32.8032, lon: 130.7079, radiusKm: 30 },
  { country: "JP", name: "Yatsushiro", lat: 32.5075, lon: 130.6014, radiusKm: 26 },
  { country: "JP", name: "Amakusa", lat: 32.4594, lon: 130.1931, radiusKm: 28 },
  { country: "JP", name: "Nobeoka", lat: 32.5822, lon: 131.6647, radiusKm: 28 },
  { country: "JP", name: "Miyazaki", lat: 31.9077, lon: 131.4202, radiusKm: 28 },
  { country: "JP", name: "Miyakonojo", lat: 31.72, lon: 131.06, radiusKm: 26 },
  { country: "JP", name: "Minamisatsuma", lat: 31.43, lon: 130.29, radiusKm: 28 },
  { country: "JP", name: "Okinawa", lat: 26.3344, lon: 127.8056, radiusKm: 16 },
  { country: "JP", name: "Naha", lat: 26.2124, lon: 127.6809, radiusKm: 18 },
];

// US State reference centroids for assigning 2-letter admin1 codes to standalone US towns
const US_STATE_REFS: readonly { state: string; lat: number; lon: number }[] = [
  { state: "AL", lat: 32.3668, lon: -86.3 }, { state: "AL", lat: 33.5186, lon: -86.8104 }, { state: "AL", lat: 34.7304, lon: -86.5861 }, { state: "AL", lat: 30.6954, lon: -88.0399 },
  { state: "AK", lat: 61.2181, lon: -149.9003 }, { state: "AK", lat: 64.8378, lon: -147.7164 }, { state: "AK", lat: 58.3019, lon: -134.4197 },
  { state: "AZ", lat: 33.4484, lon: -112.074 }, { state: "AZ", lat: 32.2226, lon: -110.9747 }, { state: "AZ", lat: 35.1983, lon: -111.6513 }, { state: "AZ", lat: 32.6927, lon: -114.6277 },
  { state: "AR", lat: 34.7465, lon: -92.2896 }, { state: "AR", lat: 36.0822, lon: -94.1719 }, { state: "AR", lat: 35.8423, lon: -90.7043 },
  { state: "CA", lat: 34.0522, lon: -118.2437 }, { state: "CA", lat: 32.7157, lon: -117.1611 }, { state: "CA", lat: 37.7749, lon: -122.4194 }, { state: "CA", lat: 38.5816, lon: -121.4944 }, { state: "CA", lat: 36.7378, lon: -119.7871 }, { state: "CA", lat: 35.3733, lon: -119.0187 }, { state: "CA", lat: 40.5865, lon: -122.3917 }, { state: "CA", lat: 40.8021, lon: -124.1637 }, { state: "CA", lat: 33.8303, lon: -116.5453 },
  { state: "CO", lat: 39.7392, lon: -104.9903 }, { state: "CO", lat: 38.8339, lon: -104.8214 }, { state: "CO", lat: 39.0639, lon: -108.5506 }, { state: "CO", lat: 40.5853, lon: -105.0844 }, { state: "CO", lat: 37.2753, lon: -107.8801 },
  { state: "CT", lat: 41.7658, lon: -72.6734 }, { state: "CT", lat: 41.3083, lon: -72.9279 }, { state: "CT", lat: 41.1865, lon: -73.1952 },
  { state: "DE", lat: 39.7391, lon: -75.5398 }, { state: "DE", lat: 39.1582, lon: -75.5244 }, { state: "DE", lat: 38.7165, lon: -75.0855 },
  { state: "DC", lat: 38.9072, lon: -77.0369 },
  { state: "FL", lat: 25.7617, lon: -80.1918 }, { state: "FL", lat: 27.9506, lon: -82.4572 }, { state: "FL", lat: 28.5383, lon: -81.3792 }, { state: "FL", lat: 30.3322, lon: -81.6557 }, { state: "FL", lat: 30.4383, lon: -84.2807 }, { state: "FL", lat: 30.4213, lon: -87.2169 }, { state: "FL", lat: 26.6406, lon: -81.8723 },
  { state: "GA", lat: 33.749, lon: -84.388 }, { state: "GA", lat: 32.0809, lon: -81.0912 }, { state: "GA", lat: 33.4735, lon: -82.0105 }, { state: "GA", lat: 32.461, lon: -84.9877 }, { state: "GA", lat: 31.5785, lon: -84.1557 },
  { state: "HI", lat: 21.3069, lon: -157.8583 }, { state: "HI", lat: 20.7984, lon: -156.3319 }, { state: "HI", lat: 19.7241, lon: -155.0868 }, { state: "HI", lat: 22.0964, lon: -159.5261 },
  { state: "ID", lat: 43.615, lon: -116.2023 }, { state: "ID", lat: 42.8666, lon: -112.4447 }, { state: "ID", lat: 43.4917, lon: -112.0339 }, { state: "ID", lat: 47.6777, lon: -116.7805 },
  { state: "IL", lat: 41.8781, lon: -87.6298 }, { state: "IL", lat: 39.7817, lon: -89.6501 }, { state: "IL", lat: 40.6936, lon: -89.589 }, { state: "IL", lat: 40.1164, lon: -88.2434 }, { state: "IL", lat: 42.2711, lon: -89.094 },
  { state: "IN", lat: 39.7684, lon: -86.1581 }, { state: "IN", lat: 41.0793, lon: -85.1394 }, { state: "IN", lat: 37.9716, lon: -87.5711 }, { state: "IN", lat: 41.6764, lon: -86.252 },
  { state: "IA", lat: 41.5868, lon: -93.625 }, { state: "IA", lat: 41.9779, lon: -91.6656 }, { state: "IA", lat: 41.5236, lon: -90.5776 }, { state: "IA", lat: 42.4999, lon: -96.4003 },
  { state: "KS", lat: 37.6872, lon: -97.3301 }, { state: "KS", lat: 39.0473, lon: -95.6752 }, { state: "KS", lat: 38.8403, lon: -97.6114 }, { state: "KS", lat: 37.9642, lon: -100.8727 },
  { state: "KY", lat: 38.2527, lon: -85.7585 }, { state: "KY", lat: 38.0406, lon: -84.5037 }, { state: "KY", lat: 36.9685, lon: -86.4808 }, { state: "KY", lat: 37.0834, lon: -88.6001 },
  { state: "LA", lat: 29.9511, lon: -90.0715 }, { state: "LA", lat: 30.4515, lon: -91.1871 }, { state: "LA", lat: 32.5252, lon: -93.7502 }, { state: "LA", lat: 30.2241, lon: -92.0198 },
  { state: "ME", lat: 43.6591, lon: -70.2568 }, { state: "ME", lat: 44.8016, lon: -68.7712 }, { state: "ME", lat: 44.3106, lon: -69.7795 },
  { state: "MD", lat: 39.2904, lon: -76.6122 }, { state: "MD", lat: 39.4143, lon: -77.4105 }, { state: "MD", lat: 38.3607, lon: -75.5994 },
  { state: "MA", lat: 42.3601, lon: -71.0589 }, { state: "MA", lat: 42.2626, lon: -71.8023 }, { state: "MA", lat: 42.1015, lon: -72.5898 }, { state: "MA", lat: 41.7003, lon: -70.3002 },
  { state: "MI", lat: 42.3314, lon: -83.0458 }, { state: "MI", lat: 42.9634, lon: -85.6681 }, { state: "MI", lat: 42.7325, lon: -84.5555 }, { state: "MI", lat: 44.7631, lon: -85.6206 }, { state: "MI", lat: 46.5436, lon: -87.3954 },
  { state: "MN", lat: 44.9778, lon: -93.265 }, { state: "MN", lat: 46.7867, lon: -92.1005 }, { state: "MN", lat: 44.0121, lon: -92.4802 }, { state: "MN", lat: 45.5579, lon: -94.1632 },
  { state: "MS", lat: 32.2988, lon: -90.1848 }, { state: "MS", lat: 30.396, lon: -88.8853 }, { state: "MS", lat: 34.2576, lon: -88.7034 },
  { state: "MO", lat: 38.627, lon: -90.1994 }, { state: "MO", lat: 39.0997, lon: -94.5786 }, { state: "MO", lat: 37.209, lon: -93.2923 }, { state: "MO", lat: 38.9517, lon: -92.3341 },
  { state: "MT", lat: 45.7833, lon: -108.5007 }, { state: "MT", lat: 46.8721, lon: -113.994 }, { state: "MT", lat: 45.677, lon: -111.0429 }, { state: "MT", lat: 47.5053, lon: -111.3008 }, { state: "MT", lat: 48.1958, lon: -114.3129 },
  { state: "NE", lat: 41.2565, lon: -95.9345 }, { state: "NE", lat: 40.8136, lon: -96.7026 }, { state: "NE", lat: 41.1399, lon: -100.7601 },
  { state: "NV", lat: 36.1699, lon: -115.1398 }, { state: "NV", lat: 39.5296, lon: -119.8138 }, { state: "NV", lat: 40.8324, lon: -115.7631 },
  { state: "NH", lat: 42.9956, lon: -71.4548 }, { state: "NH", lat: 43.2081, lon: -71.5376 }, { state: "NH", lat: 43.0718, lon: -70.7626 },
  { state: "NJ", lat: 40.7357, lon: -74.1724 }, { state: "NJ", lat: 40.2206, lon: -74.7597 }, { state: "NJ", lat: 39.3643, lon: -74.4229 }, { state: "NJ", lat: 40.15, lon: -74.05 },
  { state: "NM", lat: 35.0844, lon: -106.6504 }, { state: "NM", lat: 35.687, lon: -105.9378 }, { state: "NM", lat: 32.3199, lon: -106.7637 },
  { state: "NY", lat: 40.7128, lon: -74.006 }, { state: "NY", lat: 40.7891, lon: -73.135 }, { state: "NY", lat: 42.6526, lon: -73.7562 }, { state: "NY", lat: 43.0481, lon: -76.1474 }, { state: "NY", lat: 43.1566, lon: -77.6088 }, { state: "NY", lat: 42.8864, lon: -78.8784 },
  { state: "NC", lat: 35.2271, lon: -80.8431 }, { state: "NC", lat: 35.7796, lon: -78.6382 }, { state: "NC", lat: 36.0726, lon: -79.792 }, { state: "NC", lat: 35.5951, lon: -82.5515 }, { state: "NC", lat: 34.2104, lon: -77.8868 },
  { state: "ND", lat: 46.8772, lon: -96.7898 }, { state: "ND", lat: 46.8083, lon: -100.7837 }, { state: "ND", lat: 48.2325, lon: -101.2963 },
  { state: "OH", lat: 39.9612, lon: -82.9988 }, { state: "OH", lat: 41.4993, lon: -81.6944 }, { state: "OH", lat: 39.1031, lon: -84.512 }, { state: "OH", lat: 41.6528, lon: -83.5379 }, { state: "OH", lat: 39.7589, lon: -84.1916 },
  { state: "OK", lat: 35.4676, lon: -97.5164 }, { state: "OK", lat: 36.154, lon: -95.9928 }, { state: "OK", lat: 34.6036, lon: -98.3959 },
  { state: "OR", lat: 45.5152, lon: -122.6784 }, { state: "OR", lat: 44.0521, lon: -123.0868 }, { state: "OR", lat: 44.0582, lon: -121.3153 }, { state: "OR", lat: 42.3265, lon: -122.8756 },
  { state: "PA", lat: 39.9526, lon: -75.1652 }, { state: "PA", lat: 40.4406, lon: -79.9959 }, { state: "PA", lat: 40.2732, lon: -76.8867 }, { state: "PA", lat: 40.6023, lon: -75.4714 }, { state: "PA", lat: 42.1292, lon: -80.0851 },
  { state: "RI", lat: 41.824, lon: -71.4128 },
  { state: "SC", lat: 34.0007, lon: -81.0348 }, { state: "SC", lat: 32.7765, lon: -79.9311 }, { state: "SC", lat: 34.8526, lon: -82.394 }, { state: "SC", lat: 33.6891, lon: -78.8867 },
  { state: "SD", lat: 43.546, lon: -96.7313 }, { state: "SD", lat: 44.0805, lon: -103.231 },
  { state: "TN", lat: 36.1627, lon: -86.7816 }, { state: "TN", lat: 35.1495, lon: -90.049 }, { state: "TN", lat: 35.9606, lon: -83.9207 }, { state: "TN", lat: 35.0456, lon: -85.3097 }, { state: "TN", lat: 36.3134, lon: -82.3535 },
  { state: "TX", lat: 29.7604, lon: -95.3698 }, { state: "TX", lat: 32.7767, lon: -96.797 }, { state: "TX", lat: 30.2672, lon: -97.7431 }, { state: "TX", lat: 29.4241, lon: -98.4936 }, { state: "TX", lat: 31.7619, lon: -106.485 }, { state: "TX", lat: 33.5779, lon: -101.8552 }, { state: "TX", lat: 27.8006, lon: -97.3964 }, { state: "TX", lat: 35.222, lon: -101.8313 },
  { state: "UT", lat: 40.7608, lon: -111.891 }, { state: "UT", lat: 40.2338, lon: -111.6585 }, { state: "UT", lat: 37.0965, lon: -113.5684 }, { state: "UT", lat: 38.5733, lon: -109.5498 },
  { state: "VT", lat: 44.4759, lon: -73.2121 }, { state: "VT", lat: 43.6106, lon: -72.9726 },
  { state: "VA", lat: 37.5407, lon: -77.436 }, { state: "VA", lat: 36.8529, lon: -75.978 }, { state: "VA", lat: 37.271, lon: -79.9414 }, { state: "VA", lat: 38.0293, lon: -78.4767 },
  { state: "WA", lat: 47.6062, lon: -122.3321 }, { state: "WA", lat: 47.2529, lon: -122.4443 }, { state: "WA", lat: 47.6588, lon: -117.426 }, { state: "WA", lat: 46.6021, lon: -120.5059 }, { state: "WA", lat: 48.7519, lon: -122.4787 },
  { state: "WV", lat: 38.3498, lon: -81.6326 }, { state: "WV", lat: 39.6295, lon: -79.9559 }, { state: "WV", lat: 38.4192, lon: -82.4452 },
  { state: "WI", lat: 43.0389, lon: -87.9065 }, { state: "WI", lat: 43.0731, lon: -89.4012 }, { state: "WI", lat: 44.5133, lon: -88.0133 }, { state: "WI", lat: 44.8113, lon: -91.4985 },
  { state: "WY", lat: 41.14, lon: -104.8202 }, { state: "WY", lat: 42.8666, lon: -106.3131 }, { state: "WY", lat: 43.4799, lon: -110.7624 },
];

function inferUsState(lat: number, lon: number): string {
  let best = "CA";
  let bestDist = Infinity;
  for (const ref of US_STATE_REFS) {
    const d = haversineKm(lat, lon, ref.lat, ref.lon);
    if (d < bestDist) {
      bestDist = d;
      best = ref.state;
    }
  }
  return best;
}

const ADMIN_NOISE_REGEX =
  /\b(county|township|charter township|parish|borough|census area|municipality|municipalite|district|arrondissement|kreis|landkreis|gemeinde|samtgemeinde|verbandsgemeinde|bezirk|casco urbano|area metropolitana|ciudad|comune|provincia|governorate|prefecture|kommun|kommune|gmina|powiat|okres|obec|jaras|gorodskoe poselenie|gorodskoi okrug|munitsipal nyi okrug|munitsipal nyi raion|sel skoe poselenie|poselkovyi sovet|mis ka gromada|raion|krai|oblast|demotike enoteta|demos|periphereiake enoteta|thanh pho|tambl|ameph|ethsbaalnkhr|ethsbaalemuue|ethsbaaltambl|kecamatan|kabupaten|kota administrasi|majlis bandaraya|majlis perbandaran|daerah|tehsil|taluka|taluk|mandal|opcina|opshtina|gradska opshtina|grad|municipio)\b/i;

export function isAdminNoiseName(name: string): boolean {
  return ADMIN_NOISE_REGEX.test(name);
}

export function cleanCityDisplayName(country: string, rawName: string, rawSlug: string): string {
  const override =
    EXPLICIT_CITY_OVERRIDES[`${country}:${rawSlug}`] ??
    EXPLICIT_CITY_OVERRIDES[`${country}:${rawName}`];
  if (override) return override.name;

  let cleaned = rawName.trim();

  // Strip administrative prefixes
  cleaned = cleaned
    .replace(
      /^(City Of|Town Of|Village Of|Borough Of|Municipality Of|Municipio De|Municipio|Ciudad De|Ciudad|Casco Urbano De|Casco Urbano|Area Metropolitana De|Distrito De|Distrito|Provincia De|Provincia|Comune Di|Comune|Gemeinde|Samtgemeinde|Verbandsgemeinde|Landkreis|Kreis|Gmina|Powiat|Okres|Obec|Opcina|Opshtina|Gradska Opshtina|Grad|Demotike Enoteta|Demos|Gorodskoe Poselenie|Gorodskoi Okrug|Gorod|Thanh Pho|Majlis Bandaraya|Majlis Perbandaran|Daerah|Kanton)\s+/i,
      "",
    )
    // Strip administrative suffixes
    .replace(
      /\s+(Charter Township|Township|County|Parish|Borough|Census Area|Metropolitan Municipality|Local Municipality|Municipality|District|Kommun|Kommune|Gmina|Powiat|Ciudad|Casco Urbano|Gorodskoe Poselenie|Gorodskoi Okrug|Sel Skoe Poselenie|Poselkovyi Sovet|Ka Mis Ka Gromada|S Ka Mis Ka Gromada|Mis Ka Gromada|Tehsil|Taluka|Taluk|Mandal)$/i,
      "",
    )
    .trim();

  return cleaned.length >= 2 ? cleaned : rawName.trim();
}

function main() {
  const checkOnly = process.argv.includes("--check");
  const rootDir = process.cwd();
  const spotsPath = path.join(rootDir, "src/data/spots.json");
  const citiesPath = path.join(rootDir, "src/data/cities.json");

  const spots: RawSpot[] = JSON.parse(fs.readFileSync(spotsPath, "utf8"));

  // Build gazetteer lookup by country
  const hubsByCountry = new Map<string, GazetteerHub[]>();
  for (const hub of GAZETTEER_HUBS) {
    const list = hubsByCountry.get(hub.country);
    if (list) list.push(hub);
    else hubsByCountry.set(hub.country, [hub]);
  }

  // Step 1: Fix country_code for HK & PR, decode coordinates, and apply Pass 1 (Gazetteer + Explicit Overrides)
  interface WorkingSpot {
    raw: RawSpot;
    lat: number;
    lon: number;
    originalCity: string;
    wasNoisy: boolean;
    snappedHub: GazetteerHub | null;
    cleanedCity: string;
    cleanedSlug: string;
    admin1: string | null;
  }

  const working: WorkingSpot[] = spots.map((raw) => {
    const { lat, lon } = decodeEwkb(raw.location);

    // Reassign Hong Kong spots from CN -> HK
    if (
      raw.country_code === "CN" &&
      (raw.city_slug === "xiang-gang-hong-kong" ||
        (lat >= 22.15 && lat <= 22.56 && lon >= 113.82 && lon <= 114.45))
    ) {
      raw.country_code = "HK";
    }
    // Reassign Puerto Rico spots from US -> PR
    if (
      raw.country_code === "US" &&
      lat >= 17.85 &&
      lat <= 18.55 &&
      lon >= -67.3 &&
      lon <= -65.2
    ) {
      raw.country_code = "PR";
    }

    const originalCity = raw.city;
    const wasNoisy = isAdminNoiseName(originalCity);
    const override =
      EXPLICIT_CITY_OVERRIDES[`${raw.country_code}:${raw.city_slug}`] ??
      EXPLICIT_CITY_OVERRIDES[`${raw.country_code}:${raw.city}`];

    const countryHubs = hubsByCountry.get(raw.country_code) ?? [];

    // If explicit override matches a gazetteer hub, snap directly to it
    if (override) {
      const targetSlug = slugifyCity(override.name);
      const matchingHub = countryHubs.find((h) => slugifyCity(h.name) === targetSlug);
      if (matchingHub) {
        return {
          raw,
          lat,
          lon,
          originalCity,
          wasNoisy,
          snappedHub: matchingHub,
          cleanedCity: matchingHub.name,
          cleanedSlug: targetSlug,
          admin1: matchingHub.admin1 ?? override.admin1 ?? null,
        };
      }
    }

    // For JP, ALL original names are Mandarin Pinyin of Kanji — always snap to nearest Japanese hub
    if (raw.country_code === "JP" && countryHubs.length > 0) {
      let bestHub = countryHubs[0]!;
      let bestDist = Infinity;
      for (const hub of countryHubs) {
        const d = haversineKm(lat, lon, hub.lat, hub.lon);
        if (d < bestDist) {
          bestDist = d;
          bestHub = hub;
        }
      }
      return {
        raw,
        lat,
        lon,
        originalCity,
        wasNoisy: true,
        snappedHub: bestHub,
        cleanedCity: bestHub.name,
        cleanedSlug: slugifyCity(bestHub.name),
        admin1: bestHub.admin1 ?? null,
      };
    }

    // Standard Gazetteer proximity check
    let matchedHub: GazetteerHub | null = null;
    let matchedDist = Infinity;
    for (const hub of countryHubs) {
      const baseRadius = hub.radiusKm ?? 28;
      const effectiveRadius = wasNoisy ? Math.max(baseRadius, 42) : baseRadius;
      const d = haversineKm(lat, lon, hub.lat, hub.lon);
      if (d <= effectiveRadius && d < matchedDist) {
        matchedDist = d;
        matchedHub = hub;
      }
    }

    if (matchedHub) {
      return {
        raw,
        lat,
        lon,
        originalCity,
        wasNoisy,
        snappedHub: matchedHub,
        cleanedCity: matchedHub.name,
        cleanedSlug: slugifyCity(matchedHub.name),
        admin1: matchedHub.admin1 ?? null,
      };
    }

    const cleanedCity = cleanCityDisplayName(raw.country_code, raw.city, raw.city_slug);
    const cleanedSlug = slugifyCity(cleanedCity);
    return {
      raw,
      lat,
      lon,
      originalCity,
      wasNoisy,
      snappedHub: null,
      cleanedCity,
      cleanedSlug,
      admin1: override?.admin1 ?? null,
    };
  });

  // Step 2: Spatially-coherent clustering + Canopy Consolidation per country
  interface Cluster {
    country: string;
    baseSlug: string;
    slug: string;
    name: string;
    admin1: string | null;
    latSum: number;
    lonSum: number;
    lat: number;
    lon: number;
    isGazetteer: boolean;
    featured: boolean;
    wasAllNoisy: boolean;
    spots: WorkingSpot[];
  }

  const clustersByCountry = new Map<string, Cluster[]>();
  for (const ws of working) {
    let list = clustersByCountry.get(ws.raw.country_code);
    if (!list) {
      list = [];
      clustersByCountry.set(ws.raw.country_code, list);
    }

    // Find an existing cluster with the same baseSlug within 60km (prevents homonym collisions across states)
    let cluster: Cluster | undefined;
    for (const existing of list) {
      if (existing.baseSlug !== ws.cleanedSlug) continue;
      if (ws.snappedHub && existing.isGazetteer) {
        const dHub = haversineKm(ws.snappedHub.lat, ws.snappedHub.lon, existing.lat, existing.lon);
        if (dHub < 10) {
          cluster = existing;
          break;
        }
      } else if (!ws.snappedHub && !existing.isGazetteer) {
        const d = haversineKm(ws.lat, ws.lon, existing.lat, existing.lon);
        if (d <= 60) {
          cluster = existing;
          break;
        }
      }
    }

    if (!cluster) {
      cluster = {
        country: ws.raw.country_code,
        baseSlug: ws.cleanedSlug,
        slug: ws.cleanedSlug,
        name: ws.cleanedCity,
        admin1: ws.admin1,
        latSum: 0,
        lonSum: 0,
        lat: ws.snappedHub?.lat ?? ws.lat,
        lon: ws.snappedHub?.lon ?? ws.lon,
        isGazetteer: ws.snappedHub !== null,
        featured: ws.snappedHub?.featured ?? false,
        wasAllNoisy: ws.wasNoisy,
        spots: [],
      };
      list.push(cluster);
    }

    cluster.latSum += ws.lat;
    cluster.lonSum += ws.lon;
    if (ws.snappedHub) {
      cluster.isGazetteer = true;
      cluster.lat = ws.snappedHub.lat;
      cluster.lon = ws.snappedHub.lon;
      cluster.name = ws.snappedHub.name;
      if (ws.snappedHub.featured) cluster.featured = true;
      if (ws.snappedHub.admin1) cluster.admin1 = ws.snappedHub.admin1;
    } else {
      cluster.lat = cluster.latSum / (cluster.spots.length + 1);
      cluster.lon = cluster.lonSum / (cluster.spots.length + 1);
    }
    if (!ws.wasNoisy) cluster.wasAllNoisy = false;
    cluster.spots.push(ws);
  }

  // Canopy consolidation: sort clusters by prominence and merge nearby satellite clusters within 25km (45km for noisy labels)
  for (const [, allClusters] of clustersByCountry) {
    allClusters.sort((a, b) => {
      if (a.isGazetteer !== b.isGazetteer) return a.isGazetteer ? -1 : 1;
      if (a.wasAllNoisy !== b.wasAllNoisy) return a.wasAllNoisy ? 1 : -1;
      return b.spots.length - a.spots.length || a.name.localeCompare(b.name);
    });

    for (let i = 0; i < allClusters.length; i++) {
      const hub = allClusters[i]!;
      if (hub.spots.length === 0) continue;

      for (let j = i + 1; j < allClusters.length; j++) {
        const candidate = allClusters[j]!;
        if (candidate.spots.length === 0 || candidate.isGazetteer) continue;

        const maxRadiusKm = candidate.wasAllNoisy
          ? 45
          : hub.isGazetteer
            ? 28
            : candidate.spots.length <= 2
              ? 25
              : 18;

        const d = haversineKm(candidate.lat, candidate.lon, hub.lat, hub.lon);
        if (d <= maxRadiusKm) {
          for (const ws of candidate.spots) {
            hub.spots.push(ws);
          }
          candidate.spots = [];
        }
      }
    }
  }

  // Step 3: Build final curated cities list, disambiguate homonym slugs, and update spots
  const finalCities: CuratedCity[] = [];
  for (const [countryCode, allClusters] of [...clustersByCountry.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const activeClusters = allClusters.filter((c) => c.spots.length > 0);

    // Infer admin1 for US clusters before slug disambiguation
    for (const c of activeClusters) {
      if (!c.admin1 && countryCode === "US") {
        c.admin1 = inferUsState(c.lat, c.lon);
      }
    }

    // Sort country cities by spot_count DESC, then featured DESC, then name ASC
    activeClusters.sort((a, b) => {
      if (b.spots.length !== a.spots.length) return b.spots.length - a.spots.length;
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    // Disambiguate homonym slugs within the same country (e.g. Portland OR -> "portland", Portland ME -> "portland-me")
    const usedSlugs = new Set<string>();
    for (const c of activeClusters) {
      let candidateSlug = c.baseSlug;
      if (usedSlugs.has(candidateSlug)) {
        if (c.admin1) {
          candidateSlug = `${c.baseSlug}-${c.admin1.toLowerCase()}`;
        }
        let suffix = 2;
        while (usedSlugs.has(candidateSlug)) {
          candidateSlug = `${c.baseSlug}-${suffix++}`;
        }
      }
      usedSlugs.add(candidateSlug);
      c.slug = candidateSlug;
    }

    // Ensure every country with spots has up to 5 featured cities (starting with gazetteer featured, then top by spot count)
    let featuredCount = activeClusters.filter((c) => c.featured).length;
    for (const c of activeClusters) {
      if (featuredCount >= 5) break;
      if (!c.featured && c.spots.length >= 2) {
        c.featured = true;
        featuredCount++;
      }
    }
    if (featuredCount === 0 && activeClusters[0]) {
      activeClusters[0].featured = true;
    }

    activeClusters.forEach((c, idx) => {
      const lat = Math.round(c.lat * 10000) / 10000;
      const lon = Math.round(c.lon * 10000) / 10000;
      const admin1 =
        c.admin1 ?? (countryCode === "US" ? inferUsState(lat, lon) : null);

      finalCities.push({
        country_code: countryCode,
        slug: c.slug,
        name: c.name,
        admin1,
        lat,
        lon,
        spot_count: c.spots.length,
        sort_order: idx,
        featured: c.featured,
      });

      // Update each spot in this cluster
      for (const ws of c.spots) {
        const oldCity = ws.originalCity.trim();
        ws.raw.city = c.name;
        ws.raw.city_slug = c.slug;

        // Preserve non-noise sub-locality in address if address was just the old or new city
        if (
          oldCity &&
          oldCity.toLowerCase() !== c.name.toLowerCase() &&
          !ws.wasNoisy
        ) {
          const addr = ws.raw.address.trim();
          if (
            !addr ||
            addr.toLowerCase() === oldCity.toLowerCase() ||
            addr.toLowerCase() === c.name.toLowerCase()
          ) {
            ws.raw.address = `${oldCity}, ${c.name}`;
          }
        } else if (ws.wasNoisy && ws.raw.address.trim().toLowerCase() === oldCity.toLowerCase()) {
          ws.raw.address = c.name;
        }
      }
    });
  }

  // Verification summary
  const usCities = finalCities.filter((c) => c.country_code === "US");
  const singleSpotCities = finalCities.filter((c) => c.spot_count === 1);
  console.log(
    JSON.stringify(
      {
        totalSpots: spots.length,
        totalCuratedCities: finalCities.length,
        usCitiesCount: usCities.length,
        singleSpotCityPct: `${((singleSpotCities.length / finalCities.length) * 100).toFixed(1)}%`,
        topUsCities: usCities.slice(0, 12).map((c) => `${c.name}, ${c.admin1} (${c.spot_count})`),
      },
      null,
      2,
    ),
  );

  if (checkOnly) return;

  fs.writeFileSync(spotsPath, JSON.stringify(spots, null, 2) + "\n", "utf8");
  fs.writeFileSync(citiesPath, JSON.stringify(finalCities, null, 2) + "\n", "utf8");
  console.log("Wrote curated src/data/spots.json and src/data/cities.json");
}

main();
