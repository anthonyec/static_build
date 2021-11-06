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

module.exports = {
  exists
};
