/*
 *  convmsg
 */
"use strict";

const Majiang = require('@kobalab/majiang-core');

function pai(s, n) {
    return s == 'z'? ['','E','S','W','N','P','F','C'][+n]
                   : (+n||5) + s + (+n ? '' : 'r');
}

function bingpai(paistr) {
    paistr = paistr.replace(/,.*$/,'');
    let bingpai = [];
    for (let suitstr of paistr.match(/[mpsz]\d+/g)) {
        let s = suitstr[0];
        for (let n of suitstr.match(/\d/g)) {
            bingpai.push(pai(s, n));
        }
    }
    return bingpai;
}

function convmsg() {

    const board = new Majiang.Board();

    return function(msg) {

        if (! msg) return board;

        if (msg.kaiju) {
            board.kaiju(msg.kaiju);
            let { id, player } = msg.kaiju;
            return {
                type:  'start_game',
                id:    id,
                names: player.concat()
            };
        }
        else if (msg.qipai) {
            board.qipai(msg.qipai);
            let { zhuangfeng, jushu, changbang, lizhibang,
                                            baopai, shoupai } = msg.qipai;
            let req = {
                type:        'start_kyoku',
                bakaze:      ['E','S','W','N'][zhuangfeng],
                kyoku:       jushu + 1,
                honba:       changbang,
                kyotaku:     lizhibang,
                oya:         (board.qijia + jushu) % 4,
                dora_marker: pai(...baopai),
                tehais:      []
            };
            for (let l = 0; l < 4; l++) {
                let id = board.player_id[l];
                req.tehais[id] = shoupai[l] ? bingpai(shoupai[l])
                                            : Array(13).fill('?')
            }
            return req;
        }
        else if (msg.zimo) {
            board.zimo(msg.zimo);
            let { l, p } = msg.zimo;
            return {
                type:  'tsumo',
                actor: board.player_id[l],
                pai:   p ? pai(...p) : '?'
            };
        }
        else if (msg.dapai) {
            board.dapai(msg.dapai);
            let { l, p } = msg.dapai;
            return {
                type:      'dahai',
                actor:     board.player_id[l],
                pai:       p ? pai(...p) : '?',
                tsumogiri: p[2] == '_'
            };
        }
        else if (msg.fulou) {
            board.fulou(msg.fulou);
            let { l, m } = msg.fulou;
            let s = m[0];
            let d = { '+': 1, '=': 2, '-': 3 }[m.match(/[\+\=\-]/)];
            return {
                type:     (  m.match(/\d{4}/)                   ? 'daiminkan'
                           : m.replace(/0/,'5').match(/(\d)\1/) ? 'pon'
                           :                                      'chi' ),
                actor:    board.player_id[l],
                target:   board.player_id[(l + d) % 4],
                pai:      pai(s, m.match(/\d(?=[\+\=\-])/)),
                consumed: m.match(/\d(?![\+\=\-])/g).map(n => pai(s, n))
            };
        }
        else if (msg.gang) {
            board.gang(msg.gang);
            let { l, m } = msg.gang;
            let s = m[0];
            if (m.match(/\d{4}/)) {
                return {
                    type:   'ankan',
                    actor:  board.player_id[l],
                    consumed: m.match(/\d(?![\+\=\-])/g).map(n => pai(s, n))
                };
            }
            else {
                let d = { '+': 1, '=': 2, '-': 3 }[m.match(/[\+\=\-]/)];
                return {
                    type:   'kakan',
                    actor:  board.player_id[l],
                    pai:      pai(s, m.match(/(?<=[\+\=\-])\d/)),
                    consumed: m.match(/(?<![\+\=\-])\d/g).map(n => pai(s, n))
                };
            }
        }
        else if (msg.gangzimo) {
            board.zimo(msg.gangzimo);
            let { l, p } = msg.gangzimo;
            return {
                type:  'tsumo',
                actor: board.player_id[l],
                pai:   p ? pai(...p) : '?'
            };
        }
        else if (msg.kaigang) {
            board.kaigang(msg.kaigang);
            let { baopai } = msg.kaigang;
            return {
                type:  'dora',
                dora_marker: pai(...baopai)
            };
        }
        else if (msg.hule) {
            board.hule(msg.hule);
            let { l, shoupai, baojia, fubaopai, fu, fanshu,
                    damanguan, defen, hupai, fenpei } = msg.hule;
            let hora_tehais = bingpai(shoupai);
            let hulepai = hora_tehais.pop();
            if (baojia == null) hora_tehais.push(hulepai);
            let req = {
                type:   'hora',
                actor:  board.player_id[l],
                target: board.player_id[baojia == null ? l : baojia],
                pai:    hulepai,
                uradora_markers: (fubaopai || []).map(p => pai(...p)),
                hora_tehais: hora_tehais,
                yakus:  hupai.map(h => [ h.name,
                                         `${h.fanshu}`[0] == '*'
                                            ? 13 : h.fanshu ]),
                fu:     damanguan ? 20 : fu,
                fan:    damanguan ? 13 : fanshu,
                hora_points: defen,
                deltas: [],
                scores: []
            };
            for (let l = 0; l < 4; l++) {
                let id = board.player_id[l];
                req.deltas[id] = fenpei[l];
                req.scores[id] = board.defen[id] + fenpei[l];
            }
            return req;
        }
        else if (msg.pingju) {
            board.pingju(msg.pingju);
            let { name, shoupai, fenpei } = msg.pingju;
            let req = {
                type:   'ryukyoku',
                reason: name,
                tehais: [],
                tenpais: [],
                deltas: [],
                scores: []
            };
            for (let l = 0; l < 4; l++) {
                let id = board.player_id[l];
                let n_fulou = board.shoupai[l]._fulou.length;
                req.tehais[id] = shoupai[l] ? bingpai(shoupai[l])
                                            : Array(13 - n_fulou * 3).fill('?');
                req.tenpais[id] = name == '荒牌平局' && shoupai[l] != '';
                req.deltas[id] = fenpei[l];
                req.scores[id] = board.defen[id] + fenpei[l];
            }
            return req;
        }
        else if (msg.jieju) {
            let { defen } = msg.jieju;
            return {
                type:   'end_game',
                scores: defen
            };
        }
    }
}

module.exports = convmsg;
