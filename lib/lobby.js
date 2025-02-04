/*
 *  lobby
 */
"use strict";

const { version } = require('../package.json');
const Game = require('./game');

function get_user(sock) {

    let session_id = sock.request.sessionID;
    let user       = sock.request.user;

    if (! user) return;

    user.uid = user.uid ?? session_id;
    return user;
}

const style
    = '<style>\n'
    + 'html { font-size: 14px; }\n'
    + 'li.user { display: inline-block; width: 11em; white-space: nowrap;'
        + ' overflow: hidden; text-overflow: ellipsis; }\n'
    + 'img { width: 2em; vertical-align: middle; border-radius: 50%; }\n'
    + '.offline { opacity: 0.5; }\n'
    + '.version { text-align: right; margin-top: -3em; }\n'
    + 'pre { font-size: 100%; }\n'
    + '</style>\n'

function print_user(USER) {
    return function(uid) {
        let icon  = USER[uid].user.icon || '../img/icon.png';
        let name  = USER[uid].user.name;
        let title = USER[uid].user.icon ? uid : '';
        return (USER[uid].sock ? '<span>' : '<span class="offline">')
            + `<img src="${icon}" title="${title}"> ${name}</span>`;
    }
}

function print_room(USER, ROOM) {
    const user = print_user(USER);
    return function(room_no) {
        if (room_no) {
            return `ルーム: ${room_no}`
                    + (ROOM[room_no].game ? ' (対局中)' : '')
                + '\n<ul>'
                + ROOM[room_no].uids
                    .map(uid => `<li class="user">${user(uid)}</li>`)
                    .join('\n')
                + '</ul>\n';
        }
        else {
            return '(接続中)\n<ul>'
                + Object.keys(USER).filter(uid => ! USER[uid].room_no)
                    .map(uid => `<li class="user">${user(uid)}</li>`)
                    .join('\n')
                + '</ul>\n';
        }
    }
}

class Lobby {

    constructor(io) {

        this.USER = {};
        this.ROOM = {};
        this._start_date = new Date();

        io.on('connection', (sock)=> this.connect(sock));
    }

    connect(sock) {

        try {
            let user = get_user(sock);

            sock.emit('HELLO', user);

            if (! user) {
                sock.disconnect(true);
                return;
            }

            if (! this.USER[user.uid]) {
                this.USER[user.uid] = { user: user, sock: sock };
            }
            else if (this.USER[user.uid].sock) {
                sock.emit('ERROR', '既に接続済みです');
                sock.disconnect(true);
                return;
            }
            else {
                this.USER[user.uid].sock = sock;
                let room_no = this.USER[user.uid].room_no;
                if (this.ROOM[room_no].game)
                        this.ROOM[room_no].game.connect(sock);
                else    this.send_room_info(room_no);
            }

            sock.on('disconnect', (reason)=> this.disconnect(sock));
            sock.on('ROOM', (room_no, uid)=> this.room(sock, room_no, uid));
            sock.on('START', (room_no, rule, timer)=>
                                    this.start(sock, room_no, rule, timer));
            this.status_log();
        }
        catch (e) { console.error(e.stack); console.log(this.dump()) }
    }

    disconnect(sock) {

        try {
            let user = get_user(sock);

            delete this.USER[user.uid].sock;

            let room_no = this.USER[user.uid].room_no;
            if (room_no) {
                if (this.ROOM[room_no].game) {
                    this.ROOM[room_no].game.disconnect(sock);
                }
                else {
                    if (this.ROOM[room_no].uids[0] != user.uid) {
                        this.ROOM[room_no].uids = this.ROOM[room_no].uids
                                                .filter(uid => uid != user.uid);
                        delete this.USER[user.uid];
                    }
                    this.send_room_info(room_no);
                }
            }
            else {
                delete this.USER[user.uid];
            }
            this.status_log();
        }
        catch (e) { console.error(e.stack); console.log(this.dump()) }
    }

    room(sock, room_no, uid) {

        try {
            if (! room_no)  this.create_room(sock);
            else if (! uid) this.enter_room(sock, room_no);
            else            this.leave_room(sock, room_no, uid);
        }
        catch (e) { console.error(e.stack); console.log(this.dump()) }
    }

    create_room(sock) {

        let user = get_user(sock);

        let room_no;
        const CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ', NUM = 10000;
        do {
            let n = (Math.random() * CODE.length * NUM) | 0;
            room_no = CODE[(n / NUM) | 0] + ('' + NUM + (n % NUM)).slice(-4);
        } while(this.ROOM[room_no]);
        this.ROOM[room_no] = { uids: [ user.uid ] };
        this.USER[user.uid].room_no = room_no;
        this.send_room_info(room_no);
        this.status_log();
    }

    enter_room(sock, room_no) {

        let user = get_user(sock);

        if (this.USER[user.uid].room_no) return;

        if (! this.ROOM[room_no]) {
            sock.emit('ERROR', `ルーム ${room_no} は存在しません`);
        }
        else if (this.ROOM[room_no].game) {
            sock.emit('ERROR', '既に対局中です');
        }
        else if (this.ROOM[room_no].uids.length >= 4) {
            sock.emit('ERROR', '満室です');
        }
        else {
            this.ROOM[room_no].uids.push(user.uid);
            this.USER[user.uid].room_no = room_no;

            this.send_room_info(room_no);
            this.status_log();
        }
    }

    leave_room(sock, room_no, uid) {

        let user = get_user(sock);

        if (! this.USER[uid] || ! this.ROOM[room_no]) return;
        if (this.USER[uid].room_no != room_no) return;
        if (this.ROOM[room_no].game) return;

        if (uid == user.uid && this.ROOM[room_no].uids[0] == user.uid) {
            for (let uid of this.ROOM[room_no].uids) {
                delete this.USER[uid].room_no;
                this.USER[uid].sock.emit('HELLO', this.USER[uid].user);
            }
            delete this.ROOM[room_no];
        }
        else if (uid == user.uid || this.ROOM[room_no].uids[0] == user.uid) {
            this.ROOM[room_no].uids
                    = this.ROOM[room_no].uids.filter(u => u != uid);
            delete this.USER[uid].room_no;
            this.USER[uid].sock.emit('HELLO', this.USER[uid].user);
            this.send_room_info(room_no);
        }
        this.status_log();
    }

    send_room_info(room_no) {

        for (let uid of this.ROOM[room_no].uids) {
            let sock = this.USER[uid].sock;
            if (! sock) continue;
            sock.emit('ROOM', {
                room_no: room_no,
                user:    this.ROOM[room_no].uids.map(uid =>
                            Object.assign({}, this.USER[uid].user,
                                        { offline: ! this.USER[uid].sock }))
            });
        }
    }

    get_socks(room_no) {
        let uids = [];
        for (let i = 0; i < 4; i++) {
            uids[i] = this.ROOM[room_no].uids[i];
        }
        let socks = [];
        while (socks.length < 4) {
            let uid = uids.splice(Math.random()*uids.length, 1)[0];
            socks.push(uid ? this.USER[uid].sock : null);
        }
        return socks;
    }

    start(sock, room_no, rule, timer) {

        try {
            let user = get_user(sock);

            if (! this.ROOM[room_no]) return;
            if (user.uid != this.ROOM[room_no].uids[0]) return;
            if (this.ROOM[room_no].game) return;

            const callback = (paipu)=>{
                if (! this.ROOM[room_no]) return;
                for (let uid of this.ROOM[room_no].uids) {
                    if (! this.USER[uid].sock) delete this.USER[uid];
                    else                       delete this.USER[uid].room_no;
                }
                delete this.ROOM[room_no];
                this.status_log();
            };
            this.ROOM[room_no].game
                    = new Game(this.get_socks(room_no), callback,
                                rule, null, timer);
            this.ROOM[room_no].game.speed = 2;
            this.ROOM[room_no].game.kaiju();
            this.status_log();
        }
        catch (e) { console.error(e.stack); console.log(this.dump()) }
    }

    short_status() {
        let conn = Object.keys(this.USER)
                            .filter(uid => this.USER[uid].sock).length;
        let room = 0, game = 0;
        for (let room_no of Object.keys(this.ROOM)) {
            if (this.ROOM[room_no].game)
                game += this.ROOM[room_no].uids
                            .filter(uid => this.USER[uid].sock).length;
            else
                room += this.ROOM[room_no].uids
                            .filter(uid => this.USER[uid].sock).length;
        }
        return `接続: ${conn} / 待機: ${room} / 対局: ${game}`;
    }

    status_log() {
        console.log('**', this.short_status());
    }

    status(refresh, all, debug) {

        function datestr(date) {
            return date.toLocaleString('sv');
        }
        function timestr(time) {
            let day  = (time / (24*60*60*1000))|0;
            time = new Date(time).toLocaleTimeString('sv', { timeZone: 'UTC'});
            return day == 0 ? `${time}`
                 : day <  7 ? `${day}日 ${time}`
                 :            `${day}日`;
        }

        try {
            const title = 'majiang-server status';
            const room = print_room(this.USER, this.ROOM);

            let html = `<title>${title}</title>\n`
                     + style;
            if (refresh)
                html += `<meta http-equiv="refresh" content="${refresh}">\n`;
            html += `<h1>${title}</h1>\n`;
            html += `<div class="version">ver.${version}</div>\n`;

            let now = new Date();
            html += `<p>現在: ${datestr(now)} / `
                    + `起動: ${datestr(this._start_date)} / `
                    + `稼働: ${timestr(now - this._start_date)}</p>\n`;

            if (debug != null) return html + `<pre>${this.dump()}</pre>`;

            html += `<ul><li>${this.short_status()}</li></ul>\n`;

            html += '<ul>\n';
            for (let room_no of Object.keys(this.ROOM)
                                        .filter(r => this.ROOM[r].game))
            {
                html += `<li>${room(room_no)}</li>\n`;
            }
            for (let room_no of Object.keys(this.ROOM)
                                        .filter(r => ! this.ROOM[r].game))
            {
                if (all || this.ROOM[room_no].uids
                                .filter(uid => this.USER[uid].sock).length)
                {
                    html += `<li>${room(room_no)}</li>\n`;
                }
            }
            html += `<li>${room()}</li>\n`;
            html += '</ul>\n';

            return html;
        }
        catch (e) { console.error(e.stack) }
    }

    dump() {
        let dump = '== ROOM ==\n';
        for (let room_no of Object.keys(this.ROOM)) {
            dump += (this.ROOM[room_no].game ? ' * ' : ' - ') + room_no
                  + ` [ ${this.ROOM[room_no].uids.map(uid=>uid.slice(-12))
                            .join(', ')} ]\n`;
        }
        dump += '-- USER --\n';
        for (let uid of Object.keys(this.USER)) {
            dump += (this.USER[uid].sock ? ' * ' : ' - ') + uid.slice(-12)
                  + ` ${this.USER[uid].user.name}`
                  + ` ${this.USER[uid].room_no || ''}\n`;
        }
        return dump;
    }
}

module.exports = (io)=> new Lobby(io);
