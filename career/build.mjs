// Regenerates career/index.html from the markdown files in this folder.
// Run after editing any .md file:  node career/build.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), "utf8");

const docs = {
  en: { linkedin: read("en/linkedin.md"), resume: read("en/resume.md"), cv: read("en/cv.md"), brief: read("en/brief.md") },
  es: { linkedin: read("es/linkedin.md"), resume: read("es/resume.md"), cv: read("es/cv.md"), brief: read("es/brief.md") },
  guide: read("README.md"),
};

const template = read("page.template.html");
const json = JSON.stringify(docs).replace(/</g, "\\u003c");
writeFileSync(join(here, "index.html"), template.replace("/*__DOCS__*/null", json));
console.log("career/index.html written");
