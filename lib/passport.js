/*
 *  passport
 */

"use strict";

const passport = require('passport');

passport.serializeUser((user, done)=> done(null, user));
passport.deserializeUser((userstr, done)=> done(null, userstr));

const local = require('passport-local');

passport.use(new local.Strategy(
    { usernameField: 'name',
      passwordField: 'passwd' },
    (name, passwd, done)=> done(null, { name: name })
));

const hatena = require('passport-hatena-oauth');

passport.use(new hatena.Strategy(
    require('../ex/auth/hatena.json'),
    (token, tokenSecret, profile, done)=>{
        let user = {
            id:   profile.id + '@hatena',
            name: profile.displayName,
            icon: profile.photos[0].value
        };
        done(null, user);
    }
));

module.exports = passport;
