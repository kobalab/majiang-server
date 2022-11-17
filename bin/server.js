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

const express = require('express');

const app = express();
if (docs) app.use(express.static(docs));
app.use((req, res)=>res.status(404).send('<h1>Not Found</h1>'));

const http = require('http').createServer(app);
const io   = require('socket.io')(http);

http.listen(port, ()=>{
    console.log(`Server start on http://127.0.0.1:${port}`);
}).on('error', (e)=>{
    console.log('' + e);
    process.exit(-1);
});
