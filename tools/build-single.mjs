// tools/build-single.mjs - builds the single-file versions of the game (SPEC 5.7). No dependencies.
//   node tools/build-single.mjs
// Writes:
//   dist/before-he-stood.html  one self-contained page (all CSS/JS/data inlined) that runs offline
//   dist/artifact.html         the same content as a body fragment for claude.ai artifacts
// Google Fonts stay as an optional stylesheet link; everything else is inlined.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const dist = path.join(root, "dist");
const MAX_BYTES = 2 * 1024 * 1024;
const TITLE = "그가 일어나기 전 · Before He Stood";

const warnings = [];
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

// Inline script text must not close the script element or open an HTML comment.
function safeScript(js) {
  return js.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");
}

function safeStyle(css) {
  return css.replace(/<\/(style)/gi, "<\\/$1");
}

const html = read("index.html");

// Collect the pieces in document order.
const head = html.match(/<head>([\s\S]*?)<\/head>/i)[1];
const bodyMatch = html.match(/<body([^>]*)>([\s\S]*?)<\/body>/i);
const bodyAttrs = bodyMatch[1];
let body = bodyMatch[2];

const fontLinks = [];
head.replace(/<link\b[^>]*>/gi, (tag) => {
  const href = (tag.match(/href="([^"]+)"/i) || [])[1] || "";
  if (/fonts\.googleapis\.com\/css/.test(href)) fontLinks.push(tag);
  return tag;
});

let css = "";
head.replace(/<link\b[^>]*rel="stylesheet"[^>]*>/gi, (tag) => {
  const href = (tag.match(/href="([^"]+)"/i) || [])[1] || "";
  if (/^https?:/.test(href)) return tag;
  const file = path.join(root, href);
  if (fs.existsSync(file)) css += fs.readFileSync(file, "utf8") + "\n";
  else warnings.push("missing stylesheet " + href);
  return tag;
});

const metaDescription = (head.match(/<meta name="description"[^>]*>/i) || [""])[0];

// Replace local script tags in the body with inline scripts, keeping the order of SPEC 2.
const scriptOrder = [];
body = body.replace(/<script\s+src="([^"]+)"><\/script>/gi, (tag, src) => {
  if (/^https?:/.test(src)) {
    warnings.push("external script dropped: " + src);
    return "";
  }
  const file = path.join(root, src);
  if (!fs.existsSync(file)) {
    warnings.push("missing script " + src + " (skipped)");
    return "";
  }
  scriptOrder.push(src);
  return "<script>/* " + src + " */\n" + safeScript(fs.readFileSync(file, "utf8")) + "\n</script>";
});

// Marks the single-file builds so page code can tell them apart from the folder version.
const config = '<script>window.BHS = window.BHS || {}; window.BHS.config = { build: "single" };</script>';
body = body.replace(/(<script>\/\* data\/meta\.js \*\/)/, config + "\n$1");

const bodyTrim = body.trim();

// ---------------------------------------------------------------- dist/before-he-stood.html
const single = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1f1d1a">
<meta name="color-scheme" content="dark">
${metaDescription}
<title>${TITLE}</title>
<style>
${safeStyle(css)}
</style>
${fontLinks.join("\n")}
</head>
<body${bodyAttrs}>
${bodyTrim}
</body>
</html>
`;

// ---------------------------------------------------------------- dist/artifact.html (body fragment)
// title, the viewport-fit meta and the style come first; no doctype/html/head/body tags.
const artifactCss = `
/* artifact host: give the fragment the full frame and an explicit background */
:root { color-scheme: dark; }
html, body { height: 100%; margin: 0; background: #1f1d1a; }
`;
const artifact = `<title>${TITLE}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
${safeStyle(css)}
${artifactCss}
</style>
${fontLinks.join("\n")}
${bodyTrim}
`;

// ---------------------------------------------------------------- checks + write
function audit(name, text) {
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > MAX_BYTES) warnings.push(`${name} is ${bytes} bytes (> 2 MB)`);
  if (/\bwindow\.(confirm|alert|prompt)\s*\(|(^|[^.\w])(confirm|alert|prompt)\s*\(/m.test(text.replace(/<style>[\s\S]*?<\/style>/g, ""))) {
    warnings.push(`${name}: uses confirm/alert/prompt`);
  }
  if (/<script\s+src=/i.test(text)) warnings.push(`${name}: still has an external script`);
  return bytes;
}

fs.mkdirSync(dist, { recursive: true });
const sizes = {
  "dist/before-he-stood.html": audit("before-he-stood.html", single),
  "dist/artifact.html": audit("artifact.html", artifact)
};
if (/<!doctype|<html[\s>]|<head[\s>]|<body[\s>]|<\/(html|head|body)>/i.test(artifact)) warnings.push("artifact.html contains document-level tags");

fs.writeFileSync(path.join(dist, "before-he-stood.html"), single);
fs.writeFileSync(path.join(dist, "artifact.html"), artifact);

for (const [file, bytes] of Object.entries(sizes)) console.log(`${file}  ${(bytes / 1024).toFixed(1)} KB`);
console.log("scripts inlined: " + scriptOrder.join(", "));
warnings.forEach((w) => console.log("WARN  " + w));
process.exit(0);
