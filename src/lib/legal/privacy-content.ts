export interface CookieItem {
  name: string;
  type: "Cookie" | "LocalStorage";
  category: "Strictly Necessary" | "Functional";
  purpose: string;
  duration: string;
}

export interface ProcessorItem {
  name: string;
  role: string;
  country: string;
  purpose: string;
  privacyUrl: string;
}

export interface PrivacySection {
  id: string;
  number: string;
  title: string;
  plainEnglishSummary: string;
  subsections: {
    id?: string;
    title?: string;
    content: string | string[];
  }[];
}

export const PRIVACY_LAST_UPDATED = "October 31, 2026";
export const PRIVACY_EFFECTIVE_DATE = "October 31, 2026";
export const PRIVACY_VERSION = "1.0";

export const COOKIE_INVENTORY: readonly CookieItem[] = [
  {
    name: "sb-*-auth-token",
    type: "Cookie",
    category: "Strictly Necessary",
    purpose: "Maintains your authenticated rider session securely across server requests via Supabase Auth (HttpOnly, Secure).",
    duration: "Session / Up to 1 year or until sign-out",
  },
  {
    name: "osp_seed",
    type: "Cookie",
    category: "Strictly Necessary",
    purpose: "Provides a consistent random seed for landing page spot exploration and marquee shuffling without tracking user identity.",
    duration: "Session / 24 hours",
  },
  {
    name: "openspot-preferences",
    type: "LocalStorage",
    category: "Functional",
    purpose: "Remembers your preferred sport discipline (skate, bmx, roller, scooter), distance units (mi/km), and onboarding completed state.",
    duration: "Persistent until manually cleared",
  },
  {
    name: "openspot-last-map-filter",
    type: "LocalStorage",
    category: "Functional",
    purpose: "Remembers your last explored map region and country filter so the map reopens right where you left off.",
    duration: "Persistent until manually cleared",
  },
  {
    name: "openspot-guest-token",
    type: "LocalStorage",
    category: "Functional",
    purpose: "Enables anonymous participation in challenge games without requiring account registration.",
    duration: "Persistent until game completion or browser clear",
  },
  {
    name: "openspot-tv-auto-advance",
    type: "LocalStorage",
    category: "Functional",
    purpose: "Stores your personal toggle preference for auto-advancing to the next video in OpenSpot TV queue.",
    duration: "Persistent until manually cleared",
  },
];

export const THIRD_PARTY_PROCESSORS: readonly ProcessorItem[] = [
  {
    name: "Supabase, Inc.",
    role: "Database & Authentication",
    country: "United States",
    purpose: "PostgreSQL database storage, user authentication, and secure row-level access control.",
    privacyUrl: "https://supabase.com/privacy",
  },
  {
    name: "Cloudflare, Inc.",
    role: "Hosting, Object Storage & CDN",
    country: "United States",
    purpose: "Application hosting, global edge CDN delivery, API routing, and storage and delivery of user-submitted spot photos and media assets.",
    privacyUrl: "https://www.cloudflare.com/privacypolicy/",
  },
  {
    name: "OpenWeather Ltd",
    role: "Weather Telemetry API",
    country: "United Kingdom",
    purpose: "Retrieves live outdoor temperature and weather conditions for spot verification.",
    privacyUrl: "https://openweather.co.uk/privacy-policy",
  },
  {
    name: "OpenStreetMap & Nominatim",
    role: "Mapping & Reverse Geocoding",
    country: "United Kingdom / EU",
    purpose: "Renders open map tiles and translates latitude/longitude into human-readable street names.",
    privacyUrl: "https://wiki.osmfoundation.org/wiki/Privacy_Policy",
  },
  {
    name: "Google LLC / YouTube",
    role: "Video Streaming & OAuth",
    country: "United States",
    purpose: "Provides Google OAuth sign-in and powers embedded action sports video playback on OpenSpot TV.",
    privacyUrl: "https://policies.google.com/privacy",
  },
  {
    name: "Emergency Number API",
    role: "Safety Reference Directory",
    country: "Germany / EU",
    purpose: "Provides local police and medical dispatch phone numbers by country code.",
    privacyUrl: "https://emergencynumberapi.com",
  },
];

export const PRIVACY_SECTIONS: readonly PrivacySection[] = [
  {
    id: "overview",
    number: "01",
    title: "Data Controller & Core Privacy Principles",
    plainEnglishSummary:
      "OpenSpot is operated by Open Spot League, based in Bogotá D.C., Colombia. We collect only what is strictly necessary to run the map, save your spots, and host challenge games. We NEVER sell your personal data or track you across the web with third-party advertising trackers.",
    subsections: [
      {
        title: "1.1 Data Controller Identification",
        content: [
          "Open Spot League ('OpenSpot', 'we', 'our', or 'us'), based in Bogotá D.C., Republic of Colombia, acts as the Data Controller responsible for the processing of your personal information in connection with our website, mobile web app, map directory, challenge network, and OpenSpot TV (the 'Platform').",
          "If you have any questions regarding your data or this policy, our Data Protection team can be reached directly at legal@openspotleague.com or via our in-app Support channel at /support.",
        ],
      },
      {
        title: "1.2 Global & Dual Regulatory Harmonization",
        content: [
          "We process personal data in strict compliance with the applicable data protection regulations of the jurisdictions in which our riders live and ride, including:",
          "• Republic of Colombia: Statutory Law 1581 of 2012 (Habeas Data Protection Law) and Regulatory Decree 1377 of 2013.",
          "• European Union & UK: General Data Protection Regulation (Regulation EU 2016/679 - 'GDPR') and the UK Data Protection Act 2018.",
          "• United States: California Consumer Privacy Act of 2018 as amended by the California Privacy Rights Act ('CCPA/CPRA') and the Children's Online Privacy Protection Act ('COPPA').",
        ],
      },
      {
        title: "1.3 Absolute 'No Sale of Data' Commitment",
        content:
          "OpenSpot does not sell, rent, monetize, or trade your personal information, email address, spot visits, or location history to third-party data brokers, marketers, or advertisers. We do not engage in cross-context behavioral advertising.",
      },
    ],
  },
  {
    id: "information-collected",
    number: "02",
    title: "Information We Collect",
    plainEnglishSummary:
      "We collect information in three ways: (1) What you give us directly (Google name, email, avatar, spot uploads); (2) Precise GPS location ONLY when you tap a location button; and (3) Technical logs (hashed IP for rate-limiting, browser type) to keep the servers safe.",
    subsections: [
      {
        title: "2.1 Information You Provide to Us Directly",
        content: [
          "• Account Information: When you sign in with your Google account via Supabase Auth, we receive and store your email address, display name, initials, and Google profile picture URL.",
          "• Rider Profile & Preferences: You may choose to specify your preferred sports discipline (Skateboarding, BMX, Inline, Scooter), unit preferences (miles or kilometers, Celsius or Fahrenheit), and custom bio.",
          "• User-Generated Submissions: When you add a spot, we collect the spot title, street address, city, country, sport tags, spot types, optional Instagram handle, and uploaded photographs.",
          "• Challenge Game Records: Trick attempts, letters accumulated (e.g. S-K-A-T-E), landed tricks, race lap times, and competition scores recorded during games.",
          "• Support & Inquiries: Any communications, feedback, curator applications, or takedown requests you send to us.",
        ],
      },
      {
        title: "2.2 Geolocation Data (On-Demand GPS Only)",
        content: [
          "• We collect precise geolocation coordinates (latitude, longitude, and horizontal accuracy radius) ONLY when you explicitly trigger a location-based feature by clicking an interactive button in your browser (e.g., 'Find Spots Near Me', 'Verify Spot Visit', or 'Check-in to Game').",
          "• OpenSpot NEVER tracks your location continuously in the background or when your browser tab is inactive.",
          "• For spot verifications and game sessions, coordinates and timestamp are validated against spot boundaries and recorded in game location verification tables to prevent location spoofing.",
        ],
      },
      {
        title: "2.3 Automated Technical & Telemetry Data",
        content: [
          "• IP Address & Hashing: For anti-abuse protection and rate-limiting (e.g., preventing automated spam lobby creation in training games), our servers compute a one-way cryptographic hash of your IP address (creatorIpHash). Raw IP addresses may appear in transient edge server access logs for DDoS prevention.",
          "• Device & Browser Diagnostics: Browser type, operating system, referrer URL, timestamps, and error diagnostics to maintain uptime and troubleshoot crashes.",
        ],
      },
    ],
  },
  {
    id: "legal-bases",
    number: "03",
    title: "Purposes & Legal Bases for Processing",
    plainEnglishSummary:
      "We process your data under clear legal rules: to provide the service you signed up for (contract), to keep the platform safe and fair (legitimate interests), or because you explicitly allowed it (consent, such as tapping 'Allow Location').",
    subsections: [
      {
        title: "3.1 Purposes and Applicable Legal Grounds (GDPR Art. 6 & Law 1581)",
        content: [
          "• Service Delivery & Account Management (Contractual Necessity / Ejecución Contractual): Delivering interactive maps, maintaining your saved spots, orchestrating multiplayer challenge games, recording leaderboard standings, and enabling Google OAuth.",
          "• Precise Geolocation Checks (Explicit Consent / Consentimiento Expreso): Calculating real-time distance to spots and verifying physical presence at spots based on your browser permission prompt. You can revoke location access at any time in your browser settings.",
          "• Platform Security & Anti-Cheat (Legitimate Interests / Interés Legítimo): Detecting bot attacks, rate-limiting API endpoints, hashing IP addresses to prevent lobby spam, and moderating inappropriate UGC.",
          "• Legal & Regulatory Compliance (Legal Obligation / Obligación Legal): Responding to valid DMCA takedown notices, property owner removal demands, and lawful governmental orders.",
        ],
      },
    ],
  },
  {
    id: "cookies-storage",
    number: "04",
    title: "Cookies & Local Storage Disclosures",
    plainEnglishSummary:
      "We use only essential cookies for authentication and functional local storage items to remember your preferences (like favorite sport, units, or dark mode). We do not use third-party marketing or tracking cookies.",
    subsections: [
      {
        title: "4.1 Purpose of Cookies and Local Storage",
        content: [
          "Cookies and local browser storage are small text files placed on your device to enable core website functionality. Because we only employ Strictly Necessary and Functional storage technologies, our usage is exempt from mandatory marketing cookie consent banners under EU ePrivacy and GDPR directives.",
          "You can inspect, clear, or block cookies and localStorage at any time through your browser preferences; however, disabling essential session cookies will prevent you from signing in or saving spots across devices.",
        ],
      },
    ],
  },
  {
    id: "third-parties",
    number: "05",
    title: "Third-Party Service Providers (Sub-Processors)",
    plainEnglishSummary:
      "We rely on trusted cloud infrastructure providers to host OpenSpot (like Supabase for database and Cloudflare for hosting and images). We share data only to make the app work, under strict security agreements.",
    subsections: [
      {
        title: "5.1 Infrastructure & Sub-Processor Overview",
        content:
          "OpenSpot contracts with trusted third-party technology providers to operate our cloud infrastructure. All sub-processors are bound by strict data processing agreements and industry-standard security certifications.",
      },
    ],
  },
  {
    id: "transfers-security",
    number: "06",
    title: "International Data Transfers & Security Measures",
    plainEnglishSummary:
      "Our servers and cloud providers are located in the United States, Colombia, and the European Union. We protect your data with end-to-end HTTPS encryption, secure database access controls, and strict rate limits.",
    subsections: [
      {
        title: "6.1 Cross-Border Data Transfers",
        content:
          "Because OpenSpot is accessible worldwide and utilizes cloud infrastructure primarily located in the United States (Supabase, Cloudflare), your information may be transferred across international borders. For transfers of data originating in the European Economic Area (EEA), United Kingdom, or Colombia to countries without an adequacy finding, we rely on Standard Contractual Clauses (SCCs) and robust organizational safeguards.",
      },
      {
        title: "6.2 Technical & Organizational Security Measures",
        content: [
          "We implement rigorous technical safeguards to protect your personal data against unauthorized access, loss, or alteration, including:",
          "• Transport Layer Security (HTTPS / TLS 1.3) with HSTS headers.",
          "• PostgreSQL Row-Level Security (RLS) ensuring users only read and write authorized data rows.",
          "• Multi-tiered in-memory rate limiting across authentication and API routes.",
          "• Strict Content Security Policy (CSP) and permission isolation headers.",
          "• Cryptographic hashing (creatorIpHash, HMAC cursor secrets).",
        ],
      },
    ],
  },
  {
    id: "retention-deletion",
    number: "07",
    title: "Data Retention & Account Erasure",
    plainEnglishSummary:
      "We keep your profile data as long as your account remains active. You can delete your account and data at any time by contacting us, and we will permanently erase your personal information.",
    subsections: [
      {
        title: "7.1 Retention Schedule",
        content: [
          "• Profile & Saved Spots: Retained for the lifetime of your active rider account.",
          "• Challenge Games: Completed game sessions and trick scores are archived as historical game records; user links are detached upon account deletion.",
          "• Uploaded Spot Imagery: Public spot contributions remain in the community directory to preserve spot mapping utility; creator identity is anonymized if the contributing account is deleted.",
          "• Ephemeral Telemetry: IP hashes, rate-limit keys, and server access logs are automatically cleared or rotated within 30 to 90 days.",
        ],
      },
      {
        title: "7.2 Account Deletion (Right to Erasure)",
        content:
          "You have the right to request the permanent deletion of your account and associated personal data at any time. Simply email legal@openspotleague.com or reach out via /support. Upon verification, we will permanently delete your profile, email, authentication records, and personal saved spot heads within thirty (30) days.",
      },
    ],
  },
  {
    id: "children-privacy",
    number: "08",
    title: "Children's Privacy (Strictly 13+)",
    plainEnglishSummary:
      "OpenSpot is strictly for riders aged 13 and older. We do not knowingly collect information from children under 13. If you believe a child under 13 has created an account, notify us and we will delete it immediately.",
    subsections: [
      {
        title: "8.1 COPPA & Minor Protection",
        content: [
          "OpenSpot is not directed to, marketed to, or intended for use by children under thirteen (13) years of age. In compliance with the United States Children's Online Privacy Protection Act (COPPA), the European GDPR, and Colombian Statutory Law 1581 of 2012, we do not knowingly solicit or collect personal information from any child under 13.",
          "If we discover that personal data from a child under 13 has been collected without verified parental consent, we will immediately take steps to purge such data and terminate the associated account. If you are a parent or guardian and become aware that your child has provided us with personal information, please contact us immediately at legal@openspotleague.com.",
        ],
      },
    ],
  },
  {
    id: "user-rights",
    number: "09",
    title: "Your Privacy Rights (GDPR, CCPA & Colombia Habeas Data)",
    plainEnglishSummary:
      "Depending on where you live, you have strong legal rights over your personal data: the right to see what data we have, correct mistakes, delete your data, object to processing, and lodge a complaint with your local data authority.",
    subsections: [
      {
        title: "9.1 Rights under Colombian Law 1581 of 2012 (Habeas Data)",
        content: [
          "In accordance with Article 8 of Law 1581 of 2012, Colombian residents possess the following rights:",
          "• Right to Know (Conocer): Free access to personal data processed by OpenSpot.",
          "• Right to Update and Rectify (Actualizar y Rectificar): Request correction of partial, inaccurate, incomplete, or misleading data.",
          "• Right to Delete & Revoke (Suprimir y Revocar): Request deletion of data or revocation of authorization when processing fails to respect constitutional principles.",
          "• Right to Complain: File complaints with the Superintendencia de Industria y Comercio (SIC) regarding data protection violations.",
        ],
      },
      {
        title: "9.2 Rights under European Union & UK GDPR",
        content: [
          "EEA and UK residents hold the rights to: (a) Access personal data; (b) Rectify inaccurate data; (c) Erase personal data ('Right to be Forgotten'); (d) Restrict processing; (e) Data portability in a structured, machine-readable format; (f) Object to legitimate-interest processing; and (g) Lodge a complaint with a competent Supervisory Authority.",
        ],
      },
      {
        title: "9.3 Rights under California Consumer Privacy Act (CCPA / CPRA)",
        content: [
          "California residents are entitled to: (a) Know what categories of personal information we collect and disclose; (b) Delete personal information; (c) Correct inaccurate information; (d) Non-discrimination for exercising privacy rights; and (e) Notice that OpenSpot DOES NOT sell or share personal information for cross-context behavioral advertising.",
        ],
      },
      {
        title: "9.4 How to Exercise Your Rights",
        content:
          "To exercise any of these rights, email legal@openspotleague.com with the subject line 'Data Privacy Request' specifying your country of residence and the specific right you wish to exercise. We will respond and fulfill verified requests within statutory deadlines.",
      },
    ],
  },
  {
    id: "youtube-embeds",
    number: "10",
    title: "YouTube API Services Disclosures",
    plainEnglishSummary:
      "OpenSpot TV embeds videos from YouTube using the official YouTube API. When you watch these videos, Google and YouTube may collect data about your viewing in accordance with their privacy policy.",
    subsections: [
      {
        title: "10.1 Mandatory YouTube API Disclosure",
        content: [
          "OpenSpot TV utilizes YouTube API Services to embed and showcase action sports videos. By accessing or viewing videos on OpenSpot TV, you agree to be bound by the YouTube Terms of Service (https://www.youtube.com/t/terms) and acknowledge that your interaction with video content is governed by the Google Privacy Policy (https://policies.google.com/privacy).",
          "OpenSpot does not store your Google/YouTube search history, video watch history, or video comments. Third-party video tracking is governed directly by Google's privacy settings.",
        ],
      },
    ],
  },
  {
    id: "policy-changes",
    number: "11",
    title: "Updates to this Privacy Policy",
    plainEnglishSummary:
      "We may update this policy from time to time to reflect new features or legal requirements. When we make changes, we will update the date at the top.",
    subsections: [
      {
        title: "11.1 Policy Revisions",
        content:
          "We reserve the right to amend this Privacy Policy at our discretion. The date at the top of this document indicates the effective date of the latest revisions. Continued use of our Platform after revisions indicates acceptance of the updated practices.",
      },
    ],
  },
  {
    id: "contact-privacy",
    number: "12",
    title: "Contact Us & Data Inquiries",
    plainEnglishSummary:
      "Have questions or need help with your privacy? Reach out to our team at legal@openspotleague.com or visit /support.",
    subsections: [
      {
        title: "12.1 Communication Channels",
        content: [
          "If you have any questions, concerns, or requests regarding this Privacy Policy or our data protection practices, please contact:",
          "Open Spot League",
          "Attn: Data Protection Officer",
          "Email: legal@openspotleague.com or support@openspotleague.com",
          "In-App Help: /support",
          "Location: Bogotá D.C., Colombia",
        ],
      },
    ],
  },
] as const;
