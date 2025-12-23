// 전역 Toast 관리자
let toastListeners = []

export const toastManager = {
  subscribe: (listener) => {
    toastListeners.push(listener)
    return () => {
      toastListeners = toastListeners.filter(l => l !== listener)
    }
  },

  show: (message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random()
    toastListeners.forEach(listener => {
      listener({ id, message, type, duration })
    })
    return id
  },

  success: (message, duration) => {
    return toastManager.show(message, 'success', duration)
  },

  error: (message, duration) => {
    return toastManager.show(message, 'error', duration)
  },

  warning: (message, duration) => {
    return toastManager.show(message, 'warning', duration)
  },

  info: (message, duration) => {
    return toastManager.show(message, 'info', duration)
  }
}

