(() => {
  const MAX_SCAN_SIZE = 1600;
  let noticeTimer;
  let selectionActive = false;

  function showNotice(text, kind = "info", duration = 4200) {
    document.getElementById("qr-scout-notice")?.remove();
    const box = document.createElement("div");
    box.id = "qr-scout-notice";
    box.dataset.kind = kind;
    box.textContent = text;
    document.documentElement.appendChild(box);
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => box.remove(), duration);
  }

  function asUrl(value) {
    try {
      const url = new URL(value.trim());
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
    } catch {
      return null;
    }
  }

  function handleResult(result) {
    if (!result?.data) {
      showNotice("未发现二维码", "warning");
      return;
    }
    const url = asUrl(result.data);
    if (url) {
      showNotice(`已识别链接，正在打开：${url}`, "success", 2500);
      chrome.runtime.sendMessage({ type: "QR_SCOUT_OPEN_URL", url });
    } else {
      showNotice(`二维码内容：${result.data}`, "success", 8000);
    }
  }

  function decodeCanvas(canvas) {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context || canvas.width < 1 || canvas.height < 1) return null;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    return window.jsQR(pixels.data, pixels.width, pixels.height, {
      inversionAttempts: "attemptBoth"
    });
  }

  function cropScreenshot(dataUrl, rect) {
    const image = new Image();
    image.onload = () => {
      const scaleX = image.naturalWidth / window.innerWidth;
      const scaleY = image.naturalHeight / window.innerHeight;
      const width = Math.max(1, Math.round(rect.width * scaleX));
      const height = Math.max(1, Math.round(rect.height * scaleY));
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, MAX_SCAN_SIZE / Math.max(width, height));
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      canvas.getContext("2d", { willReadFrequently: true }).drawImage(
        image, Math.round(rect.left * scaleX), Math.round(rect.top * scaleY), width, height,
        0, 0, canvas.width, canvas.height
      );
      handleResult(decodeCanvas(canvas));
    };
    image.src = dataUrl;
  }

  function canvasFromImage(image) {
    return new Promise((resolve, reject) => {
      const draw = () => {
        const scale = Math.min(1, MAX_SCAN_SIZE / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d", { willReadFrequently: true });
        try {
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas);
        } catch {
          reject(new Error("无法读取图片"));
        }
      };
      if (image.complete && image.naturalWidth) draw();
      else {
        image.onload = draw;
        image.onerror = () => reject(new Error("图片加载失败"));
      }
    });
  }

  async function scanImageUrl(srcUrl) {
    showNotice("正在识别二维码…");
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = srcUrl;
    try {
      const canvas = await canvasFromImage(image);
      handleResult(decodeCanvas(canvas));
    } catch {
      showNotice("无法读取此图片，可能受跨域限制", "warning");
    }
  }

  function scanPageImages() {
    const images = [...document.images].filter((image) => image.naturalWidth > 40 && image.naturalHeight > 40);
    let index = 0;
    const next = () => {
      if (index >= images.length) return;
      const image = images[index++];
      canvasFromImage(image).then((canvas) => {
        const result = decodeCanvas(canvas);
        if (result) handleResult(result);
        else next();
      }).catch(next);
    };
    next();
  }

  function startSelection() {
    if (selectionActive) return;
    selectionActive = true;
    const shade = document.createElement("div");
    shade.id = "qr-scout-selection";
    shade.innerHTML = '<div class="qr-scout-guide">拖动选择二维码区域 · Esc 取消</div><div class="qr-scout-box"></div>';
    document.documentElement.appendChild(shade);
    const box = shade.querySelector(".qr-scout-box");
    let startX = 0;
    let startY = 0;
    let dragging = false;

    const finish = () => {
      if (!dragging) return;
      dragging = false;
      const rect = box.getBoundingClientRect();
      shade.remove();
      selectionActive = false;
      if (rect.width < 8 || rect.height < 8) {
        showNotice("选择区域太小", "warning");
        return;
      }
      showNotice("正在识别选中区域…");
      chrome.runtime.sendMessage({
        type: "QR_SCOUT_CAPTURE",
        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
      });
    };

    shade.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      box.style.cssText = `left:${startX}px;top:${startY}px;width:0;height:0`;
    });
    shade.addEventListener("mousemove", (event) => {
      if (!dragging) return;
      const left = Math.min(startX, event.clientX);
      const top = Math.min(startY, event.clientY);
      box.style.left = `${left}px`;
      box.style.top = `${top}px`;
      box.style.width = `${Math.abs(event.clientX - startX)}px`;
      box.style.height = `${Math.abs(event.clientY - startY)}px`;
    });
    shade.addEventListener("mouseup", finish);
    shade.addEventListener("mouseleave", () => { if (dragging) finish(); });
    const cancel = (event) => {
      if (event.key === "Escape") {
        shade.remove();
        selectionActive = false;
        document.removeEventListener("keydown", cancel, true);
      }
    };
    document.addEventListener("keydown", cancel, true);
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "QR_SCOUT_IMAGE") scanImageUrl(message.srcUrl);
    if (message.type === "QR_SCOUT_SELECT") startSelection();
    if (message.type === "QR_SCOUT_CROP") cropScreenshot(message.dataUrl, message.rect);
    if (message.type === "QR_SCOUT_CAPTURE_ERROR") showNotice("无法截取当前页面", "warning");
  });

  const style = document.createElement("style");
  style.textContent = `
    #qr-scout-notice { position:fixed; z-index:2147483647; top:20px; left:50%; transform:translateX(-50%); max-width:min(620px, calc(100vw - 32px)); padding:12px 18px; color:#fff; background:#263238; border-radius:8px; box-shadow:0 5px 22px #0005; font:14px/1.5 system-ui,sans-serif; word-break:break-word }
    #qr-scout-notice[data-kind=success] { background:#17633a } #qr-scout-notice[data-kind=warning] { background:#8a4b08 }
    #qr-scout-selection { position:fixed; inset:0; z-index:2147483646; cursor:crosshair; background:#0005 }
    #qr-scout-guide { position:absolute; top:18px; left:50%; transform:translateX(-50%); padding:9px 14px; color:#fff; background:#222d; border-radius:6px; font:14px system-ui,sans-serif; pointer-events:none }
    .qr-scout-box { position:absolute; border:2px solid #25c477; background:#25c47722; pointer-events:none }
  `;
  document.documentElement.appendChild(style);
  setTimeout(scanPageImages, 1200);
})();
