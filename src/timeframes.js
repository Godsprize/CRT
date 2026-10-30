export const TIMEFRAMES = [
  { key: "D1", label: "D1", seconds: 24 * 60 * 60 },
  { key: "H12", label: "H12", seconds: 12 * 60 * 60 },
  { key: "H8", label: "H8", seconds: 8 * 60 * 60 },
  { key: "H6", label: "H6", seconds: 6 * 60 * 60 },
  { key: "H4", label: "H4", seconds: 4 * 60 * 60 },
  { key: "H3", label: "H3", seconds: 3 * 60 * 60 },
  { key: "H2", label: "H2", seconds: 2 * 60 * 60 },
  { key: "H1", label: "H1", seconds: 60 * 60 },
  { key: "M30", label: "M30", seconds: 30 * 60 },
  { key: "M15", label: "M15", seconds: 15 * 60 }
];

export function timeframeByKey(key) {
  return TIMEFRAMES.find((timeframe) => timeframe.key === key);
}

export function timeframeLabelFromSeconds(seconds) {
  return TIMEFRAMES.find((timeframe) => timeframe.seconds === seconds)?.label || `${seconds}s`;
}

export function higherTimeframeFor(timeframe) {
  const map = {
    M15: "H1",
    M30: "H4",
    H1: "H4",
    H2: "H6",
    H3: "H6",
    H4: "D1",
    H6: "D1",
    H8: "D1",
    H12: "D1"
  };
  return timeframeByKey(map[timeframe.key]);
}
