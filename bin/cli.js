#! /usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { stdout } = require('process');

const staticBuild = require('../index');

const DEFAULT_ARGS = {
  watch: false,
  force: false
};

function logUsage() {
  stdout.write(`Usage: static-build <dist> <bucket> [--watch]\n`);

  stdout.write(`\nArguments:\n`);
  stdout.write(`<dist>        Location of directory containing content\n`);
  stdout.write(`<source>      Location of directory for build output\n`);
  stdout.write(`--watch, -w   Watch source directory for changes\n`);
}

function askQuestion(query = '') {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

async function main() {
  // Remove the first 2 arguments that nodejs provides.
  const args = process.argv.splice(2, process.argv.length);

  const sourcePath = args[0];
  const destinationPath = args[1];

  // Get arguments that user has inputted.
  const options = args.reduce(
    (mem, arg) => {
      if (arg === '--watch' || arg === '-w') {
        mem['watch'] = true;
      }

      if (arg === '--force' || arg === '-f') {
        mem['force'] = true;
      }

      return mem;
    },
    { ...DEFAULT_ARGS }
  );

  // Check that the first argument is a path and not a command.
  if (!sourcePath || sourcePath.slice(0, 1) === '-') {
    stdout.write(`Error: Invalid source path.\n`);
    return;
  }

  // Check that the second argument is a path and not a command.
  if (!destinationPath || destinationPath.slice(0, 1) === '-') {
    stdout.write(`Error: Invalid destination path.\n`);
    return;
  }

  if (!fs.existsSync(sourcePath)) {
    stdout.write(`Error: Source path "${sourcePath}" does not exist.\n`);
    return;
  }

  // Does not matter `destinationPath` does not exist, build will create it.
  // But it does matter if it exists already, as it could be someones files.
  if (fs.existsSync(destinationPath) && !options.force) {
    stdout.write(
      `Warning: Destination path "${destinationPath}" already exists.\n`
    );

    const answer = await askQuestion(
      'It will be deleted, do you want to continue? [yes] '
    );

    if (answer !== 'yes') {
      stdout.write(`Aborting!\n`);
      return;
    }
  }

  staticBuild(
    path.join(process.cwd(), sourcePath),
    path.join(process.cwd(), destinationPath),
    options
  );
}

main();
