import React, { Component } from "react";
import browser from "webextension-polyfill";
import log from "loglevel";
import url from "url";
import {
  initSettings,
  getSettings,
  setSettings,
  handleSettingsChange
} from "src/settings/settings";
import { updateLogLevel, overWriteLogLevel } from "src/common/log";
import {
  getSessions,
  sendOpenMessage,
  sendSessionSaveMessage,
  sendSessionRemoveMessage,
  sendSessionsRemoveMessage,
  sendSessionUpdateMessage,
  sendUndoMessage,
  sendUndoManyMessage,
  sendEndTrackingByWindowDeleteMessage
} from "../actions/controlSessions";
import { applyTheme, watchTheme } from "../actions/applyTheme";
import { deleteWindow, deleteTab } from "../../common/editSessions.js";
import openUrl from "../actions/openUrl";
import Header from "./Header";
import OptionsArea from "./OptionsArea";
import SessionsArea, { getSortedSessions } from "./SessionsArea";
import SessionDetailsArea from "./SessionDetailsArea";
import SelectionSummary from "./SelectionSummary";
import ConfirmModalContent from "./ConfirmModalContent";
import Notification from "./Notification";
import SaveArea from "./SaveArea";
import Menu from "./Menu";
import Modal from "./Modal";
import Error from "./Error";
import "../styles/PopupPage.scss";
import { makeSearchInfo } from "../../common/makeSearchInfo";

const logDir = "popup/components/PopupPage";

export default class PopupPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      sessions: [],
      searchInfo: [],
      isInitSessions: false,
      selectedSession: {},
      selectedSessionIds: [],
      selectionAnchorId: "",
      filterValue: "_displayAll",
      sortValue: "newest",
      isShowSearchBar: false,
      searchWords: [],
      searchedSessionIds: [],
      isInTab: false,
      sidebarWidth: 390,
      notification: {
        message: "",
        type: "info",
        buttonLabel: "",
        onClick: () => {}
      },
      syncStatus: {
        status: "complete",
        progress: 0,
        total: 0
      },
      needsSync: false,
      undoStatus: {
        undoCount: 0,
        redoCount: 0
      },
      tagList: [],
      trackingSessions: [],
      menu: {
        isOpen: false,
        x: 0,
        y: 0,
        items: <div />
      },
      modal: {
        isOpen: false,
        title: "Title",
        content: <div />
      },
      error: {
        isError: false,
        type: ""
      }
    };

    this.optionsAreaElement = React.createRef();
    this.searchBarElement = React.createRef();
    this.sessionsAreaElement = React.createRef();
    this.saveAreaElement = React.createRef();

    this.init();
  }

  init = async () => {
    await initSettings();
    overWriteLogLevel();
    updateLogLevel();
    log.info(logDir, "init()");

    const isInTab = url.parse(location.href).hash == "#inTab";
    if (!isInTab) {
      document.body.style.width = `${getSettings("popupWidthV2")}px`;
      document.body.style.height = `${getSettings("popupHeight")}px`;
      if (getSettings("isSessionListOpenInTab")) {
        const popupUrl = "../popup/index.html#inTab";
        openUrl(popupUrl);
        window.close();
      }
    } else {
      document.documentElement.style.height = "100%";
      document.body.style.height = "100%";
    }

    await applyTheme();
    watchTheme();

    this.setState({
      sortValue: getSettings("sortValue") || "newest",
      isInTab: isInTab,
      sidebarWidth: getSettings("sidebarWidth")
    });

    const isInit = await browser.runtime.sendMessage({ message: "getInitState" });
    if (!isInit) this.setState({ error: { isError: true, type: "indexedDB" } });

    this.firstFilterValue = getSettings("filterValue");
    this.firstSelectedSessionId = getSettings("selectedSessionId");

    const keys = ["id", "name", "date", "tag", "tabsNumber", "windowsNumber", "lastEditedTime", "tabGroups"];
    this.port = Math.random();
    browser.runtime.onMessage.addListener(this.handleMessage);
    browser.runtime.sendMessage({
      message: "requestAllSessions",
      needKeys: keys,
      count: 30,
      port: this.port
    });

    if (this.firstSelectedSessionId) {
      const selectedSession = await getSessions(this.firstSelectedSessionId, keys);
      if (selectedSession) {
        this.setState({ sessions: this.state.sessions.concat([selectedSession]) });
        this.selectSession(this.firstSelectedSessionId);
      }
    }

    browser.storage.local.onChanged.addListener(handleSettingsChange);
    window.addEventListener("unload", this.handleUnload, { once: true });
    browser.runtime.sendMessage({ message: "updateUndoStatus" });
    browser.runtime.sendMessage({ message: "updateTrackingStatus" });

    if (getSettings("isShowUpdated")) {
      this.openNotification({
        message: browser.i18n.getMessage("NotificationOnUpdateLabel"),
        type: "info",
        duration: 20000,
        buttonLabel: browser.i18n.getMessage("seeMoreLabel"),
        onClick: () => openUrl("../options/index.html#information?action=updated")
      });
      setSettings("isShowUpdated", false);
    }
  };

  calcNeedsSync = sessions => {
    const shouldShowCloudSync = getSettings("signedInEmail");
    const lastSyncTime = getSettings("lastSyncTime");
    const removedQueue = getSettings("removedQueue");
    const includesAutoSaveToSync = getSettings("includesAutoSaveToSync");
    if (!shouldShowCloudSync) return false;

    const shouldDelete = removedQueue.length > 0;
    const shouldUpload = sessions
      .filter(session => !session.tag.includes("temp"))
      .filter(
        session =>
          includesAutoSaveToSync ||
          (!session.tag.includes("regular") &&
            !session.tag.includes("winClose") &&
            !session.tag.includes("browserExit"))
      )
      .some(session => session.lastEditedTime > lastSyncTime);
    return shouldDelete || shouldUpload;
  };

  updateTagList = sessions => {
    const reservedTags = ["regular", "winClose", "browserExit", "temp", "_startup", "_tracking"];
    const allTags = sessions
      .map(session => session.tag)
      .flat()
      .concat(this.state.tagList);
    const uniqueTags = Array.from(new Set(allTags))
      .filter(tag => !reservedTags.includes(tag))
      .sort((a, b) => a.localeCompare(b));

    this.setState({ tagList: uniqueTags });
  };

  handleMessage = request => {
    switch (request.message) {
      case "saveSession":
      case "updateSession":
      case "deleteSession":
      case "deleteAll":
        return this.changeSessions(request);
      case "updateSyncStatus":
        return this.handleUpdateSyncStatus(request);
      case "responseAllSessions":
        return this.handleResponseAllSessions(request);
      case "updateUndoStatus":
        return this.handleUpdateUndoStatus(request);
      case "updateTrackingStatus":
        return this.handleUpdateTrackingStatus(request);
    }
  };

  handleResponseAllSessions = async request => {
    if (request.port != this.port) return;
    const sessions = request.sessions.filter(session => session.id !== this.firstSelectedSessionId);
    this.setState({
      sessions: this.state.sessions.concat(sessions),
      filterValue: this.firstFilterValue || "_displayAll"
    });

    if (request.isEnd) {
      this.changeFilterValue(this.firstFilterValue);
      const needsSync = this.calcNeedsSync(this.state.sessions);
      const syncStatus = await browser.runtime.sendMessage({ message: "getSyncStatus" });
      this.updateTagList(this.state.sessions);
      this.setState({
        isInitSessions: true,
        needsSync: needsSync,
        syncStatus: syncStatus
      });

      const searchInfo = await browser.runtime.sendMessage({ message: "getsearchInfo" });
      this.setState({ searchInfo: searchInfo });
    }
  };

  changeSessions = async request => {
    log.info(logDir, "changeSessions()", request);
    let sessions;
    let searchInfo;
    let selectedSession = this.state.selectedSession;
    let needsSync = true;

    switch (request.message) {
      case "saveSession": {
        const newSession = request.session;
        sessions = this.state.sessions.concat(newSession);
        searchInfo = this.state.searchInfo.concat(makeSearchInfo(newSession));
        needsSync = !request.saveBySync;
        this.updateTagList([newSession]);
        break;
      }
      case "updateSession": {
        const newSession = request.session;
        const newSearchInfo = makeSearchInfo(newSession);
        if (newSession.id === selectedSession.id) selectedSession = newSession;

        sessions = this.state.sessions;
        searchInfo = this.state.searchInfo;
        const sessionIndex = sessions.findIndex(session => session.id === newSession.id);
        const infoIndex = searchInfo.findIndex(info => info.id === newSearchInfo.id);
        if (sessionIndex === -1) {
          sessions = this.state.sessions.concat(newSession);
          searchInfo = this.state.searchInfo.concat(newSearchInfo);
        } else {
          sessions.splice(sessionIndex, 1, newSession);
          searchInfo.splice(infoIndex, 1, newSearchInfo);
        }
        needsSync = !request.saveBySync;
        this.updateTagList([newSession]);
        break;
      }
      case "deleteSession": {
        const deletedSessionId = request.id;
        if (deletedSessionId === selectedSession.id) selectedSession = {};

        sessions = this.state.sessions;
        searchInfo = this.state.searchInfo;
        const sessionIndex = sessions.findIndex(session => session.id === deletedSessionId);
        const infoIndex = searchInfo.findIndex(info => info.id === deletedSessionId);
        if (sessionIndex === -1) return;
        sessions.splice(sessionIndex, 1);
        searchInfo.splice(infoIndex, 1);
        break;
      }
      case "deleteAll": {
        const keys = ["id", "name", "date", "tag", "tabsNumber", "windowsNumber", "tabGroups"];
        sessions = await getSessions(null, keys);
        searchInfo = [];
        selectedSession = {};
        break;
      }
    }
    this.setState({
      sessions: sessions,
      searchInfo: searchInfo,
      selectedSession: selectedSession,
      needsSync: needsSync
    });
  };

  handleUpdateSyncStatus = request => {
    if (request.syncStatus.status == "pending") this.setState({ needsSync: false });
    this.setState({ syncStatus: request.syncStatus });
  };

  handleUpdateUndoStatus = request => {
    if (!request.undoStatus) return;
    this.setState({ undoStatus: request.undoStatus });
  };

  handleUpdateTrackingStatus = request => {
    this.setState({ trackingSessions: request.trackingSessions || [] });
  };

  handleUnload = () => {
    browser.storage.local.onChanged.removeListener(handleSettingsChange);
  };

  changeFilterValue = value => {
    log.info(logDir, "changeFilterValue()", value);
    this.setState({ filterValue: value });
    setSettings("filterValue", value);
  };

  changeSortValue = value => {
    log.info(logDir, "changeSortValue()", value);
    this.setState({ sortValue: value });
    setSettings("sortValue", value);
  };

  toggleSearchBar = (isShow = !this.state.isShowSearchBar) => {
    this.setState({ isShowSearchBar: isShow });
    if (isShow) this.searchBarElement.current?.focus();
    else {
      this.changeSearchWord("");
      this.sessionsAreaElement.current?.focus();
    }
  };

  changeSearchWord = (searchWord, isEnter = false) => {
    log.info(logDir, "changeSearchValue()", searchWord);
    this.searchSessions(searchWord);
    if (isEnter) {
      const { sessions, sortValue, filterValue, searchWords, searchedSessionIds } = this.state;
      const sortedSessions = getSortedSessions(
        sessions,
        sortValue,
        filterValue,
        searchWords,
        searchedSessionIds
      );
      if (sortedSessions.length === 0) return;
      this.selectSession(sortedSessions[0].id);
      this.sessionsAreaElement.current.focus();
      if (searchWord === "") this.toggleSearchBar(false);
    }
  };

  searchSessions = searchWord => {
    log.info(logDir, "searchSessions()", searchWord);
    const searchWords = searchWord.trim().toLowerCase().split(" ");
    this.setState({ searchWords: searchWords });
    if (searchWords.length === 0) return;

    const matchedIdsBySessionName = this.state.sessions
      .filter(session => searchWords.every(word => session.name.toLowerCase().includes(word)))
      .map(session => session.id);

    const matchedIdsByTabTitle = this.state.searchInfo
      .filter(info => searchWords.every(word => info.tabsTitle.includes(word)))
      .map(info => info.id);

    const searchedSessionIds = Array.from(
      new Set(matchedIdsBySessionName.concat(matchedIdsByTabTitle))
    );
    this.setState({ searchedSessionIds: searchedSessionIds });
    log.info(logDir, "=>searchSessions()", searchedSessionIds);
  };

  // Ids of the currently visible sessions, in the same sorted/filtered order
  // the list renders them — used for Shift range-select and Ctrl+A.
  getOrderedSessionIds = () => {
    const { sessions, sortValue, filterValue, searchWords, searchedSessionIds } = this.state;
    return getSortedSessions(
      sessions,
      sortValue,
      filterValue,
      searchWords,
      searchedSessionIds
    ).map(s => s.id);
  };

  // modifiers: { ctrl, shift }. Plain select replaces the selection and moves
  // the anchor; Ctrl toggles a single row; Shift selects the range from the
  // fixed anchor to the cursor. The cursor (detail pane / focus) always moves.
  selectSession = async (id, modifiers = {}) => {
    const { ctrl, shift } = modifiers;
    log.info(logDir, "selectSession()", id, modifiers);

    const orderedIds = this.getOrderedSessionIds();
    let selectedSessionIds;
    let anchorId = this.state.selectionAnchorId || this.state.selectedSession.id || id;

    if (shift) {
      const a = orderedIds.indexOf(anchorId);
      const b = orderedIds.indexOf(id);
      if (a === -1 || b === -1) selectedSessionIds = [id];
      else {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        selectedSessionIds = orderedIds.slice(lo, hi + 1);
      }
    } else if (ctrl) {
      const set = new Set(this.state.selectedSessionIds);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      selectedSessionIds = orderedIds.filter(x => set.has(x));
      anchorId = id;
    } else {
      selectedSessionIds = [id];
      anchorId = id;
    }

    this.setState({ selectedSessionIds, selectionAnchorId: anchorId });

    // Move the cursor / detail-pane session to the clicked row.
    const cursor = this.state.sessions.find(session => session.id === id) || {};
    setSettings("selectedSessionId", id);
    this.setState({ selectedSession: cursor });

    // When more than one is selected the detail pane shows a summary, so skip
    // the heavier full-session fetch (matters when you've got a lot of sessions).
    if (selectedSessionIds.length > 1) return;

    const full = await getSessions(id);
    if (!full) return;
    if (full.id !== this.state.selectedSession.id) return;
    this.setState({ selectedSession: full });
  };

  toggleSelectSession = id => this.selectSession(id, { ctrl: true });

  selectAllSessions = () => {
    const orderedIds = this.getOrderedSessionIds();
    this.setState({ selectedSessionIds: orderedIds });
  };

  clearSelection = () => {
    const cursorId = this.state.selectedSession.id;
    this.setState({
      selectedSessionIds: cursorId ? [cursorId] : [],
      selectionAnchorId: cursorId || ""
    });
  };

  removeSelectedSessions = async () => {
    const ids = this.state.selectedSessionIds;
    if (!ids || ids.length === 0) return;
    if (ids.length === 1) return this.removeSession(ids[0]);

    log.info(logDir, "removeSelectedSessions()", ids);
    const count = ids.length;
    try {
      await sendSessionsRemoveMessage(ids);
      this.setState({ selectedSessionIds: [] });
      this.openNotification({
        message: browser.i18n
          .getMessage("removedSessionsLabel", [count.toString()])
          .replace(/^$/, `${count} sessions deleted`),
        type: "warn",
        buttonLabel: browser.i18n.getMessage("undoLabel"),
        onClick: () => sendUndoManyMessage(count)
      });
    } catch (e) {
      this.openNotification({
        message: browser.i18n.getMessage("failedDeleteSessionLabel"),
        type: "error"
      });
    }
  };

  // Routed from the Delete key. Confirms first when more than one is selected.
  requestRemoveSelected = () => {
    const ids = this.state.selectedSessionIds;
    if (!ids || ids.length === 0) return;
    if (ids.length === 1) {
      this.removeSession(ids[0]);
      return;
    }
    const message = browser.i18n
      .getMessage("confirmRemoveSessionsLabel", [ids.length.toString()])
      .replace(/^$/, `Delete ${ids.length} selected sessions?`);
    this.openModal(
      browser.i18n.getMessage("remove").replace(/^$/, "Delete"),
      <ConfirmModalContent
        message={message}
        confirmLabel={browser.i18n.getMessage("remove").replace(/^$/, "Delete")}
        onConfirm={this.removeSelectedSessions}
        closeModal={this.closeModal}
      />
    );
  };

  // Multi-open always opens each selected session in its own new window, in
  // list order — mirrors removeSelectedSessions().
  openSelectedSessions = async () => {
    const ids = this.state.selectedSessionIds;
    if (!ids || ids.length === 0) return;
    log.info(logDir, "openSelectedSessions()", ids);
    for (const id of ids) {
      await sendOpenMessage(id, "openInNewWindow");
    }
  };

  // Routed from the Enter key and the "Open all" button. Confirms first when
  // more than one is selected, since each opens a separate window.
  requestOpenSelected = () => {
    const ids = this.state.selectedSessionIds;
    if (!ids || ids.length === 0) return;
    if (ids.length === 1) {
      sendOpenMessage(ids[0], getSettings("openButtonBehavior"));
      return;
    }
    const message = browser.i18n
      .getMessage("confirmOpenSessionsLabel", [ids.length.toString()])
      .replace(/^$/, `Open ${ids.length} selected sessions? This opens ${ids.length} new windows.`);
    this.openModal(
      browser.i18n.getMessage("open").replace(/^$/, "Open"),
      <ConfirmModalContent
        message={message}
        confirmLabel={browser.i18n.getMessage("open").replace(/^$/, "Open")}
        onConfirm={this.openSelectedSessions}
        closeModal={this.closeModal}
      />
    );
  };

  saveSession = async (name, property) => {
    log.info(logDir, "saveSession()", name, property);
    try {
      const savedSession = await sendSessionSaveMessage(name, property);
      this.selectSession(savedSession.id);
      this.openNotification({
        message: browser.i18n.getMessage("sessionSavedLabel"),
        type: "success",
        duration: 2000
      });
    } catch (e) {
      this.openNotification({
        message: browser.i18n.getMessage("failedSaveSessionLabel"),
        type: "error"
      });
    }
  };

  removeSession = async id => {
    log.info(logDir, "removeSession()", id);
    try {
      await sendSessionRemoveMessage(id);
      this.openNotification({
        message: browser.i18n.getMessage("sessionDeletedLabel"),
        type: "warn",
        buttonLabel: browser.i18n.getMessage("undoLabel"),
        onClick: sendUndoMessage
      });
    } catch (e) {
      this.openNotification({
        message: browser.i18n.getMessage("failedDeleteSessionLabel"),
        type: "error"
      });
    }
  };

  removeWindow = async (session, winId) => {
    try {
      const editedSession = deleteWindow(session, winId);
      await sendSessionUpdateMessage(editedSession);

      if (this.state.trackingSessions.includes(session.id))
        sendEndTrackingByWindowDeleteMessage(session.id, winId);

      this.openNotification({
        message: browser.i18n.getMessage("sessionWindowDeletedLabel"),
        type: "warn",
        buttonLabel: browser.i18n.getMessage("undoLabel"),
        onClick: sendUndoMessage
      });
    } catch (e) {
      this.openNotification({
        message: browser.i18n.getMessage("failedDeleteSessionWindowLabel"),
        type: "error"
      });
    }
  };

  removeTab = async (session, winId, tabId) => {
    try {
      const editedSession = deleteTab(session, winId, tabId);
      await sendSessionUpdateMessage(editedSession);
      this.openNotification({
        message: browser.i18n.getMessage("sessionTabDeletedLabel"),
        type: "warn",
        buttonLabel: browser.i18n.getMessage("undoLabel"),
        onClick: sendUndoMessage
      });
    } catch (e) {
      this.openNotification({
        message: browser.i18n.getMessage("failedDeleteSessionTabLabel"),
        type: "error"
      });
    }
  };

  openNotification = notification => {
    log.info(logDir, "openNotification()", notification);
    this.setState({
      notification: {
        key: Date.now(),
        ...notification
      }
    });
  };

  openMenu = (x, y, itemsComponent) => {
    log.info(logDir, "openMenu()", itemsComponent);
    this.lastFocusedElement = document.activeElement;
    this.setState({
      menu: {
        isOpen: true,
        x: x,
        y: y,
        items: itemsComponent
      }
    });
  };

  closeMenu = () => {
    this.setState({
      menu: {
        isOpen: false,
        x: this.state.menu.x,
        y: this.state.menu.y,
        items: this.state.menu.items
      }
    });
    this.lastFocusedElement.focus();
  };

  openModal = (title, contentComponent) => {
    log.info(logDir, "openModal", title);
    this.lastFocusedElement = document.activeElement;
    this.setState({
      modal: {
        isOpen: true,
        title: title,
        content: contentComponent
      }
    });
  };

  closeModal = () => {
    this.setState({
      modal: {
        isOpen: false,
        title: this.state.modal.title,
        content: this.state.modal.content
      }
    });
    this.lastFocusedElement.focus();
  };

  render() {
    return (
      <div
        id="popupPage"
        className={this.state.isInTab ? "isInTab" : ""}
        onClick={this.state.menu.isOpen ? this.closeMenu : null}
        onContextMenu={this.state.menu.isOpen ? this.closeMenu : null}
      >
        <Notification notification={this.state.notification} />
        <Header
          openModal={this.openModal}
          openNotification={this.openNotification}
          syncStatus={this.state.syncStatus}
          needsSync={this.state.needsSync}
          undoStatus={this.state.undoStatus}
        />
        <div id="contents">
          <div className="column sidebar" style={{ width: `${this.state.sidebarWidth}px` }}>
            <OptionsArea
              sessions={this.state.sessions || []}
              filterValue={this.state.filterValue}
              sortValue={this.state.sortValue}
              toggleSearchBar={this.toggleSearchBar}
              isShowSearchBar={this.state.isShowSearchBar}
              changeSearchWord={this.changeSearchWord}
              changeFilter={this.changeFilterValue}
              changeSort={this.changeSortValue}
              optionsAreaRef={this.optionsAreaElement}
              searchBarRef={this.searchBarElement}
              sessionsAreaRef={this.sessionsAreaElement}
            />
            <Error error={this.state.error} />
            <SessionsArea
              sessions={this.state.sessions || []}
              selectedSessionId={this.state.selectedSession.id || ""}
              selectedSessionIds={this.state.selectedSessionIds}
              filterValue={this.state.filterValue}
              sortValue={this.state.sortValue}
              searchWords={this.state.searchWords}
              searchedSessionIds={this.state.searchedSessionIds || []}
              trackingSessions={this.state.trackingSessions}
              removeSession={this.removeSession}
              selectSession={this.selectSession}
              toggleSelectSession={this.toggleSelectSession}
              selectAllSessions={this.selectAllSessions}
              clearSelection={this.clearSelection}
              requestRemoveSelected={this.requestRemoveSelected}
              requestOpenSelected={this.requestOpenSelected}
              openMenu={this.openMenu}
              toggleSearchBar={this.toggleSearchBar}
              isInitSessions={this.state.isInitSessions}
              error={this.state.error}
              sessionsAreaRef={this.sessionsAreaElement}
              optionsAreaRef={this.optionsAreaElement.current}
              saveAreaRef={this.saveAreaElement.current}
            />
            <SaveArea
              openMenu={this.openMenu}
              saveSession={this.saveSession}
              saveAreaRef={this.saveAreaElement}
              sessionsAreaRef={this.sessionsAreaElement.current}
            />
          </div>
          <div className="column">
            {this.state.selectedSessionIds.length > 1 ? (
              <SelectionSummary
                count={this.state.selectedSessionIds.length}
                openSelectedSessions={this.requestOpenSelected}
                removeSelectedSessions={this.requestRemoveSelected}
                clearSelection={this.clearSelection}
              />
            ) : (
              <SessionDetailsArea
                session={this.state.selectedSession}
                searchWords={
                  this.state.searchedSessionIds.includes(this.state.selectedSession.id)
                    ? this.state.searchWords
                    : []
                }
                tagList={this.state.tagList}
                isTracking={this.state.trackingSessions.includes(this.state.selectedSession.id)}
                removeSession={this.removeSession}
                removeWindow={this.removeWindow}
                removeTab={this.removeTab}
                openMenu={this.openMenu}
                openModal={this.openModal}
                closeModal={this.closeModal}
              />
            )}
          </div>
        </div>
        <Menu menu={this.state.menu} />
        <Modal modal={this.state.modal} closeModal={this.closeModal} />
      </div>
    );
  }
}
