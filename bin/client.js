#!/usr/bin/env node

"use strict";

const { version } = require('../package.json');
const agent = 'majiang-bot/' + version.replace(/\.\d+$/,'');

const io = require('socket.io-client');

const Player = require('@kobalab/majiang-ai');
const player = new Player();

let cookie;

function login(url, name, room) {

    fetch(url + '/auth/', {
        method:   'POST',
        headers:  { 'User-Agent': agent },
        body:     new URLSearchParams({ name: name, passwd: '*'}),
        redirect: 'manual'
    }).then(res=>{
        for (let c of (res.headers.get('Set-Cookie')||'').split(/,\s*/)) {
            if (! c.match(/^MAJIANG=/)) continue;
            cookie = c.replace(/^MAJIANG=/,'').replace(/; .*$/,'');
            init(url, room);
            break;
        }
        if (! cookie) console.log('ログインエラー:', url);
    }).catch(err=>{
        console.log('接続エラー:', url);
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

function init(url, room) {

    const server = url.replace(/^(https?:\/\/[^\/]*)\/.*$/,'$1');
    const path   = url.replace(/^https?:\/\/[^\/]*/,'').replace(/\/$/,'');
    const sock = io(server, {
                        path: `${path}/socket.io/`,
                        extraHeaders: {
                            'User-Agent': agent,
                            Cookie: `MAJIANG=${cookie}`,
                        }
                    });

    if (argv.verbose) sock.onAny(console.log);
    sock.on('ERROR', error);
    sock.on('END',   logout);
    sock.on('ROOM',  ()=>{ sock.on('HELLO', logout)});
    sock.on('GAME',  (msg)=>{
        if (msg.seq) {
            player.action(msg, (reply = {})=>{
                reply.seq = msg.seq;
                sock.emit('GAME', reply);
            });
        }
        else {
            player.action(msg);
        }
    });

    process.on('SIGTERM', logout);
    process.on('SIGINT',  logout);

    sock.emit('ROOM', room);
}

const argv = require('yargs')
    .usage('Usage: $0 [ server-url ]')
    .option('name',     { alias: 'n', default: '*ボット*'})
    .option('room',     { alias: 'r', type: 'string', demandOption: true })
    .option('verbose',  { alias: 'v', boolean: true })
    .argv;

const url = (argv._[0] || 'http://127.0.0.1:4615/server').replace(/\/$/,'');
const room = argv.room || '-';

login(url, argv.name, room);
