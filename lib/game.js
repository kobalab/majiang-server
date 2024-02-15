/*
 *  game
 */
"use strict";

const Majiang = require('@kobalab/majiang-core');

function get_timer(type, limit, allowed = 0, wait) {
    if (type == 'jieju')                        return;
    if (type.match(/^(kaiju|hule|pingju)$/))    return  wait ? [ wait ] : null;
    if (type.match(/^(zimo|gangzimo|fulou)$/))  return [ limit, allowed ];
    else                                        return [ limit ]
}

module.exports = class Game extends Majiang.Game {

    constructor(socks, callback, rule, title) {

        super(socks, callback, rule, title);

        this._model.title  = this._model.title.replace(/\n/, ': ネット対戦\n');
        this._model.player = socks.map(s=>s ? s.request.user.name : '(NOP)');
        this._uid          = socks.map(s=>s ? s.request.user.uid : null);
        this._seq = 0;
        this._timer = [ 5, 10, 10 ];
        this._time_allowed = [];
        this._time_limit   = [];
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
        let msg = { players: this._players.map(s => s != null) };
        this.notify_players('players', [ msg, msg, msg, msg ]);
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
        let msg = { players: this._players.map(s => s != null) };
        this.notify_players('players', [ msg, msg, msg, msg ]);
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
            if (this._timer) {
                msg[l].timer = get_timer(type, this._timer[0],
                                               this._time_allowed[id],
                                               this._timer[2]);
                this._time_limit[id] = msg[l].timer
                    ? Date.now() + msg[l].timer.reduce((x, y) => x + y) * 1000
                                 + 200
                    : null;
            }
            if (this._players[id])
                    this._players[id].emit('GAME', msg[l]);
            else    this._reply[id] = {};
        }
        if (type == 'jieju') {
            this._callback(this._paipu);
            return;
        }
        this._timeout_id = setTimeout(()=>this.next(), timeout);
    }

    reply(id, reply) {
        if (reply.seq != this._seq) return;
        if (this._time_limit[id]) {
            let allowed = (this._time_limit[id] - Date.now()) / 1000;
            if (allowed < 0) this._reply[id] = {};
            if (this._status.match(/^(zimo|gangzimo|fulou)$/)) {
                this._time_allowed[id]
                        = Math.ceil(Math.min(Math.max(allowed, 0),
                                             this._time_allowed[id]));
            }
        }
        this._reply[id] = reply;
        if (this._status == 'jieju') {
            if (this._players[id]) this._players[id].emit('END', this._paipu);
            return;
        }
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

    qipai(shan) {
        if (this._timer)
                this._time_allowed = [ this._timer[1], this._timer[1],
                                       this._timer[1], this._timer[1] ];
        super.qipai(shan);
    }
}
