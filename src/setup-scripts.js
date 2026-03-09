const { PS1_TEMPLATE, BAT_TEMPLATE } = require("./template-data");

function getPs1Template(baseURL, storeID) {
    return PS1_TEMPLATE
        .replace(/\{\{BASE_URL\}\}/g, baseURL)
        .replace(/\{\{STORE_ID\}\}/g, storeID);
}

function getBatTemplate() {
    return BAT_TEMPLATE;
}

module.exports = { getPs1Template, getBatTemplate };
