const fs = require('fs/promises');

async function exists(filePath) {
  try {
    await fs.access(filePath, fs.F_OK);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') {
      return false;
    }

    throw new Error(err);
  }
}

async function watch(sourcePath, callback) {
  try {
    const watcher = fs.watch(sourcePath, {
      recursive: true
    });

    for await (const event of watcher) {
      await callback(null, event);
    }
  } catch (err) {
    await callback(err, null);
  }
}

module.exports = {
  exists,
  watch
};
