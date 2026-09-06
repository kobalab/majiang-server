/*
 *  convreply
 */
"use strict";

const Majiang = require('@kobalab/majiang-core');

function pai(p) {
    if (p == '?') return '';
    if (p.length == 1) return 'z' + { E:1, S:2, W:3, N:4, P:5, F:6, C:7 }[p];
    let n = + p[0], s = p[1];
    return s + (p[2] == 'r' ? 0 : n);
}

function mianzi(l, t, ...p) {
    let d = ['','+','=','-'][(4 + t - l) % 4];
    return Majiang.Shoupai.valid_mianzi(
                p.map(p => pai(p)).join('').replace(/(?<=\d)[mpsz]/g,'') + d);
}

function convreply() {

    let lizhi, peng = [];

    return function(res) {

        if (res.type == 'dahai') {
            let reply = { dapai: pai(res.pai) + (res.tsumogiri ? '_' : '')
                                              + (lizhi         ? '*' : '')};
            lizhi = false;
            return reply;
        }
        else if (res.type == 'reach') {
            lizhi = true;
            return { mjai: res };
        }
        else if (res.type == 'chi' || res.type == 'pon' ||
                 res.type ==  'daiminkan')
        {
            let m = mianzi(res.actor, res.target, ...res.consumed, res.pai);
            if (res.type == 'pon') peng.push(m);
            return { fulou: m };
        }
        else if (res.type == 'ankan') {
            return { gang: mianzi(res.actor, res.actor, ...res.consumed) }
        }
        else if (res.type == 'kakan') {
            let i = peng.map(m => m.slice(0,2).replace(/0/,'5'))
                        .indexOf(pai(res.pai).replace(/0/,'5'));
            return { gang: peng[i] + pai(res.pai)[1] };
        }
        else if (res.type == 'hora') {
            return { hule: '-' };
        }
        else if (res.type == 'ryukyoku') {
            return { daopai: '-' };
        }

        return {};
    }
}

module.exports = convreply;
