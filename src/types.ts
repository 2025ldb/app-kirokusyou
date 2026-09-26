export type Performance = {
  id: string;
  bib: string;
  name: string;
  nameRaw: string;
  kana: string;
  grade: string;
  prefecture: string;
  team: string;
  rank: string;
  lane: string;
  heat: string;
  heatPlace: string;
  mark: string;
  markLabel: string;
  wind: string;
  comment: string;
  valid: boolean;
  category: string;
  event: string;
  round: string;
  title: string;
  source: string;
  searchText: string;
};

export type MeetEvent = {
  title: string;
  category: string;
  event: string;
  round: string;
  source: string;
};

export type Meet = {
  id: string;
  name: string;
  date: string;
  dateLabel: string;
  venue: string;
  referee: string;
  recorder: string;
  organizer: string;
  president?: string;
  sourceUrl: string;
  events: MeetEvent[];
  performances: Performance[];
};

export type MeetFile = {
  meets: Meet[];
};
