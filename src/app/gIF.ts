
export enum eDlgType {
    E_ATTR_NAME,
    E_ATTR_STYLE,
    E_BINDS,
    E_STATS,
    E_SCROLLS,
    E_LOGS,
    E_UNITS,
    E_SSR,
    E_GRAPH,
    E_ABOUT
}

export enum eDlgStyle{
    E_FONT_SIZE,
}

export enum eGroup_t {
    E_GROUP_TEMPERATURE = 1,
    E_GROUP_HUMIDITY,
    E_GROUP_PRESSURE,
    E_GROUP_VOLTAGE,
    E_GROUP_AIR_QUALITY,
    E_GROUP_ON_OFF,
}
export enum eType_t {
    E_TYPE_SENSOR = 1,
    E_TYPE_ACUATOR,
    E_TYPE_SWITCH,
    E_TYPE_BATTERY
}

export enum eBattRepSize {
    E_BATT_REP_SIZE_ZERO = 0,
    E_BATT_REP_SIZE_SHORT,
    E_BATT_REP_SIZE_FULL
}

export interface routing_t {
    len: number;
    hops: number[];
}

export interface battery_t {
    rep_size: number;
    v_bat: number | undefined;
    i_bat: number | undefined;
    i_chg: number | undefined;
    i_bat_status: number | undefined;
    ntc_status: number | undefined;
    die_status: number | undefined;
    chg_status: number | undefined;
    chg_err: number | undefined;
}

export interface battEvent_t {
    addr: number;
    //endPoint: number;
    battery: battery_t;
}

export interface netItem_t {
    drag: boolean;
    isSel: boolean;
    timestamp: number;
    pos: nsPos_t;
    name: string;
    style: ngStyle_t;
    valCorr: valCorr_t;
    partNum: number;
    group: eGroup_t;
    type: eType_t;
    isValid: boolean;
    frame_rnd: number;
    addr: number;
    endPoint: number;
    hops: number[];
    formatedVal: string;
    battery: battery_t;
    timestamps: number[];
    vals: number[];
}

export interface keyVal_t {
    key: string;
    value: netItem_t;
}

export interface itemReport_t {
    partNum: number;
    addr: number;
    endPoint: number;
    hops: number[];
    data: number[];
}

export interface deviceReport_t {
    partNum: number;
    addr: number;
    hops: number[];
    data: number[];
}

export interface ep_cmd_t {
    endPoint: number;
    cmdLen: number;
    cmd: number[];
}

export interface usb_ep_cmd_t  {
    hops: number[];
    ep_cmd: ep_cmd_t;
}

export interface itemProps_t {
    valid: boolean;
    isVisible: boolean;
    group: eGroup_t;
    type: eType_t;
    hasHistory: boolean;
    formatedVal: string;
    battery: battery_t;
    units: number;
    value: number;
}

export interface epProps_t {
    frame_rnd: number;
    endPoint: number;
    valid: boolean;
    isVisible: boolean;
    group: eGroup_t;
    type: eType_t;
    hasHistory: boolean;
    formatedVal: string;
    battery: battery_t;
    units: number;
    value: number;
}

export interface nvProps_t {
    name: string;
    pos: nsPos_t;
    style: ngStyle_t;
    valCorr: valCorr_t;
}

export interface nsPos_t {
    x: number;
    y: number;
}
export interface ngStyle_t {
    color: string;
    bgColor: string;
    bgOpacity: number;
    fontSize: number;
    borderWidth: number;
    borderStyle: string;
    borderColor: string;
    borderRadius: number;
    paddingTop: number;
    paddingRight: number;
    paddingBottom: number;
    paddingLeft: number;
}
export interface valCorr_t{
    units: number;
    offset: number;
}

export interface descVal_t {
    key: string;
    value: string;
}

export  interface partDesc_t {
    partNum: number;
    devName: string;
    part: string;
    url: string;
}

export  interface part_t {
    devName: string;
    part: string;
    url: string;
}

export interface scroll_t {
    name: string;
    yPos: number;
}

export interface usbId_t {
    pid: number;
    vid: number;
}

/*
export interface udpCmd_t {
    seqNum: number;
    ttl: number;
    cmdID: number;
    hostShortAddr: number;
    ip: string;
    port: number;
}
*/
export interface imgDim_t {
    width: number;
    height: number;
}

export interface thermostatActuator_t {
    name: string;
    addr: number;
    endPoint: number;
}

export interface thermostat_t {
    name: string;
    partNum: number;
    setPoint: number;
    prevSetPoint: number;
    workPoint: number;
    hysteresis: number;
    addr: number;
    endPoint: number;
    actuators: thermostatActuator_t[];
}

export interface on_off_actuator_t {
    valid: boolean
    name: string;
    partNum: number;
    addr: number;
    endPoint: number;
}

export interface tempEvent_t {
    temp: number;
    addr: number;
    endPoint: number;
}

export interface pbEvent_t {
    trig: number;
    addr: number;
    endPoint: number;
}

export interface msgLogs_t {
    text: string;
    color: string;
    id: number;
}

export interface nameDlgData_t {
    type: eDlgType;
    name: string;
}

export interface nameDlgReturn_t {
    status: number;
    name: string;
}

export interface units_t {
    name: string;
    units: number;
}

export class rwBuf_t {

    rdIdx!: number;
    wrIdx!: number;

    rdBuf!: DataView;
    wrBuf!: DataView;

    constructor(){

    }

    read_uint8(){
        const val = this.rdBuf.getUint8(this.rdIdx);
        this.rdIdx += 1;
        return val;
    }

    read_uint16_LE(){
        const val = this.rdBuf.getUint16(this.rdIdx, true);
        this.rdIdx += 2;
        return val;
    }

    read_int16_LE(){
        const val = this.rdBuf.getInt16(this.rdIdx, true);
        this.rdIdx += 2;
        return val;
    }

    read_uint32_LE(){
        const val = this.rdBuf.getUint32(this.rdIdx, true);
        this.rdIdx += 4;
        return val;
    }

    read_uint64_LE(){
        const val = this.rdBuf.getFloat64(this.rdIdx, true);
        this.rdIdx += 8;
        return val;
    }

    write_uint8(val: number){
        this.wrBuf.setUint8(this.wrIdx, val);
        this.wrIdx += 1;
    }

    modify_uint8(val: number, idx: number){
        this.wrBuf.setUint8(idx, val);
    }

    write_uint16_LE(val: number){
        this.wrBuf.setUint16(this.wrIdx, val, true);
        this.wrIdx += 2;
    }

    write_int16_LE(val: number){
        this.wrBuf.setInt16(this.wrIdx, val, true);
        this.wrIdx += 2;
    }

    modify_uint16_LE(val: number, idx: number){
        this.wrBuf.setUint16(idx, val, true);

    }

    write_uint32_LE(val: number){
        this.wrBuf.setUint32(this.wrIdx, val, true);
        this.wrIdx += 4;
    }

    write_uint64_LE(val: number){
        this.wrBuf.setFloat64(this.wrIdx, val, true);
        this.wrIdx += 8;
    }
}

