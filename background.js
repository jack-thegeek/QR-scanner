const IMAGE_MENU_ID = "qr-scout-image";
const AREA_MENU_ID = "qr-scout-area";
let menuSetup = Promise.resolve();

function setupContextMenu() {
  menuSetup = menuSetup.then(async () => {
    await chrome.contextMenus.removeAll();
    chrome.contextMenus.create({
      id: IMAGE_MENU_ID,
      title: "识别此图片中的二维码",
      contexts: ["image"]
    });
    chrome.contextMenus.create({
      id: AREA_MENU_ID,
      title: "选取区域识别二维码",
      contexts: ["page", "selection", "link", "video", "audio"]
    });
  });
  return menuSetup;
}

chrome.runtime.onInstalled.addListener(setupContextMenu);
chrome.runtime.onStartup.addListener(setupContextMenu);
setupContextMenu();

async function startAreaSelection(tab) {
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "QR_SCOUT_SELECT" });
  } catch {
    // Restricted pages do not allow content scripts.
  }
}

chrome.action.onClicked.addListener(startAreaSelection);

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  if (info.menuItemId === IMAGE_MENU_ID && info.srcUrl) {
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: "QR_SCOUT_IMAGE",
        srcUrl: info.srcUrl
      });
    } catch {
      // Restricted pages do not allow content scripts.
    }
  } else if (info.menuItemId === AREA_MENU_ID) {
    await startAreaSelection(tab);
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "QR_SCOUT_OPEN_URL" && typeof message.url === "string") {
    try {
      const url = new URL(message.url);
      if (url.protocol === "http:" || url.protocol === "https:") {
        chrome.tabs.create({ url: url.href });
      }
    } catch {
      // QR payload was not a valid URL.
    }
  }

  if (message.type === "QR_SCOUT_CAPTURE" && sender.tab?.id && message.rect) {
    const tabId = sender.tab.id;
    chrome.tabs.captureVisibleTab(null, { format: "png" }).then((dataUrl) => {
      chrome.tabs.sendMessage(tabId, {
        type: "QR_SCOUT_CROP",
        dataUrl,
        rect: message.rect
      });
    }).catch(() => {
      chrome.tabs.sendMessage(tabId, { type: "QR_SCOUT_CAPTURE_ERROR" });
    });
  }
});
