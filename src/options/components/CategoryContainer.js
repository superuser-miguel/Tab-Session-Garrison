import React, { forwardRef } from "react";
import browser from "webextension-polyfill";
import OptionContainer from "./OptionContainer";
import "../styles/CategoryContainer.scss";

export default forwardRef((props, ref) => {
  const { category, elements, isActive } = props;
  return (
    <li className={`categoryContainer ${isActive ? "isActive" : ""}`} ref={ref}>
      <fieldset>
        <legend>
          <p className="categoryTitle">
            {category !== "" ? browser.i18n.getMessage(category) : ""}
          </p>
        </legend>
        <ul className="categoryElements">
          {elements.map((option, index) => (
            <OptionContainer {...option} key={index}>
              {option.hasOwnProperty("childElements") && (
                <ul className="childElements">
                  {option.childElements.map((option, index) => (
                    <OptionContainer {...option} key={index} />
                  ))}
                </ul>
              )}
              <hr />
            </OptionContainer>
          ))}
        </ul>
      </fieldset>
    </li>
  );
});
