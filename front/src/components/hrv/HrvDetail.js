import React, { useState, useEffect, useMemo } from 'react'
import BasicHrvMetrics from './BasicHrvMetrics'
import FrequencyDomainAnalysis from './FrequencyDomainAnalysis'
import PoincareMetrics from './PoincareMetrics'
import ComplexityAnalysis from './ComplexityAnalysis'
import StressAnalysis from './StressAnalysis'
import RrIntervalChart from './RrIntervalChart'
import PoincarePlot from './PoincarePlot'

const HrvDetail = ({ irData }) => {
  const [hrvData, setHrvData] = useState([])
  const [poincareData, setPoincareData] = useState([])
  const [hrvMetrics, setHrvMetrics] = useState(null)

  // 통계 함수들
  const mean = (arr) => {
    if (!arr || arr.length === 0) return 0
    return arr.reduce((a, b) => a + b, 0) / arr.length
  }

  const std = (arr) => {
    if (!arr || arr.length === 0) return 0
    const mu = mean(arr)
    return Math.sqrt(
      arr.map((x) => Math.pow(x - mu, 2)).reduce((a, b) => a + b, 0) / arr.length
    )
  }

  // 피크 검출 함수 (최적화)
  const detectPeaks = useMemo(() => {
    return (signal, fs = 100) => {
      if (!signal || signal.length < 3) return []
      
      let peaks = []
      let minDistance = Math.floor(fs * 0.4) // 최소 0.4초 간격
      
      const signalMean = mean(signal)
      const signalStd = std(signal)
      let threshold = signalMean + 0.5 * signalStd
      
      // 슬라이딩 윈도우로 피크 검출
      for (let i = 1; i < signal.length - 1; i++) {
        if (
          signal[i] > threshold &&
          signal[i] > signal[i - 1] &&
          signal[i] > signal[i + 1]
        ) {
          if (peaks.length === 0 || i - peaks[peaks.length - 1] > minDistance) {
            peaks.push(i)
          }
        }
      }
      
      // 피크가 너무 적으면 임계값을 낮춰서 재시도
      if (peaks.length < 10) {
        threshold = signalMean + 0.2 * signalStd
        peaks = []
        
        for (let i = 1; i < signal.length - 1; i++) {
          if (
            signal[i] > threshold &&
            signal[i] > signal[i - 1] &&
            signal[i] > signal[i + 1]
          ) {
            if (peaks.length === 0 || i - peaks[peaks.length - 1] > minDistance) {
              peaks.push(i)
            }
          }
        }
      }
      
      return peaks
    }
  }, [])

  // RR 간격 계산
  const computeRR = useMemo(() => {
    return (peaks, fs = 100) => {
      if (!peaks || peaks.length < 2) return []
      
      let rr = []
      for (let i = 1; i < peaks.length; i++) {
        let interval = (peaks[i] - peaks[i - 1]) * (1000 / fs) // ms 단위
        if (interval > 300 && interval < 2000) {
          rr.push(interval)
        }
      }
      
      if (rr.length < 5) {
        rr = []
        for (let i = 1; i < peaks.length; i++) {
          let interval = (peaks[i] - peaks[i - 1]) * (1000 / fs)
          if (interval > 200 && interval < 3000) {
            rr.push(interval)
          }
        }
      }
      
      return rr
    }
  }, [])

  // HRV 계산
  const computeHRV = useMemo(() => {
    return (rr) => {
      if (!rr || rr.length < 2) return null
      
      const meanRR = mean(rr)
      const bpm = 60000 / meanRR
      const sdnn = Math.sqrt(
        rr.map((x) => Math.pow(x - meanRR, 2)).reduce((a, b) => a + b, 0) /
          (rr.length - 1)
      )
      const diff = rr.slice(1).map((x, i) => x - rr[i])
      const rmssd = Math.sqrt(
        diff.map((x) => x * x).reduce((a, b) => a + b, 0) / diff.length
      )
      const pnn50 = (diff.filter(d => Math.abs(d) > 50).length / diff.length) * 100

      const { lf, hf, lfHfRatio } = computeFrequencyDomain(rr)
      const { sd1, sd2, ellipseArea } = computePoincare(rr)
      const sampleEntropy = computeSampleEntropy(rr)

      return { 
        meanRR, 
        bpm, 
        sdnn, 
        rmssd, 
        pnn50, 
        lf, 
        hf, 
        lfHfRatio,
        sd1,
        sd2,
        ellipseArea,
        sampleEntropy
      }
    }
  }, [])

  // 주파수 도메인 분석
  const computeFrequencyDomain = (rr) => {
    if (rr.length < 10) return { lf: 0, hf: 0, lfHfRatio: 0 }
    
    const fs = 4 // 4Hz로 리샘플링
    const duration = rr.reduce((sum, interval) => sum + interval, 0) / 1000
    const timePoints = Math.floor(duration * fs)
    const resampledRR = new Array(timePoints).fill(0)
    
    let currentTime = 0
    let rrIndex = 0
    
    for (let i = 0; i < timePoints; i++) {
      const targetTime = i / fs
      while (rrIndex < rr.length && currentTime < targetTime) {
        currentTime += rr[rrIndex] / 1000
        rrIndex++
      }
      if (rrIndex > 0) {
        resampledRR[i] = rr[rrIndex - 1]
      }
    }
    
    const fft = simpleFFT(resampledRR)
    const freqs = fft.map((_, i) => i * fs / resampledRR.length)
    
    const lfPower = freqs
      .map((freq, i) => freq >= 0.04 && freq <= 0.15 ? Math.abs(fft[i]) ** 2 : 0)
      .reduce((sum, power) => sum + power, 0)
    
    const hfPower = freqs
      .map((freq, i) => freq >= 0.15 && freq <= 0.4 ? Math.abs(fft[i]) ** 2 : 0)
      .reduce((sum, power) => sum + power, 0)
    
    const lfHfRatio = hfPower > 0 ? lfPower / hfPower : 0
    
    return { lf: lfPower, hf: hfPower, lfHfRatio }
  }

  // 간단한 FFT 구현
  const simpleFFT = (signal) => {
    const N = signal.length
    const fft = new Array(N).fill(0).map(() => ({ real: 0, imag: 0 }))
    
    for (let k = 0; k < N; k++) {
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N
        fft[k].real += signal[n] * Math.cos(angle)
        fft[k].imag += signal[n] * Math.sin(angle)
      }
    }
    
    return fft.map(complex => Math.sqrt(complex.real ** 2 + complex.imag ** 2))
  }

  // Poincare plot 지표 계산
  const computePoincare = (rr) => {
    if (rr.length < 2) return { sd1: 0, sd2: 0, ellipseArea: 0 }
    
    const rr1 = rr.slice(0, -1)
    const rr2 = rr.slice(1)
    
    const diff = rr2.map((r2, i) => r2 - rr1[i])
    const sum = rr2.map((r2, i) => r2 + rr1[i])
    
    const sd1 = std(diff) / Math.sqrt(2)
    const sd2 = std(sum) / Math.sqrt(2)
    const ellipseArea = Math.PI * sd1 * sd2
    
    return { sd1, sd2, ellipseArea }
  }

  // Sample Entropy 계산
  const computeSampleEntropy = (rr, m = 2, r = 0.2) => {
    if (rr.length < m + 1) return 0
    
    const N = rr.length
    const stdRR = std(rr)
    const tolerance = r * stdRR
    
    const countMatches = (m) => {
      let matches = 0
      for (let i = 0; i < N - m; i++) {
        for (let j = i + 1; j < N - m; j++) {
          let match = true
          for (let k = 0; k < m; k++) {
            if (Math.abs(rr[i + k] - rr[j + k]) > tolerance) {
              match = false
              break
            }
          }
          if (match) matches++
        }
      }
      return matches
    }
    
    const phiM = countMatches(m)
    const phiM1 = countMatches(m + 1)
    
    if (phiM === 0) return 0
    
    return -Math.log(phiM1 / phiM)
  }

  // IR 데이터가 변경될 때마다 HRV 계산 (최적화)
  useEffect(() => {
    if (irData && irData.length > 0) {
      // IR 신호 추출
      const irSignal = irData.map(d => d.ir).filter(ir => ir !== null && ir !== undefined && ir > 0)
      
      if (irSignal.length < 10) {
        setHrvData([])
        setHrvMetrics(null)
        setPoincareData([])
        return
      }
      
      // 피크 검출
      const peaks = detectPeaks(irSignal, 100)
      
      if (peaks.length < 2) {
        setHrvData([])
        setHrvMetrics(null)
        setPoincareData([])
        return
      }
      
      // RR 간격 계산
      const rr = computeRR(peaks, 100)
      
      if (rr.length < 2) {
        setHrvData([])
        setHrvMetrics(null)
        setPoincareData([])
        return
      }
      
      // HRV 지표 계산
      const hrv = computeHRV(rr)
      
      if (!hrv) {
        setHrvData([])
        setHrvMetrics(null)
        setPoincareData([])
        return
      }
      
      setHrvData(rr.map((v, i) => ({ index: i + 1, rr: v })))
      setHrvMetrics(hrv)
      
      // Poincare plot 데이터 생성
      const poincarePoints = rr.slice(0, -1).map((rr1, i) => ({
        x: rr1,
        y: rr[i + 1]
      }))
      setPoincareData(poincarePoints)
    } else {
      setHrvData([])
      setHrvMetrics(null)
      setPoincareData([])
    }
  }, [irData, detectPeaks, computeRR, computeHRV])

  if (!irData || irData.length === 0) {
    return null
  }

  return (
    <div className="hrv-section">
      <h2>HRV (심박변이도) 분석</h2>
      
      {hrvData.length > 0 && (
        <>
          <RrIntervalChart hrvData={hrvData} />
          <BasicHrvMetrics metrics={hrvMetrics} />
          <FrequencyDomainAnalysis metrics={hrvMetrics} />
          <PoincareMetrics metrics={hrvMetrics} />
          <ComplexityAnalysis metrics={hrvMetrics} />
          <StressAnalysis metrics={hrvMetrics} hrvData={hrvData} />
          <PoincarePlot poincareData={poincareData} />
        </>
      )}
      
      {hrvData.length === 0 && irData.length > 0 && (
        <div className="no-hrv-data">
          <p>HRV 분석을 위한 충분한 데이터가 없습니다. (최소 10개 이상의 유효한 IR 데이터 포인트 필요)</p>
        </div>
      )}
    </div>
  )
}

export default HrvDetail

