#!/usr/bin/env node

"use strict";

const { version } = require('../package.json');
const agent = 'mjai-proxy/' + version.replace(/^(\d+\.\d+).*$/,'$1');

const net       = require('net');
const io        = require('socket.io-client');
const { spawn } = require('child_process');

let cookie;

function login() {

    fetch(url + '/auth/', {
        method:   'POST',
        headers:  { 'User-Agent': agent },
        body:     new URLSearchParams({ name: name, passwd: '*'}),
        redirect: 'manual'
    }).then(res=>{
        for (let c of (res.headers.get('Set-Cookie')||'').split(/,\s*/)) {
            if (! c.match(/^MAJIANG=/)) continue;
            cookie = c.replace(/^MAJIANG=/,'').replace(/; .*$/,'');

            process.on('SIGTERM', logout);
            process.on('SIGINT',  logout);

            exec_bot();

            break;
        }
        if (! cookie) console.log('ログインエラー:', url);
    }).catch(err=>{
        console.log('接続エラー:', err.toString());
    });
}

function logout() {

    fetch(url + '/logout', {
        method:   'POST',
        headers:  { 'User-Agent': agent,
                    'Cookie':     `MAJIANG=${cookie}`},
    }).then(res=>{
        process.exit();
    });
}

function error(msg) {
    console.log('ERROR:', msg);
    logout();
}

function connect() {

    const server = url.replace(/^(https?:\/\/[^\/]*)\/.*$/,'$1');
    const path   = url.replace(/^https?:\/\/[^\/]*/,'').replace(/\/$/,'');
    const sock = io(server, {
                        path: `${path}/socket.io/`,
                        extraHeaders: {
                            'User-Agent': agent,
                            Cookie: `MAJIANG=${cookie}`,
                        }
                    });

    sock.on('ERROR', error);
    sock.on('END',   logout);
    sock.on('ROOM',  ()=> sock.on('HELLO', logout));
    sock.on('START', ()=> sock.off('ERROR'));

    sock.emit('ROOM', room);
}

function exec_bot() {

    const proxy = net.createServer((sock)=>{

        let reply = { type: 'hello', protocol: 'mjsonp', protocol_version: 3 };
        if (argv.verbose) console.log('<-', reply);
        sock.write(JSON.stringify(reply) + '\n');

        sock.on('data', (data)=>{
            let msg = JSON.parse(data.toString('utf-8'));
            if (argv.verbose) console.log('->', msg);

            if (msg.type == 'join') connect();
        });
    }).listen(()=>{

        const port = proxy.address().port;

        spawn(bot_name, [`mjsonp://127.0.0.1:${port}/${room}`],
                        { shell: argv.shell }
            ).on('error', (err)=>{
                console.error(err.toString());
                process.exit(-1);
            });
    });
}

const argv = require('yargs')
    .usage('Usage: $0 server-url mjai-bot -- [ bot-params... ]')
    .option('name',     { alias: 'n', default: 'Mjaiボット'})
    .option('room',     { alias: 'r', type: 'string', demandOption: true })
    .option('verbose',  { alias: 'v', boolean: true })
    .option('shell',    { alias: 'S', boolean: true })
    .demandCommand(2)
    .argv;

const name = argv.name;
const room = argv.room;

const url  = argv._[0] == '-' ? 'http://127.0.0.1:4615/server'
                              : ('' + argv._[0]).replace(/\/$/,'');
const bot_name = argv._[1];

login();
