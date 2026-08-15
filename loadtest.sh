#!/bin/sh

url=$1

node bin/client-multi.js -n 512 -p A- -w 400 $url &
sleep 50
node bin/client-multi.js -n 512 -p B- -w 350 $url &
sleep 50
node bin/client-multi.js -n 512 -p C- -w 300 $url &
sleep 50
node bin/client-multi.js -n 512 -p D- -w 250 $url &
sleep 50
node bin/client-multi.js -n 512 -p E- -w 200 $url &
sleep 50
node bin/client-multi.js -n 512 -p F- -w 150 $url &
sleep 50
node bin/client-multi.js -n 512 -p G- -w 100 $url &
sleep 50
node bin/client-multi.js -n 512 -p H- -w 50 $url &
