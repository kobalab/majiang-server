/*
 *  Majiang.Server.Game
 */
"use strict";

const Majiang = require('@kobalab/majiang-core');

class View {
    constructor(game) { this._game = game }
    kaiju()   {}
    redraw()  {}
    update()  {}
    summary() {}
    say(name, l) {
        let msg = [];
        for (let id = 0; id < 4; id++) {
            msg[id] = { say: { l: l, name: name } };
        }
        this._game.notify_players('say', msg);
    }
}

module.exports = class Game extends Majiang.Game {

    constructor(socks, callback, rule, title) {

        rule = rule || Majiang.rule({'場数':0});
        super(socks, callback, rule, title);

        const name = this._model.player;

        this._model.title  = this._model.title.replace(/\n/, ': ネット対戦\n');
        this._model.player = socks.map(s=>s.request.user.name);
        this._uid          = socks.map(s=>s.request.user.id);
        this._seq = 0;
        socks.forEach(s=>this.connect(s));

        this._view = new View(this);

        for (let i = 0; i < 4; i++) {
            this._model.player[i] = this._model.player[i] ?? name[i];
        }
    }

    connect(sock) {
        let id = this._uid.indexOf(sock.request.user.id);
        this._players[id] = sock;
        sock.emit('START');
        sock.on('GAME', (reply)=>this.reply(id, reply));
    }

    disconnect(sock) {
        let id = this._uid.indexOf(sock.request.user.id);
        console.log(`** DISCONNECT: ${id}`);
        this._players[id] = null;
        if (! this._players.find(s=>s)) {
            this.stop(this._callback);
        }
        if (! this._reply[id]) {
            this.reply(id, { seq: this._seq });
        }
    }

    notify_players(type, msg) {

        for (let l = 0; l < 4; l++) {
            let id = this._model.player_id[l];
            if (this._players[id])
                    this._players[id].emit('GAME', msg[l]);
        }
    }

    call_players(type, msg, timeout) {

        timeout = this._speed == 0 ? 0
                : timeout == null  ? this._speed * 200
                :                    timeout;
        this._status = type;
        this._reply  = [];
        this._seq++;
        for (let l = 0; l < 4; l++) {
            let id = this._model.player_id[l];
            msg[l].seq = this._seq;
            if (this._players[id])
                    this._players[id].emit('GAME', msg[l]);
            else    this._reply[id] = {};
        }
        this._timeout_id = setTimeout(()=>this.next(), timeout);
    }

    reply(id, reply) {
        if (reply.seq != this._seq) return;
        this._reply[id] = reply;
        if (this._status == 'jieju') this._players[id].emit('END', this._paipu);
        if (this._reply.filter(x=>x).length < 4) return;
        if (! this._timeout_id)
                this._timeout_id = setTimeout(()=>this.next(), 0);
    }
}
