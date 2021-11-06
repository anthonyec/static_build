const fs = require('fs/promises');
const path = require('path');
const markdown = require('markdown-wasm');
const picomatch = require('picomatch');
const { fdir } = require('fdir');

require('../types');
const { exists } = require('./utils');

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

// TODO: Tidy this mess up!
// TODO: Make dynamic glob.
async function pages(sourcePath) {
  // TODO: Maybe only do 1 directory scan once.
  const files = new fdir().withBasePath().crawl(sourcePath).withPromise();
  const allFiles = await files;

  // TODO: Is this possible to do with one glob? I can't work it out.
  const isMatch = picomatch('**/*.(html|md)');
  const isMatchSpecialFolder = picomatch('**/_**/**/*');

  const excludedFiles = allFiles.filter((file) => {
    return isMatchSpecialFolder(file);
  });

  const filteredFiles = allFiles.filter((file) => {
    return isMatch(file) && !excludedFiles.includes(file);
  });

  const builtPages = [];

  for await (const filePath of filteredFiles) {
    const extension = path.extname(filePath);
    const filePathRelative = filePath
      .replace(sourcePath, '')
      .replace(extension, '');
    const slug = filePathRelative;
    const isMarkdown = extension === '.md';

    let newPath = filePathRelative;

    // TODO: Decide if I should use folders with indexes?
    if (slug === '/index') {
      newPath = filePathRelative.replace('index', '');
    }

    const fileContents = await fs.readFile(filePath, 'utf8');
    const content = isMarkdown ? markdown.parse(fileContents) : fileContents;
    const title = getTitleFromHTML(content);
    const [headers, contentWithoutHeaders] =
      getCommentHeadersFromContent(content);

    /** @type {Page} */
    const page = {
      path: newPath,
      slug,
      title,
      date: null,
      content: contentWithoutHeaders,
      ...headers
    };

    builtPages.push(page);
  }

  return builtPages;
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
async function collection(collectionName, layout, sourcePath, destinationPath) {
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
    const markdownExists = await exists(markdownPath);

    // Avoid any empty folders.
    if (!markdownExists) {
      continue;
    }

    const fileContents = await fs.readFile(markdownPath, 'utf8');
    const content = markdown.parse(fileContents);
    const title = getTitleFromHTML(content);
    const date = getDateFromFilename(filename);
    const slug = filename.replace(`${date}-`, '').replace(extension, '');
    const assets = isDirectory ? filePath : null;

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

/**
 * Creates pages that redirect to other pages or URLs.
 * @param {Redirects} redirects - Map of redirects, with key as "redirect from" and value as "redirect to".
 * @returns {Page[]}
 */
async function redirects(redirects = {}) {
  const pages = [];

  for (const redirectFrom in redirects) {
    const redirectTo = redirects[redirectFrom];
    const content = `<link href="${redirectTo}" rel="canonical"><meta http-equiv="refresh" content="0;url=${redirectTo}" />This page has moved. <a href="${redirectTo}">Click here if not redirected automatically.</a>`;

    /** @type {Page} */
    const page = {
      title: `Redirect to ${redirectTo}`,
      path: redirectFrom,
      collection: 'redirects',
      content
    };

    pages.push(page);
  }

  return pages;
}

module.exports = { pages, collection, redirects };
