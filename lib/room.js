/*
 *  room
 */
"use strict";

const Game = require('./server/game');

const USER = {};
const ROOM = {};

function DUMP_USER() {                                              // for DEBUG
    console.log(                                                    // for DEBUG
        Object.keys(USER).map(                                      // for DEBUG
            id => [ id,                                             // for DEBUG
                    USER[id].sock ? '+' : '-',                      // for DEBUG
                    USER[id].room || '',                            // for DEBUG
                    USER[id].user.name ]                            // for DEBUG
        )                                                           // for DEBUG
    );                                                              // for DEBUG
}                                                                   // for DEBUG
                                                                    // for DEBUG
function get_user(sock) {

    let session_id = sock.request.sessionID;
    let user       = sock.request.user;

    if (! user) return;

    user.id = user.id ?? sock.request.sessionID;
    return user;
}

function get_socks(no) {
    let ids = [];
    for (let i = 0; i < 4; i++) {
        ids[i] = ROOM[no].user[i];
    }
    let socks = [];
    while (socks.length < 4) {
        let id = ids.splice(Math.random()*ids.length, 1)[0];
        socks.push(id ? USER[id].sock : null);
    }
    return socks;
}

function connect(sock) {

    let user = get_user(sock);
    console.log('++ CONNECT:', user);                               // for DEBUG
//  sock.onAny((...args)=> console.log(`** ${sock.id}`, args));     // for DEBUG

    sock.emit('HELLO', user);

    if (! user) {
        sock.disconnect(true);
        return;
    }

    if (! USER[user.id]) {
        USER[user.id] = { user: user, sock: sock };
    }
    else if (USER[user.id].sock) {
        sock.emit('ERROR', '既に接続済みです');
        sock.disconnect(true);
        return;
    }
    else {
        USER[user.id].sock = sock;
        delete USER[user.id].user.offline;
        let no = USER[user.id].room;
        room_info(no);
        if (ROOM[no].game) ROOM[no].game.connect(sock);
    }
    sock.on('disconnect', (reason)=> disconnect(sock));
    sock.on('ROOM', (no)=> room(sock, no));
    DUMP_USER();                                                    // for DEBUG
}

function disconnect(sock) {

    let user = get_user(sock);
    console.log('-- DISCONNECT:', user);                            // for DEBUG

    if (user) {
        let no = USER[user.id].room;
        if (no) {
            if (ROOM[no].user[0] == user.id || ROOM[no].game) {
                delete USER[user.id].sock;
                USER[user.id].user.offline = 1;
                if (ROOM[no].game) ROOM[no].game.disconnect(sock);
            }
            else {
                ROOM[no].user = ROOM[no].user.filter(uid=>uid != user.id);
                delete USER[user.id];
            }
            room_info(no);
        }
        else {
            delete USER[user.id];
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

    let user = get_user(sock);

    if (ROOM[no] && ROOM[no].user[0] == user.id) {
        if (ROOM[no].game) return;
        console.log(`**** START: ${no}`);
        const callback = (paipu)=>{
            console.log(`**** END: ${no}`);
            for (let id of ROOM[no].user) {
                if (! USER[id].sock) delete USER[id];
                else                 delete USER[id].room;
            }
            delete ROOM[no];
            DUMP_USER();                                            // for DEBUG
        };
        ROOM[no].game = new Game(get_socks(no), callback);
        ROOM[no].game.speed = 2;
        ROOM[no].game.kaiju();
        return;
    }

    if (USER[user.id].room) {
        sock.emit('ERROR', '既に入室済みです');
        sock.disconnect(true);
        return;
    }
    if (no) {
        if (ROOM[no]) {
            if (ROOM[no].user.length >= 4) {
                sock.emit('ERROR', '満室です');
                return;
            }
            ROOM[no].user.push(user.id);
            USER[user.id].room = no;
            room_info(no);
        }
        else {
            sock.emit('ERROR', `ルーム No.${no} は存在しません`);
            return;
        }
    }
    else {
        no = room_no();
        ROOM[no] = { user: [ user.id ] };
        USER[user.id].room = no;
        room_info(no);
    }
    DUMP_USER();                                                    // for DEBUG
}

function room_info(no) {
    if (! ROOM[no]) return;
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
