export interface RegionSeedCountry {
  name: string;
  cities: readonly string[];
}

export interface RegionSeed {
  name: string;
  slug: string;
  desc: string;
  image: string;
  sortOrder: number;
  countries: readonly RegionSeedCountry[];
}

export const REGION_SEED: readonly RegionSeed[] = [
  {
    name: "North America",
    slug: "north-america",
    desc: "The birthplace of modern street skating. From LA ledges to NYC gaps and Toronto DIYs.",
    image: "",
    sortOrder: 0,
    countries: [
      {
        name: "United States",
        cities: [
          "Los Angeles",
          "New York",
          "San Francisco",
          "Portland",
          "Chicago",
          "Miami",
          "Las Vegas",
          "Westminster",
          "North Las Vegas",
        ],
      },
      {
        name: "Canada",
        cities: [
          "Toronto",
          "Vancouver",
          "Montreal",
          "Calgary",
          "Mississauga",
          "Banff",
        ],
      },
      {
        name: "Mexico",
        cities: ["Mexico City", "Monterrey", "Guadalajara", "Tijuana"],
      },
    ],
  },
  {
    name: "Latin America",
    slug: "latin-america",
    desc: "Tropical plazas, Andean DIYs, and the deepest vert scene outside California.",
    image: "",
    sortOrder: 1,
    countries: [
      {
        name: "Brazil",
        cities: [
          "São Paulo",
          "Rio de Janeiro",
          "Belo Horizonte",
          "Curitiba",
          "Amparo",
        ],
      },
      {
        name: "Argentina",
        cities: ["Buenos Aires", "Córdoba", "Rosario", "Mendoza"],
      },
      {
        name: "Colombia",
        cities: [
          "Bogota",
          "Medellin",
          "Cali",
          "Barranquilla",
          "Envigado",
          "Zipaquira",
          "Sopo",
          "Rionegro",
          "Bello",
          "Pereira",
          "Mosquera",
        ],
      },
      {
        name: "Chile",
        cities: ["Santiago", "Valparaíso", "Concepción"],
      },
      {
        name: "Peru",
        cities: ["Lima", "Arequipa", "Cusco"],
      },
      {
        name: "Uruguay",
        cities: ["Montevideo"],
      },
      {
        name: "Ecuador",
        cities: ["Quito", "Guayaquil"],
      },
      {
        name: "Venezuela",
        cities: ["Caracas"],
      },
      {
        name: "Bolivia",
        cities: ["La Paz"],
      },
      {
        name: "Paraguay",
        cities: ["Asunción"],
      },
      {
        name: "Costa Rica",
        cities: ["San José"],
      },
      {
        name: "Panama",
        cities: ["Panama City"],
      },
      {
        name: "Dominican Republic",
        cities: ["Santo Domingo"],
      },
      {
        name: "Puerto Rico",
        cities: ["San Juan"],
      },
      {
        name: "Cuba",
        cities: ["Havana"],
      },
      {
        name: "Guatemala",
        cities: ["Guatemala City"],
      },
      {
        name: "Honduras",
        cities: ["Tegucigalpa"],
      },
      {
        name: "El Salvador",
        cities: ["San Salvador"],
      },
      {
        name: "Nicaragua",
        cities: ["Managua"],
      },
      {
        name: "Barbados",
        cities: [],
      },
      {
        name: "Haiti",
        cities: [],
      },
      {
        name: "Jamaica",
        cities: [],
      },
      {
        name: "Cayman Islands",
        cities: [],
      },
    ],
  },
  {
    name: "Iberia",
    slug: "iberia",
    desc: "Mediterranean sun, mosaic plazas, and a generation raised on MACBA sessions.",
    image: "",
    sortOrder: 2,
    countries: [
      {
        name: "Spain",
        cities: [
          "Barcelona",
          "Madrid",
          "Seville",
          "Valencia",
          "Málaga",
          "Bilbao",
          "Zaragoza",
          "Pineda de Mar",
        ],
      },
      {
        name: "Portugal",
        cities: ["Lisbon", "Porto"],
      },
      {
        name: "Andorra",
        cities: [],
      },
      {
        name: "Gibraltar",
        cities: [],
      },
    ],
  },
  {
    name: "France & Benelux",
    slug: "france-benelux",
    desc: "Haussmannian plazas, brutalist squares, and FISE-grade park culture.",
    image: "",
    sortOrder: 3,
    countries: [
      {
        name: "France",
        cities: [
          "Paris",
          "Lyon",
          "Marseille",
          "Bordeaux",
          "Montpellier",
          "Toulouse",
        ],
      },
      {
        name: "Belgium",
        cities: ["Brussels", "Antwerp", "Brugge"],
      },
      {
        name: "Netherlands",
        cities: ["Amsterdam", "Rotterdam", "Utrecht", "The Hague"],
      },
      {
        name: "Luxembourg",
        cities: ["Luxembourg City"],
      },
      {
        name: "Monaco",
        cities: [],
      },
    ],
  },
  {
    name: "DACH",
    slug: "dach",
    desc: "German engineering meets Austrian DIYs and Swiss precision ledges.",
    image: "",
    sortOrder: 4,
    countries: [
      {
        name: "Germany",
        cities: [
          "Berlin",
          "Hamburg",
          "Munich",
          "Cologne",
          "Frankfurt",
          "Stuttgart",
        ],
      },
      {
        name: "Austria",
        cities: ["Vienna", "Linz", "Graz"],
      },
      {
        name: "Switzerland",
        cities: ["Zurich", "Bern", "Basel", "Lausanne"],
      },
      {
        name: "Liechtenstein",
        cities: [],
      },
    ],
  },
  {
    name: "British Isles",
    slug: "british-isles",
    desc: "Rain-slick granite, brutalist council estates, and the South Bank lineage.",
    image: "",
    sortOrder: 5,
    countries: [
      {
        name: "United Kingdom",
        cities: ["London", "Manchester", "Bristol", "Liverpool", "Glasgow"],
      },
      {
        name: "Ireland",
        cities: ["Dublin", "Cork"],
      },
      {
        name: "Guernsey",
        cities: [],
      },
      {
        name: "Isle of Man",
        cities: [],
      },
      {
        name: "Jersey",
        cities: [],
      },
    ],
  },
  {
    name: "Nordics",
    slug: "nordics",
    desc: "Year-round dedication. Indoor parks, frosty ledges, and the Helsinki school.",
    image: "",
    sortOrder: 6,
    countries: [
      {
        name: "Sweden",
        cities: [
          "Stockholm",
          "Malmö",
          "Gothenburg",
          "Vallentuna",
          "Bjuv",
          "Halmstad",
        ],
      },
      {
        name: "Finland",
        cities: ["Helsinki", "Tampere", "Turku"],
      },
      {
        name: "Norway",
        cities: ["Oslo", "Bergen", "Trondheim", "Stavanger", "Flekkefjord"],
      },
      {
        name: "Denmark",
        cities: ["Copenhagen", "Aarhus"],
      },
      {
        name: "Iceland",
        cities: ["Reykjavik", "Akureyri"],
      },
      {
        name: "Greenland",
        cities: [],
      },
    ],
  },
  {
    name: "Italy & Balkans",
    slug: "italy-balkans",
    desc: "Renaissance piazzas, Roman travertine, and the Adriatic roller scene.",
    image: "",
    sortOrder: 7,
    countries: [
      {
        name: "Italy",
        cities: ["Rome", "Milan", "Florence", "Naples", "Bologna"],
      },
      {
        name: "Greece",
        cities: ["Athens", "Thessaloniki", "Andros"],
      },
      {
        name: "Croatia",
        cities: ["Zagreb", "Split"],
      },
      {
        name: "Albania",
        cities: ["Tirana"],
      },
      {
        name: "Malta",
        cities: ["Valletta", "Msida"],
      },
    ],
  },
  {
    name: "Eastern Europe",
    slug: "eastern-europe",
    desc: "Post-Soviet blocks, brutalist megastructures, and a fierce new generation.",
    image: "",
    sortOrder: 8,
    countries: [
      {
        name: "Poland",
        cities: ["Warsaw", "Kraków", "Łódź", "Wrocław", "Gdańsk"],
      },
      {
        name: "Czech Republic",
        cities: ["Prague", "Brno"],
      },
      {
        name: "Slovakia",
        cities: ["Bratislava", "Košice"],
      },
      {
        name: "Hungary",
        cities: ["Budapest", "Debrecen"],
      },
      {
        name: "Romania",
        cities: ["Bucharest", "Cluj-Napoca"],
      },
      {
        name: "Bulgaria",
        cities: ["Sofia", "Plovdiv"],
      },
      {
        name: "Ukraine",
        cities: ["Kyiv", "Lviv", "Kharkiv"],
      },
      {
        name: "Russia",
        cities: ["Moscow", "Saint Petersburg", "Yekaterinburg"],
      },
      {
        name: "Latvia",
        cities: ["Riga"],
      },
      {
        name: "Estonia",
        cities: ["Tallinn"],
      },
      {
        name: "Turkey",
        cities: ["Istanbul", "Ankara", "İzmir"],
      },
      {
        name: "Armenia",
        cities: [],
      },
      {
        name: "Azerbaijan",
        cities: [],
      },
      {
        name: "Georgia",
        cities: [],
      },
      {
        name: "Bosnia and Herzegovina",
        cities: [],
      },
      {
        name: "Belarus",
        cities: [],
      },
      {
        name: "Lithuania",
        cities: [],
      },
      {
        name: "Moldova",
        cities: [],
      },
      {
        name: "Montenegro",
        cities: [],
      },
      {
        name: "North Macedonia",
        cities: [],
      },
      {
        name: "Serbia",
        cities: [],
      },
      {
        name: "Slovenia",
        cities: [],
      },
    ],
  },
  {
    name: "Asia",
    slug: "asia",
    desc: "Megacity plazas, tropical parks, and the fastest-growing scene on the planet.",
    image: "",
    sortOrder: 10,
    countries: [
      {
        name: "South Korea",
        cities: ["Seoul", "Busan", "Incheon"],
      },
      {
        name: "China",
        cities: ["Beijing", "Shanghai", "Guangzhou", "Shenzhen", "Chengdu"],
      },
      {
        name: "Thailand",
        cities: ["Bangkok", "Chiang Mai"],
      },
      {
        name: "Singapore",
        cities: ["Singapore"],
      },
      {
        name: "Indonesia",
        cities: ["Jakarta", "Bandung", "Surabaya"],
      },
      {
        name: "Philippines",
        cities: ["Manila", "Cebu"],
      },
      {
        name: "Malaysia",
        cities: ["Kuala Lumpur", "Penang"],
      },
      {
        name: "Vietnam",
        cities: ["Ho Chi Minh City", "Hanoi"],
      },
      {
        name: "Taiwan",
        cities: ["Taipei", "Kaohsiung"],
      },
      {
        name: "Hong Kong",
        cities: ["Hong Kong"],
      },
      {
        name: "India",
        cities: ["Mumbai", "Bangalore", "Delhi", "Chennai"],
      },
      {
        name: "Japan",
        cities: [
          "Tokyo",
          "Osaka",
          "Yokohama",
          "Nagoya",
          "Fukuoka",
          "Sapporo",
          "Kobe",
          "Kyoto",
          "Hachioji",
        ],
      },
      {
        name: "Bangladesh",
        cities: [],
      },
      {
        name: "Brunei",
        cities: [],
      },
      {
        name: "Kazakhstan",
        cities: [],
      },
      {
        name: "Maldives",
        cities: [],
      },
      {
        name: "Nepal",
        cities: [],
      },
      {
        name: "Pakistan",
        cities: [],
      },
      {
        name: "Tajikistan",
        cities: [],
      },
      {
        name: "Turkmenistan",
        cities: [],
      },
      {
        name: "Uzbekistan",
        cities: [],
      },
      {
        name: "North Korea",
        cities: [],
      },
      {
        name: "Sri Lanka",
        cities: [],
      },
      {
        name: "Timor-Leste",
        cities: [],
      },
      {
        name: "Cambodia",
        cities: [],
      },
      {
        name: "Laos",
        cities: [],
      },
      {
        name: "Mongolia",
        cities: [],
      },
    ],
  },
  {
    name: "Oceania",
    slug: "oceania",
    desc: "Beachside bowls, volcanic coastlines, and the Indo-Pacific crossover.",
    image: "",
    sortOrder: 11,
    countries: [
      {
        name: "Australia",
        cities: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide"],
      },
      {
        name: "New Zealand",
        cities: ["Auckland", "Wellington", "Christchurch", "Hibiscus Coast"],
      },
      {
        name: "Tonga",
        cities: [],
      },
      {
        name: "Samoa",
        cities: [],
      },
    ],
  },
  {
    name: "Middle East & Africa",
    slug: "middle-east-africa",
    desc: "Desert marble, Red Sea ledges, and a rising scene from Tel Aviv to Cape Town.",
    image: "",
    sortOrder: 12,
    countries: [
      {
        name: "Israel",
        cities: [
          "Tel Aviv",
          "Jerusalem",
          "Haifa",
          "Ashdod",
          "Modi'in",
          "Nahariya",
          "Rishon LeZion",
        ],
      },
      {
        name: "Egypt",
        cities: ["Cairo", "Alexandria", "Giza"],
      },
      {
        name: "Morocco",
        cities: [
          "Casablanca",
          "Marrakech",
          "Rabat",
          "Tangier",
          "Ida Ou Guelloul",
        ],
      },
      {
        name: "South Africa",
        cities: [
          "Johannesburg",
          "Cape Town",
          "Durban",
          "Somerset West",
          "Milnerton",
          "Pretoria",
        ],
      },
      {
        name: "Algeria",
        cities: ["Algiers"],
      },
      {
        name: "Iraq",
        cities: ["Sulaymaniyah"],
      },
      {
        name: "Qatar",
        cities: ["Ar Rayyan"],
      },
      {
        name: "Tunisia",
        cities: ["Hammam Sousse", "La Marsa"],
      },
      {
        name: "Angola",
        cities: [],
      },
      {
        name: "Cape Verde",
        cities: [],
      },
      {
        name: "Lesotho",
        cities: [],
      },
      {
        name: "Madagascar",
        cities: [],
      },
      {
        name: "Mali",
        cities: [],
      },
      {
        name: "Mozambique",
        cities: [],
      },
      {
        name: "Senegal",
        cities: [],
      },
      {
        name: "Tanzania",
        cities: [],
      },
      {
        name: "Uganda",
        cities: [],
      },
      {
        name: "Zambia",
        cities: [],
      },
      {
        name: "Syria",
        cities: [],
      },
      {
        name: "UAE",
        cities: [],
      },
      {
        name: "Bahrain",
        cities: [],
      },
      {
        name: "Cyprus",
        cities: [],
      },
      {
        name: "Ethiopia",
        cities: [],
      },
      {
        name: "Ghana",
        cities: [],
      },
      {
        name: "Iran",
        cities: [],
      },
      {
        name: "Jordan",
        cities: [],
      },
      {
        name: "Kenya",
        cities: [],
      },
      {
        name: "Lebanon",
        cities: [],
      },
      {
        name: "Nigeria",
        cities: [],
      },
      {
        name: "Oman",
        cities: [],
      },
      {
        name: "Saudi Arabia",
        cities: [],
      },
    ],
  },
];
