#!/usr/bin/env node

"use strict";

const { version } = require('../package.json');
const agent = 'majiang-bot/' + version.replace(/^(\d+\.\d+).*$/,'$1');

const io = require('socket.io-client');

const Player = require('@kobalab/majiang-ai/legacy')('0202');

const rule = require('@kobalab/majiang-core').rule(
            { '場数': 1, '途中流局あり': false, 'トビ終了あり': false,
              '連荘方式': 0, '延長戦方式': 0});

if (! global.fetch) global.fetch = require('node-fetch');

const COOKIES = [];
const SOCKS   = [];
const ROOMS   = [];

function login(n = 0) {

    let name = argv.prefix + ('0000' + (n + 1)).slice(-4);

    fetch(url + '/auth/', {
        method:   'POST',
        headers:  { 'User-Agent': agent },
        body:     new URLSearchParams({ name: name, passwd: '*'}),
        redirect: 'manual'
    }).then(res=>{
        for (let c of (res.headers.get('Set-Cookie')||'').split(/,\s*/)) {
            if (! c.match(/^MAJIANG=/)) continue;
            COOKIES[n] = c.replace(/^MAJIANG=/,'').replace(/; .*$/,'');
            process.stdout.write('+');
            if (COOKIES.filter(c => c).length == argv.players) {
                process.stdout.write('\n');
                connect();
            }
            return;
        }
        console.log('ログインエラー:', url);
    }).catch(err=>{
        console.log('接続エラー:', url);
    });

    if (n + 1 < argv.players) setTimeout(()=>login(n + 1), 10);
}

function connect(n = 0) {

    const server = url.replace(/^(https?:\/\/[^\/]*)\/.*$/,'$1');
    const path   = url.replace(/^https?:\/\/[^\/]*/,'').replace(/\/$/,'');
    const sock = io(server, {
                        path: `${path}/socket.io/`,
                        extraHeaders: {
                            'User-Agent': agent,
                            Cookie: `MAJIANG=${COOKIES[n]}`,
                        }
                    });

    if (argv.verbose) sock.onAny(console.log);
    sock.on('HELLO', ()=>{
        sock.off('HELLO');
        SOCKS[n] = sock;
        process.stdout.write('.');
        if (SOCKS.filter(s => s).length == argv.players) {
            process.stdout.write('\n');
            init();
        }
    });

    if (n + 1 < argv.players) setTimeout(()=>connect(n + 1), 40);
}

function init(n = 0, room) {

    const sock = SOCKS[n];

    process.stdout.write('=');
    if (room) ROOMS[n] = room;

    if (! room) {
        sock.on('ROOM', (msg)=>{
            sock.off('ROOM');
            ROOMS[n] = msg.room_no;
            init(n + 1, msg.room_no);
            init(n + 2, msg.room_no);
            init(n + 3, msg.room_no);
        });
    }
    else {
        sock.on('HELLO', (msg)=>{
            sock.off('HELLO');
            process.stdout.write('#');
            init(n, room);
        });
    }
    if (ROOMS.filter(r => r).length == argv.players) {
        process.stdout.write('\n');
        setTimeout(start, (argv.wait + 1) * 1000);
    }

    sock.emit('ROOM', room);

    if (! room && n + 4 < argv.players) setTimeout(()=>init(n + 4), 160);
}

function start(n = 0) {

    for (let i = 0; i < 4; i++) {

        let sock = SOCKS[n + i];
        process.stdout.write('*');

        const player = new Player();
        sock.on('GAME', (msg)=>{
            try {
                if (msg.seq) {
                    player.action(msg, (reply = {})=>{
                        reply.seq = msg.seq;
                        setTimeout(()=>sock.emit('GAME', reply), argv.delay);
                    });
                }
                else {
                    player.action(msg);
                }
            }
            catch(err) {
                if (msg.seq) sock.emit('GAME', { seq: msg.seq });
            }
        });
        sock.off('HELLO');
        sock.on('END', ()=>{
            logout(n + i);
        });

    }
    SOCKS[n].emit('START', ROOMS[n], rule);

    if (n + 4 < argv.players) setTimeout(()=>start(n + 4), 10);
    else                      process.stdout.write('\n');
}

function logout(n) {

    if (SOCKS[n]) {
        SOCKS[n].disconnect();
        SOCKS[n] = null;
    }

    fetch(url + '/logout', {
        method:   'POST',
        headers:  { 'User-Agent': agent,
                    'Cookie':     `MAJIANG=${COOKIES[n]}`},
    }).then(res=>{
        process.stdout.write('-');
        COOKIES[n] = null;
        if (COOKIES.filter(c => c).length == 0) {
            process.stdout.write('\n');
        }
    }).catch(err=>{});
}

function logout_all(n = 0) {

    for (let i = n; i < COOKIES.length; i++) {
        if (COOKIES[i]) {
            logout(i);
            setTimeout(()=>logout_all(i + 1), 20);
            return;
        }
    }
}

const argv = require('yargs')
    .usage('Usage: $0 [ server-url ]')
    .option('prefix',   { alias: 'p', default: 'BOT'})
    .option('players',  { alias: 'n', default: 4    })
    .option('delay',    { alias: 'd', default: 1000 })
    .option('wait',     { alias: 'w', default: 0    })
    .option('verbose',  { alias: 'v', boolean: true })
    .argv;

const url = (argv._[0] || 'http://127.0.0.1:4615/server').replace(/\/$/,'');

process.on('SIGTERM', ()=>logout_all());
process.on('SIGINT',  ()=>logout_all());

login();
