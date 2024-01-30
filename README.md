# majiang-server

麻雀サーバー (α版)

## 使用方法

### majiang-server [ *options*... ] [ *docs* ]
<dl>
<dt>--posrt, -p</dt>
    <dd>麻雀サーバーを起動するポート番号(デフォルトは <code>4615</code>)</dd>
<dt>--baseurl, -b</dt>
    <dd>socket.io のエントリポイント(デフォルトは <code>/sever</code>)</dd>
<dt>--callback, -c</dt>
    <dd>認証からの復帰URL(デフォルトは <code>/</code>)</dd>
<dt>--oauth, -o</dt>
    <dd>OAuth認証定義ファイルの配置ディレクトリ(省略可能)</dd>
<dt>docs</dt>
    <dd>サーバの配信する静的コンテンツの配置ディレクトリ(省略可能)</dd>
</dl>

## ライセンス
[MIT](https://github.com/kobalab/majiang-server/blob/master/LICENSE)

## 作者
[Satoshi Kobayashi](https://github.com/kobalab)
