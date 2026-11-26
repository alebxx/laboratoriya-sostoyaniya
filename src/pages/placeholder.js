// Временная страница для разделов, которые появятся на следующих этапах.
export function placeholder(title, stage) {
  return (root) => {
    root.innerHTML = `
      <h1>${title}</h1>
      <p class="notice">Этот раздел появится на этапе ${stage}.</p>
      <p><a href="#/">На главную</a></p>`;
  };
}
