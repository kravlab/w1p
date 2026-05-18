/**
 * Listener for the extension's installation event.
 * Creates a context menu item for text selection.
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "send-to-extension",
    title: "Send to Extension",
    contexts: ["selection"]
  });
});

/**
 * Listener for context menu clicks.
 * If the 'send-to-extension' menu item is clicked, it saves the selected text
 * to chrome.storage.local.
 * 
 * @param {chrome.contextMenus.OnClickData} info - Information about the item clicked and the context.
 * @param {chrome.tabs.Tab} [tab] - The tab in which the menu item was clicked.
 */
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "send-to-extension") {
    chrome.storage.local.set({ sharedText: info.selectionText }, () => {
      /**
       * Optional callback after saving text.
       */
      console.log("Text saved:", info.selectionText);
    });
  }
});
