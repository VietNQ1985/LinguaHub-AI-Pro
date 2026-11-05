(() => {
    const norm = value => (value || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('vi')
    const target = "__lh_name__"
    const rows = [...document.querySelectorAll('#searchResultList .conv-item')].filter(row => (() => { const name = row.querySelector('.conv-item-title__name'); return norm(name?.innerText || name?.textContent) === target })())
    if (rows.length === 1) rows[0].click()
    return rows.length
  })()
