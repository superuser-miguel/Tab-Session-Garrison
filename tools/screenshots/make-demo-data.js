// Generates demo-sessions.json: fictional, neutral sessions in the exact record
// shape TS-G stores (see src/background/save.js loadCurrentSession).
// Run: node make-demo-data.js
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// --- favicons: tiny letter tiles as SVG data URLs (no real logos) -----------
const SITES = {
  "developer.mozilla.org": ["M", "#1f6feb"],
  "doc.rust-lang.org": ["R", "#ce422b"],
  "github.com": ["G", "#6e7681"],
  "en.wikipedia.org": ["W", "#555"],
  "www.japan-guide.com": ["J", "#c0392b"],
  "www.seriouseats.com": ["S", "#d35400"],
  "news.ycombinator.com": ["Y", "#ff6600"],
  "stackoverflow.com": ["S", "#f48024"],
  "www.python.org": ["P", "#3776ab"],
  "docs.python.org": ["P", "#3776ab"],
  "arxiv.org": ["a", "#b31b1b"],
  "www.youtube.com": ["▶", "#e62117"],
  "blog.rust-lang.org": ["R", "#ce422b"],
  "www.mozilla.org": ["F", "#e66000"],
  "react.dev": ["⚛", "#149eca"],
  "www.openstreetmap.org": ["O", "#7ebc6f"],
  "www.rome2rio.com": ["r", "#2e86de"],
  "www.bbcgoodfood.com": ["B", "#2d6a4f"],
  "kubernetes.io": ["K", "#326ce5"],
  "go.dev": ["G", "#00add8"],
  "www.gutenberg.org": ["G", "#8b5a2b"],
  "scholar.archive.org": ["A", "#666"],
  "www.notion.so": ["N", "#333"],
  "calendar.example.com": ["C", "#4285f4"],
  "docs.example.com": ["D", "#1a73e8"],
  "www.kayak.com": ["K", "#ff690f"],
  "www.booking.com": ["B", "#003580"],
  "en.wikivoyage.org": ["W", "#3a7d44"],
  "www.figma.com": ["F", "#a259ff"],
  "tailwindcss.com": ["T", "#38bdf8"],
  "nodejs.org": ["N", "#3c873a"],
  "www.reddit.com": ["r", "#ff4500"],
  "www.allrecipes.com": ["A", "#e04f1e"],
  "addons.mozilla.org": ["A", "#0060df"]
};
const favicon = url => {
  const host = new URL(url).hostname;
  const [ch, bg] = SITES[host] || [host[0].toUpperCase(), "#5c6370"];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" rx="3" fill="${bg}"/><text x="8" y="12" font-family="sans-serif" font-size="11" font-weight="bold" fill="#fff" text-anchor="middle">${ch}</text></svg>`;
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
};

// --- helpers ------------------------------------------------------------------
let seed = 7;
const uuid = () => {
  // deterministic v4-looking ids so reruns produce identical data
  const h = crypto.createHash("md5").update(String(seed++)).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const at = (s) => new Date(s).getTime(); // local time
let nextTabId = 100;
let nextWinId = 10;
let nextGroupId = 1000;

// windowsSpec: [{ tabs: [[title, url, groupKey?], ...], groups: {key:[title,color,collapsed?]} }]
function session({ name, date, tag = ["manual"], windows: windowsSpec }) {
  const date_ = at(date);
  const s = {
    windows: {},
    windowsNumber: 0,
    windowsInfo: {},
    tabsNumber: 0,
    name,
    date: date_,
    lastEditedTime: date_,
    tag,
    sessionStartTime: date_ - 3 * 3600e3,
    id: uuid()
  };
  const tabGroups = [];
  windowsSpec.forEach((w, wi) => {
    const windowId = nextWinId++;
    const groupIds = {};
    for (const [key, [title, color, collapsed]] of Object.entries(w.groups || {})) {
      const id = nextGroupId++;
      groupIds[key] = id;
      tabGroups.push({ id, title, color, collapsed: !!collapsed, windowId });
    }
    s.windows[windowId] = {};
    w.tabs.forEach(([title, url, gkey], index) => {
      const id = nextTabId++;
      s.windows[windowId][id] = {
        id,
        index,
        windowId,
        highlighted: index === (w.active || 0),
        active: index === (w.active || 0),
        attention: false,
        pinned: !!w.pinned && index < w.pinned,
        status: "complete",
        hidden: false,
        discarded: false,
        incognito: false,
        width: 1600,
        height: 900,
        lastAccessed: date_ - (w.tabs.length - index) * 60e3,
        audible: false,
        autoDiscardable: true,
        mutedInfo: { muted: false },
        isArticle: false,
        isInReaderMode: false,
        sharingState: { camera: false, microphone: false },
        successorTabId: -1,
        cookieStoreId: "firefox-default",
        url,
        title,
        favIconUrl: favicon(url),
        groupId: gkey ? groupIds[gkey] : -1
      };
      s.tabsNumber++;
    });
    s.windowsInfo[windowId] = {
      id: windowId,
      focused: wi === 0,
      top: 0,
      left: wi * 40,
      width: 1600,
      height: 900,
      incognito: false,
      type: "normal",
      state: "maximized",
      alwaysOnTop: false,
      title: w.tabs[w.active || 0][0]
    };
  });
  s.windowsNumber = Object.keys(s.windows).length;
  if (tabGroups.length) s.tabGroups = tabGroups;
  return s;
}

// --- reusable tab sets -----------------------------------------------------------
const MDN = p => `https://developer.mozilla.org/en-US/docs/${p}`;
const rustBook = [
  ["The Rust Programming Language", "https://doc.rust-lang.org/book/", "book"],
  ["Understanding Ownership — The Rust Book", "https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html", "book"],
  ["References and Borrowing — The Rust Book", "https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html", "book"],
  ["Validating References with Lifetimes — The Rust Book", "https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html", "book"],
  ["rust-lang/rustlings: Small exercises to get you used to reading and writing Rust code", "https://github.com/rust-lang/rustlings", "ex"],
  ["Rust by Example — Borrowing", "https://doc.rust-lang.org/rust-by-example/scope/borrow.html", "ex"],
  ["std::collections::HashMap — Rust", "https://doc.rust-lang.org/std/collections/struct.HashMap.html", "ref"],
  ["std::rc::Rc — Rust", "https://doc.rust-lang.org/std/rc/struct.Rc.html", "ref"],
  ["What are lifetimes in Rust? — Stack Overflow", "https://stackoverflow.com/questions/tagged/rust", null]
];

const japanTrip = {
  groups: {
    fl: ["Flights", "blue"],
    st: ["Stay", "purple"],
    food: ["Food", "orange"],
    plan: ["Itinerary", "green"]
  },
  tabs: [
    ["Tokyo to Kyoto by Shinkansen — Rome2Rio", "https://www.rome2rio.com/s/Tokyo/Kyoto", "fl"],
    ["Cheap flights to Tokyo (HND) — KAYAK", "https://www.kayak.com/flight-routes/HND", "fl"],
    ["Ryokan stays in Gion, Kyoto — Booking.com", "https://www.booking.com/region/jp/gion.html", "st"],
    ["Hotels near Kyoto Station — Booking.com", "https://www.booking.com/district/jp/kyoto/kyotostation.html", "st"],
    ["Nishiki Market — Kyoto Travel Guide", "https://www.japan-guide.com/e/e3931.html", "food"],
    ["How to Make Okonomiyaki at Home — Serious Eats", "https://www.seriouseats.com/okonomiyaki-japanese-pancake-recipe", "food"],
    ["Kyoto Itinerary: 3 Days — japan-guide.com", "https://www.japan-guide.com/e/e3970.html", "plan"],
    ["Fushimi Inari Shrine — japan-guide.com", "https://www.japan-guide.com/e/e3915.html", "plan"],
    ["Arashiyama Bamboo Grove — Wikivoyage", "https://en.wikivoyage.org/wiki/Arashiyama", "plan"],
    ["Japan Rail Pass — Wikipedia", "https://en.wikipedia.org/wiki/Japan_Rail_Pass", null],
    ["Kyoto — OpenStreetMap", "https://www.openstreetmap.org/#map=13/35.0116/135.7681", null]
  ]
};

const sessions = [
  // HERO for list-and-details: manual, groups, 2 windows
  session({
    name: "Kyoto trip planning",
    date: "2026-10-14T21:12:00",
    tag: ["manual", "travel"],
    windows: [
      japanTrip,
      {
        groups: { lang: ["Language", "pink"] },
        tabs: [
          ["Japanese phrasebook — Wikivoyage", "https://en.wikivoyage.org/wiki/Japanese_phrasebook", "lang"],
          ["Hiragana — Wikipedia", "https://en.wikipedia.org/wiki/Hiragana", "lang"],
          ["Weather in Kyoto in April — Wikipedia", "https://en.wikipedia.org/wiki/Kyoto#Climate"]
        ]
      }
    ]
  }),
  session({
    name: "Rust Book — Ownership",
    date: "2026-10-13T19:40:00",
    tag: ["manual", "learning"],
    windows: [
      {
        groups: { book: ["Book", "orange"], ex: ["Exercises", "green"], ref: ["std docs", "blue", true] },
        tabs: rustBook,
        active: 1
      }
    ]
  }),
  session({
    name: "Hacker News",
    date: "2026-10-10T08:30:00",
    tag: ["regular"],
    windows: [
      {
        tabs: [
          ["Hacker News", "https://news.ycombinator.com/"],
          ["Show HN: A tiny SQLite-backed queue — Hacker News", "https://news.ycombinator.com/item?id=1"],
          ["sqlite/sqlite: Official Git mirror of the SQLite source tree", "https://github.com/sqlite/sqlite"],
          ["Write-Ahead Logging — Wikipedia", "https://en.wikipedia.org/wiki/Write-ahead_logging"]
        ]
      }
    ]
  }),
  session({
    name: "Weeknight dinners",
    date: "2026-10-12T17:05:00",
    tag: ["manual", "recipes"],
    windows: [
      {
        groups: { veg: ["Veggie", "green"], quick: ["Under 30 min", "yellow"] },
        tabs: [
          ["Easy Vegetable Curry — BBC Good Food", "https://www.bbcgoodfood.com/recipes/easy-vegetable-curry", "veg"],
          ["Mushroom Risotto — Serious Eats", "https://www.seriouseats.com/mushroom-risotto", "veg"],
          ["15-Minute Garlic Noodles — Allrecipes", "https://www.allrecipes.com/recipe/garlic-noodles/", "quick"],
          ["Sheet-Pan Gnocchi — BBC Good Food", "https://www.bbcgoodfood.com/recipes/sheet-pan-gnocchi", "quick"],
          ["How to Cook Rice on the Stovetop — Serious Eats", "https://www.seriouseats.com/how-to-cook-rice", null]
        ]
      }
    ]
  }),
  session({
    name: "Release prep — v2.4",
    date: "2026-10-11T15:22:00",
    tag: ["manual", "work"],
    windows: [
      {
        groups: { rel: ["Release", "red"], ci: ["CI", "cyan"] },
        tabs: [
          ["Draft: v2.4.0 release notes — docs", "https://docs.example.com/d/v240-release-notes", "rel"],
          ["Firefox 157 Release Notes — Mozilla", "https://www.mozilla.org/en-US/firefox/157.0/releasenotes/", "rel"],
          ["Semantic Versioning 2.0.0", "https://semver.org/", "rel"],
          ["Actions · example-org/app — GitHub", "https://github.com/example-org/app/actions", "ci"],
          ["Pull requests · example-org/app — GitHub", "https://github.com/example-org/app/pulls", "ci"],
          ["Keep a Changelog", "https://keepachangelog.com/en/1.1.0/", null]
        ]
      }
    ]
  }),
  // Contains "release" and "notes" but only in DIFFERENT tabs (phrase excluded)
  session({
    name: "Team planning",
    date: "2026-10-09T10:15:00",
    tag: ["manual", "work"],
    windows: [
      {
        tabs: [
          ["Q4 release calendar — Calendar", "https://calendar.example.com/q4"],
          ["Meeting notes template — Notion", "https://www.notion.so/templates/meeting-notes"],
          ["Roadmap board — Figma", "https://www.figma.com/board/roadmap"]
        ]
      }
    ]
  }),
  session({
    name: "React docs — Hooks",
    date: "2026-10-14T18:48:00",
    tag: ["winClose"],
    windows: [
      {
        tabs: [
          ["Built-in React Hooks — React", "https://react.dev/reference/react/hooks"],
          ["useEffect — React", "https://react.dev/reference/react/useEffect"],
          ["You Might Not Need an Effect — React", "https://react.dev/learn/you-might-not-need-an-effect"],
          ["Installation — Tailwind CSS", "https://tailwindcss.com/docs/installation"]
        ]
      }
    ]
  }),
  session({
    name: "Rust 1.90 release notes — Rust Blog",
    date: "2026-10-08T23:59:00",
    tag: ["browserExit"],
    windows: [
      {
        tabs: [
          ["Announcing Rust 1.90.0 — Rust Blog", "https://blog.rust-lang.org/2026/09/18/Rust-1.90.0/"],
          ["rust-lang/rust: Empowering everyone to build reliable and efficient software.", "https://github.com/rust-lang/rust"],
          ["RELEASES.md · rust-lang/rust — GitHub", "https://github.com/rust-lang/rust/blob/master/RELEASES.md"]
        ]
      },
      {
        tabs: [
          ["The Cargo Book", "https://doc.rust-lang.org/cargo/"],
          ["Clippy Lints", "https://rust-lang.github.io/rust-clippy/master/"]
        ]
      }
    ]
  }),
  session({
    name: "Reading list — distributed systems",
    date: "2026-10-06T20:30:00",
    tag: ["manual", "reading"],
    windows: [
      {
        groups: { papers: ["Papers", "purple"], talks: ["Talks", "pink"] },
        tabs: [
          ["In Search of an Understandable Consensus Algorithm (Raft) — arXiv", "https://arxiv.org/abs/raft", "papers"],
          ["Time, Clocks, and the Ordering of Events — Wikipedia", "https://en.wikipedia.org/wiki/Lamport_timestamp", "papers"],
          ["CAP theorem — Wikipedia", "https://en.wikipedia.org/wiki/CAP_theorem", "papers"],
          ["Designing Data-Intensive Applications — talk", "https://www.youtube.com/watch?v=ddia", "talks"],
          ["Jepsen analyses — talk", "https://www.youtube.com/watch?v=jepsen", "talks"]
        ]
      }
    ]
  }),
  session({
    name: "MDN — Fetch API",
    date: "2026-10-15T12:10:00",
    tag: ["regular"],
    windows: [
      {
        tabs: [
          ["Using the Fetch API — MDN Web Docs", MDN("Web/API/Fetch_API/Using_Fetch")],
          ["Response — Web APIs | MDN", MDN("Web/API/Response")],
          ["AbortController — Web APIs | MDN", MDN("Web/API/AbortController")],
          ["Promise.allSettled() — JavaScript | MDN", MDN("Web/JavaScript/Reference/Global_Objects/Promise/allSettled")],
          ["fetch — Stack Overflow", "https://stackoverflow.com/questions/tagged/fetch-api"]
        ]
      }
    ]
  }),
  session({
    name: "Kubernetes — Pods",
    date: "2026-10-07T18:02:00",
    tag: ["winClose"],
    windows: [
      {
        groups: { k8s: ["k8s docs", "blue"] },
        tabs: [
          ["Pods | Kubernetes", "https://kubernetes.io/docs/concepts/workloads/pods/", "k8s"],
          ["Deployments | Kubernetes", "https://kubernetes.io/docs/concepts/workloads/controllers/deployment/", "k8s"],
          ["Configure Liveness, Readiness and Startup Probes | Kubernetes", "https://kubernetes.io/docs/tasks/configure-pod-container/", "k8s"],
          ["A Tour of Go", "https://go.dev/tour/", null]
        ]
      }
    ]
  }),
  session({
    name: "Python asyncio",
    date: "2026-10-04T14:44:00",
    tag: ["manual", "learning"],
    windows: [
      {
        tabs: [
          ["asyncio — Asynchronous I/O — Python 3.14 documentation", "https://docs.python.org/3/library/asyncio.html"],
          ["Coroutines and Tasks — Python 3.14 documentation", "https://docs.python.org/3/library/asyncio-task.html"],
          ["What's New In Python 3.14", "https://docs.python.org/3/whatsnew/3.14.html"],
          ["Welcome to Python.org", "https://www.python.org/"]
        ]
      }
    ]
  }),
  session({
    name: "Weekend hike — Lake District",
    date: "2026-10-02T09:20:00",
    tag: ["manual", "travel"],
    windows: [
      {
        tabs: [
          ["Lake District — Wikivoyage", "https://en.wikivoyage.org/wiki/Lake_District"],
          ["Helvellyn — Wikipedia", "https://en.wikipedia.org/wiki/Helvellyn"],
          ["Glenridding — OpenStreetMap", "https://www.openstreetmap.org/#map=14/54.5435/-2.9516"],
          ["Trains to Windermere — Rome2Rio", "https://www.rome2rio.com/s/London/Windermere"]
        ]
      }
    ]
  }),
  session({
    name: "Node.js streams",
    date: "2026-10-14T23:41:00",
    tag: ["browserExit"],
    windows: [
      {
        tabs: [
          ["Stream | Node.js v24 Documentation", "https://nodejs.org/api/stream.html"],
          ["Backpressuring in Streams | Node.js", "https://nodejs.org/en/learn/modules/backpressuring-in-streams"],
          ["Node.js 24.10.0 release notes — nodejs.org", "https://nodejs.org/en/blog/release/v24.10.0"],
          ["nodejs/node — GitHub", "https://github.com/nodejs/node"]
        ]
      }
    ]
  }),
  session({
    name: "Classic novels to read",
    date: "2026-09-28T21:15:00",
    tag: ["manual", "reading"],
    windows: [
      {
        tabs: [
          ["Middlemarch by George Eliot — Project Gutenberg", "https://www.gutenberg.org/ebooks/145"],
          ["Moby Dick; Or, The Whale — Project Gutenberg", "https://www.gutenberg.org/ebooks/2701"],
          ["The Count of Monte Cristo — Project Gutenberg", "https://www.gutenberg.org/ebooks/1184"]
        ]
      }
    ]
  }),
  session({
    name: "MDN — CSS Grid",
    date: "2026-09-27T16:33:00",
    tag: ["regular"],
    windows: [
      {
        groups: { grid: ["Grid", "cyan"], flex: ["Flexbox", "yellow"] },
        tabs: [
          ["CSS grid layout — MDN Web Docs", MDN("Web/CSS/CSS_grid_layout"), "grid"],
          ["grid-template-areas — CSS | MDN", MDN("Web/CSS/grid-template-areas"), "grid"],
          ["Basic concepts of flexbox — CSS | MDN", MDN("Web/CSS/CSS_flexible_box_layout/Basic_concepts"), "flex"],
          ["Container queries — CSS | MDN", MDN("Web/CSS/CSS_containment/Container_queries"), null]
        ]
      }
    ]
  }),
  session({
    name: "Sourdough experiments",
    date: "2026-09-25T11:02:00",
    tag: ["winClose"],
    windows: [
      {
        tabs: [
          ["The Science of Sourdough — Serious Eats", "https://www.seriouseats.com/sourdough-science"],
          ["Simple Sourdough Bread — BBC Good Food", "https://www.bbcgoodfood.com/recipes/sourdough-bread"],
          ["Baker percentage — Wikipedia", "https://en.wikipedia.org/wiki/Baker_percentage"]
        ]
      }
    ]
  }),
  session({
    name: "Firefox add-on dev",
    date: "2026-09-23T20:05:00",
    tag: ["manual", "work"],
    windows: [
      {
        groups: { api: ["WebExtension APIs", "orange"] },
        tabs: [
          ["tabGroups — Mozilla | MDN", MDN("Mozilla/Add-ons/WebExtensions/API/tabGroups"), "api"],
          ["sessions — Mozilla | MDN", MDN("Mozilla/Add-ons/WebExtensions/API/sessions"), "api"],
          ["storage.local — Mozilla | MDN", MDN("Mozilla/Add-ons/WebExtensions/API/storage/local"), "api"],
          ["mozilla/web-ext: A command line tool to help build, run, and test web extensions", "https://github.com/mozilla/web-ext", null],
          ["Developer Hub — Add-ons for Firefox", "https://addons.mozilla.org/en-US/developers/", null]
        ]
      },
      {
        tabs: [["Extension Workshop — Mozilla", "https://extensionworkshop.com/"]]
      }
    ]
  }),
  session({
    name: "r/rust",
    date: "2026-09-21T13:50:00",
    tag: ["regular"],
    windows: [
      {
        tabs: [
          ["r/rust", "https://www.reddit.com/r/rust/"],
          ["This Week in Rust", "https://this-week-in-rust.org/"]
        ]
      }
    ]
  }),
  session({
    name: "Kyoto — Wikivoyage",
    date: "2026-09-19T22:30:00",
    tag: ["browserExit"],
    windows: [
      {
        tabs: [
          ["Kyoto — Wikivoyage", "https://en.wikivoyage.org/wiki/Kyoto"],
          ["Kinkaku-ji — Wikipedia", "https://en.wikipedia.org/wiki/Kinkaku-ji"],
          ["Philosopher's Path — japan-guide.com", "https://www.japan-guide.com/e/e3906.html"]
        ]
      }
    ]
  })
];

const out = path.join(__dirname, "demo-sessions.json");
fs.writeFileSync(out, JSON.stringify(sessions, null, 1));
console.log(`wrote ${sessions.length} sessions -> ${out}`);
