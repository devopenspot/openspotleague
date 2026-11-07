import type { LegalSection } from "@/lib/legal/types";

export type { LegalSection } from "@/lib/legal/types";

export const TERMS_LAST_UPDATED = "November 7, 2026";
export const TERMS_EFFECTIVE_DATE = "November 7, 2026";
export const TERMS_VERSION = "2.0";

export const TERMS_KEY_POINTS: readonly string[] = [
  "You must be 13 or older. If you're under 18, a parent or guardian has to agree for you.",
  "Riding is dangerous and you ride at your own risk. Always wear a helmet.",
  "A spot on the map is not permission to ride there. Respect private property.",
  "You keep ownership of what you post, and you let us show it on OpenSpot.",
  "Play fair: no betting, no cheating, no harassment.",
];

export const TERMS_SECTIONS: readonly LegalSection[] = [
  {
    id: "acceptance",
    number: "01",
    title: "Using OpenSpot",
    summary:
      "These terms apply whenever you use OpenSpot: the map, games, the League and OpenSpot TV. By using it, you agree to them and to our Privacy Policy.",
    points: [
      "You must be at least 13 years old to use OpenSpot.",
      "If you're under 18, a parent or legal guardian must agree to these terms for you, and they are responsible for how you use OpenSpot.",
      "We may update these terms. When we do, we change the date at the top, and important changes are announced on the site.",
    ],
  },
  {
    id: "risk-waiver",
    number: "02",
    title: "Ride at your own risk",
    calloutType: "risk",
    summary:
      "Skateboarding, BMX, scooter and roller are dangerous. OpenSpot is a map and a scorekeeper. We don't inspect spots, supervise riders or guarantee anyone's safety.",
    points: [
      "You can get badly hurt or killed. Wear a helmet and pads, check your gear and the spot, and ride within your limits.",
      "You choose where and how you ride. As far as the law allows, you don't hold OpenSpot or its team responsible for injuries or damage that happen while you ride.",
      "Emergency numbers on OpenSpot are there to help, but they may be out of date. In an emergency, call your local emergency number directly.",
    ],
  },
  {
    id: "spots-property",
    number: "03",
    title: "Spots and private property",
    calloutType: "trespass",
    summary:
      "Spots are added by the community. A spot on the map does not mean it is public, safe, or that you are allowed to ride there.",
    points: [
      "Check whether you're allowed to ride a spot before you go. Follow signs, opening hours and local rules.",
      "Don't trespass, damage property or leave a mess. You are responsible for any fines or trouble that follow.",
      "Own a place listed on OpenSpot and want it removed? Email legal@openspotleague.com with the spot link and how you're connected to the property.",
    ],
  },
  {
    id: "accounts",
    number: "04",
    title: "Your account",
    summary:
      "Sign in with Google, or play games as a guest without an account.",
    points: [
      "We never see your Google password.",
      "Keep your account safe. You're responsible for what happens under it.",
      "If you think someone else is using your account, tell us right away.",
    ],
  },
  {
    id: "ugc",
    number: "05",
    title: "What you post",
    summary:
      "Spots, photos, descriptions and contest videos you add stay yours. You give us permission to show them on OpenSpot.",
    points: [
      "By posting, you let OpenSpot store, resize, display and share your content to run and promote OpenSpot. This permission continues after you post.",
      "Only post content you own or have permission to use. Don't post anyone under 18 without their parent's OK.",
      "We can edit, hide or remove content that is wrong, duplicated, offensive or that breaks these terms.",
      "Found your photo or video posted without permission? Email legal@openspotleague.com with the link and proof that it's yours, and we'll take it down. We close the accounts of people who keep doing it.",
    ],
  },
  {
    id: "games-league",
    number: "06",
    title: "Games, contests and fair play",
    summary:
      "Games like S.K.A.T.E. are for practice and fun. League contests are run by their organizers, and OpenSpot provides the tools.",
    points: [
      "No betting or gambling on games or contests.",
      "Report your tricks honestly. Don't fake your location, use bots or mess with other players' games.",
      "Contest organizers are responsible for their events: permits, safety, insurance, rider waivers and judging. OpenSpot doesn't run their events unless we say so.",
      "We aren't responsible for cancelled contests or for injuries during them.",
    ],
  },
  {
    id: "paid-plans",
    number: "07",
    title: "Paid plans",
    summary:
      "The map, saved spots, games and TV are free. League contests have a free plan and paid plans for bigger contests.",
    points: [
      "You see the price before you pay.",
      "Payments go through a payment provider, so we never see your card details.",
      "Payments are final, except where the law in your country gives you a right to a refund.",
    ],
  },
  {
    id: "conduct",
    number: "08",
    title: "Community rules",
    summary:
      "Keep OpenSpot a good place to ride and hang out.",
    points: [
      "Don't harass, threaten or insult other people.",
      "Don't post spam, porn, hate or violent content.",
      "Don't copy our data with bots, try to break into the site, or get around its limits.",
      "OpenSpot TV plays videos from YouTube. When you watch them, YouTube's terms apply and the videos belong to their creators.",
      "We can suspend or close accounts that break these rules.",
    ],
  },
  {
    id: "legal",
    number: "09",
    title: "Liability, disputes and contact",
    summary:
      "We work hard to keep OpenSpot accurate and online, but we can't promise it will always be perfect.",
    points: [
      "OpenSpot is provided as is. Spot details, weather and other info may be wrong or missing.",
      "As far as the law allows, our total liability to you is capped at what you paid us in the last 6 months, or USD 50 if that's more.",
      "If something you do, such as trespassing or posting someone else's photo, gets OpenSpot into legal trouble, you cover the costs.",
      "These terms follow the laws of Colombia. If we disagree, we first try to sort it out together. If that doesn't work within 30 days, we go to arbitration in Bogotá. This doesn't remove any consumer rights you have in your own country.",
      "Questions? Email legal@openspotleague.com or visit /support.",
    ],
  },
] as const;
