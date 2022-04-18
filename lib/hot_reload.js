const http = require('http');
const EventEmitter = require('events');

const PORT = 5678;

function formatServerSideEvent(name, message = '') {
  return `event: ${name}\ndata: ${message}\n\n`;
}

function createHotReload() {
  const events = new EventEmitter();

  function start() {
    const server = http.createServer(function (_request, response) {
      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('access-control-allow-origin', '*');

      events.on('reload', () => {
        response.write(formatServerSideEvent('reload'));
      });
    });

    server.listen(PORT);
  }

  function reload(timeout = 0) {
    // TODO: Timeout is used to wait for all files to be created in file system.
    // It's not a good solution because this time can vary. What's the best
    // way to know when all files have been created?
    setTimeout(() => events.emit('reload'), timeout);
  }

  return {
    start,
    reload
  };
}

module.exports = createHotReload;
