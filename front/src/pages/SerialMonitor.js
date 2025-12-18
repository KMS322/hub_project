// src/components/SerialMonitor.jsx
import React, { useEffect, useRef, useState } from 'react';

const BAUD_RATE = 115200; // ESP32-S3에서 쓰는 시리얼 속도에 맞게 변경

export default function SerialMonitor() {
  const [port, setPort] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [outgoing, setOutgoing] = useState('');

  const readerRef = useRef(null);
  const writerRef = useRef(null);
  const decoderStreamRef = useRef(null);

  const isSerialSupported = typeof navigator !== 'undefined' && navigator.serial;

  const appendLog = (line) => {
    setLogs((prev) => {
      const next = [...prev, line];
      if (next.length > 200) {
        return next.slice(next.length - 200);
      }
      return next;
    });
  };

  const connect = async () => {
    if (!isSerialSupported) {
      alert('이 브라우저는 Web Serial API를 지원하지 않습니다. (Chrome/Edge 권장)');
      return;
    }

    try {
      setIsConnecting(true);

      // 포트 선택
      const selectedPort = await navigator.serial.requestPort();
      await selectedPort.open({ baudRate: BAUD_RATE });

      setPort(selectedPort);
      appendLog(`✅ 포트 연결 완료 (baud: ${BAUD_RATE})`);

      // 디코더 스트림 생성 (바이트 → 문자열)
      const decoderStream = new TextDecoderStream();
      decoderStreamRef.current = decoderStream;

      const readable = selectedPort.readable;
      if (!readable) {
        appendLog('⚠️ 이 포트는 readable 스트림이 없습니다.');
        return;
      }

      // 시리얼 스트림을 디코더에 파이프
      readable.pipeTo(decoderStream.writable).catch((error) => {
        console.error('Readable pipe closed with error:', error);
      });

      const reader = decoderStream.readable.getReader();
      readerRef.current = reader;
      setIsReading(true);

      // 쓰기용 writer
      const writable = selectedPort.writable;
      if (writable) {
        const writer = writable.getWriter();
        writerRef.current = writer;
      }

      // 읽기 루프
      (async () => {
        try {
          let buffer = '';

          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            if (value !== undefined) {
              buffer += value;
              const lines = buffer.split(/\r?\n/);
              buffer = lines.pop() || '';

              lines.forEach((line) => {
                if (line.trim().length > 0) {
                  appendLog(line);
                }
              });
            }
          }
        } catch (error) {
          console.error('읽기 중 오류:', error);
          appendLog(`❌ 읽기 오류: ${error.message}`);
        } finally {
          setIsReading(false);
          try {
            reader.releaseLock();
          } catch (e) {}
        }
      })();
    } catch (error) {
      console.error(error);
      appendLog(`❌ 연결 실패: ${error.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      if (readerRef.current) {
        try {
          await readerRef.current.cancel();
        } catch (e) {}
        try {
          readerRef.current.releaseLock();
        } catch (e) {}
        readerRef.current = null;
      }

      if (writerRef.current) {
        try {
          await writerRef.current.close();
        } catch (e) {}
        try {
          writerRef.current.releaseLock();
        } catch (e) {}
        writerRef.current = null;
      }

      if (decoderStreamRef.current) {
        decoderStreamRef.current = null;
      }

      if (port) {
        await port.close();
      }

      setPort(null);
      setIsReading(false);
      appendLog('🔌 포트 연결 해제');
    } catch (error) {
      console.error(error);
      appendLog(`❌ 연결 해제 중 오류: ${error.message}`);
    }
  };

  const sendData = async () => {
    if (!writerRef.current) {
      appendLog('⚠️ 포트가 열려있지 않습니다.');
      return;
    }

    if (!outgoing.trim()) return;

    const encoder = new TextEncoder();
    const data = encoder.encode(outgoing + '\n');

    try {
      await writerRef.current.write(data);
      appendLog(`➡️ SEND: ${outgoing}`);
      setOutgoing('');
    } catch (error) {
      console.error(error);
      appendLog(`❌ 전송 실패: ${error.message}`);
    }
  };

  useEffect(() => {
    return () => {
      // 언마운트 시 정리
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '1.5rem',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>
        ESP32-S3 USB 시리얼 모니터
      </h1>

      {!isSerialSupported && (
        <p style={{ color: '#e11d48', marginBottom: '1rem' }}>
          이 브라우저는 Web Serial API를 지원하지 않습니다. Chrome 또는 Edge 최신 버전을 사용해주세요.
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={connect}
          disabled={!isSerialSupported || port !== null || isConnecting}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            cursor:
              port === null && !isConnecting && isSerialSupported
                ? 'pointer'
                : 'not-allowed',
          }}
        >
          {isConnecting ? '연결 중...' : '포트 연결'}
        </button>

        <button
          type="button"
          onClick={disconnect}
          disabled={port === null}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: port !== null ? 'pointer' : 'not-allowed',
          }}
        >
          연결 해제
        </button>

        <span style={{ alignSelf: 'center', fontSize: '0.875rem' }}>
          상태:{' '}
          {port === null
            ? '🔴 미연결'
            : isReading
            ? '🟢 수신 중'
            : '🟡 연결됨 (수신 중 아님)'}
        </span>
      </div>

      {/* 전송 박스 */}
      <div style={{ marginBottom: '1rem' }}>
        <label
          htmlFor="outgoing"
          style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}
        >
          ESP32로 전송할 데이터
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            id="outgoing"
            value={outgoing}
            onChange={(event) => setOutgoing(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                sendData();
              }
            }}
            style={{
              flex: 1,
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid #d4d4d8',
            }}
          />
          <button
            type="button"
            onClick={sendData}
            disabled={port === null}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: port !== null ? 'pointer' : 'not-allowed',
            }}
          >
            전송
          </button>
        </div>
      </div>

      {/* 로그 뷰어 */}
      <div>
        <div
          style={{
            marginBottom: '0.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.875rem',
          }}
        >
          <span>수신 로그 ({logs.length}줄)</span>
          <button
            type="button"
            onClick={() => setLogs([])}
            style={{
              border: 'none',
              background: 'transparent',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            로그 초기화
          </button>
        </div>

        <div
          style={{
            height: '320px',
            borderRadius: '0.5rem',
            border: '1px solid #e4e4e7',
            padding: '0.5rem',
            overflowY: 'auto',
            backgroundColor: '#020617',
            color: '#e5e7eb',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: '0.8rem',
            lineHeight: 1.4,
          }}
        >
          {logs.length === 0 ? (
            <div style={{ opacity: 0.6 }}>아직 수신된 데이터가 없습니다.</div>
          ) : (
            logs.map((line, index) => (
              <div key={`${index}-${line.slice(0, 10)}`}>{line}</div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
