# majiang-server

麻雀サーバー

WebSocket(socket.io)による麻雀サーバーの実装です。
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
<dt>--verbose, -v</dt>
    <dd>標準出力にデバッグログを出力する</dd>
</dl>

**関連記事:** [麻雀サーバーの使い方](https://blog.kobalab.net/entry/2024/02/15/081605)

## ライセンス
[MIT](https://github.com/kobalab/majiang-server/blob/master/LICENSE)

## 作者
[Satoshi Kobayashi](https://github.com/kobalab)
