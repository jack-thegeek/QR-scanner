# QR Code Scout

一个 Chrome Manifest V3 扩展，用于识别网页中的二维码。

## 功能

- 页面打开后自动扫描可读取的图片二维码。
- 右击图片或页面，选择“识别二维码”。右击图片会直接识别图片，右击其它位置会进入框选截取识别。
- 识别内容是 `http` 或 `https` 链接时，自动在新标签页打开。
- 识别到普通文本时，在页面顶部显示二维码内容。

## 安装

1. 在 Chrome 地址栏打开 `chrome://extensions`。
2. 打开右上角“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择本项目目录 `E:\AI\QR-scanner`。

修改代码后，在扩展管理页点击扩展的刷新按钮即可重新加载。

## 开发

```bash
npm install
npm run build
```

`npm run build` 会将 `jsqr` 依赖复制为扩展使用的本地 `jsQR.js` 文件。
