const fs = require('fs/promises');
const path = require('path');
const markdown = require('markdown-wasm');

function getTitleFromHTML(html = '') {
  const match = html.match(/\<h1\>.*\<\/h1\>/g);

  if (match?.length) {
    return (
      match[0]
        // Remove A and H1 tags.
        .replace(/<a\s.*<\/a>/g, '')
        .replace('<h1>', '')
        .replace('</h1>', '')
    );
  }
}

function getDateFromFilename(filename = '') {
  const dateMatch = filename.match(
    /^(19[0-9]{2}|2[0-9]{3})-(0[1-9]|1[012])-([123]0|[012][1-9]|31)/g
  );
  return dateMatch && dateMatch[0];
}

function getCommentHeadersFromContent(content = '') {
  const headers = {};
  const contentSplitByNewLines = content.split('\n');

  let lineReached = 0;

  for (const line of contentSplitByNewLines) {
    const match = line.match(/\<\!--\s?(.+)\s?:\s?(.+)\s?--\>/);

    if (!match) {
      break;
    }

    const key = match[1].trim();
    const value = match[2].trim();

    headers[key] = value;
    lineReached += 1;
  }

  const contentWithoutHeaders = contentSplitByNewLines
    .slice(lineReached, contentSplitByNewLines.length)
    .join('\n');

  return [headers, contentWithoutHeaders];
}

/**
 * Creates pages belonging to a collection based on the collection filesystem structure.
 *
 * Collections must have the following filesystem structures:
 * ```
 * // Entries as folders with a index markdown file.
 * |- _collectionName
 * |  |- YYYY-MM-DD-entry-slug
 * |  |  |- index.md
 * ```
 *
 * ```
 * // Entries as markdown files.
 * |- _collectionName
 * |  |- YYYY-MM-DD-entry-slug.md
 * ```
 * @param {string} collectionName - Name of the collection
 * @param {string} layout - Layout to use from `_layouts` directory
 * @param {string} sourcePath - Path of the source files
 * @param {string} destinationPath - Path of where the built files should go
 * @returns {Page[]}
 */
 async function parseCollectionFromFS(collectionName, layout, sourcePath, destinationPath) {
  const ignoredFilenames = ['.DS_Store'];
  const collectionFilenames = await fs.readdir(sourcePath);
  const pages = [];

  for await (const filename of collectionFilenames) {
    if (ignoredFilenames.includes(filename)) {
      continue;
    }

    const filePath = path.join(sourcePath, filename);
    const extension = path.extname(filename);

    // Cheap way to check for directory, will totally break if a file
    // has no extension name!
    const isDirectory = !extension;
    const markdownPath = isDirectory
      ? path.join(sourcePath, filename, 'index.md')
      : filePath;

    let fileContents;

    // Done instead of checking if file exists separately.
    try {
      fileContents = await fs.readFile(markdownPath, 'utf8');
    } catch (err) {
      continue;
    }

    const content = markdown.parse(fileContents);
    const title = getTitleFromHTML(content);
    const date = getDateFromFilename(filename);
    const slug = filename.replace(`${date}-`, '').replace(extension, '');

    // TODO: Move this into a separate process unrelated to making pages?
    const assets = isDirectory ? path.join(process.cwd(), filePath) : null;

    // TODO: Make this dynamic!
    const pagePath = destinationPath.replace('{{slug}}', slug);
    const [headers, contentWithoutHeaders] =
      getCommentHeadersFromContent(content);

    /** @type {Page} */
    const page = {
      slug,
      path: pagePath,
      collection: collectionName,
      title,
      date: new Date(date),
      assets,
      layout,
      content: contentWithoutHeaders,

      // Page comment headers can override anything, so be careful (or have fun)!
      ...headers
    };

    pages.push(page);
  }

  return pages;
}

module.exports = parseCollectionFromFS;
