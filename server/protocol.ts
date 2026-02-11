import type { PacketHeader, GwInfoPayload, TagDataPayload } from './types';

// 온도 보정 룩업 테이블 (레거시 코드에서 이식)
const dLowTempComp = [57.11, 57.23, 57.34, 57.45, 57.56, 57.66, 57.75, 57.84];

/**
 * 패킷 헤더 파싱
 * byte[0] = dataType, byte[1] = direction, byte[2-3] = length (big-endian)
 */
export function parseHeader(buf: Buffer): PacketHeader {
  return {
    dataType: buf[0],
    direction: buf[1],
    length: (buf[2] << 8) | buf[3],
  };
}

/**
 * DataType 0x08 - 게이트웨이 정보 응답 파싱
 * 게이트웨이가 연결 시 보내는 자체 정보
 */
export function parseGwInfo(buf: Buffer): GwInfoPayload {
  // GW MAC: bytes 4-9 (6 bytes)
  const gwMac = Array.from(buf.subarray(4, 10))
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(':');

  // HW Version: bytes 10-16 (7 bytes, UTF-8)
  const hwVersion = buf.subarray(10, 17).toString('utf-8').replace(/\0/g, '').trim();

  // FW Version: bytes 17-23 (7 bytes, UTF-8)
  const fwVersion = buf.subarray(17, 24).toString('utf-8').replace(/\0/g, '').trim();

  // OTA Server URL
  const otaUrlLen = buf[24];
  const otaServerUrl = buf.subarray(25, 25 + otaUrlLen).toString('utf-8').replace(/\0/g, '');

  // WS Server URL
  const wsUrlOffset = 25 + otaUrlLen;
  const wsUrlLen = buf[wsUrlOffset];
  const wsServerUrl = buf.subarray(wsUrlOffset + 1, wsUrlOffset + 1 + wsUrlLen).toString('utf-8').replace(/\0/g, '');

  // Report Interval (4 bytes, little-endian)
  const riOffset = wsUrlOffset + 1 + wsUrlLen;
  const reportInterval = buf.readUInt32LE(riOffset);

  // RSSI Filter (1 byte, signed)
  const rssiFilter = buf.readInt8(riOffset + 4);

  return { gwMac, hwVersion, fwVersion, otaServerUrl, wsServerUrl, reportInterval, rssiFilter };
}

/**
 * DataType 0x0A - 태그 센싱 데이터 파싱
 * 게이트웨이가 BLE 태그에서 수신한 데이터를 전달
 */
export function parseTagData(buf: Buffer): TagDataPayload {
  // GW MAC: bytes 4-9 (6 bytes, 순방향)
  const gwMac = Array.from(buf.subarray(4, 10))
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(':');

  // Scan Tick: bytes 10-13 (4 bytes, little-endian reversed)
  const scanTickBuf = Buffer.from(buf.subarray(10, 14));
  scanTickBuf.reverse();
  const scanTick = scanTickBuf.readUInt32BE(0);

  // RSSI: byte 14 (음수값)
  const rssi = -(buf.readUInt8(14));

  // advData: bytes 15-45 (31 bytes)
  const advData = buf.subarray(15, 46);

  // TAG MAC: bytes 19-24 (6 bytes, 역순)
  const tagMac = Array.from(buf.subarray(19, 25))
    .map(b => b.toString(16).padStart(2, '0')).reverse()
    .join(':').toUpperCase();

  // 온도/전압 계산용 바이트 추출
  const ucTempOtp = advData[10];  // advData offset 10
  const ucTempBat = advData[26];  // advData offset 26
  const ucTempVal = advData[27];  // advData offset 27

  const temperature = calTemp(ucTempOtp, ucTempVal);
  const voltage = calVol(ucTempBat, temperature);

  const rawAdvData = advData.toString('hex');

  return { gwMac, tagMac, scanTick, rssi, temperature, voltage, rawAdvData };
}

/**
 * 온도 계산 (레거시 코드에서 이식)
 * OTP 보정값과 센서값으로 실제 온도 산출
 */
export function calTemp(ucTempOtp: number, ucTempVal: number): number {
  const ucOtp32p5 = (ucTempOtp & 0x1F) + 104;
  const ucOtp85to23p5 = (ucTempOtp >> 5) + 35;

  let temp: number;
  if (ucTempVal >= ucOtp32p5) {
    temp = (ucTempVal - ucOtp32p5) * ((85 - 23.5) / ucOtp85to23p5) + 23.5;
  } else {
    const tempComp = dLowTempComp[ucTempOtp >> 5] || 57.11;
    temp = (ucTempVal - ucOtp32p5) * ((85 - 23.5) / ucOtp85to23p5) * ((23.5 + 40) / tempComp) + 23.5;
  }

  return Math.round(temp * 100) / 100;
}

/**
 * 전압 계산 (레거시 코드에서 이식)
 * 배터리 ADC값과 온도로 실제 전압 산출
 */
export function calVol(ucTempBat: number, dTemp: number): number {
  let voltage: number;
  if (dTemp >= 30) {
    voltage = ((ucTempBat - (11.475 - (-3 / (85 - 30)) * (dTemp - 30))) * ((3.3 - 1.7) / (194.225 - 11.475))) + 1.7;
  } else {
    voltage = ((ucTempBat - (11.475 - (2 / (30 - (-40))) * (30 - dTemp))) * ((3.3 - 1.7) / (194.225 - 11.475))) + 1.7;
  }
  return Math.round(voltage * 100) / 100;
}

/** 게이트웨이 정보 응답 패킷 생성 */
export function buildGwInfoResponse(): Buffer {
  return Buffer.from([0x08, 0x02, 0x00, 0x01, 0x00]);
}

/** 태그 데이터 응답 패킷 생성 */
export function buildTagDataResponse(): Buffer {
  return Buffer.from([0x0A, 0x02, 0x00, 0x01, 0x00]);
}

/** 게이트웨이 정보 요청 패킷 생성 */
export function buildGwInfoRequest(): Buffer {
  return Buffer.from([0x01, 0x01]);
}

/** 패킷 유효성 검사 */
export function isValidPacket(dataType: number, direction: number): boolean {
  const validTypes = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A];
  const validDirections = [0x01, 0x02, 0x03]; // 0x03: 게이트웨이 푸시/알림
  return validTypes.includes(dataType) && validDirections.includes(direction);
}
