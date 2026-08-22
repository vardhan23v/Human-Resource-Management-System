export function parseJsonColumn(val: any) {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return val; }
  }
  return val; // already parsed object/array/number
}
export function stringifyJson(val: any) {
  return JSON.stringify(val);
}
