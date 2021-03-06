#!/usr/bin/env node
// @ts-check
"use strict";
/** @type {import("./dependencies").ProcessType} */
/** @type {import("./dependencies").FileSystem} */
/**
 * @typedef { { word: string; occurrence: number; gain: number } } WordItem
  */
// @ts-ignore
var fs = require("fs");
// @ts-ignore
var process = require("process");
var lib = require("./dependencies");
var logger = require("fancy-log");
var glob = require("glob");

var argv = process.argv, argi = 0;
if (/\bnode\b/i.test(argv[argi])) {
  argi++;
}
if (/\b(words-collect|gulp)(\.\b|$)/i.test(argv[argi])) {
  argi++;
}

const targetFile = argv[argi] && fs.existsSync(argv[argi]) ? argv[argi++] : "dist/content/vimium-c.js";
const contentText = lib.readFile(targetFile);
const minWordLen = argv[argi] && !isNaN(+argv[argi]) ? +argv[argi++] : 8;
const order = argv[argi] && "occurrence".includes(argv[argi]) ? (argi++, "occ") : "gain";
const minShownVal = argv[argi] && !isNaN(+argv[argi]) ? +argv[argi++] : 12;

const wordRe = /(["'])(?:\\.|)+?\1|\w+/g;
const stopWords = `
  function instanceof prototype
  endsWith includes startsWith toLowerCase toUpperCase
  localName textContent getAttribute removeAttribute
`;

let allLongWords = getLongWords(contentText, minWordLen);
allLongWords = allLongWords.filter(order === "occ" ? a => a.occurrence >= minShownVal : a => a.gain >= minShownVal);
allLongWords.sort(order === "occ" ? (a, b) => b.occurrence - a.occurrence : (a, b) => b.gain - a.gain);
logger.info("Here're potential gains in %o bytes of %o:", contentText.length, targetFile);
console.table(allLongWords);

const tsFiles = glob.sync("content/*.ts").concat(glob.sync("lib/*.ts"));
const tsContent = tsFiles.map(file => lib.readFile(file)).join("\n");
const allSimilarWords = getSimilarWords(tsContent);
if (allSimilarWords.length > 0) {
  logger.info("Found similar words:\n", allSimilarWords)
} else {
  logger.info("No similar property names found")
}

/**
 * @param {string} text
 * @param {number} min_len - minimum length of a word
 * @returns {WordItem[]}
 */
function getLongWords(text, min_len = 8) {
  /** @type {Map<string, number>} */
  const wordMap = new Map();
  for (const word of text.match(wordRe)) {
    if (word.length >= min_len) {
      wordMap.set(word, (wordMap.get(word) || 0) + 1);
    }
  }
  for (const word of stopWords.trim().split(/\s+/)) {
    wordMap.delete(word);
  }
  /** @type {WordItem[]} */
  const longWords = [];
  for (const [word, v] of wordMap) {
    const gain = word.length * v - (/** definition */ (word.length + 4) + /** reference */ 7 * v);
    if (gain > 0) {
      longWords.push({ word, occurrence: v, gain });
    }
  }
  return longWords;
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function getSimilarWords(text) {
  /** @type {Map<string, 0 | 1 | 2 | 3>} */
  const wordMap = new Map();
  for (const word of text.match(/\w+/g)) {
    const type = word[0] === "_" ? 1 : word.endsWith("_") ? 2 : 0;
    if (type && word.length > 2) {
      const key = word.slice(type === 1 ? 1 : 0, type === 2 ? -1 : word.length);
      const old = wordMap.get(key) || 0;
      // @ts-ignore
      wordMap.set(key, old | type);
    }
  }
  wordMap.delete("this");
  wordMap.delete("self");
  return [...wordMap].filter(([_, v]) => v === 3).map(item => item[0]);
}
