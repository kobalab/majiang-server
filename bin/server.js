#!/usr/bin/env node

"use strict";

const path  = require('path');

const yargs = require('yargs');
const argv = yargs
    .usage('Usage: $0 <docs>')
    .option('port', { alias: 'p', default: 4615 })
    .demandCommand(0)
    .argv;
const port = argv.port;
const docs = argv._[0] && path.resolve(argv._[0]);

const express  = require('express');
const session  = require('express-session')({
                            name:   'MAJIANG',
                            secret: 'keyboard cat',
                            resave: false,
                            saveUninitialized: false });
const passport = require('../lib/passport');

const app = express();
app.use(session);
app.use(passport.initialize());
app.use(passport.session());
app.use(express.urlencoded({ limit: '4mb', extended: false }));
app.post('/', passport.authenticate('local',
                                    { successRedirect: '/',
                                      failureRedirect: '/' }));
if (docs) app.use(express.static(docs));
app.use((req, res)=>res.status(404).send('<h1>Not Found</h1>'));

const wrap = (middle_wear)=>
                    (socket, next)=> middle_wear(socket.request, {}, next);

const http = require('http').createServer(app);
const io   = require('socket.io')(http);
io.use(wrap(session));
io.use(wrap(passport.initialize()));
io.use(wrap(passport.session()));

http.listen(port, ()=>{
    console.log(`Server start on http://127.0.0.1:${port}`);
}).on('error', (e)=>{
    console.log('' + e);
    process.exit(-1);
});
