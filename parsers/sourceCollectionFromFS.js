const fs = require('fs/promises');
const { createReadStream } = require('fs');
const path = require('path');
const readline = require('readline');
const markdown = require('markdown-wasm');

function getDateFromFilename(filename = '') {
  const dateMatch = filename.match(
    /^(19[0-9]{2}|2[0-9]{3})-(0[1-9]|1[012])-([123]0|[012][1-9]|31)/g
  );
  return dateMatch && dateMatch[0];
}

async function getHeadersFile(fileStream) {
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const headers = {};

  let hasFoundAllCommentHeaders = false;
  let hasFoundTitle = false;

  for await (const line of rl) {
    const markdownTitleMatch = line.match(/^[^\S\r\n]*#[^#\S\r\n]*([^#\s]+.*)/);
    const commentHeaderMatch = line.match(/\<\!--\s?(.+)\s?:\s?(.+)\s?--\>/);

    if (hasFoundTitle && hasFoundAllCommentHeaders) {
      return headers;
    }

    if (!commentHeaderMatch) {
      hasFoundAllCommentHeaders = true;
    }

    if (commentHeaderMatch) {
      const key = commentHeaderMatch[1].trim();
      const value = commentHeaderMatch[2].trim();

      headers[key] = value;
    }

    if (markdownTitleMatch) {
      headers['title'] = markdownTitleMatch[1];
      hasFoundTitle = true;
    }
  }

  return headers;
}

async function sourceCollectionFromFS(sourcePath = '', destinationPath = '', name = '') {
  const entries = await fs.readdir(sourcePath);
  const pages = [];

  for (const entry of entries) {
    if (entry === '.DS_Store') {
      continue;
    }

    const entryPath = path.join(sourcePath, entry);
    const markdownPath = path.join(entryPath, 'index.md');
    const fileStream = createReadStream(markdownPath);

    fileStream.on('error', (err) => {
      console.log(`Read stream error for "${markdownPath}":`, err.code);
    });

    const headers = await getHeadersFile(fileStream);
    const date = getDateFromFilename(entry);
    const slug = entry.replace(`${date}-`, '');
    const pagePath = destinationPath.replace('{{slug}}', slug);

    const getContent = async () => {
      const contents = await fs.readFile(markdownPath, 'utf8');
      return markdown.parse(contents);
    };

    const page = {
      path: pagePath,
      assets: entryPath,
      slug,
      date,
      title: headers?.title,
      ...headers,
      get content() { return getContent(); },
    };

    pages.push(page);
  }


  return pages;
}

module.exports = sourceCollectionFromFS;
