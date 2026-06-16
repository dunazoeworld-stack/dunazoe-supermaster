const { randomBytes } = require("crypto");

function generate(prefix = "ID") {
  const ts  = Date.now().toString(36).toUpperCase();
  const rnd = randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${ts}-${rnd}`;
}

function generateNumeric(digits = 8) {
  const max = Math.pow(10, digits) - 1;
  const min = Math.pow(10, digits - 1);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRef(prefix = "REF") {
  const date = new Date();
  const d    = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,"0")}${String(date.getDate()).padStart(2,"0")}`;
  const rnd  = randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${d}-${rnd}`;
}

module.exports = { generate, generateNumeric, generateRef };
