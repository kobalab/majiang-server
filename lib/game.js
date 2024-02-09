/*
 *  Majiang.Server.Game
 */
"use strict";

const Majiang = require('@kobalab/majiang-core');

module.exports = class Game extends Majiang.Game {

    constructor(socks, callback, rule, title) {

        rule = rule || Majiang.rule({'場数':1});
        super(socks, callback, rule, title);

        this._model.title  = this._model.title.replace(/\n/, ': ネット対戦\n');
        this._model.player = socks.map(s=>s ? s.request.user.name : '(NOP)');
        this._uid          = socks.map(s=>s ? s.request.user.uid : null);
        this._seq = 0;
        socks.forEach(s=>this.connect(s));
    }

    connect(sock) {
        if (! sock) return;
        let id = this._uid.indexOf(sock.request.user.uid);
        this._players[id] = sock;
        sock.emit('START');
        if (this._seq) {
            let msg = { kaiju: {
                id: id,
                rule:   this._rule,
                title:  this._model.title,
                player: this._model.player,
                qijia:  this._model.qijia,
                log:    this._paipu.log
            } };
            sock.emit('GAME', msg);
        }
        sock.removeAllListeners('GAME');
        sock.on('GAME', (reply)=>this.reply(id, reply));
    }

    disconnect(sock) {
        if (! sock) return;
        let id = this._uid.indexOf(sock.request.user.uid);
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

    say(name, l) {
        let msg = [];
        for (let id = 0; id < 4; id++) {
            msg[id] = { say: { l: l, name: name } };
        }
        this.notify_players('say', msg);
    }
}
