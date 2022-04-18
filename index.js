const fs = require('fs/promises');
const path = require('path');
const performance = require('perf_hooks').performance;
const mustache = require('mustache');

require('./types');
const { exists } = require('./lib/utils');
const buildFunctions = require('./lib/build');
const createHotReload = require('./lib/hot_reload');
const createFileWatcher = require('./lib/file_watcher');

function requireUncached(module) {
  delete require.cache[require.resolve(module)];
  return require(module);
}

async function resetDistDirectory(filePath) {
  const doesDistExist = await exists(filePath);

  if (doesDistExist) {
    await fs.rm(filePath, { recursive: true });
  }

  await fs.mkdir(filePath);
}

async function getUserConfig(sourcePath) {
  const DEFAULT_CONFIG = {
    getPages: () => [],
    getPageVariables: () => {},
    postBuild: () => {}
  };

  const configPath = path.join(sourcePath, 'config.js');
  const doesConfigPathExist = await exists(configPath);

  if (!doesConfigPathExist) {
    return DEFAULT_CONFIG;
  }

  return {
    ...DEFAULT_CONFIG,
    ...requireUncached(configPath)
  };
}

// TODO: Rename to something that is both layouts and partials.
async function getPartials(sourcePath, name) {
  const partialsPath = path.join(sourcePath, `_${name}`);

  const doesSourcePathExist = await exists(partialsPath);

  if (!doesSourcePathExist) {
    return {};
  }

  const partialFiles = await fs.readdir(partialsPath);
  const partials = {};

  for await (const partialFileName of partialFiles) {
    const baseName = path.basename(partialFileName);
    const ext = path.extname(partialFileName);
    const name = baseName.replace(ext, '');

    partials[name] = await fs.readFile(
      path.join(partialsPath, baseName),
      'utf8'
    );
  }

  return partials;
}

/**
 * Takes an array of pages and builds files out of them in the correct directory structure.
 * @param {Page[]} pages - Array of pages
 * @param {Object} globalView - Mustache global view variables
 * @param {Object} layouts - Mustache includes for layouts
 * @param {Object} partials - Mustache includes for partials
 * @returns {void}
 */
async function buildPages(
  distPath,
  pages = [],
  globalView = {},
  layouts = {},
  partials = {}
) {
  for await (const page of pages) {
    const destinationPath = path.join(distPath, page.path);
    const isExtensionNameInSlug = page.slug ? !!path.extname(page.slug) : false;

    await fs.mkdir(destinationPath, { recursive: true });

    // TODO: Move this into a separate process unrelated to making pages?
    if (page.assets) {
      const sourceAssetsPath = page.assets;
      const assetsDirectoryExists = await exists(sourceAssetsPath);

      if (assetsDirectoryExists) {
        await fs.cp(sourceAssetsPath, destinationPath, { recursive: true });
      } else {
        console.warn(`Warning: Assets do not exist ${sourceAssetsPath}`);
      }
    }

    const view = {
      page,
      ...globalView,
      ...globalView.getPageVariables(globalView.site, page)
    };

    const layout = page.layout && layouts[page.layout];
    const content = layout ? layout : page.content;
    const renderedPage = mustache.render(content, view, partials);

    const outputPath = isExtensionNameInSlug
      ? path.join(destinationPath, page.slug)
      : path.join(destinationPath, 'index.html');

    await fs.writeFile(outputPath, renderedPage, 'utf8');
  }
}

function getCollectionsFromPages(pages = []) {
  return pages.reduce((acc, page) => {
    if (page.collection) {
      if (!acc[page.collection]) {
        acc[page.collection] = [page];
      } else {
        acc[page.collection].push(page);
      }
    }

    if (!page.collection) {
      if (!acc['pages']) {
        acc['pages'] = {};
      }

      // TODO: Remove first `/` slash at start of slug.
      acc['pages'][page.slug] = page;
    }

    return acc;
  }, {});
}

/**
 * Take built pages and turn into files.
 */
async function compile(sourcePath, destinationPath) {
  performance.mark('build_start');

  await resetDistDirectory(destinationPath);

  const partials = await getPartials(sourcePath, 'partials');
  const layouts = await getPartials(sourcePath, 'layouts');

  const config = await getUserConfig(sourcePath);

  const pagesToBuild = await config.getPages(buildFunctions);
  const collections = getCollectionsFromPages(pagesToBuild);
  const globalView = { ...config, ...collections };

  await buildPages(
    destinationPath,
    pagesToBuild,
    globalView,
    layouts,
    partials
  );

  // TODO: Temp solution until I do proper asset copying.
  await config.postBuild(sourcePath, destinationPath);

  performance.mark('build_end');
}

function logPerformanceMeasurements() {
  performance.measure('build', 'build_start', 'build_end');

  const measurements = performance.getEntriesByType('measure');

  measurements.forEach((measurement) => {
    console.log(`${measurement.name}:`, measurement.duration.toFixed(2));
  });

  // This will stop a history of performance measures being logged out.
  performance.clearMeasures();
}

function startWatchCompile(sourcePath, destinationPath, options) {
  const hotReload = createHotReload();
  const fileWatcher = createFileWatcher(sourcePath);

  fileWatcher.on('change', async () => {
    fileWatcher.pause();
    await compile(sourcePath, destinationPath);
    logPerformanceMeasurements();
    hotReload.reload(300);
    fileWatcher.resume();
  });

  hotReload.start();
  fileWatcher.start();
}

/**
 * Build website!
 *
 * @param {string} sourcePath - Source path
 * @param {string} destinationPath - Destination path
 * @param {object} options - Options
 * @returns {void}
 */
async function staticBuild(sourcePath, destinationPath, options = {}) {
  try {
    await compile(sourcePath, destinationPath);
    logPerformanceMeasurements();
  } catch (err) {
    return console.error('Error:', err);
  }

  if (options.watch) {
    console.log('👀 watching for changes');
    startWatchCompile(sourcePath, destinationPath, options);
  }
}

module.exports = staticBuild;
