#!/usr/bin/env node
// Converts .template files into a JS module with JSON-escaped string constants.
// This ensures Netlify serverless functions can access the templates without fs.readFileSync.

const fs = require("fs");
const path = require("path");

const ps1 = fs.readFileSync(
    path.join(__dirname, "..", "src", "templates", "LaunchSignage.ps1.template"),
    "utf-8"
);
const bat = fs.readFileSync(
    path.join(__dirname, "..", "src", "templates", "Setup-PizzaSignage.bat.template"),
    "utf-8"
);

const output = `// AUTO-GENERATED from template files. Do not edit manually.
// Run: node scripts/build-templates.js to regenerate.

const PS1_TEMPLATE = ${JSON.stringify(ps1)};

const BAT_TEMPLATE = ${JSON.stringify(bat)};

module.exports = { PS1_TEMPLATE, BAT_TEMPLATE };
`;

const outPath = path.join(__dirname, "..", "src", "template-data.js");
fs.writeFileSync(outPath, output);
console.log("Generated", outPath);
