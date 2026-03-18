import fs from "node:fs";
import zlib from "node:zlib";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node tools/extract-pdf-text.mjs <path-to-pdf>");
  process.exit(2);
}

const buf = fs.readFileSync(file);

function extractObjStream(buffer, objNum) {
  const marker = Buffer.from(`${objNum} 0 obj`);
  const i = buffer.indexOf(marker);
  if (i < 0) throw new Error(`obj ${objNum} not found`);

  const streamIdx = buffer.indexOf(Buffer.from("stream"), i);
  if (streamIdx < 0) throw new Error(`stream not found for obj ${objNum}`);

  let start = streamIdx + Buffer.from("stream").length;
  if (buffer[start] === 0x0d && buffer[start + 1] === 0x0a) start += 2;
  else if (buffer[start] === 0x0a) start += 1;

  const end = buffer.indexOf(Buffer.from("endstream"), start);
  if (end < 0) throw new Error(`endstream not found for obj ${objNum}`);

  return buffer.slice(start, end);
}

function decodePdfLiteralString(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = s[++i];
    if (next === undefined) break;
    if (next === "n") out += "\n";
    else if (next === "r") out += "\r";
    else if (next === "t") out += "\t";
    else if (next === "b") out += "\b";
    else if (next === "f") out += "\f";
    else if (next === "(") out += "(";
    else if (next === ")") out += ")";
    else if (next === "\\") out += "\\";
    else if (/[0-7]/.test(next)) {
      let oct = next;
      for (let k = 0; k < 2; k++) {
        const c = s[i + 1];
        if (c && /[0-7]/.test(c)) {
          oct += c;
          i++;
        } else break;
      }
      out += String.fromCharCode(Number.parseInt(oct, 8));
    } else {
      out += next;
    }
  }
  return out;
}

function decodePdfHexString(hex) {
  let cleaned = hex.replace(/\s+/g, "");
  if (cleaned.length % 2 === 1) cleaned += "0";
  const bytes = Buffer.from(cleaned, "hex");
  let zeroCount = 0;
  for (const b of bytes) if (b === 0) zeroCount++;

  if (bytes.length >= 2 && zeroCount / bytes.length > 0.2) {
    const swapped = Buffer.alloc(bytes.length);
    for (let i = 0; i < bytes.length; i += 2) {
      swapped[i] = bytes[i + 1] ?? 0;
      swapped[i + 1] = bytes[i] ?? 0;
    }
    return swapped.toString("utf16le");
  }

  return bytes.toString("latin1");
}

function extractTextFromContentStream(content) {
  const texts = [];

  for (const m of content.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) {
    texts.push(decodePdfLiteralString(m[1]));
  }

  for (const m of content.matchAll(/<([0-9A-Fa-f\s]+)>\s*Tj/g)) {
    texts.push(decodePdfHexString(m[1]));
  }

  for (const m of content.matchAll(/\[((?:[^\]]|\](?!\s*TJ))*)\]\s*TJ/g)) {
    const inner = m[1];
    for (const sm of inner.matchAll(/\(((?:\\.|[^\\)])*)\)|<([0-9A-Fa-f\s]+)>/g)) {
      if (sm[1] !== undefined) texts.push(decodePdfLiteralString(sm[1]));
      else if (sm[2] !== undefined) texts.push(decodePdfHexString(sm[2]));
    }
  }

  const cleaned = texts
    .map((t) => t.replace(/\u0000/g, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const out = [];
  for (const t of cleaned) {
    if (out[out.length - 1] !== t) out.push(t);
  }
  return out;
}

const contentStream = zlib.inflateSync(extractObjStream(buf, 4)).toString("latin1");
const text = extractTextFromContentStream(contentStream);
process.stdout.write(text.join("\n"));

