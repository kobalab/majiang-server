#!/usr/bin/env node

"use strict";

const { version } = require('../package.json');
const agent = 'mjai-bridge/' + version.replace(/^(\d+\.\d+).*$/,'$1');

const net       = require('net');
const io        = require('socket.io-client');
const readline = require('readline');
const { execFile } = require('child_process');
const util     = require('util');

const converter = require('@kobalab/mjai-bot/convert');

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

    let queue = Promise.resolve();

    sock.on('GAME', (msg)=>{
        queue = queue.then(()=> convert(msg));
    });

    function recv() {
        return new Promise(resolve =>{
            line.once('line',  (res)=>{
                res = JSON.parse(res);
                if (argv.verbose) console.log('->', util.inspect(res,
                                            { depth: null,
                                              colors: process.stdout.isTTY }));
                resolve(res);
            });
        });
    }

    function send(req) {
        if (argv.verbose) console.log('<-', util.inspect(req,
                                            { depth: null,
                                              colors: process.stdout.isTTY }));
        bot.write(JSON.stringify(req) + '\n');
    }

    line.on('close', ()=>{
        console.log(`${bot_name}: disconnected.`);
        logout();
    });

    let convrep = converter.convrep();
    let convmsg = converter.convmsg();

    let lizhi;

    async function convert(msg) {

        if (msg.qipai) {
            convrep = converter.convrep();
            lizhi = null;
        }

        let req = convmsg(msg);
        if (! req) return;

        if (msg.dapai && msg.dapai.p.slice(-1) == '*' && lizhi == null) {
            lizhi = req.actor;
            send({ type: 'reach', actor: req.actor });
            await recv();
        }
        else if (lizhi != null && (msg.zimo || msg.fulou)) {
            let deltas = [], scores = [];
            for (let id = 0; id < 4; id++) {
                deltas[id] = id == lizhi ? -1000 : 0;
                scores[id] = convmsg().defen[id];
            }
            send({ type: 'reach_accepted', actor: lizhi,
                   deltas: deltas, scores: scores });
            await recv();
            lizhi = null;
        }

        send(req);

        if (msg.jieju) {
            line.removeAllListeners('close');
            let reply = {};
            reply.seq = msg.seq;
            sock.emit('GAME', reply);
            return;
        }

        let reply = convrep(await recv());

        if (reply.mjai && reply.mjai.type == 'reach') {
            lizhi = reply.mjai.actor;
            send(reply.mjai);
            reply = convrep(await recv());
        }

        if (msg.seq) {
            reply.seq = msg.seq;
            sock.emit('GAME', reply);
        }

        if (msg.hule || msg.pingju) {
            send({ type: 'end_kyoku' });
            await recv();
        }
    }

    sock.emit('ROOM', room);
}

function exec_bot() {

    const bridge = net.createServer((sock)=>{

        const line = readline.createInterface(sock);

        let reply = { type: 'hello', protocol: 'mjsonp', protocol_version: 1 };
        if (argv.verbose) console.log('<-', util.inspect(reply,
                                            { depth: null,
                                              colors: process.stdout.isTTY }));
        sock.write(JSON.stringify(reply) + '\n');

        line.once('line', (data)=>{
            let msg = JSON.parse(data.toString('utf-8'));
            if (argv.verbose) console.log('->', util.inspect(msg,
                                            { depth: null,
                                              colors: process.stdout.isTTY }));

            if (msg.type == 'join') connect(sock, line);
        });
        line.on('error', (err)=>{
            logout();
        });
    }).listen(()=>{

        const port = bridge.address().port;

        if (argv.noexec) {
            console.log([bot_name, `mjsonp://127.0.0.1:${port}/${room}`,
                        ...bot_param].join(' '));
            return;
        }

        execFile(bot_name, [`mjsonp://127.0.0.1:${port}/${room}`, ...bot_param],
                    { shell: argv.shell }
        ).on('error', (err)=>{
            console.error(err.toString());
            logout();
        }).on('exit', ()=>{
            logout();
        }).stderr.pipe(process.stderr);
    });
}

const argv = require('yargs')
    .usage('Usage: $0 -r room server-url mjai-bot [ -- bot-params... ]')
    .parserConfiguration({ 'populate--': true })
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
const bot_param = argv['--']||[];

login();
