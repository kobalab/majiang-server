/*
 *  room
 */
"use strict";

const Game = require('./game');

let DEBUG;

const USER = {};
const ROOM = {};

function debug_log(...args) { if (DEBUG) console.log(...args) }

function status_log() {
    let conn = Object.keys(USER).filter(uid => USER[uid].sock).length;
    let room = 0, game = 0;
    for (let room_no of Object.keys(ROOM)) {
        if (ROOM[room_no].game)
            game += ROOM[room_no].uids.filter(uid => USER[uid].sock).length;
        else
            room += ROOM[room_no].uids.filter(uid => USER[uid].sock).length;
    }
    console.log(`** 接続: ${conn} / 待機: ${room} / 対局: ${game}`);
}

function get_user(sock) {

    let session_id = sock.request.sessionID;
    let user       = sock.request.user;

    if (! user) return;

    user.uid = user.uid ?? session_id;
    return user;
}

function get_socks(room_no) {
    let uids = [];
    for (let i = 0; i < 4; i++) {
        uids[i] = ROOM[room_no].uids[i];
    }
    let socks = [];
    while (socks.length < 4) {
        let uid = uids.splice(Math.random()*uids.length, 1)[0];
        socks.push(uid ? USER[uid].sock : null);
    }
    return socks;
}

function connect(sock) {

    let user = get_user(sock);

    sock.emit('HELLO', user);

    if (! user) {
        sock.disconnect(true);
        return;
    }
    debug_log(`++ connect: ${user.name}`);

    if (! USER[user.uid]) {
        USER[user.uid] = { user: user, sock: sock };
    }
    else if (USER[user.uid].sock) {
        sock.emit('ERROR', '既に接続済みです');
        sock.disconnect(true);
        return;
    }
    else {
        USER[user.uid].sock = sock;
        let room_no = USER[user.uid].room_no;
        if (ROOM[room_no].game) ROOM[room_no].game.connect(sock);
        else                    send_room_info(room_no);
        sock.on('START', (room_no, rule, timer)=>
                                start(sock, room_no, rule, timer));
    }
    sock.on('disconnect', (reason)=> disconnect(sock));
    sock.on('ROOM', (room_no, uid)=> room(sock, room_no, uid));
    debug_log('USER:', Object.keys(USER).map(
                uid => (USER[uid].sock ? '+ ' : '- ') + USER[uid].user.name));
    status_log();
}

function disconnect(sock) {

    let user = get_user(sock);

    if (user) {
        debug_log(`-- disconnect: ${user.name}`);
        let room_no = USER[user.uid].room_no;
        if (room_no) {
            delete USER[user.uid].sock;
            if (ROOM[room_no].game) {
                ROOM[room_no].game.disconnect(sock);
            }
            else if (ROOM[room_no].uids[0] != user.uid) {
                ROOM[room_no].uids
                        = ROOM[room_no].uids.filter(uid => uid != user.uid);
                delete USER[user.uid];
                send_room_info(room_no);
            }
        }
        else {
            delete USER[user.uid];
        }
        debug_log('USER:', Object.keys(USER).map(
                uid => (USER[uid].sock ? '+ ' : '- ') + USER[uid].user.name));
        status_log();
    }
}

function get_room_no() {
    const MAX = 260000;
    for (;;) {
        let n = (Math.random() * MAX) | 0;
        let room_no = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[(n / 10000) | 0]
                        + ('0000' + (n % 10000)).slice(-4);
        if (! ROOM[room_no]) return room_no;
    }
}

function room(sock, room_no, uid) {

    let user = get_user(sock);
    if (! user) return;

    if (uid) {
        if (! ROOM[room_no]) return;
        if (uid == user.uid && ROOM[room_no].uids[0] == user.uid) {
            for (let uid of ROOM[room_no].uids) {
                if (USER[uid].room_no == room_no) {
                    delete USER[uid].room_no;
                    if (USER[uid].sock)
                            USER[uid].sock.emit('HELLO', USER[uid].user);
                    else    delete USER[uid];
                }
            }
            delete ROOM[room_no];
            debug_log('ROOM:', Object.keys(ROOM).map(
                        room_no => (ROOM[room_no].game ? '* ' : '') + room_no));
        }
        else if (uid == user.uid || ROOM[room_no].uids[0] == user.uid) {
            if (USER[uid].room_no == room_no) {
                ROOM[room_no].uids = ROOM[room_no].uids.filter(u => u != uid);
                delete USER[uid].room_no;
                if (USER[uid].sock)
                        USER[uid].sock.emit('HELLO', USER[uid].user);
                else    delete USER[uid];
                send_room_info(room_no);
            }
        }
    }
    else if (USER[user.uid].room_no) {
        sock.emit('ERROR', '既に入室済みです');
        sock.disconnect(true);
    }
    else if (room_no) {
        if (ROOM[room_no]) {
            if (ROOM[room_no].uids.length >= 4) {
                sock.emit('ERROR', '満室です');
                return;
            }
            ROOM[room_no].uids.push(user.uid);
            USER[user.uid].room_no = room_no;
            send_room_info(room_no);
        }
        else {
            sock.emit('ERROR', `ルーム ${room_no} は存在しません`);
        }
    }
    else {
        room_no = get_room_no();
        ROOM[room_no] = { uids: [ user.uid ] };
        USER[user.uid].room_no = room_no;
        debug_log('ROOM:', Object.keys(ROOM).map(
                    room_no => (ROOM[room_no].game ? '* ' : '') + room_no));
        send_room_info(room_no);
        sock.on('START', (room_no, rule, timer)=>
                                start(sock, room_no, rule, timer));
    }
    status_log();
}

function send_room_info(room_no) {
    if (! ROOM[room_no]) return;
    for (let uid of ROOM[room_no].uids) {
        let sock = USER[uid].sock;
        if (! sock) continue;
        sock.emit('ROOM', {
            room_no: room_no,
            user:    ROOM[room_no].uids.map(
                        uid=> Object.assign(
                                    USER[uid].user,
                                    { offline: USER[uid].sock == null }))
        });
    }
    debug_log(room_no, ROOM[room_no].uids.map(
                uid => (USER[uid].sock ? '+ ' : '- ') + USER[uid].user.name));
}

function start(sock, room_no, rule, timer) {

    let user = get_user(sock);

    if (ROOM[room_no] && ROOM[room_no].uids[0] == user.uid) {
        if (ROOM[room_no].game) return;
        const callback = (paipu)=>{
            for (let uid of ROOM[room_no].uids) {
                if (! USER[uid].sock) delete USER[uid];
                else                  delete USER[uid].room_no;
            }
            delete ROOM[room_no];
            debug_log('<< end:', room_no);
            debug_log('ROOM:', Object.keys(ROOM).map(
                    room_no => (ROOM[room_no].game ? '* ' : '') + room_no));
            status_log();
        };
        ROOM[room_no].game
                = new Game(get_socks(room_no), callback, rule, null, timer);
        ROOM[room_no].game.speed = 2;
        ROOM[room_no].game.kaiju();
        debug_log('>> start:', room_no);
        debug_log('ROOM:', Object.keys(ROOM).map(
                    room_no => (ROOM[room_no].game ? '* ' : '') + room_no));
        status_log();
    }
}

module.exports = (io, debug)=> {
    DEBUG = debug;
    io.on('connection', connect);
}
