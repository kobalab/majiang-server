/*
 *  room
 */
"use strict";

const USER = {};
const ROOM = {};

function DUMP_USER() {                                              // for DEBUG
    console.log(                                                    // for DEBUG
        Object.keys(USER).map(                                      // for DEBUG
            id => [ id,                                             // for DEBUG
                    USER[id].sock ? '+' : '-',                      // for DEBUG
                    USER[id].room || '',                            // for DEBUG
                    USER[id].user ]                                 // for DEBUG
        )                                                           // for DEBUG
    );                                                              // for DEBUG
}                                                                   // for DEBUG
                                                                    // for DEBUG
function connect(sock) {

    let session_id = sock.request.sessionID;
    let user       = sock.request.user;
    console.log('++ CONNECT:', session_id, user);                   // for DEBUG
    sock.onAny((...args)=> console.log(`** ${sock.id}`, args));     // for DEBUG

    if (! user) {
        sock.emit('HELLO', null);
        return;
    }

    let id = user.id ?? session_id;
    user.id     = id;
    sock.emit('HELLO', user);

    if (! USER[id]) {
        USER[id] = { user: user, sock: sock };
    }
    else if (USER[id].sock) {
        sock.emit('ERROR', '既に接続済みです');
        sock.disconnect(true);
        return;
    }
    else {
        USER[id].sock = sock;
        delete USER[id].user.offline;
        room_info(USER[id].room);
    }
    sock.on('disconnect', (reason)=> disconnect(sock));
    sock.on('ROOM', (no)=> room(sock, no));
    DUMP_USER();                                                    // for DEBUG
}

function disconnect(sock) {
    let session_id = sock.request.sessionID;
    let user       = sock.request.user;
    console.log('-- DISCONNECT:', session_id, user);                // for DEBUG
    if (user) {
        let id = user.id || session_id;
        let no = USER[id].room;
        if (no) {
            if (ROOM[no].user[0] == id || ROOM[no].game) {
                delete USER[id].sock;
                USER[id].user.offline = 1;
            }
            else {
                ROOM[no].user = ROOM[no].user.filter(uid=>uid != id);
                delete USER[id];
            }
            room_info(no);
        }
        else {
            delete USER[id];
        }
    }
    DUMP_USER();                                                    // for DEBUG
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
        sock.emit('ERROR', '既に入室済みです');
        return;
    }
    if (no) {
        if (ROOM[no]) {
            ROOM[no].user.push(id);
            USER[id].room = no;
            room_info(no);
        }
        else {
            sock.emit('ERROR', `ルーム No.${no} は存在しません`);
            return;
        }
    }
    else {
        no = room_no();
        ROOM[no] = { user: [ id ] };
        USER[id].room = no;
        room_info(no);
    }
    DUMP_USER();                                                    // for DEBUG
}

function room_info(no) {
    for (let id of ROOM[no].user) {
        let sock = USER[id].sock;
        if (! sock) continue;
        sock.emit('ROOM', {
            no:   no,
            user: ROOM[no].user.map(id=> USER[id].user)
        });
    }
}

module.exports = (io)=> io.on('connection', connect);
