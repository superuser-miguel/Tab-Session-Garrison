import React, { Component } from "react";
import ReactDOM from "react-dom";
import browser from "webextension-polyfill";
import SessionItem from "./SessionItem";
import { actionFor } from "../../common/keymap";
import "../styles/SessionsArea.scss";

const matchesFilter = (tags, filterValue) => {
  if (tags.includes("temp")) return false;
  switch (filterValue) {
    case "_displayAll":
      return true;
    case "_user":
      return (
        !tags.includes("regular") && !tags.includes("winClose") && !tags.includes("browserExit")
      );
    case "_auto":
      return tags.includes("regular") || tags.includes("winClose") || tags.includes("browserExit");
    default:
      return tags.includes(filterValue);
  }
};

const matchesSearch = (searchWords, sessionId, searchedIdSet) => {
  if (searchWords.join() === "") return true;
  return searchedIdSet.has(sessionId);
};

const newestSort = (a, b) => b.date - a.date;
const alphabeticallySort = (a, b) => {
  if (a.name.toLowerCase() > b.name.toLowerCase()) return 1;
  else if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;
};
const namelessSort = (a, b) => {
  //名前の無いセッションを最後に，同じ名前なら新しい順に
  if (a.name == "" && b.name != "") return 1;
  else if (a.name != "" && b.name == "") return -1;
  else if (a.name == b.name) return newestSort(a, b);
};
const tabsSort = (a, b) => b.tabsNumber - a.tabsNumber;

export const getSortedSessions = (
  sessions,
  sortValue,
  filterValue,
  searchWords,
  searchedSessionIds
) => {
  // Set for O(1) membership instead of Array.includes per session (the filter
  // below would otherwise be O(sessions * matches) on every keystroke).
  const searchedIdSet = new Set(searchedSessionIds);

  let sortedSessions = sessions.map(session => ({
    id: session.id,
    date: session.date,
    name: session.name,
    tag: session.tag,
    tabsNumber: session.tabsNumber
  }));
  sortedSessions = sortedSessions.filter(
    session =>
      matchesFilter(session.tag, filterValue) &&
      matchesSearch(searchWords, session.id, searchedIdSet)
  );

  switch (sortValue) {
    case "newest":
      sortedSessions.sort(newestSort);
      break;
    case "oldest":
      sortedSessions.sort(newestSort);
      sortedSessions.reverse();
      break;
    case "aToZ":
      sortedSessions.sort(alphabeticallySort);
      sortedSessions.sort(namelessSort);
      break;
    case "zToA":
      sortedSessions.sort(alphabeticallySort);
      sortedSessions.reverse();
      sortedSessions.sort(namelessSort);
      break;
    case "tabsAsc":
      sortedSessions.sort(tabsSort).reverse();
      break;
    case "tabsDes":
      sortedSessions.sort(tabsSort);
      break;
  }

  return sortedSessions;
};

// Progressive first render: rows are mounted top-of-list first (in display
// order), then the rest a chunk per task, so a large profile paints at once
// and the page never blocks on mounting thousands of rows in one go.
const INITIAL_RENDER_COUNT = 60;
const RENDER_CHUNK = 250;

export default class SessionsArea extends Component {
  selectedItemRef = React.createRef();
  state = { renderLimit: INITIAL_RENDER_COUNT };

  componentWillUnmount() {
    clearTimeout(this.growTimer);
  }

  // Called after each render: schedule the next chunk until every row that
  // matches the current filter/search is mounted. Once all sessions are
  // mounted the limit is lifted for good.
  scheduleRenderGrowth(visibleCount) {
    const { renderLimit } = this.state;
    if (renderLimit === Infinity || this.growTimer) return;
    const { sessions, isInitSessions } = this.props;
    if (isInitSessions && renderLimit >= sessions.length) {
      this.setState({ renderLimit: Infinity });
      return;
    }
    if (renderLimit >= visibleCount) return;
    this.growTimer = setTimeout(() => {
      this.growTimer = null;
      this.setState(state => ({ renderLimit: state.renderLimit + RENDER_CHUNK }));
    }, 0);
  }

  scrollTo = top => {
    const sessionsArea = this.props.sessionsAreaRef.current;
    sessionsArea.scrollTo(0, top);
  };

  handleSessionSelect = (id, e) => {
    const modifiers = e ? { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey } : {};
    this.props.selectSession(id, modifiers);
  };

  // Keys are defined in common/keymap.js (area "list").
  handleKeyDown = e => {
    const {
      selectSession,
      toggleSelectSession,
      selectAllSessions,
      clearSelection,
      requestRemoveSelected,
      requestOpenSelected,
      openSelectedAs,
      requestRename,
      requestAddTag,
      focusTabs,
      openHelp,
      openSessionMenu,
      optionsAreaRef,
      saveAreaRef,
      selectedSessionId
    } = this.props;

    // Tab moves between the popup's areas (not listed in the keymap's handlers).
    if (e.key === "Tab" && !e.ctrlKey && !e.altKey && !e.metaKey) {
      (e.shiftKey ? optionsAreaRef : saveAreaRef).focus();
      e.preventDefault();
      return;
    }

    const action = actionFor(e, "list") || actionFor(e, "anywhere");
    switch (action) {
      case "move":
      case "extend": {
        const target = this.sessionAfterMove(e.key);
        if (target) selectSession(target.id, { shift: action === "extend" });
        break;
      }
      case "toggle":
        toggleSelectSession(selectedSessionId);
        break;
      case "selectAll":
        selectAllSessions();
        break;
      case "clear":
        clearSelection();
        break;
      case "open":
        requestOpenSelected();
        break;
      case "openReplace":
        openSelectedAs("openInCurrentWindow");
        break;
      case "openAdd":
        openSelectedAs("addToCurrentWindow");
        break;
      case "delete":
        requestRemoveSelected();
        break;
      case "rename":
        requestRename();
        break;
      case "addTag":
        requestAddTag();
        break;
      case "menu":
        openSessionMenu();
        break;
      case "toTabs":
        focusTabs();
        break;
      case "search":
        this.props.toggleSearchBar(true);
        break;
      case "help":
        openHelp();
        break;
      default: {
        // Undo/redo are handled for the whole popup in PopupPage.
        if (action) return;
        // Any other printable character starts a search with that character
        // (Shift included, so capitals and the " that starts a phrase work).
        const isPrintable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
        if (isPrintable) this.props.toggleSearchBar(true);
        return;
      }
    }
    e.preventDefault();
  };

  // The session a move key lands on, in the list's visible order.
  sessionAfterMove = key => {
    const sessions = this.sortedSessions || [];
    if (sessions.length === 0) return null;
    const current = sessions.findIndex(session => session.id === this.props.selectedSessionId);
    const last = sessions.length - 1;
    const page = this.rowsPerPage();
    const next = {
      ArrowUp: current - 1,
      ArrowDown: current + 1,
      Home: 0,
      End: last,
      PageUp: current - page,
      PageDown: current + page
    }[key];
    if (next === undefined) return null;
    return sessions[Math.min(last, Math.max(0, current === -1 ? 0 : next))];
  };

  // How many rows fit in the list, for PageUp/PageDown.
  rowsPerPage = () => {
    const area = this.props.sessionsAreaRef.current;
    const row = area?.querySelector(".sessionItem");
    if (!area || !row || !row.offsetHeight) return 10;
    return Math.max(1, Math.floor(area.clientHeight / row.offsetHeight) - 1);
  };

  componentDidMount() {
    this.scheduleRenderGrowth(this.visibleCount);
  }

  componentDidUpdate() {
    this.scheduleRenderGrowth(this.visibleCount);
    const { filterValue, sortValue, searchWords, isInitSessions } = this.props;
    const { prevFilterValue, prevSortValue, prevSearchWords } = this;

    if (
      filterValue !== prevFilterValue ||
      sortValue !== prevSortValue ||
      searchWords.join() !== prevSearchWords.join()
    )
      this.scrollTo(0);
    this.prevFilterValue = filterValue;
    this.prevSortValue = sortValue;
    this.prevSearchWords = searchWords;

    if (!isInitSessions) {
      const selectedItemTop = ReactDOM.findDOMNode(this.selectedItemRef?.current)?.offsetTop;
      this.scrollTo(selectedItemTop);
    }
  }

  render() {
    const {
      sessions,
      selectedSessionId,
      selectedSessionIds,
      filterValue,
      sortValue,
      searchWords,
      searchedSessionIds,
      isInitSessions,
      isRebuildingIndex,
      removeSession,
      error,
      sessionsAreaRef,
      openMenu,
      trackingSessions,
      rowSettings
    } = this.props;
    const sortedSessions = getSortedSessions(
      sessions,
      sortValue,
      filterValue,
      searchWords,
      searchedSessionIds
    );

    // Precompute id -> display order once, so each row is an O(1) lookup instead
    // of an O(n) findIndex (which made the whole render O(n^2) on large profiles).
    const orderById = new Map(
      sortedSessions.map((sortedSession, index) => [sortedSession.id, index])
    );

    const order = orderById.get(selectedSessionId) ?? -1;
    // Always mount at least down to the selected row, so the initial
    // scroll-to-selected lands where the fully rendered list will have it.
    const renderLimit = Math.max(this.state.renderLimit, order + 1 + INITIAL_RENDER_COUNT);
    this.visibleCount = sortedSessions.length;
    this.sortedSessions = sortedSessions;

    // Sets for O(1) per-row membership. Array.includes here made the row map
    // O(n^2) during an active search or a large multi-selection (e.g. Ctrl+A).
    const searchedIdSet = new Set(searchedSessionIds);
    const selectedIdSet = new Set(selectedSessionIds);

    const shouldShowNoSessionMessage =
      isInitSessions &&
      sortedSessions.length === 0 &&
      filterValue == "_displayAll" &&
      searchWords.join() === "" &&
      !error.isError;
    const shouldShowNoResultMessage =
      isInitSessions && sortedSessions.length === 0 && searchWords.join() !== "" && !error.isError;

    return (
      <div
        id="sessionsArea"
        className="scrollbar"
        ref={sessionsAreaRef}
        role="toolbar"
        tabIndex="0"
        onKeyDown={this.handleKeyDown}
      >
        {sessions.map(
          session =>
            matchesFilter(session.tag, filterValue) &&
            matchesSearch(searchWords, session.id, searchedIdSet) &&
            orderById.get(session.id) < renderLimit && (
              <SessionItem
                session={session}
                isSelected={selectedSessionId === session.id}
                isMultiSelected={selectedIdSet.has(session.id)}
                isTracking={trackingSessions.includes(session.id)}
                ref={selectedSessionId === session.id ? this.selectedItemRef : null}
                order={orderById.get(session.id)}
                searchWords={searchWords}
                removeSession={removeSession}
                handleSessionSelect={this.handleSessionSelect}
                openMenu={openMenu}
                truncateTitle={rowSettings.truncateTitle}
                isShowOpenButtons={rowSettings.isShowOpenButtons}
                dateFormat={rowSettings.dateFormat}
                key={session.id}
              />
            )
        )}
        {!isInitSessions && isRebuildingIndex && (
          <div className="noSession">
            <p>{browser.i18n.getMessage("optimizingSessionsLabel")}</p>
            <p>{browser.i18n.getMessage("optimizingSessionsCaptionLabel")}</p>
          </div>
        )}
        {shouldShowNoSessionMessage && (
          <div className="noSession">
            <p>{browser.i18n.getMessage("noSessionLabel")}</p>
            <p>{browser.i18n.getMessage("letsSaveLabel")}</p>
          </div>
        )}
        {shouldShowNoResultMessage && (
          <div className="noSession">
            <p>{browser.i18n.getMessage("noResultLabel")}</p>
          </div>
        )}
      </div>
    );
  }
}
