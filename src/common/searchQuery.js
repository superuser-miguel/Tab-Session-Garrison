// Turns what the user typed into search terms (lowercased).
//   stop light      → ["stop", "light"]   each word may match anywhere
//   "stop light"    → ["stop light"]      the exact phrase, inside one field
//   "stop li        → ["stop li"]         an unfinished quote is a phrase in progress
// Straight and curly double quotes both count.
const QUOTES = new Set(['"', "“", "”", "„"]);

export const parseSearchQuery = query => {
  const terms = [];
  let current = "";
  let inPhrase = false;

  const push = () => {
    const term = inPhrase ? current.replace(/\s+/g, " ").trim() : current;
    if (term !== "") terms.push(term.toLowerCase());
    current = "";
  };

  for (const char of query) {
    if (QUOTES.has(char)) {
      push();
      inPhrase = !inPhrase;
    } else if (!inPhrase && /\s/.test(char)) {
      push();
    } else {
      current += char;
    }
  }
  push();
  return terms;
};

// Tab titles and group names are stored one per line (see makeSearchInfo), so
// a phrase can never match across two different tabs.
export const matchesSearchTerms = (terms, name, info) => {
  const lowerName = (name || "").toLowerCase();
  const tabsTitle = info?.tabsTitle || "";
  const groupsTitle = info?.groupsTitle || "";
  return terms.every(
    term => lowerName.includes(term) || tabsTitle.includes(term) || groupsTitle.includes(term)
  );
};
