# majiang-server

麻雀サーバー

WebSocket(Socket.IO)による麻雀サーバーの実装です。
[電脳麻将](https://github.com/kobalab/Majiang) ver.2.3.0 で追加したネット対戦は、本サーバーに接続して実現しています。

## デモ
https://kobalab.net/majiang/netplay.html

## インストール
```bash
$ npm i -g @kobalab/majiang-server
```

## 使用方法

### majiang-server [ *options*... ]
<dl>
<dt>--port, -p</dt>
    <dd>麻雀サーバーを起動するポート番号(デフォルトは <code>4615</code>)</dd>
<dt>--baseurl, -b</dt>
    <dd>socket.io のエントリポイント(デフォルトは <code>/server</code>)</dd>
<dt>--callback, -c</dt>
    <dd>認証からの復帰URL(デフォルトは <code>/</code>)</dd>
<dt>--docroot, -d</dt>
    <dd>サーバの配信する静的コンテンツの配置ディレクトリ(省略可能)</dd>
<dt>--oauth, -o</dt>
    <dd>OAuth認証定義ファイルの配置ディレクトリ(省略可能)</dd>
<dt>--store, -s</dt>
    <dd>セッションデータを保存するディレクトリ(省略可能)</dd>
<dt>--status, -S</dt>
    <dd><code>/server/status</code> でステータス表示を有効にする</dd>
</dl>

**関連記事:** [麻雀サーバーの使い方](https://blog.kobalab.net/entry/2024/02/15/081605)

### majiang-bot [ *options*... ] [ *server-url* ]
麻雀サーバーにAIのボットを接続する。
```bash
$ majiang-bot -r A1234 -n '麻雀ロボ' https://kobalab.net/majiang/server
```
<dl>
<dt>--room, -r</dt>
    <dd>入室するルーム</dd>
<dt>--name, -n</dt>
    <dd>対局者名(デフォルトは <code>*ボット*</code>)</dd>
<dt>--legacy, -l</dt>
    <dd>対局者の <a href="https://github.com/kobalab/majiang-ai/blob/master/legacy/README.md">思考アルゴリズム</a> を指定する(デフォルトは最新アルゴリズム)</dd>
<dt>--verbose, -v</dt>
    <dd>標準出力にデバッグログを出力する</dd>
<dt>server-url</dt>
  <dd>麻雀サーバーのURL(デフォルトは <code>http://127.0.0.1:4615/server</code>)。<br>
      デモサイトに接続するときは <code>https://kobalab.net/majiang/server</code> を指定すればよい。</dd>
</dl>

### mjai-bridge -r *room* *server-url* *mjai-bot* [ -- *bot-params*... ]
麻雀サーバーにMjai完全互換のボットを接続する。
```bash
$ mjai-bridge -r A1234 https://kobalab.net/majiang/server mjai-manue
```
<dl>
<dt>--room, -r</dt>
    <dd>入室するルーム</dd>
<dt>--name, -n</dt>
    <dd>対局者名(デフォルトは <code>Mjaiボット</code>)</dd>
<dt>--verbose, -v</dt>
    <dd>標準出力にデバッグログを出力する</dd>
<dt>--shell, -S</dt>
    <dd>シェルを介してボットを起動する<br>
        Windowsの場合、このオプションが必要な場合があります。</dd>
<dt>--noexec, -X</dt>
    <dd>ボットを起動せずにボットの起動方法を表示する<br>
        Mjaiボットが標準のURL形式を理解できない場合、このオプションが助けになる場合があります。</dd>
<dt>server-url</dt>
    <dd>麻雀サーバーのURL<br>
        デモサイトに接続するときは <code>https://kobalab.net/majiang/server</code> を指定します。
        <code>-</code> を指定すると<code>http://127.0.0.1:4615/server</code>に接続します。</dd>
<dt>mjai-bot</dt>
    <dd>起動するMjaiボット<br>
        ボットは <code>mjsonp://host:port/room</code>の形式の起動パラメータを処理できる必要があります。</dd>
<dt>bot-params</dt>
    <dd><code>--</code> 以降はMjaiボットの起動パラメータと解釈します。</dd>
</dl>

## ライセンス
[MIT](https://github.com/kobalab/majiang-server/blob/master/LICENSE)

## 作者
[Satoshi Kobayashi](https://github.com/kobalab)
