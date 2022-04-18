const fs = require('fs/promises');
const EventEmitter = require('events');

function debounce(callback, timeout = 300){
  let timer;

  return () => {
    clearTimeout(timer);
    timer = setTimeout(callback, timeout);
  };
}

function createFileWatcher(sourcePath) {
  let paused = false;

  const events = new EventEmitter();
  const emitChangeEvent = debounce(() => events.emit('change'));

  async function start() {
    const watcher = fs.watch(sourcePath, {
      recursive: true
    });

    try {
      // TODO: Add a debounce, `fs.watch` likes to emit events
      // twice for the same file. It's known to be buggy.
      for await (const event of watcher) {
        if (!paused) {
          emitChangeEvent();
        }
      }
    } catch(err) {
      console.error('File watcher error', err);
    }
  }

  function pause() {
    paused = true;
  }

  function resume() {
    paused = false;
  }

  return {
    start,
    pause,
    resume,
    on: (eventName, callback) => events.on(eventName, callback)
  }
};

module.exports = createFileWatcher;
