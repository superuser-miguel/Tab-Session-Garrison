import React, { Component } from "react";
import browser from "webextension-polyfill";
import "../styles/ConfirmModalContent.scss";

export default class ConfirmModalContent extends Component {
  handleConfirm = () => {
    this.props.onConfirm();
    this.props.closeModal();
  };

  render() {
    const { message, confirmLabel, closeModal } = this.props;
    return (
      <div className="confirmModalContent">
        <p className="message">{message}</p>
        <div className="buttons">
          <button type="button" onClick={closeModal}>
            {browser.i18n.getMessage("cancelLabel").replace(/^$/, "Cancel")}
          </button>
          <button type="button" className="confirmButton" onClick={this.handleConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    );
  }
}
