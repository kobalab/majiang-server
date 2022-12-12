/*
 *  passport
 */

"use strict";

const fs   = require('fs');
const path = require('path');

const passport = require('passport');

passport.serializeUser((user, done)=> done(null, user));
passport.deserializeUser((userstr, done)=> done(null, userstr));

const local = require('passport-local');

passport.use(new local.Strategy(
    { usernameField: 'name',
      passwordField: 'passwd' },
    (name, passwd, done)=> done(null, { name: name })
));

module.exports = function(auth) {

    if (auth) {

        if (fs.existsSync(path.join(auth, 'hatena.json'))) {

            const hatena = require('passport-hatena-oauth');

            passport.use(new hatena.Strategy(
                require(path.join(auth, 'hatena.json')),
                (token, tokenSecret, profile, done)=>{
                    let user = {
                        id:   profile.id + '@hatena',
                        name: profile.displayName,
                        icon: profile.photos[0].value
                    };
                    done(null, user);
                }
            ));
        }
    }

    return passport;
}
