import type { LegalSection } from "@/lib/legal/types";

export type { LegalSection as PrivacySection } from "@/lib/legal/types";

export interface ProcessorItem {
  name: string;
  purpose: string;
  privacyUrl: string;
}

export const PRIVACY_LAST_UPDATED = "November 7, 2026";
export const PRIVACY_EFFECTIVE_DATE = "November 7, 2026";
export const PRIVACY_VERSION = "2.0";

export const PRIVACY_KEY_POINTS: readonly string[] = [
  "We only collect what we need to run the map, games and contests.",
  "We never sell your data, and we don't use ad trackers.",
  "We only use your location when you tap a button that needs it.",
  "You can ask us to see, fix or delete your data at any time.",
];

export const THIRD_PARTY_PROCESSORS: readonly ProcessorItem[] = [
  {
    name: "Supabase",
    purpose: "Accounts and the database",
    privacyUrl: "https://supabase.com/privacy",
  },
  {
    name: "Cloudflare",
    purpose: "Hosting, photos and videos",
    privacyUrl: "https://www.cloudflare.com/privacypolicy/",
  },
  {
    name: "Google / YouTube",
    purpose: "Google sign-in and OpenSpot TV videos",
    privacyUrl: "https://policies.google.com/privacy",
  },
  {
    name: "OpenStreetMap",
    purpose: "Map tiles and street addresses",
    privacyUrl: "https://wiki.osmfoundation.org/wiki/Privacy_Policy",
  },
  {
    name: "OpenWeather",
    purpose: "Weather at spots",
    privacyUrl: "https://openweather.co.uk/privacy-policy",
  },
  {
    name: "Emergency Number API",
    purpose: "Local emergency phone numbers",
    privacyUrl: "https://emergencynumberapi.com",
  },
];

export const PRIVACY_SECTIONS: readonly LegalSection[] = [
  {
    id: "overview",
    number: "01",
    title: "Who we are",
    summary:
      "OpenSpot is run by Open Spot League in Bogotá, Colombia. We're responsible for the personal data you share with us.",
    points: [
      "We collect only what we need to run OpenSpot.",
      "We never sell your data, and we don't show ads that track you around the web.",
      "We follow Colombia's data protection law (Law 1581 of 2012, Habeas Data), the GDPR in Europe and the UK, and the CCPA/CPRA in California.",
    ],
  },
  {
    id: "information-collected",
    number: "02",
    title: "What we collect",
    summary:
      "We collect what you give us, your location only when you ask for it, and a little technical data to keep the site working.",
    points: [
      "Your account: your name, email and profile photo from Google, plus your favorite sport and units if you set them.",
      "What you add: spots, photos, game results, contest entries, video links and scores, and messages you send us.",
      "Your location: only when you tap a button that needs it, like Near me or checking in at a spot. We never track your location in the background.",
      "Technical data: browser type, error reports and a scrambled version of your IP address that we use to block spam and abuse.",
    ],
  },
  {
    id: "how-we-use",
    number: "03",
    title: "How we use it",
    summary:
      "We use your data to run OpenSpot and keep it fair and safe. Nothing else.",
    points: [
      "To show the map, save your spots, run games and contests, and show results.",
      "To confirm you're at a spot when a game or check-in needs it. This needs your browser's permission, and you can turn it off anytime in your browser settings.",
      "To stop spam, cheating and abuse.",
      "To answer legal requests, like copyright or property removal claims.",
    ],
  },
  {
    id: "cookies-storage",
    number: "04",
    title: "Cookies",
    summary:
      "We only use cookies OpenSpot needs to work. No advertising or tracking cookies.",
    points: [
      "A sign-in cookie that keeps you logged in.",
      "A cookie that shuffles the spots on the home page. It doesn't identify you.",
      "Settings saved in your browser, like your sport, units, last map view, TV autoplay and your guest game pass.",
      "You can clear these in your browser at any time, but you'll be signed out and your settings will reset.",
    ],
  },
  {
    id: "third-parties",
    number: "05",
    title: "Services we use",
    summary:
      "A few trusted services help us run OpenSpot. They only get the data they need to do their job.",
    points: [
      "Your data may be stored on servers in the United States and other countries. We protect it with encryption and strict access controls wherever it's stored.",
    ],
  },
  {
    id: "retention-deletion",
    number: "06",
    title: "Keeping and deleting your data",
    summary:
      "We keep your data while your account is open, and you can ask us to delete it at any time.",
    points: [
      "To delete your account, email legal@openspotleague.com or visit /support. We delete your profile and personal data within 30 days.",
      "Spots and photos you added stay on the map so other riders can still use them, but without your name. Game and contest results stay too, without your name.",
      "Technical logs are deleted automatically within 90 days.",
    ],
  },
  {
    id: "user-rights",
    number: "07",
    title: "Your rights",
    summary:
      "Wherever you live, you control your data.",
    points: [
      "You can ask to see, correct, delete or download your data, and object to how we use it.",
      "To make a request, email legal@openspotleague.com with the subject \"Data Privacy Request\". We reply within the time the law gives us.",
      "If you're not happy with our answer, you can complain to your data protection authority. In Colombia, that's the Superintendencia de Industria y Comercio (SIC).",
      "OpenSpot is not for children under 13. If we find an account belonging to a child under 13, we delete it. Parents can contact us at legal@openspotleague.com.",
    ],
  },
  {
    id: "contact-privacy",
    number: "08",
    title: "Changes and contact",
    summary:
      "If we change this policy, we update the date at the top.",
    points: [
      "Questions about your privacy? Email legal@openspotleague.com or visit /support.",
      "Open Spot League, Bogotá D.C., Colombia.",
    ],
  },
] as const;
