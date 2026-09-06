#!/usr/bin/env node

"use strict";

const { version } = require('../package.json');
const agent = 'mjai-proxy/' + version.replace(/^(\d+\.\d+).*$/,'$1');

const net       = require('net');
const io        = require('socket.io-client');
const readline = require('readline');
const { execFile } = require('child_process');

const convmsg = require('../lib/convmsg')();
const converter = require('../lib/convreply');

let cookie;

function login() {

    fetch(url + '/auth/', {
        method:   'POST',
        headers:  { 'User-Agent': agent },
        body:     new URLSearchParams({ name: name, passwd: '*'}),
        redirect: 'manual'
    }).then(res=>{
        for (let c of res.headers.getSetCookie()) {
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

function connect(bot, line) {

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

    function recv() {
        return new Promise(resolve =>{
            line.once('line',  (res)=>{
                res = JSON.parse(res);
                if (argv.verbose) console.log('->', res);
                resolve(res);
            });
        });
    }

    function send(req) {
        if (argv.verbose) console.log('<-', req);
        bot.write(JSON.stringify(req) + '\n');
    }

    let convreply = converter();
    let lizhi;

    sock.on('GAME', async (msg)=>{
        if (msg.qipai) {
            convreply = converter();
        }
        let req = convmsg(msg);
        if (! req) return;
        if (msg.dapai && msg.dapai.p.slice(-1) == '*' && ! lizhi) {
            send({ type: 'reach', actor: req.actor });
            await recv();
            lizhi = true;
        }
        else if (lizhi) {
            send({ type: 'reach_accepted' });
            await recv();
            lizhi = false;
        }

        send(req);

        if (msg.jieju) {
            let reply = {};
            reply.seq = msg.seq;
            sock.emit('GAME', reply);
            return;
        }

        let reply = convreply(await recv());
        if (reply.mjai && reply.mjai.type == 'reach') {
            send(reply.mjai);
            reply = convreply(await recv());
            lizhi = true;
        }
        reply.seq = msg.seq;
        sock.emit('GAME', reply);

        if (msg.hule || msg.pingju) {
            send({ type: 'end_kyoku' });
            await recv();
        }
    });

    sock.emit('ROOM', room);
}

function exec_bot() {

    const proxy = net.createServer((sock)=>{

        const line = readline.createInterface(sock);

        let reply = { type: 'hello', protocol: 'mjsonp', protocol_version: 1 };
        if (argv.verbose) console.log('<-', reply);
        sock.write(JSON.stringify(reply) + '\n');

        line.once('line', (data)=>{
            let msg = JSON.parse(data.toString('utf-8'));
            if (argv.verbose) console.log('->', msg);

            if (msg.type == 'join') connect(sock, line);
        });
        line.on('error', (err)=>{
            logout();
        });
    }).listen(()=>{

        const port = proxy.address().port;

        if (argv.noexec) {
            console.log(`${bot_name} mjsonp://127.0.0.1:${port}/${room}`);
            return;
        }

        execFile(bot_name, [`mjsonp://127.0.0.1:${port}/${room}`],
                        { shell: argv.shell }
            ).on('error', (err)=>{
                console.error(err.toString());
                logout();
            });
    });
}

const argv = require('yargs')
    .usage('Usage: $0 server-url mjai-bot -- [ bot-params... ]')
    .option('name',     { alias: 'n', default: 'Mjaiボット'})
    .option('room',     { alias: 'r', type: 'string', demandOption: true })
    .option('verbose',  { alias: 'v', boolean: true })
    .option('shell',    { alias: 'S', boolean: true })
    .option('noexec',   { alias: 'X', boolean: true })
    .demandCommand(2)
    .argv;

const name = argv.name;
const room = argv.room || '-';

const url  = argv._[0] == '-' ? 'http://127.0.0.1:4615/server'
                              : ('' + argv._[0]).replace(/\/$/,'');
const bot_name = argv._[1];

login();
