/*
 *  room
 */
"use strict";

const USER = {};
const ROOM = {};

function connect(sock) {

    let session_id = sock.request.sessionID;
    let user       = sock.request.user;
    console.log('++ CONNECT:', session_id, user);
    sock.onAny((...args)=> console.log(`** ${sock.id}`, args));     // for DEBUG

    sock.emit('HELLO', user);

    if (! user) {
        return;
    }

    let id = user.id || session_id;
    if (! USER[id]) {
        USER[id] = { sock: sock.id };
    }
    else if (USER[id].sock) {
        sock.emit('ERROR', '既に接続済みです');
        sock.disconnect(true);
        return;
    }
    else {
        USER[id].sock = sock.id;
        room_info(sock, USER[id].room);
        console.log(ROOM);
    }
    sock.on('disconnect', (reason)=> disconnect(sock));
    sock.on('ROOM', (no)=> room(sock, no));
    console.log(USER);
}

function disconnect(sock) {
    let session_id = sock.request.sessionID;
    let user       = sock.request.user;
    console.log('-- DISCONNECT:', session_id, user);
    if (user) {
        let id = user.id || session_id;
        if (USER[id].room) delete USER[id].sock;
        else               delete USER[id];
        console.log(USER);
    }
}

function room_no() {
    const MAX = 260000;
    let n = (Math.random() * MAX) | 0;
    return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[(n / 10000) | 0]
                + ('0000' + (n % 10000)).substr(-4);
}

function room(sock, no) {
    let session_id = sock.request.sessionID;
    let user       = sock.request.user;
    let id         = user.id || session_id;
    if (USER[id].room) {
        sock.emit('ERROR', '既に入室済みです')
        return;
    }
    if (no) {
        if (ROOM[no]) {
            ROOM[no].push(sock);
            room_info(sock, no);
        }
        else {
            sock.emit('ERROR', `ルーム No.${no} は存在しません`)
            return;
        }
    }
    else {
        no = room_no();
        ROOM[no] = [ sock ];
        USER[id].room = no;
        room_info(sock, no);
    }
    console.log(ROOM);
}

function room_info(sock, no) {
    sock.emit('ROOM', {
        no:   no,
        user: ROOM[no].map(s=> s.request.user)
    });
}

module.exports = (io)=> io.on('connection', connect);
