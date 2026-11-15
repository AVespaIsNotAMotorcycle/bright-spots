// The three guided detective cases for students.
// Each case is a sequence of steps: predict → examine → analyze → interpret.

export type StepKind =
  | "intro"       // set the scene
  | "predict"     // student makes a prediction before seeing data
  | "examine"     // show the time-series chart
  | "analyze"     // show the MK verdict + numbers
  | "interpret";  // so what? link to planner

export interface Step {
  kind: StepKind;
  heading: string;
  body: string;             // plain English, no jargon
  /** For predict steps: the choices the student picks from */
  choices?: { label: string; correct: boolean; explanation: string }[];
  /** For examine/analyze: which park + variable + period to show */
  parkId?: string;
  variable?: string;
  period?: string;
  /** For interpret: a link to the planner with a pre-set month */
  plannerLink?: { month: number; label: string };
}

export interface Case {
  id: string;
  title: string;
  subtitle: string;
  difficulty: "easy" | "medium" | "hard";
  steps: Step[];
}

export const CASES: Case[] = [
  {
    id: "crater-lake-warming",
    title: "Is Crater Lake warming?",
    subtitle: "The challenge author stood here. Let's find out what the data says.",
    difficulty: "easy",
    steps: [
      {
        kind: "intro",
        heading: "Welcome to Crater Lake, Oregon",
        body:
          "Crater Lake sits in the caldera of a volcano that exploded 7,700 years ago. " +
          "Its water is so clear it looks like the Pacific Ocean — the NASA Space Apps " +
          "challenge author literally filmed his intro video here. " +
          "Your job: figure out whether the temperature around the park is trending up, down, or not at all.",
      },
      {
        kind: "predict",
        heading: "Before you look at the data — make a guess",
        body: "Annual average high temperature at Crater Lake from 1981 to 2026 is…",
        choices: [
          {
            label: "Trending up (warming)",
            correct: true,
            explanation:
              "Correct. The data shows Crater Lake's annual high is rising at +0.69°F per decade " +
              "(q = 0.041, real after FDR correction). Over 45 years that is about +3°F total.",
          },
          {
            label: "Trending down (cooling)",
            correct: false,
            explanation:
              "Not quite. The data shows a warming signal, not a cooling one. " +
              "Western parks have warmed more than the global average.",
          },
          {
            label: "No clear trend",
            correct: false,
            explanation:
              "Close — the trend is real but modest. The statistical test says " +
              "it clears the significance bar after correcting for multiple tests (q < 0.05).",
          },
        ],
      },
      {
        kind: "examine",
        heading: "Now look at 45 years of data",
        body:
          "Each dot is one year's average daily high temperature at Crater Lake. " +
          "The dashed line is the Sen's slope — a trend line that is not fooled by outlier years. " +
          "The dashed horizontal line is the long-run average.",
        parkId: "crla",
        variable: "tmax_c",
        period: "annual",
      },
      {
        kind: "analyze",
        heading: "What does the statistical test say?",
        body:
          "The Mann-Kendall test asks: does the data consistently rank later years higher than earlier ones? " +
          "A p-value under 0.05 means the pattern is unlikely to be random. " +
          "Because we ran this test on 63 parks at once, we also apply a false-discovery-rate correction " +
          "(Benjamini-Hochberg) — that is what the q-value is. " +
          "Only trends with q < 0.05 earn the 'Real, not luck' verdict.",
        parkId: "crla",
        variable: "tmax_c",
        period: "annual",
      },
      {
        kind: "interpret",
        heading: "So what does this mean for a visit?",
        body:
          "Crater Lake's snow season is shifting. Peak snowmelt — when waterfalls run fullest — " +
          "has moved about two weeks earlier over the last 30 years. " +
          "The best wildflower weeks are moving earlier too. " +
          "If you plan a June visit expecting 2000-era conditions, you may be two weeks late.",
        parkId: "crla",
        variable: "tmax_c",
        period: "annual",
        plannerLink: { month: 6, label: "Plan a June visit to Crater Lake" },
      },
    ],
  },

  {
    id: "opposite-snow",
    title: "Same driver, opposite answers",
    subtitle: "Precipitation is falling in one park and rising in another. Why?",
    difficulty: "medium",
    steps: [
      {
        kind: "intro",
        heading: "The central mystery of this challenge",
        body:
          "The NASA challenge says: 'A measured variable can trend one way in one region " +
          "and the opposite way in another, even when the same process drives both.' " +
          "Let's find that in real data. We're going to look at summer precipitation " +
          "at two parks: Death Valley (California/Nevada) and Acadia (Maine).",
      },
      {
        kind: "predict",
        heading: "Death Valley, summer rain — predict the trend",
        body:
          "Death Valley is the hottest, driest place in North America. " +
          "Over the last 45 years, its summer (JJA) precipitation has…",
        choices: [
          {
            label: "Increased (more rain)",
            correct: false,
            explanation:
              "Not quite. Death Valley summer precipitation shows no statistically confirmed trend — " +
              "the desert stays a desert. But look at what's happening in the Northeast.",
          },
          {
            label: "Decreased (less rain)",
            correct: false,
            explanation:
              "Not confirmed. Death Valley's summer rain has no statistically real trend. " +
              "But check what is happening at Acadia in Maine.",
          },
          {
            label: "No confirmed change",
            correct: true,
            explanation:
              "Right. Death Valley summer rain shows no statistically significant trend (q > 0.05). " +
              "Now look at Acadia — and see if the story is different.",
          },
        ],
      },
      {
        kind: "examine",
        heading: "Death Valley summer rain, 1981–2026",
        body: "Noisy year-to-year variation with no clear direction. The trend line is nearly flat.",
        parkId: "deva",
        variable: "prcp_mm",
        period: "JJA",
      },
      {
        kind: "predict",
        heading: "Now Acadia, Maine — same variable, same period",
        body:
          "Acadia sits on the Atlantic coast of Maine. " +
          "Its summer (JJA) precipitation over the last 45 years has…",
        choices: [
          {
            label: "Increased (more rain)",
            correct: true,
            explanation:
              "Correct. Acadia's summer precipitation shows a confirmed upward trend. " +
              "The Atlantic coast is getting wetter summers as the climate shifts — " +
              "while the Southwest stays dry or gets drier. Same driver (warming), opposite regional signals.",
          },
          {
            label: "Decreased (less rain)",
            correct: false,
            explanation:
              "Actually it's going the other way. The Northeast is getting wetter summers " +
              "as warmer air holds more moisture and storm tracks shift.",
          },
          {
            label: "No confirmed change",
            correct: false,
            explanation:
              "Actually there is a confirmed trend at Acadia. " +
              "The Northeast is getting meaningfully wetter summers.",
          },
        ],
      },
      {
        kind: "examine",
        heading: "Acadia summer rain, 1981–2026",
        body:
          "Compare this with Death Valley. Same variable, same time period, " +
          "one park going one way, the other flat. The driver — a warming planet — is the same. " +
          "The regional response is not.",
        parkId: "acad",
        variable: "prcp_mm",
        period: "JJA",
      },
      {
        kind: "interpret",
        heading: "One planet, many responses",
        body:
          "This is exactly what the challenge is about. " +
          "Global warming doesn't mean everything warms and dries equally. " +
          "The West dries. The Northeast gets wetter summers. The Arctic warms fastest. " +
          "Detecting these regional differences — and distinguishing real trends from noise — " +
          "is why we need 45 years of satellite data and statistical significance testing.",
        plannerLink: { month: 8, label: "Compare an August visit to both parks" },
      },
    ],
  },

  {
    id: "hottest-park",
    title: "Which park is heating up fastest?",
    subtitle: "Find the park with the most rapidly rising summer hot days.",
    difficulty: "hard",
    steps: [
      {
        kind: "intro",
        heading: "Days above 90°F — a health and ecology metric",
        body:
          "Days above 90°F (32.2°C) affect wildlife breeding cycles, visitor safety, " +
          "and fire risk. We tracked this for all 64 parks from 1981 to 2026. " +
          "Some parks have zero hot days — they're always cool. " +
          "Others have been adding hot days at an alarming rate. " +
          "Your challenge: which park is adding summer hot days the fastest?",
      },
      {
        kind: "predict",
        heading: "Which park do you think is adding hot days fastest?",
        body: "Think about geography: which park type would you expect to be most affected?",
        choices: [
          {
            label: "A desert park (Death Valley, Joshua Tree, Saguaro)",
            correct: false,
            explanation:
              "Desert parks are already so hot that many summer days already exceed 90°F — " +
              "so the rate of *new* hot days can't climb as steeply. " +
              "The fastest-warming parks by hot-days trend are often mid-latitude parks " +
              "that weren't hot before but are crossing the threshold now.",
          },
          {
            label: "A mid-latitude park (Zion, Grand Canyon, Great Smoky Mountains)",
            correct: true,
            explanation:
              "Good instinct. Parks that were borderline — cool enough that 90°F days were rare — " +
              "are now crossing that line more often. Zion shows +11.8 hot days per decade, " +
              "one of the strongest confirmed trends in the dataset.",
          },
          {
            label: "An Alaskan or high-elevation park",
            correct: false,
            explanation:
              "Alaska is warming fast, but its summers rarely reach 90°F. " +
              "The hot-days metric captures what's happening in the lower 48 " +
              "where threshold crossings are occurring.",
          },
        ],
      },
      {
        kind: "examine",
        heading: "Zion: summer hot days, 1981–2026",
        body:
          "Zion National Park in Utah. Annual days above 90°F, every year from 1981. " +
          "The trend line tells the story: parks that were borderline hot " +
          "are now crossing the threshold much more often.",
        parkId: "zion",
        variable: "hot90_days",
        period: "annual",
      },
      {
        kind: "analyze",
        heading: "The numbers behind the trend",
        body:
          "Zion is gaining about 11.8 hot days per decade. " +
          "That is a confirmed real trend (q < 0.001 — well clear of the significance bar). " +
          "Over 45 years, that is roughly 50 additional hot days per year compared to 1981. " +
          "For hikers, this compresses the safe-to-hike window.",
        parkId: "zion",
        variable: "hot90_days",
        period: "annual",
      },
      {
        kind: "interpret",
        heading: "What this means for planning a visit",
        body:
          "The best months to visit Zion are shifting. Spring (April–May) and autumn (October) " +
          "are replacing July–August as the safest hiking windows. " +
          "The park itself now posts heat warnings for summer visitors. " +
          "The data backs that up: July and August hot days are rising the fastest.",
        parkId: "zion",
        variable: "hot90_days",
        period: "JJA",
        plannerLink: { month: 10, label: "Plan an October visit to Zion" },
      },
    ],
  },
];
