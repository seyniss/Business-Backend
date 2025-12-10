const axios = require('axios');

const KAKAO_MAP_API_KEY = process.env.KAKAO_MAP_API_KEY;
const KAKAO_GEOCODING_URL = 'https://dapi.kakao.com/v2/local/search/address.json';
if (process.env.NODE_ENV !== 'production') {
  console.log('🔍 KAKAO_MAP_API_KEY 로드 상태:', KAKAO_MAP_API_KEY ? `설정됨 (길이: ${KAKAO_MAP_API_KEY.length})` : '❌ 설정되지 않음');
  if (KAKAO_MAP_API_KEY) {
    console.log('🔍 API 키 앞 10자리:', KAKAO_MAP_API_KEY.substring(0, 10) + '...');
  }
}
// API 키 검증 (시작 시 한 번만 확인)
const isApiKeyAvailable = () => {
  return KAKAO_MAP_API_KEY && KAKAO_MAP_API_KEY.trim().length > 0;
};

// API 키가 없을 때 경고 메시지 출력 (한 번만)
let apiKeyWarningShown = false;
const showApiKeyWarning = () => {
  if (!apiKeyWarningShown && !isApiKeyAvailable()) {
    console.warn('⚠️  KAKAO_MAP_API_KEY 환경 변수가 설정되지 않았습니다.');
    console.warn('   주소 좌표 변환 기능이 비활성화됩니다.');
    console.warn('   .env 파일에 KAKAO_MAP_API_KEY를 추가하거나 환경 변수를 설정해주세요.');
    apiKeyWarningShown = true;
  }
};

/**
 * 카카오맵 Geocoding API를 사용하여 주소를 좌표로 변환
 * @param {string} address - 변환할 주소
 * @returns {Promise<{lat: number, lng: number}>} 좌표 객체
 * @throws {Error} API 호출 실패 또는 주소를 찾을 수 없을 때
 */
const addressToCoordinates = async (address) => {
  if (!isApiKeyAvailable()) {
    showApiKeyWarning();
    throw new Error('KAKAO_MAP_API_KEY 환경 변수가 설정되지 않았습니다.');
  }

  if (!address || typeof address !== 'string' || address.trim().length === 0) {
    throw new Error('주소가 유효하지 않습니다.');
  }

  try {
    const response = await axios.get(KAKAO_GEOCODING_URL, {
      headers: {
        'Authorization': `KakaoAK ${KAKAO_MAP_API_KEY}`
      },
      params: {
        query: address.trim()
      },
      timeout: 5000 // 5초 타임아웃
    });

    if (!response.data || !response.data.documents || response.data.documents.length === 0) {
      throw new Error(`주소를 찾을 수 없습니다: ${address}`);
    }

    // 첫 번째 결과 사용
    const firstResult = response.data.documents[0];
    const lat = parseFloat(firstResult.y); // 카카오맵 API는 y가 위도
    const lng = parseFloat(firstResult.x); // 카카오맵 API는 x가 경도

    if (isNaN(lat) || isNaN(lng)) {
      throw new Error('좌표 변환에 실패했습니다.');
    }

    return { lat, lng };
  } catch (error) {
    if (error.response) {
      // API 응답 에러
      const status = error.response.status;
      const message = error.response.data?.message || '카카오맵 API 호출에 실패했습니다.';
      
      if (status === 401) {
        throw new Error('카카오맵 API 키가 유효하지 않습니다.');
      } else if (status === 429) {
        throw new Error('카카오맵 API 호출 한도를 초과했습니다.');
      } else {
        throw new Error(`카카오맵 API 오류 (${status}): ${message}`);
      }
    } else if (error.request) {
      // 요청은 보냈지만 응답을 받지 못함
      throw new Error('카카오맵 API 서버에 연결할 수 없습니다.');
    } else {
      // 에러 메시지가 이미 설정된 경우 그대로 사용
      throw error;
    }
  }
};

module.exports = {
  addressToCoordinates,
  isApiKeyAvailable
};

