export interface LegalSubSection {
  id?: string;
  title?: string;
  content: string | string[];
}

export interface LegalSection {
  id: string;
  number: string;
  title: string;
  plainEnglishSummary: string;
  subsections: LegalSubSection[];
  calloutType?: "risk" | "trespass" | "youtube" | "emergency";
}

export const TERMS_LAST_UPDATED = "October 21, 2026";
export const TERMS_EFFECTIVE_DATE = "October 21, 2026";
export const TERMS_VERSION = "1.0";

export const TERMS_SECTIONS: readonly LegalSection[] = [
  {
    id: "acceptance",
    number: "01",
    title: "Acceptance of Terms & Eligibility",
    plainEnglishSummary:
      "By using OpenSpot, signing in, or browsing spots and challenges, you agree to these terms. You must be at least 13 years old to use the platform. If you are under 18, your parent or legal guardian must agree to these terms on your behalf.",
    subsections: [
      {
        title: "1.1 Binding Agreement",
        content: [
          "These Terms of Use ('Terms') constitute a legally binding contract between you ('User', 'Rider', 'you', or 'your') and Open Spot League ('OpenSpot', 'we', 'our', or 'us'). These Terms govern your access to and use of the OpenSpot website, mobile interfaces, map directory, challenge network, OpenSpot TV, and associated services (collectively, the 'Platform').",
          "By accessing the Platform, browsing spots, creating an account via Google OAuth or Supabase, participating in challenge games (as a signed-in rider or anonymous guest), submitting content, or viewing OpenSpot TV, you affirmatively confirm that you have read, understood, and agreed to be bound by these Terms and our Privacy Policy.",
        ],
      },
      {
        title: "1.2 Age Requirements & Minors (13+)",
        content: [
          "The Platform is strictly prohibited for individuals under thirteen (13) years of age. OpenSpot does not knowingly collect, store, or solicit personal data from children under 13 under any circumstances, in compliance with the United States Children's Online Privacy Protection Act (COPPA), European Union General Data Protection Regulation (GDPR), and Colombian Statutory Law 1581 of 2012.",
          "If you are between the ages of 13 and the legal age of majority in your jurisdiction (typically 18 years old), you represent and warrant that your parent or legal guardian has reviewed and agreed to these Terms on your behalf. Parents and legal guardians assume full legal and financial responsibility for any use of the Platform by their minor children.",
        ],
      },
      {
        title: "1.3 Modifications to Terms",
        content:
          "We reserve the right to revise and update these Terms at our sole discretion. We will indicate the 'Last Updated' date at the top of this document. Continued use of the Platform following published revisions signifies your acceptance of the updated terms. Material changes will be communicated via on-site notification or email where feasible.",
      },
    ],
  },
  {
    id: "risk-waiver",
    number: "02",
    title: "Assumption of Risk, Inherent Hazards & Release of Liability",
    calloutType: "risk",
    plainEnglishSummary:
      "Action sports (skateboarding, BMX, inline skating, scootering) are inherently dangerous. You can get seriously hurt, break bones, suffer paralysis, or die. OpenSpot is ONLY an informational map and scorekeeper. We do NOT supervise spots, inspect surfaces, coach riders, or guarantee safety. You ride entirely at your own risk. Always wear a helmet and protective pads.",
    subsections: [
      {
        title: "2.1 Inherent Dangers of Action Sports",
        content: [
          "You expressly acknowledge that participation in skateboarding, BMX freestyle, aggressive inline skating, freestyle scootering, and related disciplines involves known and unanticipated risks of severe bodily injury, permanent disability, paralysis, death, traumatic brain injury, concussion, and damage to personal property.",
          "These risks arise naturally from high-speed maneuvers, terrain irregularities, slick or damaged surfaces, vehicular traffic, weather variations, collisions with other persons or objects, equipment failure, and personal miscalculation.",
        ],
      },
      {
        title: "2.2 Complete Release & Waiver of Liability",
        content: [
          "To the fullest extent permitted by applicable law, you knowingly, freely, and voluntarily assume all risks, both known and unknown, associated with visiting any spot listed on OpenSpot or participating in any training challenge, game session, or league event.",
          "You hereby release, waive, forever discharge, and hold harmless OpenSpot, its founders, operators, curators, moderators, contributors, contractors, and affiliates from any and all claims, demands, losses, liabilities, damages, medical expenses, or costs arising out of or related to any personal injury, death, disability, or property damage sustained by you or caused by you to others, whether caused by the negligence of OpenSpot, spot conditions, fellow riders, or otherwise.",
        ],
      },
      {
        title: "2.3 Mandatory Safety Equipment & Helmet Acknowledgment",
        content:
          "OpenSpot strongly advocates for rider safety. Helmets and certified protective equipment (knee pads, elbow pads, wrist guards) significantly reduce the severity of head traumas and fractures. You acknowledge that you alone are responsible for inspecting your equipment, evaluating spot surface conditions, monitoring weather risks (such as wet pavement or ice), and riding within your individual physical capabilities and skill limits.",
      },
    ],
  },
  {
    id: "spots-property",
    number: "03",
    title: "Spot Directory, Private Property & Anti-Trespassing",
    calloutType: "trespass",
    plainEnglishSummary:
      "OpenSpot is a community directory of spots. Just because a spot is listed here does NOT mean you have legal permission to skate or ride there. Never trespass on private property, ignore 'No Skateboarding' signs, damage property, or break municipal curfews. Respect the spot, respect property owners, and follow local laws.",
    subsections: [
      {
        title: "3.1 Informational Directory Only — No License to Enter",
        content: [
          "OpenSpot aggregates public skateparks, plazas, municipal facilities, and community-submitted urban terrain (e.g., ledges, rails, curbs, banks, ditches). The appearance, indexing, or display of any spot, coordinates, or address on the Platform does NOT constitute an endorsement, representation, or guarantee that the location is public property, authorized for recreation, or safe.",
          "Inclusion on OpenSpot does NOT grant any right of way, easement, license, or invitation to enter onto any land, building, commercial plaza, school, or residential premises. You are solely and individually responsible for determining the ownership status of any location, verifying municipal recreational ordinances, and obtaining lawful permission from property owners or managers prior to riding.",
        ],
      },
      {
        title: "3.2 Strict Anti-Trespassing & Property Defacement Prohibition",
        content: [
          "You agree not to enter, remain upon, or ride any private property where entry is forbidden, where 'No Skateboarding / No Biking / No Trespassing' signs are posted, or after operating hours or municipal curfews.",
          "You agree not to deface, wax unauthorized fixtures, destroy, modify, or vandalize public or private property. OpenSpot disclaims any liability for civil citations, trespass arrests, fines, impounded sporting equipment, or lawsuits brought by property owners against riders.",
        ],
      },
      {
        title: "3.3 Property Owner Takedown & Spot Removal Procedure",
        content: [
          "We respect private property rights and municipal authority. If you are a property owner, commercial manager, public official, or authorized representative and wish to have an unauthorized or private location removed or unlisted from OpenSpot, please contact us at legal@openspotleague.com or via our in-app Support channel with:",
          "(a) The exact spot name and URL or coordinates on OpenSpot; (b) Proof or declaration of property ownership or management authority; and (c) Specific removal request. We review and process verified property owner takedown requests promptly.",
        ],
      },
    ],
  },
  {
    id: "accounts",
    number: "04",
    title: "User Accounts, Security & Guest Sessions",
    plainEnglishSummary:
      "You can sign in with your Google account or join challenge games as an anonymous guest. Keep your account secure. You are responsible for all activity that occurs under your session or guest token.",
    subsections: [
      {
        title: "4.1 Authentication via Google OAuth & Supabase",
        content:
          "OpenSpot utilizes secure OAuth 2.0 authentication provided by Google and Supabase. We do not store or process your Google account password. When signing in, we import your email address, display name, and avatar image to establish your Rider Profile.",
      },
      {
        title: "4.2 Account Responsibilities",
        content:
          "You agree to maintain the confidentiality of your session tokens and browser credentials. You are entirely responsible for all actions, comments, submissions, and challenge moves executed under your account. You agree to notify OpenSpot immediately of any unauthorized use or security breach of your account.",
      },
      {
        title: "4.3 Anonymous Guest Sessions & IP Hashing",
        content:
          "To allow friction-free training, OpenSpot permits participation in challenge games as an anonymous guest using an ephemeral client-side token stored in your browser's localStorage. To prevent spam, flood attacks, and abusive lobby generation, we create and store a one-way cryptographic hash of your IP address (creatorIpHash) for temporary rate-limiting and anti-abuse safeguards.",
      },
    ],
  },
  {
    id: "ugc",
    number: "05",
    title: "User-Generated Content (UGC) & License Grant",
    plainEnglishSummary:
      "When you add a spot, upload photos, or submit trick videos, you keep your copyright. However, you give OpenSpot permission to display, resize, host, and promote your content on our map and platform. You must own the content you upload and not infringe on anyone's rights.",
    subsections: [
      {
        title: "5.1 Ownership & License Grant to OpenSpot",
        content: [
          "You retain full ownership of any photographs, spot descriptions, trick recordings, reviews, and text that you upload or submit to OpenSpot ('User-Generated Content' or 'UGC').",
          "By submitting UGC, you hereby grant OpenSpot a perpetual, irrevocable, worldwide, non-exclusive, royalty-free, fully paid, transferable, and sublicensable license to host, cache, store, reproduce, crop, resize, display, distribute, index, and publish such content in connection with operating, promoting, and improving the Platform.",
        ],
      },
      {
        title: "5.2 Representations & Warranties",
        content: [
          "You represent and warrant that: (a) You own all rights to the UGC you upload or have obtained all necessary written releases and permissions; (b) Your UGC does not infringe the copyright, trademark, privacy, publicity, or intellectual property rights of any third party; (c) Your UGC does not depict recognizable minors without verified parental consent; and (d) Your UGC does not portray dangerous illegal activities, hate speech, or defamatory material.",
        ],
      },
      {
        title: "5.3 Moderation & Editorial Discretion",
        content:
          "OpenSpot and its authorized scoped curators reserve the unilateral right, without prior notice or liability, to monitor, review, reject, crop, recategorize, unpublish, or permanently delete any UGC for any reason, including content deemed duplicative, inaccurate, copyright-infringing, or inappropriate.",
      },
    ],
  },
  {
    id: "dmca",
    number: "06",
    title: "Copyright Policy & DMCA Takedown Notice",
    plainEnglishSummary:
      "We respect copyright laws. If someone uploaded your photo or video without permission, send a formal DMCA takedown notice to legal@openspotleague.com and we will take it down promptly. False claims may result in legal liability.",
    subsections: [
      {
        title: "6.1 DMCA Notice (17 U.S.C. § 512)",
        content: [
          "OpenSpot complies with the United States Digital Millennium Copyright Act (DMCA) and international copyright directives. If you believe your copyrighted work has been copied or posted on the Platform in a manner that constitutes infringement, please submit a written notice to our designated Copyright Agent at legal@openspotleague.com with the subject line 'DMCA Takedown Notice'.",
          "Your notice must include: (1) A physical or electronic signature of the copyright owner or authorized representative; (2) Identification of the copyrighted work claimed to have been infringed; (3) Identification of the material to be removed, including specific URLs or spot IDs; (4) Your contact information (name, address, telephone number, and email); (5) A statement that you have a good-faith belief that use of the material is not authorized by the copyright owner, its agent, or the law; and (6) A statement, made under penalty of perjury, that the information in the notification is accurate and that you are authorized to act on behalf of the owner.",
        ],
      },
      {
        title: "6.2 Repeat Infringer Policy",
        content:
          "In accordance with the DMCA and other applicable laws, OpenSpot has adopted a policy of terminating, in appropriate circumstances and at our sole discretion, the accounts of users who are deemed to be repeat infringers.",
      },
    ],
  },
  {
    id: "challenge-games",
    number: "07",
    title: "Challenge Arena, Training Games & Fair Play",
    plainEnglishSummary:
      "Our training games (S.K.A.T.E., B.I.K.E., etc.) are for fun, practice, and progression. OpenSpot strictly prohibits illegal betting, gambling, or wagering. Do not cheat, fake your location, or use bots. We provide the rule engine, not referee supervision.",
    subsections: [
      {
        title: "7.1 Skill-Based Recreational Training",
        content: [
          "The challenge game formats offered on OpenSpot (Game of S.K.A.T.E., B.I.K.E., S.C.O.O.T., R.O.L.L., and racing laps) are pure games of athletic skill, balance, coordination, and physical practice.",
          "OpenSpot is not a gambling platform. The Platform strictly prohibits the use of its challenge game systems, share codes, or scorekeeping tools for any form of real-money wagering, sports betting, staking, or illegal gambling.",
        ],
      },
      {
        title: "7.2 Location Verification & Anti-Cheating",
        content: [
          "Challenge games and spot check-ins may require GPS location verification to confirm that players are within the designated geographic radius of a spot. You agree not to tamper with, spoof, mock, simulate, or manipulate your GPS coordinates or device location sensors.",
          "You agree to adhere to honorable sportsmanship, to accurately report trick attempts and landed maneuvers, and to refrain from automated bots, script-based action requests, or denial-of-service tactics against game sessions.",
        ],
      },
    ],
  },
  {
    id: "league-events",
    number: "08",
    title: "Sport Events & Independent Organizers",
    plainEnglishSummary:
      "Events listed in the League section are created and run by independent community organizers, not OpenSpot (unless explicitly marked). Organizers are solely responsible for permits, insurance, and venue safety. OpenSpot is not liable for event cancellations or injuries during contests.",
    subsections: [
      {
        title: "8.1 Independent Status of Event Organizers",
        content: [
          "Sport events, jams, contests, and competitions listed on OpenSpot are organized, hosted, managed, and executed by independent third-party organizers and clubs. OpenSpot provides digital directory, registration, scoring matrix, and points ledger software only.",
          "OpenSpot is NOT an employer, joint venturer, partner, sponsor, or insurer of any third-party event organizer. OpenSpot does not inspect event premises, control crowd flow, provide emergency medical personnel, or oversee judge decisions.",
        ],
      },
      {
        title: "8.2 Organizer Duties & Participant Releases",
        content:
          "Independent event organizers are solely responsible for securing all necessary municipal permits, street-closure authorizations, commercial general liability insurance, medical personnel, and obtaining physical release waivers and parental consents from all competing riders.",
      },
    ],
  },
  {
    id: "commercial-plans",
    number: "09",
    title: "Paid Services & Organizer Plans (When Activated)",
    plainEnglishSummary:
      "Core browsing, spot mapping, and challenge games are free. In the future, specialized event organizer plans or premium tiers may be offered. When active, all prices will be displayed clearly before you pay. Fees are processed securely via third-party processors and are non-refundable except where required by law.",
    subsections: [
      {
        title: "9.1 Current Free Access & Future Commercial Tiers",
        content:
          "General access to the OpenSpot directory, public maps, personal spot saving, and recreational challenge games is provided free of charge. OpenSpot may introduce optional paid organizer plans (e.g., elevated participant caps, extended judging criteria, multi-stage tournaments) or premium creator tools in the future.",
      },
      {
        title: "9.2 Pricing, Taxes & Payment Gateways",
        content:
          "When commercial plans are activated, applicable fees, billing intervals, and currencies will be clearly disclosed prior to purchase. Payments will be processed through certified third-party payment gateways (e.g., Stripe). OpenSpot does not store your raw credit card numbers or banking secrets. You are responsible for all applicable sales, value-added, or transactional taxes associated with your purchases.",
      },
      {
        title: "9.3 Refund Policy",
        content:
          "Except where required by mandatory consumer protection statutes in your jurisdiction, all digital plan fees and event upgrade purchases are final and non-refundable once activated.",
      },
    ],
  },
  {
    id: "tv-youtube",
    number: "10",
    title: "OpenSpot TV & Third-Party Embeds (YouTube Terms)",
    calloutType: "youtube",
    plainEnglishSummary:
      "OpenSpot TV embeds action sports video clips from YouTube and other platforms. By watching these videos, you agree to YouTube's Terms of Service and Google's Privacy Policy. OpenSpot does not claim ownership of embedded third-party videos.",
    subsections: [
      {
        title: "10.1 YouTube API Services Compliance",
        content: [
          "OpenSpot TV utilizes the YouTube API Services to embed and stream video content. By accessing, playing, or browsing videos on OpenSpot TV, you explicitly agree to be bound by the YouTube Terms of Service (available at https://www.youtube.com/t/terms) and acknowledge the Google Privacy Policy (available at https://policies.google.com/privacy).",
          "OpenSpot embeds videos via standard iframe parameters and does not download, store offline, or modify raw third-party audiovisual streams.",
        ],
      },
      {
        title: "10.2 Intellectual Property of Embedded Videos",
        content:
          "All copyrights, trademarks, and audiovisual rights in embedded videos belong exclusively to their respective creators, athletes, filmers, and YouTube channels. OpenSpot does not claim ownership of any third-party embedded video content.",
      },
    ],
  },
  {
    id: "code-of-conduct",
    number: "11",
    title: "Prohibited Conduct & Community Rules",
    plainEnglishSummary:
      "Do not harass others, upload spam, post offensive or infringing content, scrape our database, reverse-engineer the site, or attempt to bypass rate limits. We will ban accounts that abuse the platform.",
    subsections: [
      {
        title: "11.1 Prohibited Activities",
        content: [
          "You agree not to engage in any of the following prohibited behaviors: (a) Harassing, threatening, stalking, or defaming other riders or organizers; (b) Uploading pornography, hate speech, or violent non-sport content; (c) Scraping, crawling, harvesting, or spidering spot coordinates, user emails, or database records using automated tools without prior written consent; (d) Tampering with proxy security headers, rate-limiting tiers, or authentication tokens; (e) Introducing viruses, malware, or destructive payloads; or (f) Reverse engineering or decompiling any aspect of the Platform software.",
        ],
      },
      {
        title: "11.2 Account Suspension & Termination",
        content:
          "We reserve the right to suspend, disable, or permanently terminate your account, remove your spots, or block your IP address from the Platform at any time, with or without notice, for conduct that violates these Terms or harms the community.",
      },
    ],
  },
  {
    id: "warranties-disclaimers",
    number: "12",
    title: "Disclaimer of Warranties ('As-Is')",
    calloutType: "emergency",
    plainEnglishSummary:
      "OpenSpot is provided 'AS-IS' and 'AS-AVAILABLE'. We cannot guarantee uninterrupted uptime, 100% accurate weather forecasts, spot descriptions without errors, or emergency phone numbers. In a true medical emergency, always call 911 or your local emergency services directly.",
    subsections: [
      {
        title: "12.1 'As-Is' and 'As-Available' Provision",
        content:
          "THE PLATFORM, INCLUDING ALL SPOT MAPS, WEATHER FORECASTS, EMERGENCY DIRECTORIES, CHALLENGE SYSTEMS, AND CONTENT, IS PROVIDED STRICTLY ON AN 'AS-IS' AND 'AS-AVAILABLE' BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMISSIBLE UNDER APPLICABLE LAW, OPENSPOT DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.",
      },
      {
        title: "12.2 Emergency Numbers & Weather Advisory",
        content:
          "Emergency contact numbers provided on the Platform are compiled from third-party references (emergencynumberapi.com) for convenience only. OpenSpot does not guarantee the accuracy, currency, or reachability of any listed emergency telephone number. In the event of a medical emergency, severe crash, or crime, dial your nation's official emergency dispatch number (e.g., 911, 112, 123) directly from your telecommunications device.",
      },
    ],
  },
  {
    id: "limitation-liability",
    number: "13",
    title: "Limitation of Liability & Indemnification",
    plainEnglishSummary:
      "To the extent allowed by law, OpenSpot and its creators are not liable for any damages or injuries resulting from your use of the platform. If your actions (e.g. trespassing or uploading infringing photos) result in a lawsuit against OpenSpot, you agree to cover our legal costs and damages.",
    subsections: [
      {
        title: "13.1 Damage Exclusion",
        content:
          "TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL OPENSPOT, ITS DIRECTORS, CREATORS, EMPLOYEES, AFFILIATES, OR CURATORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING BUT NOT LIMITED TO DAMAGES FOR PERSONAL INJURY, WRONGFUL DEATH, PAIN AND SUFFERING, LOSS OF PROFITS, LOSS OF DATA, PROPERTY DAMAGE, OR BUSINESS INTERRUPTION ARISING OUT OF OR IN CONNECTION WITH YOUR USE OR INABILITY TO USE THE PLATFORM.",
      },
      {
        title: "13.2 Liability Cap",
        content:
          "IN NO EVENT SHALL OPENSPOT'S TOTAL AGGREGATE LIABILITY TO YOU FOR ALL CLAIMS EXCEED THE GREATER OF: (A) THE TOTAL AMOUNT PAID BY YOU TO OPENSPOT IN THE SIX (6) MONTHS PRECEDING THE CLAIM; OR (B) FIFTY UNITED STATES DOLLARS ($50.00 USD) OR ITS EQUIVALENT IN COLOMBIAN PESOS (COP).",
      },
      {
        title: "13.3 Indemnification",
        content:
          "You agree to defend, indemnify, and hold harmless OpenSpot, its officers, contractors, curators, and affiliates from and against any third-party claims, liabilities, damages, losses, costs, and expenses (including reasonable attorney's fees) arising out of or in any way connected with: (a) Your breach of these Terms; (b) Your User-Generated Content; (c) Your violation of any third-party right, including intellectual property, property ownership, or privacy rights; or (d) Your physical conduct, riding, trespassing, or accidents at any spot or event.",
      },
    ],
  },
  {
    id: "governing-law",
    number: "14",
    title: "Governing Law, Dispute Resolution & Arbitration",
    plainEnglishSummary:
      "These terms are governed by the laws of the Republic of Colombia. Any legal disputes will be resolved in Bogotá D.C., Colombia, starting with friendly conciliation and, if needed, binding commercial arbitration. This does not take away any mandatory consumer protections you have in your own country.",
    subsections: [
      {
        title: "14.1 Governing Law & Jurisdiction (Bogotá, Colombia)",
        content:
          "These Terms, their interpretation, and any dispute or controversy arising out of or relating to them or the Platform shall be governed by and construed in accordance with the laws of the Republic of Colombia, without giving effect to any principles of conflicts of law. You and OpenSpot agree that the courts and competent tribunals located in Bogotá D.C., Colombia shall have jurisdiction, subject to the arbitration clause below.",
      },
      {
        title: "14.2 Amicable Resolution & Conciliation",
        content:
          "Before initiating formal arbitration or court proceedings, you and OpenSpot agree to first attempt in good faith to resolve any dispute, claim, or controversy through informal consultation and amicable conciliation by contacting legal@openspotleague.com.",
      },
      {
        title: "14.3 Binding Arbitration",
        content:
          "If the dispute cannot be resolved informally within thirty (30) days, any controversy, claim, or dispute arising out of or related to these Terms shall be resolved by binding arbitration administered by the Center of Arbitration and Conciliation of the Chamber of Commerce of Bogotá (Centro de Arbitraje y Conciliación de la Cámara de Comercio de Bogotá), in accordance with its institutional arbitration rules. The arbitration tribunal shall consist of one (1) arbitrator appointed in accordance with said rules, the seat of arbitration shall be Bogotá D.C., Colombia, and the proceedings shall be conducted in Spanish, unless agreed otherwise.",
      },
      {
        title: "14.4 Mandatory Consumer Protections",
        content:
          "Nothing in these Terms shall deprive consumers residing in jurisdictions with non-waivable statutory consumer protection laws (such as statutory rights under European Union consumer law or Law 1480 of 2011 in Colombia) of their mandatory legal protections.",
      },
      {
        title: "14.5 Contact & Inquiries",
        content:
          "For legal notices, DMCA requests, spot removals, or inquiries regarding these Terms, contact us at legal@openspotleague.com or via our in-app Support center at /support.",
      },
    ],
  },
] as const;
