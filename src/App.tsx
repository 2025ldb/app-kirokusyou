import { useEffect, useMemo, useRef, useState } from "react";
import { Admin } from "./Admin";
import { Certificate } from "./Certificate";
import { displayEvent, displayMark, displayName, isMeetRecord, normalizeQuery } from "./format";
import { certificateFileName, downloadCertificatePdf } from "./pdf";
import {
  DEFAULT_SETTINGS,
  loadExtraMeets,
  loadLocalSettings,
  mergeMeetsById,
  mergeSettings,
  saveExtraMeets,
  type OrgSettings,
} from "./settings";
import type { Meet, MeetFile, Performance } from "./types";

type ResultRow = {
  meet: Meet;
  row: Performance;
};

function currentRoute(): string {
  const hash = window.location.hash.replace(/^#/, "");
  return hash || "/";
}

export default function App() {
  const [route, setRoute] = useState(currentRoute);
  const [meets, setMeets] = useState<Meet[]>([]);
  const [publishedMeets, setPublishedMeets] = useState<Meet[]>([]);
  const [settings, setSettings] = useState<OrgSettings>(DEFAULT_SETTINGS);
  const [error, setError] = useState("");
  const [meetId, setMeetId] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [eventFilter, setEventFilter] = useState("all");
  const [selected, setSelected] = useState<ResultRow | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onHashChange = () => setRoute(currentRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const dataUrl = `${import.meta.env.BASE_URL}data/meets.json`;
    const settingsUrl = `${import.meta.env.BASE_URL}settings.json`;
    Promise.all([
      fetch(dataUrl).then((res) => {
        if (!res.ok) throw new Error("記録データを読み込めませんでした");
        return res.json() as Promise<MeetFile>;
      }),
      fetch(settingsUrl)
        .then((res) => (res.ok ? (res.json() as Promise<Partial<OrgSettings>>) : {}))
        .catch(() => ({}) as Partial<OrgSettings>),
    ])
      .then(([data, fileSettings]) => {
        setSettings(mergeSettings(DEFAULT_SETTINGS, { ...fileSettings, ...loadLocalSettings() }));
        setPublishedMeets(data.meets);
        setMeets(mergeMeetsById(data.meets, loadExtraMeets<Meet>()));
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const events = useMemo(() => {
    const names = new Set<string>();
    for (const meet of meets) {
      for (const event of meet.events) names.add(event.event);
    }
    return [...names];
  }, [meets]);

  const results = useMemo(() => {
    const tokens = keyword
      .split(/\s+/)
      .map(normalizeQuery)
      .filter(Boolean);

    const rows: ResultRow[] = [];
    for (const meet of meets) {
      if (meetId !== "all" && meet.id !== meetId) continue;
      for (const row of meet.performances) {
        if (eventFilter !== "all" && row.event !== eventFilter) continue;
        const haystack = normalizeQuery(
          `${row.searchText} ${meet.name} ${isMeetRecord(row.comment) ? "大会新記録 NGR" : ""}`,
        );
        if (tokens.some((token) => !haystack.includes(token))) continue;
        rows.push({ meet, row });
      }
    }
    return rows;
  }, [meets, meetId, keyword, eventFilter]);

  function handleMeetImported(meet: Meet) {
    const extras = loadExtraMeets<Meet>().filter((item) => item.id !== meet.id).concat(meet);
    saveExtraMeets(extras);
    setMeets(mergeMeetsById(publishedMeets, extras));
  }

  async function handleDownload() {
    if (!selected || !sheetRef.current) return;
    setDownloading(true);
    const sheet = sheetRef.current.querySelector<HTMLElement>(".certificate");
    if (!sheet) {
      setDownloading(false);
      return;
    }
    sheet.classList.add("is-capturing");
    setDownloadError("");
    try {
      await downloadCertificatePdf(sheet, certificateFileName(selected.meet, selected.row));
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "PDFの作成に失敗しました");
    } finally {
      sheet.classList.remove("is-capturing");
      setDownloading(false);
    }
  }

  if (route.startsWith("/admin")) {
    return (
      <Admin
        settings={settings}
        onSettingsChange={setSettings}
        meets={meets}
        onMeetImported={handleMeetImported}
      />
    );
  }

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">日置地区陸上競技協会</p>
        <h1>大会記録証明書</h1>
        <p className="lede">
          ゼッケン・氏名・所属・大会名から記録を検索し、大会記録証明書のPDFをダウンロードできます。
        </p>
      </header>

      <form className="search" onSubmit={(event) => event.preventDefault()}>
        <label>
          大会
          <select value={meetId} onChange={(event) => setMeetId(event.target.value)}>
            <option value="all">すべての大会</option>
            {meets.map((meet) => (
              <option key={meet.id} value={meet.id}>
                {meet.name}
              </option>
            ))}
          </select>
        </label>
        <label className="search-keyword">
          氏名・カナ・ゼッケン・所属
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="例）402　軸屋　チェスト"
            autoComplete="off"
          />
        </label>
        <label>
          種目
          <select value={eventFilter} onChange={(event) => setEventFilter(event.target.value)}>
            <option value="all">すべての種目</option>
            {events.map((event) => (
              <option key={event} value={event}>
                {event}
              </option>
            ))}
          </select>
        </label>
      </form>

      {error ? <p className="status error">{error}</p> : null}

      <p className="status">
        {meets.length === 0 && !error
          ? "記録を読み込んでいます…"
          : `${results.length}件見つかりました`}
      </p>

      <div className="table-wrap">
        <table className="results">
          <thead>
            <tr>
              <th>ゼッケン</th>
              <th>氏名</th>
              <th>所属</th>
              <th>種目</th>
              <th>記録</th>
              <th>順位</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {results.slice(0, 200).map(({ meet, row }) => (
              <tr key={`${meet.id}-${row.id}`}>
                <td>{row.bib}</td>
                <td>
                  <strong>{displayName(row.name)}</strong>
                  <span className="kana">{row.kana}</span>
                </td>
                <td>{row.team}</td>
                <td>
                  {row.category} {displayEvent(row.event)}
                </td>
                <td>
                  {row.valid ? displayMark(row) : row.comment || "記録なし"}
                </td>
                <td>{row.rank || "—"}</td>
                <td>
                  <button
                    type="button"
                    disabled={!row.valid}
                    onClick={() => setSelected({ meet, row })}
                  >
                    証明書
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {results.length > 200 ? (
        <p className="status">表示は先頭200件です。検索条件を絞り込んでください。</p>
      ) : null}

      <footer className="site-footer">
        <a href="https://hiokiekiden.com/" target="_blank" rel="noreferrer">
          日置地区陸上競技協会ホームページ
        </a>
        <span>｜</span>
        <a href="#/admin">事務局</a>
      </footer>

      {selected ? (
        <div className="modal" role="dialog" aria-modal="true" aria-label="大会記録証明書">
          <div className="modal-panel">
            <div className="modal-toolbar">
              <div>
                <p className="modal-kicker">大会記録証明書プレビュー</p>
                <h2>
                  {displayName(selected.row.name)}　{displayEvent(selected.row.event)}
                </h2>
              </div>
              <div className="modal-actions">
                <button type="button" className="primary" onClick={handleDownload} disabled={downloading}>
                  {downloading ? "作成中…" : "PDFをダウンロード"}
                </button>
                <button type="button" onClick={() => setSelected(null)}>
                  閉じる
                </button>
              </div>
            </div>
            {downloadError ? <p className="status error">{downloadError}</p> : null}
            <div className="certificate-stage" ref={sheetRef}>
              <Certificate meet={selected.meet} row={selected.row} settings={settings} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
