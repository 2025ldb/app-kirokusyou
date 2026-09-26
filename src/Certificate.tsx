import type { ReactNode } from "react";
import type { Meet, Performance } from "./types";
import type { OrgSettings } from "./settings";
import { displayEvent, displayMark, displayName, toWareki } from "./format";

type Props = {
  meet: Meet;
  row: Performance;
  settings: OrgSettings;
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="cert-row">
      <span className="cert-label">{label}</span>
      <span className="cert-value">{children}</span>
    </div>
  );
}

export function Certificate({ meet, row, settings }: Props) {
  const date = toWareki(meet.date);
  const dateWithWeekday = toWareki(meet.date, true);
  const president = settings.president || meet.president || "宇田　栄";
  const organizer = meet.organizer || settings.organizer;
  const stadium = settings.stadium;

  return (
    <div className="certificate" id="certificate-sheet">
      <div className="certificate-frame">
        <div className="certificate-inner">
          <h1 className="certificate-title">大会記録証明書</h1>

          <div className="cert-fields">
            <Field label="氏　名">{displayName(row.name)}</Field>
            <Field label="所　属">{row.team}</Field>
            <Field label="大会名">{meet.name}</Field>
            <Field label="主　催">{organizer}</Field>
            <Field label="期　日">{dateWithWeekday}</Field>
            <Field label="競技場">{stadium}</Field>
            <Field label="種　目">
              {row.category} {displayEvent(row.event)}
            </Field>
            <Field label="記　録">{displayMark(row)}</Field>
          </div>

          <p className="certificate-proof">上記の通りであることを証明する</p>
          <p className="certificate-issued">{date}</p>

          <div className="certificate-signblock">
            <p className="certificate-assoc">{organizer}</p>
            <p className="certificate-president">会長　{president}</p>
            <img
              className="certificate-stamp"
              src={`${import.meta.env.BASE_URL}stamp.png`}
              alt=""
            />
          </div>
        </div>
      </div>
    </div>
  );
}
