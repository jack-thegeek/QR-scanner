const fs = require("fs");
const path = require("path");

const source = require.resolve("jsqr/dist/jsQR.js");
fs.copyFileSync(source, path.join(__dirname, "..", "jsQR.js"));
