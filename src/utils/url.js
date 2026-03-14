export function parsePlayerParams(search) {
  const params = new URLSearchParams(search || '');
  const cidRaw = params.get('cid');
  const timeRaw = params.get('t');

  const cid = cidRaw ? cidRaw.trim() : '';
  const timeNum = Number.parseInt(timeRaw ?? '', 10);
  const time = Number.isFinite(timeNum) && timeNum > 0 ? timeNum : 0;

  return { cid, time };
}
