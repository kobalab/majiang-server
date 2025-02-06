const assert  = require('assert');

const { rule } = require('@kobalab/majiang-core');

class Emitter {
    constructor() {
        this._callbacks = {};
        this._emit_log  = [];
    }
    on(type, callback) {
        this._callbacks[type] = this._callbacks[type] ?? [];
        this._callbacks[type].push(callback)
    }
    removeAllListeners(type) {
        delete this._callbacks[type];
    }
    trigger(type, ...msg) {
        (this._callbacks[type] || []).forEach(
            callback => callback(...msg)
        );
    }
    emit(type, ...msg) {
        this._emit_log.push([ type, ...msg ]);
    }
    emit_log(n = -1) {
        if (n < 0) n = this._emit_log.length + n;
        return this._emit_log[n];
    }
}

function sessionID() {
    return Math.random().toString(16).slice(-12);
}

class Socket extends Emitter {
    constructor(user) {
        super();
        this.request = {};
        if (user) {
            this.request.user      = user;
            this.request.sessionID = sessionID();
        }
    }
    disconnect(flag) {
        this._dissconect = flag;
    }
    trigger(type, ...msg) {
        if (this._dissconect) return;
        super.trigger(type, ...msg);
    }
    emit(type, ...msg) {
        super.emit(type, ...msg);
        if (type == 'GAME' && msg[0].seq) {
            this.trigger('GAME', { seq: msg[0].seq });
        }
    }
}

const io = new Emitter();

function connect(user) {
    let sock = new Socket(user);
    io.trigger('connection', sock);
    return sock;
}

console.log = ()=>{};

suite('Lobby', ()=>{

    let lobby;
    test('モジュールが存在すること', ()=> assert.ok(require('../lib/lobby')));
    test('モジュールが呼び出せること', ()=>
                            assert.ok(lobby = require('../lib/lobby')(io)));

    suite('接続', ()=>{
        test('非ログインユーザを拒否すること', ()=>{
            const sock = connect();
            assert.ok(sock._dissconect);
        });
        test('ゲスト認証にuidを払い出すこと', ()=>{
            const sock = connect({ name: 'ゲスト' });
            let [ type, msg ] = sock.emit_log();
            assert.equal(type, 'HELLO');
            assert.equal(msg.name, 'ゲスト');
            assert.ok(msg.uid);
            assert.deepEqual(lobby.USER[msg.uid].user,
                             { uid: msg.uid, name: 'ゲスト' });
            assert.ok(lobby.USER[msg.uid].sock);
        });
        test('外部認証を許可すること', ()=>{
            const user = { uid:'user@hatena', name:'はてな', icon:'icon.png' };
            const sock = connect(user);
            let [ type, msg ] = sock.emit_log();
            assert.equal(type, 'HELLO');
            assert.deepEqual(msg, user);
            assert.deepEqual(lobby.USER['user@hatena'].user, user);
            assert.ok(lobby.USER['user@hatena'].sock);
        });
        test('二重接続を拒否すること', ()=>{
            let sock = connect({ name:'ゲスト' });
            let [ type, msg ] = sock.emit_log();
            sock = connect({ name:'二重接続', uid: msg.uid });
            assert.ok(sock._dissconect);
            assert.deepEqual(lobby.USER[msg.uid].user,
                             { uid: msg.uid, name: 'ゲスト' });
            assert.ok(lobby.USER[msg.uid].sock);
        });
        test('再接続を許可すること', ()=>{
            const user = { uid:'user1@connect', name:'再接続', icon:'icon.png' };
            let sock = connect(user);
            sock.trigger('disconnect');
            sock = connect(user);
            let [ type, msg ] = sock.emit_log();
            assert.equal(type, 'HELLO');
            assert.deepEqual(msg, user);
            assert.deepEqual(lobby.USER['user1@connect'].user, user);
            assert.ok(lobby.USER['user1@connect'].sock);
        });
    });
    suite('ルーム', ()=>{
        const user = [
            { uid:'admin@room', name:'管理者',  icon:'admin.png' },
            { uid:'user1@room', name:'参加者1', icon:'user1.png' },
            { uid:'user2@room', name:'参加者2', icon:'user2.png' },
            { uid:'user3@room', name:'参加者3', icon:'user3.png' },
            { uid:'user4@room', name:'参加者4', icon:'user4.png' },
        ];
        const sock = [];
        let room_no, type, msg;
        test('作成できること', ()=>{
            sock[0] = connect(user[0]);
            sock[0].trigger('ROOM');
            [ type, msg ] = sock[0].emit_log();
            assert.equal(type, 'ROOM');
            assert.ok(msg.room_no);
            assert.deepEqual(msg.user,
                            [ Object.assign({}, user[0], { offline: false })]);
            room_no = msg.room_no;
            assert.deepEqual(lobby.ROOM[room_no].uids, [ 'admin@room' ]);
            assert.equal(lobby.USER['admin@room'].room_no, room_no);
        });
        test('入室できること', ()=>{
            sock[1] = connect(user[1]);
            sock[1].trigger('ROOM', room_no);
            [ type, msg ] = sock[1].emit_log();
            assert.equal(type, 'ROOM');
            assert.equal(msg.room_no, room_no);
            assert.deepEqual(msg.user[1],
                            Object.assign({}, user[1], { offline: false }));
            assert.deepEqual(lobby.ROOM[room_no].uids,
                             [ 'admin@room','user1@room' ]);
            assert.equal(lobby.USER['user1@room'].room_no, room_no);
        });
        test('管理者が切断してもルームが残ること', ()=>{
            sock[0].trigger('disconnect');
            [ type, msg ] = sock[1].emit_log();
            assert.equal(type, 'ROOM');
            assert.equal(msg.room_no, room_no);
            assert.deepEqual(msg.user[0],
                            Object.assign({}, user[0], { offline: true }));
            assert.deepEqual(lobby.ROOM[room_no].uids,
                             [ 'admin@room','user1@room' ]);
            assert.equal(lobby.USER['admin@room'].room_no, room_no);
            assert.ok(! lobby.USER['admin@room'].sock);
        });
        test('参加者が切断すると退室すること', ()=>{
            sock[2] = connect(user[2]);
            sock[2].trigger('ROOM', room_no);
            assert.deepEqual(lobby.ROOM[room_no].uids,
                             [ 'admin@room','user1@room','user2@room' ]);
            sock[2].trigger('disconnect');
            [ type, msg ] = sock[1].emit_log();
            assert.equal(type, 'ROOM');
            assert.equal(msg.room_no, room_no);
            assert.ok(! msg.user.find(u=>u.uid == 'user2@room'));
            assert.deepEqual(lobby.ROOM[room_no].uids,
                             [ 'admin@room','user1@room' ]);
            assert.ok(! lobby.USER['user2@room']);
        });
        test('管理者が再接続するとルームに戻ること', ()=>{
            sock[0] = connect(user[0]);
            [ type, msg ] = sock[1].emit_log();
            assert.equal(type, 'ROOM');
            assert.ok(msg.room_no);
            assert.deepEqual(msg.user[0],
                            Object.assign({}, user[0], { offline: false }));
            assert.ok(lobby.USER['admin@room'].sock);
        });
        test('参加者が再接続してもルームに戻らないこと', ()=>{
            sock[2] = connect(user[2]);
            [ type, msg ] = sock[2].emit_log();
            assert.equal(type, 'HELLO');
            assert.deepEqual(lobby.ROOM[room_no].uids,
                             [ 'admin@room','user1@room' ]);
            assert.ok(! lobby.USER['user2@room'].room_no);
        });
        test('管理者は参加者を強制退室できること', ()=>{
            sock[2].trigger('ROOM', room_no);
            assert.deepEqual(lobby.ROOM[room_no].uids,
                             [ 'admin@room','user1@room','user2@room' ]);
            sock[0].trigger('ROOM', room_no, 'user2@room');
            [ type, msg ] = sock[2].emit_log();
            assert.equal(type, 'HELLO');
            [ type, msg ] = sock[1].emit_log();
            assert.equal(type, 'ROOM');
            assert.equal(msg.room_no, room_no);
            assert.ok(! msg.user.find(u=>u.uid == 'user2@room'));
            assert.deepEqual(lobby.ROOM[room_no].uids,
                             [ 'admin@room','user1@room' ]);
            assert.ok(! lobby.USER['user2@room'].room_no);
        });
        test('参加者は自ら退室できること', ()=>{
            sock[2].trigger('ROOM', room_no);
            assert.deepEqual(lobby.ROOM[room_no].uids,
                             [ 'admin@room','user1@room','user2@room' ]);
            sock[2].trigger('ROOM', room_no, 'user2@room');
            [ type, msg ] = sock[2].emit_log();
            assert.equal(type, 'HELLO');
            [ type, msg ] = sock[1].emit_log();
            assert.equal(type, 'ROOM');
            assert.equal(msg.room_no, room_no);
            assert.ok(! msg.user.find(u=>u.uid == 'user2@room'));
            assert.deepEqual(lobby.ROOM[room_no].uids,
                             [ 'admin@room','user1@room' ]);
            assert.ok(! lobby.USER['user2@room'].room_no);
        });
        test('管理者が退室するとルームがなくなること', ()=>{
            sock[0].trigger('ROOM', room_no, 'admin@room');
            [ type, msg ] = sock[1].emit_log();
            assert.equal(type, 'HELLO');
            assert.ok(! lobby.ROOM[room_no]);
        });
        test('存在しないルームに入室できないこと',()=>{
            sock[1].trigger('ROOM', 'badroom');
            [ type, msg ] = sock[1].emit_log();
            assert.equal(type, 'ERROR');
        });
        test('満室のルームに入室できないこと', ()=>{
            for (let i = 0; i < 5; i++) {
                if (! sock[i]) sock[i] = connect(user[i]);
                if (i == 0) {
                    sock[i].trigger('ROOM');
                    [ type, msg ] = sock[i].emit_log();
                    assert.equal(type, 'ROOM');
                    room_no = msg.room_no;
                }
                else {
                    sock[i].trigger('ROOM', room_no);
                    [ type, msg ] = sock[i].emit_log();
                    if (i < 4) assert.equal(type, 'ROOM');
                    else       assert.equal(type, 'ERROR');
                }
            }
            assert.equal(lobby.ROOM[room_no].uids.length, 4);
        });
        test('入室済みの場合、ルームを作成できないこと', ()=>{
            sock[1].trigger('ROOM');
            assert.equal(lobby.USER['user1@room'].room_no, room_no);
        });
        test('入室済みの場合、他のルームに入室できないこと', ()=>{
            sock[4].trigger('ROOM');
            let new_room_no = sock[4].emit_log()[1].room_no;
            sock[2].trigger('ROOM', new_room_no);
            assert.equal(lobby.USER['user2@room'].room_no, room_no);
        });
        test('参加者による参加者の強制退室', ()=>{
            sock[2].trigger('ROOM', room_no, 'user3@room');
            [ type, msg ] = sock[3].emit_log();
            assert.notEqual(type, 'HELLO');
        });
        test('他のルームの参加者の強制退室', ()=>{
            sock[0].trigger('ROOM', room_no, 'user4@room');
            [ type, msg ] = sock[4].emit_log();
            assert.notEqual(type, 'HELLO');
        });
        test('存在しない参加者の強制退室', ()=>{
            sock[0].trigger('ROOM', room_no, 'baduser');
        });
        test('存在しないルームの強制退室', ()=>{
            sock[0].trigger('ROOM', 'badroom', 'admin@room');
        });
    });
    suite('ゲーム', ()=>{
        const user = [
            { uid:'admin@game', name:'管理者',  icon:'admin.png' },
            { uid:'user1@game', name:'参加者1', icon:'user1.png' },
            { uid:'user2@game', name:'参加者2', icon:'user2.png' },
            { uid:'user3@game', name:'参加者3', icon:'user3.png' },
            { uid:'user4@game', name:'参加者4', icon:'user4.png' },
        ];
        const sock = [];
        let room_no, type, msg;
        test('対局を開始できること', ()=>{
            for (let i = 0; i < 3; i++) {
                sock[i] = connect(user[i]);
                if (i == 0) { sock[i].trigger('ROOM');
                              [ type, msg ] = sock[i].emit_log();
                              room_no = msg.room_no; }
                else        { sock[i].trigger('ROOM', room_no); }
            }
            sock[0].trigger('START', room_no, rule({'場数': 1}), [ 5, 10, 15 ]);
            for (let i = 0; i < 3; i++) {
                assert.equal(sock[i]._emit_log.
                                filter(log => log[0] == 'START').length, 1);
                [ type, msg ] = sock[i].emit_log();
                assert.equal(type, 'GAME');
                assert.ok(msg.kaiju);
                assert.deepEqual(msg.timer, [ 15 ])
                assert.equal(msg.kaiju.rule['場数'], 1);
            }
            assert.ok(lobby.ROOM[room_no].game);
        });
        test('対局開始後は入室できないこと', ()=>{
            sock[3] = connect(user[3]);
            sock[3].trigger('ROOM', room_no);
            [ type, msg ] = sock[3].emit_log();
            assert.equal(type, 'ERROR');
        });
        test('対局開始後は退室できないこと', ()=>{
            sock[2].trigger('ROOM', room_no, 'user2@game');
            [ type, msg ] = sock[2].emit_log();
            assert.notEqual(type, 'HELLO');
            assert.equal(lobby.USER['user2@game'].room_no, room_no);
            assert.equal(lobby.ROOM[room_no].uids.length, 3);
        });
        test('対局開始後に重複して開始できないこと', ()=>{
            sock[0].trigger('START', room_no, rule());
            assert.equal(sock[0]._emit_log.
                            filter(log => log[0] == 'START').length, 1);
        });
        test('切断した対局者を通知すること', ()=>{
            sock[1].trigger('disconnect');
            [ type, msg ] = sock[0].emit_log();
            assert.equal(type, 'GAME');
            assert.ok(msg.players);
            assert.ok(! msg.players.find(u=>u && u.uid == 'user1@game'));
            assert.equal(lobby.USER['user1@game'].room_no, room_no);
            assert.ok(! lobby.USER['user1@game'].sock);
        });
        test('再接続で対局が再開できること', ()=>{
            sock[1] = connect(user[1]);
            assert.equal(lobby.USER['user1@game'].room_no, room_no);
            assert.ok(lobby.USER['user1@game'].sock);
            [ type, msg ] = sock[0].emit_log();
            assert.equal(type, 'GAME');
            assert.ok(msg.players);
            assert.ok(msg.players.find(u=>u && u.uid == 'user1@game'));
            [ type, msg ] = sock[1].emit_log(1);
            assert.equal(type, 'START');
            [ type, msg ] = sock[1].emit_log(2);
            assert.equal(type, 'GAME');
            assert.ok(msg.kaiju && msg.kaiju.log);
            [ type, msg ] = sock[1].emit_log(3);
            assert.equal(type, 'GAME');
            assert.ok(msg.players);
        });
        test('全員の切断で対局が終了すること', (done)=>{
            sock.forEach(s => s.trigger('disconnect'));
            setTimeout(()=>{
                sock[0] = connect(user[0]);
                [ type, msg ] = sock[0].emit_log();
                assert.equal(type, 'HELLO');
                assert.ok(! lobby.ROOM[room_no]);
                done();
            }, 500);
        });
        test('再接続した管理者が対局を開始できること', (done)=>{
            for (let i = 0; i < 4; i++) {
                if (i == 0) { sock[i].trigger('ROOM');
                              [ type, msg ] = sock[i].emit_log();
                              room_no = msg.room_no; }
                else        { sock[i] = connect(user[i]);
                              sock[i].trigger('ROOM', room_no); }
            }
            sock[0].trigger('disconnect');
            sock[0] = connect(user[0]);
            sock[0].trigger('START', room_no, rule());
            for (let i = 0; i < 4; i++) {
                assert.equal(sock[i]._emit_log.
                                filter(log => log[0] == 'START').length, 1);
                [ type, msg ] = sock[i].emit_log();
                assert.equal(type, 'GAME');
                assert.ok(msg.kaiju);
            }
            assert.ok(lobby.ROOM[room_no].game);
            sock.forEach(s => s.trigger('disconnect'));
            setTimeout(done, 500);
        });
        test('参加者が対局を開始できないこと', ()=>{
            sock[0] = connect(user[0]);
            sock[0].trigger('ROOM');
            [ type, msg ] = sock[0].emit_log();
            room_no = msg.room_no;
            sock[1] = connect(user[1]);
            sock[1].trigger('ROOM', room_no);
            sock[1].trigger('START', room_no);
            assert.ok(! sock[1]._emit_log.find(log => log[0] == 'START'));
            assert.ok(! lobby.ROOM[room_no].game);
        });
        test('他のルームの対局を開始できないこと', ()=>{
            sock[4] = connect(user[4]);
            sock[4].trigger('ROOM');
            let new_room_no = sock[4].emit_log()[1].room_no;
            sock[0].trigger('START', new_room_no);
            assert.ok(! sock[4]._emit_log.find(log => log[0] == 'START'));
            assert.ok(! lobby.ROOM[new_room_no].game);
        });
        test('存在しないルームの対局開始', ()=>{
            sock[0].trigger('START', 'badroom');
        });
        test('対局が終了すること', (done)=>{
            for (let i = 0; i < 4; i++) {
                if (i == 0) { sock[i].trigger('ROOM');
                              [ type, msg ] = sock[i].emit_log();
                              room_no = msg.room_no; }
                else        { sock[i] = connect(user[i]);
                              sock[i].trigger('ROOM', room_no); }
            }
            sock[0].trigger('START', room_no,
                            rule({ '場数': 1, "連荘方式": 0, "延長戦方式": 0 }));
            lobby.ROOM[room_no].game.speed = 0;
            const callback = lobby.ROOM[room_no].game._callback;
            lobby.ROOM[room_no].game._callback = (paipu)=>{
                callback(paipu);
                assert.ok(! lobby.ROOM[room_no]);
                done();
            };
        });
    });
    suite('ステータス表示', ()=>{
        const user = [
            { uid:'user0@status', name:'ユーザ0', icon:'user0.png' },
            { uid:'user1@status', name:'ユーザ1', icon:'user1.png' },
            { uid:'user2@status', name:'ユーザ2', icon:'user2.png' },
            { uid:'user3@status', name:'ユーザ3', icon:'user3.png' },
            { uid:'user4@status', name:'ユーザ4', icon:'user4.png' },
        ];
        const sock = [];
        let room_no, type, msg;
        test('ステータスが表示できること', (done)=>{

            for (let i = 0; i < 5; i++) {
                sock[i] = connect(user[i]);
            }

            sock[0].trigger('ROOM');
            [ type, msg ] = sock[0].emit_log();
            room_no = msg.room_no;
            sock[1].trigger('ROOM', room_no);
            sock[0].trigger('START', room_no);
            sock[1].trigger('disconnect');

            sock[2].trigger('ROOM');
            [ type, msg ] = sock[2].emit_log();
            room_no = msg.room_no;
            sock[3].trigger('ROOM', room_no);
            sock[2].trigger('disconnect');

            assert.ok(lobby.status());
            assert.ok(lobby.status(15));

            sock[0].trigger('disconnect');
            setTimeout(done, 500);
        });
    });
    suite('例外処理', ()=>{
        const CONSOLE_ERROR = console.error();
        suiteSetup(()=>{
            console.error = ()=>{};
        });
        test('ログ出力時の例外を捕捉すること', ()=>{
            let sock = connect({ name: 'ゲスト' });
            let [ type, msg ] = sock.emit_log();
            sock.trigger('ROOM');
            delete lobby.USER[msg.uid];
            assert.ok(lobby.short_status());
        });
        suiteTeardown(()=>{
            console.error = CONSOLE_ERROR;
        });
    });
});
