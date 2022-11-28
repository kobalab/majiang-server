/*
 *  room
 */
"use strict";

const USER = {};

function connect(sock) {

    let session_id = sock.request.sessionID;
    let user       = sock.request.user;
    console.log('++ CONNECT:', session_id, user);
    sock.onAny((...args)=> console.log(`** ${sock.id}`, args));     // for DEBUG

    if (! user) {
        sock.emit('HELLO', null);
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
    }
    sock.emit('HELLO', user);
    sock.on('disconnect', (reason)=> disconnect(sock))
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

module.exports = (io)=> io.on('connection', connect);
