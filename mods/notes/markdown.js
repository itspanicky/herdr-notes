// Source ranges let edits change one block without rewriting the rest of a note.
export function blocks(text, offset = 0) {
  const lines = [...text.matchAll(/[^\n]*(?:\n|$)/g)].filter(m => m[0]);
  const result = [];
  const special = line => /^\s*$/.test(line) || /^ {0,3}(#{1,6}\s|`{3,}|~{3,}|>)/.test(line)
    || /^\s*[-*+] \[[ xX]\] /.test(line);
  for (let i = 0; i < lines.length;) {
    if (!lines[i][0].trim()) { i++; continue; }
    const first = lines[i], fence = first[0].match(/^ {0,3}(`{3,}|~{3,})/);
    let end = i + 1, type = "text";
    if (fence) {
      type = "code";
      const close = new RegExp(`^ {0,3}${fence[1][0]}{${fence[1].length},}\\s*$`);
      while (end < lines.length && !close.test(lines[end++][0])) {}
    } else if (/^ {0,3}#{1,6}\s/.test(first[0])) type = "heading";
    else if (/^\s*[-*+] \[[ xX]\] /.test(first[0])) type = "task";
    else if (/^ {0,3}>/.test(first[0])) {
      type = "quote";
      while (end < lines.length && /^ {0,3}>/.test(lines[end][0])) end++;
    } else {
      while (end < lines.length && !special(lines[end][0])) end++;
    }
    const start = first.index, stop = lines[end - 1].index + lines[end - 1][0].length;
    result.push({ start: start + offset, end: stop + offset, text: text.slice(start, stop), type });
    i = end;
  }
  return result;
}

export function toggleTask(text, block) {
  const task = block.text.match(/^(\s*[-*+] \[)([ xX])\] /);
  if (!task) return text;
  const at = block.start + task[1].length;
  return text.slice(0, at) + (task[2] === " " ? "x" : " ") + text.slice(at + 1);
}
