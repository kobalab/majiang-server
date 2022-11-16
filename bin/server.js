#!/usr/bin/env node

"use strict";

const express = require('express');

const app = express();

app.use(express.static('./'));

const http = require('http').createServer(app);

http.listen(4615, ()=>{
    console.log('Server start on http://127.0.0.1:4615');
}).on('error', (e)=>{
    console.log('' + e);
    process.exit(-1);
});
