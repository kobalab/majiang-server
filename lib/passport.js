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

module.exports = passport;
