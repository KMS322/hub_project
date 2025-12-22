/**
 * 대한민국 기준 입력값 검증 유틸리티
 */

/**
 * 병원명 검증
 * - 한글, 영문, 숫자, 공백 허용
 * - 2-50자
 */
export const validateHospitalName = (name) => {
  if (!name || typeof name !== 'string') {
    return { valid: false, message: '병원명을 입력해주세요.' };
  }

  const trimmedName = name.trim();
  
  if (trimmedName.length < 2) {
    return { valid: false, message: '병원명은 최소 2자 이상이어야 합니다.' };
  }

  if (trimmedName.length > 50) {
    return { valid: false, message: '병원명은 최대 50자까지 입력 가능합니다.' };
  }

  // 한글, 영문, 숫자, 공백만 허용
  const namePattern = /^[가-힣a-zA-Z0-9\s]+$/;
  if (!namePattern.test(trimmedName)) {
    return { valid: false, message: '병원명은 한글, 영문, 숫자만 입력 가능합니다.' };
  }

  return { valid: true };
};

/**
 * 우편번호 검증
 * - 5자리 숫자 (예: 12345)
 */
export const validatePostcode = (postcode) => {
  if (!postcode || typeof postcode !== 'string') {
    return { valid: false, message: '우편번호를 입력해주세요.' };
  }

  const trimmedPostcode = postcode.trim().replace(/-/g, '');
  
  // 5자리 숫자만 허용
  const postcodePattern = /^\d{5}$/;
  if (!postcodePattern.test(trimmedPostcode)) {
    return { valid: false, message: '우편번호는 5자리 숫자로 입력해주세요. (예: 12345)' };
  }

  return { valid: true };
};

/**
 * 주소 검증
 * - 한글, 영문, 숫자, 공백, 일부 특수문자 허용
 * - 최소 5자 이상
 */
export const validateAddress = (address) => {
  if (!address || typeof address !== 'string') {
    return { valid: false, message: '주소를 입력해주세요.' };
  }

  const trimmedAddress = address.trim();
  
  if (trimmedAddress.length < 5) {
    return { valid: false, message: '주소는 최소 5자 이상이어야 합니다.' };
  }

  if (trimmedAddress.length > 200) {
    return { valid: false, message: '주소는 최대 200자까지 입력 가능합니다.' };
  }

  // 한글, 영문, 숫자, 공백, 일부 특수문자 허용 (.,- 등)
  const addressPattern = /^[가-힣a-zA-Z0-9\s.,-]+$/;
  if (!addressPattern.test(trimmedAddress)) {
    return { valid: false, message: '주소는 한글, 영문, 숫자, 공백, 일부 특수문자(.,-)만 입력 가능합니다.' };
  }

  return { valid: true };
};

/**
 * 상세주소 검증
 * - 한글, 영문, 숫자, 공백, 일부 특수문자 허용
 * - 최소 2자 이상
 */
export const validateDetailAddress = (detailAddress) => {
  if (!detailAddress || typeof detailAddress !== 'string') {
    return { valid: false, message: '상세주소를 입력해주세요.' };
  }

  const trimmedDetailAddress = detailAddress.trim();
  
  if (trimmedDetailAddress.length < 2) {
    return { valid: false, message: '상세주소는 최소 2자 이상이어야 합니다.' };
  }

  if (trimmedDetailAddress.length > 100) {
    return { valid: false, message: '상세주소는 최대 100자까지 입력 가능합니다.' };
  }

  // 한글, 영문, 숫자, 공백, 일부 특수문자 허용 (.,- 등)
  const detailAddressPattern = /^[가-힣a-zA-Z0-9\s.,-]+$/;
  if (!detailAddressPattern.test(trimmedDetailAddress)) {
    return { valid: false, message: '상세주소는 한글, 영문, 숫자, 공백, 일부 특수문자(.,-)만 입력 가능합니다.' };
  }

  return { valid: true };
};

/**
 * 전화번호 검증
 * - 대한민국 전화번호 형식
 * - 02-1234-5678, 031-123-4567, 010-1234-5678 등
 */
export const validatePhone = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, message: '전화번호를 입력해주세요.' };
  }

  const trimmedPhone = phone.trim().replace(/\s/g, '');
  
  // 하이픈 제거한 숫자만 추출
  const digitsOnly = trimmedPhone.replace(/-/g, '');
  
  // 숫자만 있는지 확인
  if (!/^\d+$/.test(digitsOnly)) {
    return { valid: false, message: '전화번호는 숫자만 입력 가능합니다.' };
  }

  // 대한민국 전화번호 형식 검증
  // 지역번호: 02, 031-033, 041-043, 051-055, 061-064
  // 휴대폰: 010, 011, 016, 017, 018, 019
  // 일반전화: 1588, 1544 등
  
  // 02-XXXX-XXXX (서울)
  if (/^02\d{8,9}$/.test(digitsOnly)) {
    return { valid: true };
  }
  
  // 0XX-XXX-XXXX (지역번호 3자리)
  if (/^0[3-6]\d{7,8}$/.test(digitsOnly)) {
    return { valid: true };
  }
  
  // 010-XXXX-XXXX (휴대폰)
  if (/^01[0-9]\d{7,8}$/.test(digitsOnly)) {
    return { valid: true };
  }
  
  // 1588, 1544 등 특수번호 (4자리)
  if (/^1[0-9]{3}$/.test(digitsOnly)) {
    return { valid: true };
  }

  return { 
    valid: false, 
    message: '올바른 전화번호 형식이 아닙니다. (예: 02-1234-5678, 031-123-4567, 010-1234-5678)' 
  };
};

/**
 * 전체 회원가입 폼 검증
 */
export const validateRegisterForm = (formData) => {
  const errors = {};

  // 병원명 검증
  const nameValidation = validateHospitalName(formData.name);
  if (!nameValidation.valid) {
    errors.name = nameValidation.message;
  }

  // 우편번호 검증
  const postcodeValidation = validatePostcode(formData.postcode);
  if (!postcodeValidation.valid) {
    errors.postcode = postcodeValidation.message;
  }

  // 주소 검증
  const addressValidation = validateAddress(formData.address);
  if (!addressValidation.valid) {
    errors.address = addressValidation.message;
  }

  // 상세주소 검증
  const detailAddressValidation = validateDetailAddress(formData.detail_address);
  if (!detailAddressValidation.valid) {
    errors.detail_address = detailAddressValidation.message;
  }

  // 전화번호 검증
  const phoneValidation = validatePhone(formData.phone);
  if (!phoneValidation.valid) {
    errors.phone = phoneValidation.message;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
};

