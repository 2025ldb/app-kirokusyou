import { useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import { importMeetFromFileList, importMeetFromUrl } from "./importMeet";
import { saveLocalSettings, type OrgSettings } from "./settings";
import type { Meet } from "./types";

type Props = {
  settings: OrgSettings;
  onSettingsChange: (settings: OrgSettings) => void;
  meets: Meet[];
  onMeetImported: (meet: Meet) => void;
};

export function Admin({ settings, onSettingsChange, meets, onMeetImported }: Props) {
  const [authed, setAuthed] = useState(sessionStorage.getItem("kirokusyou-admin") === "1");
  const [password, setPassword] = useState("");
  const [president, setPresident] = useState(settings.president);
  const [resultUrl, setResultUrl] = useState("https://hiokiekiden.com/result/20260926/kyougi.html");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPresident(settings.president);
  }, [settings.president]);

  function login(event: FormEvent) {
    event.preventDefault();
    if (password !== settings.adminPassword) {
      setStatus("パスワードが違います");
      return;
    }
    sessionStorage.setItem("kirokusyou-admin", "1");
    setAuthed(true);
    setStatus("");
  }

  function savePresident(event: FormEvent) {
    event.preventDefault();
    const next = { ...settings, president: president.trim() || settings.president };
    saveLocalSettings(next);
    onSettingsChange(next);
    setStatus("会長名を保存しました。証明書にすぐ反映されます。");
  }

  async function importUrl(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus("結果を取り込んでいます…");
    try {
      const meet = await importMeetFromUrl(resultUrl.trim(), president.trim() || settings.president);
      onMeetImported(meet);
      setStatus(`${meet.name} を取り込みました（${meet.performances.length}件）。`);
    } catch (err) {
      setStatus(
        err instanceof Error
          ? `${err.message}　結果HTMLをまとめて選ぶ方法も使えます。`
          : "取り込みに失敗しました",
      );
    } finally {
      setBusy(false);
    }
  }

  async function importFiles(event: ChangeEvent<HTMLInputElement>) {
    const list = event.target.files;
    if (!list?.length) return;
    setBusy(true);
    setStatus("ファイルを読み込んでいます…");
    try {
      const meet = await importMeetFromFileList(list, president.trim() || settings.president);
      onMeetImported(meet);
      setStatus(`${meet.name} を取り込みました（${meet.performances.length}件）。`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "ファイルの取り込みに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify({ meets }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "meets.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!authed) {
    return (
      <div className="page admin-page">
        <p className="eyebrow">日置地区陸上競技協会</p>
        <h1>事務局ログイン</h1>
        <form className="admin-card" onSubmit={login}>
          <label>
            パスワード
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button type="submit" className="primary">
            入る
          </button>
          {status ? <p className="status error">{status}</p> : null}
        </form>
        <p>
          <a href="#/">記録検索へ戻る</a>
        </p>
      </div>
    );
  }

  return (
    <div className="page admin-page">
      <p className="eyebrow">日置地区陸上競技協会</p>
      <h1>事務局</h1>
      <p className="lede">会長名の変更と、記録会結果の取り込みができます。</p>

      <form className="admin-card" onSubmit={savePresident}>
        <h2>会長名</h2>
        <label>
          証明書に出す会長名
          <input value={president} onChange={(event) => setPresident(event.target.value)} />
        </label>
        <button type="submit" className="primary">
          保存する
        </button>
      </form>

      <form className="admin-card" onSubmit={importUrl}>
        <h2>結果ページから取り込む</h2>
        <p className="admin-note">
          いま公開している競技別一覧（kyougi.html）のURLを入れるか、結果フォルダのHTMLをまとめて選んでください。
        </p>
        <label>
          競技別一覧のURL
          <input value={resultUrl} onChange={(event) => setResultUrl(event.target.value)} />
        </label>
        <button type="submit" className="primary" disabled={busy}>
          URLから取り込む
        </button>
        <label>
          または kyougi.html と rel001.html などをまとめて選ぶ
          <input type="file" multiple accept=".html,text/html" onChange={importFiles} />
        </label>
      </form>

      <div className="admin-card">
        <h2>登録済みの大会</h2>
        <ul>
          {meets.map((meet) => (
            <li key={meet.id}>
              {meet.name}（{meet.performances.length}件）
            </li>
          ))}
        </ul>
        <button type="button" onClick={downloadJson}>
          記録データ（meets.json）をダウンロード
        </button>
        <p className="admin-note">
          取り込み結果はこのパソコンのブラウザに保存されます。地区陸協のホームページで全員が見られるようにするには、ダウンロードした
          meets.json をサーバーの data/meets.json と差し替えてください。会長名を公開側にも残す場合は
          settings.json の president も更新します。
        </p>
      </div>

      {status ? <p className="status">{status}</p> : null}
      <p>
        <a href="#/">記録検索へ戻る</a>
      </p>
    </div>
  );
}
