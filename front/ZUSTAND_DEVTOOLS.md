# Zustand with Redux DevTools

## 1. Request/Success/Failure 상태 관리

Zustand는 Redux-saga처럼 비동기 상태를 관리할 수 있습니다.

### 구현 예시

```javascript
// stores/useAuthStore.js
export const useAuthStore = create(
  devtools(
    persist(
      (set) => ({
        // 상태
        user: null,
        isAuthenticated: false,
        token: null,

        // 비동기 상태 (loading, error)
        loginStatus: 'idle', // 'idle' | 'loading' | 'success' | 'failure'
        loginError: null,
        registerStatus: 'idle',
        registerError: null,

        // 로그인
        login: async (email, password) => {
          set({ loginStatus: 'loading', loginError: null });

          try {
            const response = await fetch('/api/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password })
            });
            const data = await response.json();

            set({
              user: data.user,
              token: data.token,
              isAuthenticated: true,
              loginStatus: 'success',
              loginError: null,
            });

            return { success: true, user: data.user };
          } catch (error) {
            set({
              loginStatus: 'failure',
              loginError: error.message,
            });

            return { success: false, error: error.message };
          }
        },
      }),
      { name: "auth-storage" }
    ),
    { name: 'AuthStore' } // Redux DevTools 이름
  )
);
```

### 컴포넌트에서 사용

```javascript
function Login() {
  const { login, loginStatus, loginError } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(email, password);

    if (result.success) {
      navigate('/dashboard');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {loginError && <div className="error">{loginError}</div>}
      <button disabled={loginStatus === 'loading'}>
        {loginStatus === 'loading' ? '로그인 중...' : '로그인'}
      </button>
    </form>
  );
}
```

## 2. Redux DevTools 사용법

### 설치

Chrome 웹스토어에서 "Redux DevTools" 확장 프로그램 설치:
https://chrome.google.com/webstore/detail/redux-devtools/lmhkpmbekcpmknklioeibfkpmmfibljd

### Zustand에서 DevTools 활성화

```javascript
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export const useStore = create(
  devtools(
    persist(
      (set) => ({
        // your state here
      }),
      { name: 'local-storage-key' }
    ),
    { name: 'StoreName' } // DevTools에 표시될 이름
  )
);
```

### DevTools 기능

1. **상태 확인**: 현재 store의 모든 상태를 실시간으로 확인
2. **액션 히스토리**: 모든 상태 변경 기록을 시간순으로 확인
3. **Time Travel**: 과거 상태로 되돌리기
4. **Diff 보기**: 상태 변경 전후 비교
5. **액션 필터링**: 특정 액션만 필터링해서 보기

### 사용 방법

1. 브라우저에서 애플리케이션 실행
2. F12 (개발자 도구) 열기
3. "Redux" 탭 클릭
4. 좌측에서 Store 선택 (예: "AuthStore")
5. 우측에서 상태 확인 및 디버깅

### 액션 명명 규칙

Zustand는 자동으로 액션 이름을 생성하지만, 명시적으로 지정할 수도 있습니다:

```javascript
// 방법 1: 자동 생성 (권장)
login: async (email, password) => {
  set({ loginStatus: 'loading' }); // 액션명: "login"
}

// 방법 2: 명시적 지정
login: async (email, password) => {
  set({ loginStatus: 'loading' }, false, 'auth/login/request');
  // ...
  set({ user: data }, false, 'auth/login/success');
}
```

## 3. Redux-saga vs Zustand 비교

| 기능 | Redux-saga | Zustand |
|------|-----------|---------|
| 상태 관리 | ✅ | ✅ |
| 비동기 처리 | ✅ (saga) | ✅ (async/await) |
| DevTools | ✅ | ✅ |
| Request/Success/Failure | ✅ | ✅ (수동) |
| 보일러플레이트 | 많음 | 적음 |
| 학습 곡선 | 높음 | 낮음 |
| 번들 크기 | 큼 | 작음 |
| 복잡한 플로우 제어 | ✅✅ | ⚠️ |

## 4. 여러 Store 사용 예시

```javascript
// stores/useAuthStore.js
export const useAuthStore = create(
  devtools(/* ... */, { name: 'AuthStore' })
);

// stores/useSocketStore.js
export const useSocketStore = create(
  devtools(/* ... */, { name: 'SocketStore' })
);

// stores/useUIStore.js
export const useUIStore = create(
  devtools(/* ... */, { name: 'UIStore' })
);
```

Redux DevTools에서 각 Store를 개별적으로 확인할 수 있습니다.

## 5. 프로덕션 환경에서 DevTools 비활성화

```javascript
const isDev = process.env.NODE_ENV === 'development';

export const useAuthStore = create(
  isDev
    ? devtools(persist(/* ... */), { name: 'AuthStore' })
    : persist(/* ... */)
);
```

## 참고 자료

- Zustand 공식 문서: https://docs.pmnd.rs/zustand
- Redux DevTools 문서: https://github.com/reduxjs/redux-devtools
