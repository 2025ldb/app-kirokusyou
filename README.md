# 日置地区陸上競技協会 記録証発行

結果発表ページから記録を取り込み、ゼッケン・氏名・所属・大会名で検索して、記録証PDFをダウンロードする仕組みです。

今回取り込んだ大会は [令和8年度 第２回日置地区陸上記録会](https://hiokiekiden.com/result/20260926/kyougi.html) です。決勝とタイムレース総合結果だけを使い、組ごとの重複は除いています。

公開ページ（GitHub Pages）:

https://2025ldb.github.io/app-kirokusyou/

地区陸協ホームページからは、このURLへリンクを貼って使います。事務局は公開ページ末尾の「事務局」から入れます。

## 使い方

```bash
npm install
npm run dev
```

ブラウザで表示される検索画面から、記録証のプレビューとPDFダウンロードができます。

`main` ブランチへ push すると、GitHub Pages が自動で更新されます。手元で静的ファイルだけ作る場合は次です。

```bash
npm run build
```

`dist/` を既存ホームページに置いても公開できます。

## 次の大会を取り込む

結果ページの競技別一覧URLを渡します。

```bash
python3 scripts/import_meet.py https://hiokiekiden.com/result/YYYYMMDD/kyougi.html
```
