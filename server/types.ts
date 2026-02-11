export interface GwInfoPayload {
  gwMac: string;
  hwVersion: string;
  fwVersion: string;
  otaServerUrl: string;
  wsServerUrl: string;
  reportInterval: number;
  rssiFilter: number;
}

export interface TagDataPayload {
  gwMac: string;
  tagMac: string;
  scanTick: number;
  rssi: number;
  temperature: number;
  voltage: number;
  rawAdvData: string;
}

export interface PacketHeader {
  dataType: number;
  direction: number;
  length: number;
}

export interface ClientInfo {
  ip: string;
  port: number;
}
