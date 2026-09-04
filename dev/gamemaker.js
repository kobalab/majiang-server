#!/usr/bin/env node

"use strict";

const { version } = require('../package.json');
const agent = 'majiang-bot/' + version.replace(/^(\d+\.\d+).*$/,'$1');

const io = require('socket.io-client');

const Player = require('@kobalab/majiang-ai');

const rule = require('@kobalab/majiang-core').rule(
            { '場数': 0, '途中流局あり': false, 'トビ終了あり': false,
              '連荘方式': 0, '延長戦方式': 0});

let room;
let COOKIES = [];

function login() {

    let name = argv.prefix + (COOKIES.length + 1);

    fetch(url + '/auth/', {
        method:   'POST',
        headers:  { 'User-Agent': agent },
        body:     new URLSearchParams({ name: name, passwd: '*'}),
        redirect: 'manual'
    }).then(res=>{
        let cookie;
        for (let c of (res.headers.get('Set-Cookie')||'').split(/,\s*/)) {
            if (! c.match(/^MAJIANG=/)) continue;
            cookie = c.replace(/^MAJIANG=/,'').replace(/; .*$/,'');
            COOKIES.push(cookie);
            connect(cookie);
            break;
        }
        if (! cookie) console.log('ログインエラー:', url);
    }).catch(err=>{
        console.log('接続エラー:', url);
    });
}

function logout() {

     if (! COOKIES.length) process.exit();
     let cookie = COOKIES.shift();

    fetch(url + '/logout', {
        method:   'POST',
        headers:  { 'User-Agent': agent,
                    'Cookie':     `MAJIANG=${cookie}`},
    }).then(res =>{
        logout();
    });
}

function error(msg) {
    console.log('ERROR:', msg);
    logout();
}

function connect(cookie) {

    const server = url.replace(/^(https?:\/\/[^\/]*)\/.*$/,'$1');
    const path   = url.replace(/^https?:\/\/[^\/]*/,'').replace(/\/$/,'');
    const sock = io(server, {
                        path: `${path}/socket.io/`,
                        extraHeaders: {
                            'User-Agent': agent,
                            Cookie: `MAJIANG=${cookie}`,
                        }
                    });
    const player = new Player();

    sock.on('ERROR', error);
    sock.on('ROOM', (msg)=>{
        if (! room) {
            room = msg.room_no;
            console.log('ROOM:', room);
            for (let i = 1; i < argv.players; i++) login();
        }
        if (msg.user.length == 4) sock.emit('START', room, rule);
    });
    sock.on('START', ()=> sock.off('ERROR'));
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
    sock.on('END', ()=> logout());

    sock.emit('ROOM', room);
}

const argv = require('yargs')
    .usage('Usage: $0 [ server-url ]')
    .option('prefix',   { alias: 'p', default: 'BOT'})
    .option('players',  { alias: 'n', default: 3    })
    .argv;

const url = (argv._[0] || 'http://127.0.0.1:4615/server').replace(/\/$/,'');

process.on('SIGTERM', ()=> logout());
process.on('SIGINT',  ()=> logout());

login();
