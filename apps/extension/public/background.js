chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "send-to-extension",
    title: "Send to Extension",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "send-to-extension") {
    chrome.storage.local.set({ sharedText: info.selectionText }, () => {
      console.log("Text saved:", info.selectionText);
    });
  }
});
