/*
 *  room
 */
"use strict";

const Game = require('./game');

const USER = {};
const ROOM = {};

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
        delete USER[user.uid].user.offline;
        let room_no = USER[user.uid].room;
        send_room_info(room_no);
        if (ROOM[room_no].game) ROOM[room_no].game.connect(sock);
    }
    sock.on('disconnect', (reason)=> disconnect(sock));
    sock.on('ROOM', (room_no)=> room(sock, room_no));
}

function disconnect(sock) {

    let user = get_user(sock);

    if (user) {
        let room_no = USER[user.uid].room;
        if (room_no) {
            if (ROOM[room_no].uids[0] == user.uid || ROOM[room_no].game) {
                delete USER[user.uid].sock;
                USER[user.uid].user.offline = 1;
                if (ROOM[room_no].game) ROOM[room_no].game.disconnect(sock);
            }
            else {
                ROOM[room_no].uids
                    = ROOM[room_no].uids.filter(uid=>uid != user.uid);
                delete USER[user.uid];
            }
            send_room_info(room_no);
        }
        else {
            delete USER[user.uid];
        }
    }
}

function get_room_no() {
    const MAX = 260000;
    let n = (Math.random() * MAX) | 0;
    return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[(n / 10000) | 0]
                + ('0000' + (n % 10000)).substr(-4);
}

function room(sock, room_no) {

    let user = get_user(sock);

    if (ROOM[room_no] && ROOM[room_no].uids[0] == user.uid) {
        if (ROOM[room_no].game) return;
        const callback = (paipu)=>{
            for (let uid of ROOM[room_no].uids) {
                if (! USER[uid].sock) delete USER[uid];
                else                  delete USER[uid].room;
            }
            delete ROOM[room_no];
        };
        ROOM[room_no].game = new Game(get_socks(room_no), callback);
        ROOM[room_no].game.speed = 2;
        ROOM[room_no].game.kaiju();
        return;
    }

    if (USER[user.uid].room) {
        sock.emit('ERROR', '既に入室済みです');
        sock.disconnect(true);
        return;
    }
    if (room_no) {
        if (ROOM[room_no]) {
            if (ROOM[room_no].uids.length >= 4) {
                sock.emit('ERROR', '満室です');
                return;
            }
            ROOM[room_no].uids.push(user.uid);
            USER[user.uid].room = room_no;
            send_room_info(room_no);
        }
        else {
            sock.emit('ERROR', `ルーム ${room_no} は存在しません`);
            return;
        }
    }
    else {
        room_no = get_room_no();
        ROOM[room_no] = { uids: [ user.uid ] };
        USER[user.uid].room = room_no;
        send_room_info(room_no);
        for (let sock of Object.keys(USER).map(i=>USER[i].sock)) {  // for DEBUG
            if (sock) sock.emit('BOT', room_no);                    // for DEBUG
        }                                                           // for DEBUG
    }
}

function send_room_info(room_no) {
    if (! ROOM[room_no]) return;
    for (let uid of ROOM[room_no].uids) {
        let sock = USER[uid].sock;
        if (! sock) continue;
        sock.emit('ROOM', {
            room_no: room_no,
            user:    ROOM[room_no].uids.map(uid=> USER[uid].user)
        });
    }
}

module.exports = (io)=> io.on('connection', connect);
