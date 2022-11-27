/*
 *  room
 */
"use strict";

module.exports = (io)=>{

    io.on('connection', (sock)=>{
        console.log(sock.request.sessionID, sock.request.user);
        sock.emit('HELLO', sock.request.user);
        sock.onAny((...args)=> console.log(`** ${sock.id}`, args));
    });
}
