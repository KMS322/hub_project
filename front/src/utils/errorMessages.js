/**
 * Map server error codes to user-friendly messages.
 * Unknown codes fall back to generic message.
 */

const ERROR_MESSAGES = {
  'error-0-01': '서버와 MQTT 연결이 끊어졌습니다.',
  'error-0-02': '전송 데이터 크기가 제한을 초과했습니다.',
  'error-0-03': '데이터 형식이 올바르지 않습니다.',
  'error-0-05': '연결 시간이 초과되었습니다.',
  'error-0-06': '잘못된 데이터 형식입니다.',
  'error-0-10': '서버 처리 대기열이 가득 찼습니다. 잠시 후 다시 시도해 주세요.',
  'error-1-04': '인증에 실패했습니다. 다시 로그인해 주세요.',
  'error-1-05': '요청 시간이 초과되었습니다.',
  'error-1-08': '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
  'error-1-09': '데이터 처리 중 오류가 발생했습니다.',
  'error-2-02': '데이터 크기가 너무 커서 전송되지 않았습니다.',
  'error-2-04': '인증에 실패했습니다. 다시 로그인해 주세요.',
  'error-2-07': '필수 항목이 누락되었습니다.',
  'error-2-08': '명령 처리 중 오류가 발생했습니다.',
  'error-2-12': '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  'error-3-01': 'USB 연결에 실패했습니다.',
};

/**
 * @param {string} code - e.g. "error-2-02"
 * @returns {string} User-friendly message
 */
export function getErrorMessage(code) {
  if (!code || typeof code !== 'string') return '오류가 발생했습니다.';
  return ERROR_MESSAGES[code] || '오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
}

export default getErrorMessage;
