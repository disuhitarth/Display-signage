const fs = require("fs");
const path = require("path");

const PS1_TEMPLATE = fs.readFileSync(
    path.join(__dirname, "templates", "LaunchSignage.ps1.template"),
    "utf-8"
);

const BAT_TEMPLATE = fs.readFileSync(
    path.join(__dirname, "templates", "Setup-PizzaSignage.bat.template"),
    "utf-8"
);

function getPs1Template(baseURL, storeID) {
    return PS1_TEMPLATE
        .replace(/\{\{BASE_URL\}\}/g, baseURL)
        .replace(/\{\{STORE_ID\}\}/g, storeID);
}

function getBatTemplate() {
    return BAT_TEMPLATE;
}

module.exports = { getPs1Template, getBatTemplate };
