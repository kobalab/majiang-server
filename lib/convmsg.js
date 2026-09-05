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
    let id;

    return function(msg) {

        if (msg.kaiju) {
            board.kaiju(msg.kaiju);
            id = msg.kaiju.id;
            return {
                type:  'start_game',
                id:    msg.kaiju.id,
                names: msg.kaiju.player.concat()
            };
        }
        else if (msg.qipai) {
            board.qipai(msg.qipai);
            const tehai = ['?','?','?','?','?','?','?','?','?','?','?','?','?'];
            let req = {
                type:        'start_kyoku',
                bakaze:      ['E','S','W','N'][msg.qipai.zhuangfeng],
                kyoku:       msg.qipai.jushu + 1,
                honba:       msg.qipai.changbang,
                kyotaku:     msg.qipai.lizhibang,
                oya:         (board.qijia + msg.qipai.jushu) % 4,
                dora_marker: pai(msg.qipai.baopai[0], msg.qipai.baopai[1]),
                tehais:      [ tehai.concat(),
                               tehai.concat(),
                               tehai.concat(),
                               tehai.concat() ]
            };
            req.tehais[id] = bingpai(msg.qipai.shoupai[board.menfeng(id)]);
            return req;
        }
        else if (msg.zimo) {
            board.zimo(msg.zimo);
            let { l, p } = msg.zimo;
            return {
                type:  'tsumo',
                actor: board.player_id[l],
                pai:   p ? pai(p[0], p[1]) : '?'
            };
        }
        else if (msg.dapai) {
            board.dapai(msg.dapai);
            let { l, p } = msg.dapai;
            return {
                type:      'dahai',
                actor:     board.player_id[l],
                pai:       p ? pai(p[0], p[1]) : '?',
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
                pai:   p ? pai(p[0], p[1]) : '?'
            };
        }
        else if (msg.kaigang) {
            board.kaigang(msg.kaigang);
            let [ s, n ] = msg.kaigang.baopai;
            return {
                type:  'dora',
                dora_marker: pai(s, n)
            };
        }
        else if (msg.hule) {
            board.hule(msg.hule);
            let { shoupai, baojia, fubaopai, fu, fanshu,
                    damanguan, defen, hupai, fenpei } = msg.hule;
            let hora_tehais = bingpai(shoupai);
            let hulepai = hora_tehais.pop();
            if (baojia == null) hora_tehais.push(hulepai);
            let req = {
                type:   'hora',
                actor:  board.player_id[msg.hule.l],
                target: board.player_id[baojia == null ? msg.hule.l : baojia],
                pai:    hulepai,
                uradora_markers: (fubaopai || []).map(p => pai(p[0], p[1])),
                hora_tehais: hora_tehais,
                yakus:  hupai.map(h => [ h.name, h.fanshu ]),
                fu:     damanguan ? 20 : fu,
                fan:    damanguan ? 13 : fanshu,
                hora_points: defen,
                deltas: [],
                scores: []
            };
            for (let l = 0; l < 4; l++) {
                req.deltas[board.player_id[l]] = fenpei[l];
                req.scores[board.player_id[l]]
                        = board.defen[board.player_id[l]] + fenpei[l];
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
                req.tehais[board.player_id[l]]
                        = shoupai[l] ? bingpai(shoupai[l])
                        : ['?','?','?','?','?','?','?','?','?','?','?','?','?'];
                req.tenpais[board.player_id[l]]
                        = name == '荒牌平局' && shoupai[l] != '';
                req.deltas[board.player_id[l]] = fenpei[l];
                req.scores[board.player_id[l]]
                        = board.defen[board.player_id[l]] + fenpei[l];
            }
            return req;
        }
        else if (msg.jieju) {
            return {
                type:   'end_game',
                scores: msg.jieju.defen
            };
        }
    }
}

module.exports = convmsg;
