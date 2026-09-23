import Sessions from "./sessions.js";

// Search text is precomputed per session in the searchText store (see
// sessions.js), so opening the popup no longer decodes every full record.
export const getsearchInfo = async () => {
  return await Sessions.getSearchInfo().catch(() => []);
};
