# majiang-server

麻雀サーバー (β版)

WebSocket を使った麻雀サーバーの実装です。
[電脳麻将](https://github.com/kobalab/Majiang) からの利用を想定しています。

## デモ
https://kobalab.net/majiang-server/netplay.html

## インストール
```bash
$ npm i -g @kobalab/majiang-server
```

## 使用方法

### majiang-server [ *options*... ]
<dl>
<dt>--posrt, -p</dt>
    <dd>麻雀サーバーを起動するポート番号(デフォルトは <code>4615</code>)</dd>
<dt>--baseurl, -b</dt>
    <dd>socket.io のエントリポイント(デフォルトは <code>/server</code>)</dd>
<dt>--callback, -c</dt>
    <dd>認証からの復帰URL(デフォルトは <code>/</code>)</dd>
<dt>--docs, -d</dt>
    <dd>サーバの配信する静的コンテンツの配置ディレクトリ(省略可能)</dd>
<dt>--oauth, -o</dt>
    <dd>OAuth認証定義ファイルの配置ディレクトリ(省略可能)</dd>
<dt>--verbose, -v</dt>
    <dd>標準出力にデバッグログを出力する</dd>
</dl>

## ライセンス
[MIT](https://github.com/kobalab/majiang-server/blob/master/LICENSE)

## 作者
[Satoshi Kobayashi](https://github.com/kobalab)
