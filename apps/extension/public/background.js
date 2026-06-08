chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "send-to-w1p",
    title: "Send to w1p",
    contexts: ["selection"]
  });
});

/**
 * Chrome service workers cannot push selection state directly into a popup
 * that may not be open, so storage is the handoff boundary for selected text.
 *
 * @param {chrome.contextMenus.OnClickData} info
 */
chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "send-to-w1p") {
    chrome.storage.local.set({ sharedText: info.selectionText }, () => {
      console.log("Text saved:", info.selectionText);
    });
  }
});
