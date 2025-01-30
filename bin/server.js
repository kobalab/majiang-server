#!/usr/bin/env node

"use strict";

const fs    = require('fs');
const path  = require('path');

const yargs = require('yargs');
const argv = yargs
    .usage('Usage: $0 [ options... ]')
    .option('port',     { alias: 'p', default: 4615 })
    .option('baseurl',  { alias: 'b', default: '/server'})
    .option('callback', { alias: 'c', default: '/' })
    .option('docroot',  { alias: 'd' })
    .option('oauth',    { alias: 'o' })
    .option('store',    { alias: 's' })
    .option('status',   { alias: 'S', boolean: true })
    .argv;
const port = argv.port;
const base = ('' + argv.baseurl)
                    .replace(/^(?!\/.*)/, '/$&')
                    .replace(/\/$/,'');
const back = argv.callback;
const auth = argv.oauth && path.resolve(argv.oauth);
const docs = argv.docroot && path.resolve(argv.docroot);
const stat = argv.status;

const express  = require('express');
const store    = ! argv.store ? null
               : new (require('session-file-store')(
                        require('express-session')))(
                            { path:  path.resolve(argv.store),
                              logFn: ()=>{} });
const session  = require('express-session')({
                            name:   'MAJIANG',
                            secret: 'keyboard cat',
                            resave: false,
                            saveUninitialized: false,
                            store:  store,
                            rolling: true,
                            cookie: { maxAge: 1000*60*60*24*14 } });
const passport = require('../lib/passport')(auth);

const app  = express();
const http = require('http').createServer(app);
const io   = require('socket.io')(http, { path: `${base}/socket.io/` });

const lobby = require('../lib/lobby')(io);

app.use(session);
app.use(passport.initialize());
app.use(passport.session());
app.use(express.urlencoded({ limit: '4mb', extended: false }));
app.post(`${base}/auth/`, passport.authenticate('local',
                                    { successRedirect: back,
                                      failureRedirect: back }));
if (auth && fs.existsSync(path.join(auth, 'hatena.json'))) {
    app.post(`${base}/auth/hatena`, passport.authenticate('hatena',
                                            { scope: ['read_public'] }));
    app.get(`${base}/auth/hatena`, passport.authenticate('hatena',
                                            { successRedirect: back }));
}
if (auth && fs.existsSync(path.join(auth, 'google.json'))) {
    app.post(`${base}/auth/google`, passport.authenticate('google',
                                            { scope: ['profile'] }));
    app.get(`${base}/auth/google`,  (req, res, next)=>{
        if (req.query.error) res.redirect(302, back);
        else                 next();                                    },
                                    passport.authenticate('google',
                                            { successRedirect: back }));
}
app.post(`${base}/logout`, (req, res)=>{
    req.session.destroy();
    res.clearCookie('MAJIANG');
    res.redirect(302, back);
});
if (stat) {
    app.get(`${base}/status`, (req, res)=>
        res.send(lobby.status(req.query.refresh)));
}
if (docs) app.use(express.static(docs));
app.use((req, res)=>res.status(404).send('<h1>Not Found</h1>'));

const wrap = (middle_wear)=>
                    (socket, next)=> middle_wear(socket.request, {}, next);

io.use(wrap(session));
io.use(wrap(passport.initialize()));
io.use(wrap(passport.session()));

http.listen(port, ()=>{
    console.log(`Server start on http://127.0.0.1:${port}${base}/`);
}).on('error', (e)=>{
    console.log('' + e);
    process.exit(-1);
});
