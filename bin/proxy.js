#!/usr/bin/env node

"use strict";

const { version } = require('../package.json');
const agent = 'mjai-proxy/' + version.replace(/^(\d+\.\d+).*$/,'$1');

const net       = require('net');
const { spawn } = require('child_process');

const argv = require('yargs')
    .usage('Usage: $0 server-url mjai-bot -- [ bot-params... ]')
    .option('name',     { alias: 'n', default: 'Mjaiボット'})
    .option('room',     { alias: 'r', type: 'string', demandOption: true })
    .option('verbose',  { alias: 'v', boolean: true })
    .demandCommand(2)
    .argv;

const url  = argv._[0] == '-' ? 'http://127.0.0.1:4615/server'
                              : ('' + argv._[0]).replace(/\/$/,'');
const room = argv.room;

const server = net.createServer((sock)=>{

    let reply = { type: 'hello', protocol: 'mjsonp', protocol_version: 3 };
    if (argv.verbose) console.log('<-', reply);
    sock.write(JSON.stringify(reply) + '\n');

    sock.on('data', (data)=>{
        let msg = JSON.parse(data.toString('utf-8'));
        if (argv.verbose) console.log('->', msg);
    });

}).listen(0, ()=>{

    const port = server.address().port;
    const bot = spawn(argv._[1], [`mjsonp://127.0.0.1:${port}/${room}`]);

    bot.on('error', (e)=>{
        console.error(e.toString());
        process.exit(-1);
    });
});
