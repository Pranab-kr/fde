import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';

/**
 * Loads and extracts text and metadata from a PDF file.
 * Constructs a sliced Uint8Array from raw buffer to avoid Node.js buffer pooling offset issues.
 * @param {string} filePath - Absolute or relative path to PDF file
 * @returns {Promise<{ text: string, numPages: number, info: object }>}
 */
async function loadPdf(filePath) {
  const raw = fs.readFileSync(filePath);
  const buffer = new Uint8Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  const data = await pdfParse(buffer);
  return {
    text: data.text ? data.text.trim() : '',
    numPages: data.numpages || 1,
    info: data.info || {},
  };
}

/**
 * Loads all PDF policies from a directory.
 * @param {string} dirPath - Path to directory containing policy PDF files
 * @returns {Promise<Array<{ fileName: string, title: string, text: string }>>}
 */
async function loadAllPolicies(dirPath) {
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.pdf')).sort();
  const results = [];

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const parsed = await loadPdf(fullPath);
    const title = file
      .replace('.pdf', '')
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    results.push({
      fileName: file,
      title,
      text: parsed.text,
    });
  }

  return results;
}

export { loadPdf, loadAllPolicies };
