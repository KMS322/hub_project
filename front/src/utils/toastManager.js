// 전역 Toast 관리자
let toastListeners = []

export const toastManager = {
  subscribe: (listener) => {
    toastListeners.push(listener)
    return () => {
      toastListeners = toastListeners.filter(l => l !== listener)
    }
  },

  show: (message, type = 'info', duration = 3000, onClick = null) => {
    const id = Date.now() + Math.random()
    toastListeners.forEach(listener => {
      listener({ id, message, type, duration, onClick })
    })
    return id
  },

  success: (message, duration, onClick) => {
    return toastManager.show(message, 'success', duration, onClick)
  },

  error: (message, duration, onClick) => {
    return toastManager.show(message, 'error', duration, onClick)
  },

  warning: (message, duration, onClick) => {
    return toastManager.show(message, 'warning', duration, onClick)
  },

  info: (message, duration, onClick) => {
    return toastManager.show(message, 'info', duration, onClick)
  }
}

