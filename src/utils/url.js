export function parsePlayerParams(search) {
  const params = new URLSearchParams(search || '');
  const cidRaw = params.get('cid');
  const gatewayRaw = params.get('gateway');
  const timeRaw = params.get('t');

  const cid = cidRaw ? cidRaw.trim() : '';
  const gateway = gatewayRaw ? gatewayRaw.trim() : '';
  const timeNum = Number.parseInt(timeRaw ?? '', 10);
  const time = Number.isFinite(timeNum) && timeNum > 0 ? timeNum : 0;

  return { cid, gateway, time };
}
