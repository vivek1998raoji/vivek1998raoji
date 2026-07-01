// Tiny CSV builder + browser download. `headers` is an array of
// { label, value } where value is a key string or a (row) => cell function.

export function toCSV(rows, headers) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const head = headers.map((h) => esc(h.label)).join(',');
  const body = (rows || [])
    .map((r) =>
      headers
        .map((h) => esc(typeof h.value === 'function' ? h.value(r) : r[h.value]))
        .join(','),
    )
    .join('\n');
  return head + '\n' + body;
}

export function downloadCSV(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
