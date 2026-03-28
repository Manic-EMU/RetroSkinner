#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const dir = __dirname;
const uiSrc = fs.readFileSync(path.join(dir, "ui.html"), "utf8");
const jszipSrc = fs.readFileSync(path.join(dir, "jszip.min.js"), "utf8");

// Replace <script src="./jszip.min.js"></script> with inline content
const result = uiSrc.replace(
  /<script\s+src=["']\.\/jszip\.min\.js["']\s*><\/script>/,
  `<script>\n${jszipSrc}\n</script>`
);

fs.writeFileSync(path.join(dir, "ui.built.html"), result, "utf8");
console.log("Built ui.built.html with inlined JSZip (" + Math.round(jszipSrc.length / 1024) + "KB)");
