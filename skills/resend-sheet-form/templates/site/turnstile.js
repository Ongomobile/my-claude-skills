/**
 * Cloudflare Turnstile, wrapped so a form only has to do three things:
 *
 *   const turnstile = await createTurnstile(containerEl, SITE_KEY)
 *   const token = await turnstile.getToken()   // waits if still solving
 *   turnstile.reset()                          // after a failed send
 *   turnstile.remove()                         // when the form unmounts
 *
 * The script loads on first use, not on page load, so visitors who never open
 * the form never download it.
 *
 * appearance 'interaction-only' keeps the widget invisible unless Cloudflare
 * wants a click. An automated browser (including Claude's) nearly always gets
 * the click, a normal visitor almost never does. Nobody should click it on the
 * visitor's behalf.
 *
 * Layout note: while hidden the container has zero height but still takes a
 * slot in a flex/grid stack, adding a stray gap. onVisibleChange tells you when
 * the challenge shows, so you can cancel the gap (e.g. a negative margin) the
 * rest of the time.
 */
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let loading = null

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => resolve(window.turnstile)
    script.onerror = () => {
      loading = null // let the next attempt try again
      reject(new Error('Turnstile failed to load'))
    }
    document.head.appendChild(script)
  })
  return loading
}

export async function createTurnstile(container, siteKey, { onVisibleChange } = {}) {
  const turnstile = await loadTurnstile()
  let token = ''
  let waiter = null

  const setToken = (value) => {
    token = value
    if (value && waiter) {
      waiter(value)
      waiter = null
    }
  }

  const widgetId = turnstile.render(container, {
    sitekey: siteKey,
    appearance: 'interaction-only',
    // The standard widget is 300px wide; narrower forms get the compact one.
    size: container.parentElement.clientWidth < 300 ? 'compact' : 'flexible',
    callback: setToken,
    'expired-callback': () => setToken(''),
    'error-callback': () => setToken(''),
    'before-interactive-callback': () => onVisibleChange?.(true),
    'after-interactive-callback': () => onVisibleChange?.(false),
  })

  return {
    getToken(ms = 15000) {
      if (token) return Promise.resolve(token)
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          waiter = null
          reject(new Error('Turnstile token timed out'))
        }, ms)
        waiter = (value) => {
          clearTimeout(timer)
          resolve(value)
        }
      })
    },
    reset() {
      token = ''
      turnstile.reset(widgetId)
    },
    remove() {
      turnstile.remove(widgetId)
    },
  }
}
