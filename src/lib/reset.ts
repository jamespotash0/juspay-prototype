/** Forgets everything this browser remembers about the demo. Sandbox payments are untouched. */
export function resetDemo() {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      Object.keys(storage)
        .filter((k) => k.startsWith('slabbed.'))
        .forEach((k) => storage.removeItem(k))
    } catch {
      // storage unavailable: nothing to clear
    }
  }
  // A full load rebuilds every in-memory store from the now-empty storage.
  location.assign('/')
}
