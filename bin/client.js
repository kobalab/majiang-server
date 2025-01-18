#!/usr/bin/env node

"use strict";

const agant = 'majiang-bot/1.3';

const io = require('socket.io-client');

const Player = require('@kobalab/majiang-ai');
const player = new Player();

let cookie;

function post(url, param, callback) {

    const http = require(url.slice(0,5) == 'https' ? 'https' : 'http');

    const req = http.request(url, {
        method: 'POST',
        headers: { 'User-Agent':   agant,
                   'Content-Type': 'application/x-www-form-urlencoded',
                    Cookie:        `MAJIANG=${cookie}` }
    }, res =>{
        res.on('data', ()=>{});
        res.on('end',  ()=>callback(res));
    }).on('error', err =>{
        console.log(err.message);
    });
    req.write(new URLSearchParams(param).toString());
    req.end();

}

function login(url, name, room) {

    post(url + '/auth/', { name: name, passwd: '*'}, (res)=>{
        for (let c of res.headers['set-cookie'] || []) {
            if (! c.match(/^MAJIANG=/)) continue;
            cookie = c.replace(/^MAJIANG=/,'').replace(/; .*$/,'');
            init(url, room);
            break;
        }
    });
}

function logout() {
    post(url + '/logout', '', ()=>{ process.exit() });
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
                            'User-Agent': agant,
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
    });

    process.on('SIGTERM', logout);
    process.on('SIGINT',  logout);

    sock.emit('ROOM', room);
}

const argv = require('yargs')
    .usage('Usage: $0 [ server-url ]')
    .option('name',     { alias: 'n', default: '*ボット*'})
    .option('room',     { alias: 'r', demandOption: true })
    .option('verbose',  { alias: 'v', boolean: true })
    .argv;

const url = (argv._[0] || 'http://127.0.0.1:4615/server').replace(/\/$/,'');

login(url, argv.name, argv.room);
