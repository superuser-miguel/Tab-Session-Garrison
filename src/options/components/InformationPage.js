import React from "react";
import browser from "webextension-polyfill";
import queryString from "query-string";
import OptionsContainer from "./OptionContainer";
import manifest from "src/manifest.json";

const repoUrl = "https://github.com/superuser-miguel/Tab-Session-Garrison";

export default props => {
  const query = queryString.parse(props.location.search);
  const extensionVersion = manifest.version;

  return (
    <div>
      <p className="contentTitle">{browser.i18n.getMessage("informationLabel")}</p>
      <hr />
      <OptionsContainer
        title={"extName"}
        captions={[""]}
        type={"none"}
        updated={query.action === "updated"}
        extraCaption={
          <p className="caption">
            <a href={`${repoUrl}/releases`} target="_blank">
              Version {extensionVersion}
            </a>
          </p>
        }
      />

      <OptionsContainer
        title={"licenseLabel"}
        captions={["GNU General Public License, Version 3.0 or later"]}
        useRawCaptions={true}
        type={"none"}
      />
      <hr />
      <OptionsContainer
        title={""}
        captions={[""]}
        type={"none"}
        extraCaption={
          <div>
            <p>
              <a href={repoUrl} target="_blank">
                GitHub
              </a>
            </p>
          </div>
        }
      />
    </div>
  );
};
